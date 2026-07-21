"""Quality gates — 'CI for documents' (P4 / M5).

Two execution routes, per the pricing principle (credits only where DocForge
pays tokens):
- server-run: DocForge calls the audit AI — consumes QUALITY_GATE_COST credits;
- agent-run: the user's agent audits with its own model and submits findings
  here for free (the docforge://recipes/quality-gate recipe explains how).

Findings feed the same AuditFinding badge/panel, and — when the document opts
in via require_gate_on_accept — block suggestion acceptance until open
high-severity findings are resolved or dismissed.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import AuditFinding, Document, Section
from app.models.user import User
from app.schemas.audit import AuditFindingResponse
from app.schemas.sse import SSEEvent
from app.services import db as db_service
from app.services import sse as sse_service
from app.services.observability import capture_event

router = APIRouter(tags=["quality-gate"])

VALID_SEVERITIES = {"high", "low"}


class GateFindingsRequest(BaseModel):
    findings: list[dict] = Field(max_length=50)


async def _get_owned_document(
    document_id: uuid.UUID, current_user: User, db: AsyncSession
) -> Document:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


async def _replace_open_findings(
    db: AsyncSession, doc_id: uuid.UUID, findings: list[dict]
) -> list[AuditFinding]:
    """A gate run reports current state: open findings are replaced, dismissed
    ones stay dismissed (the human's judgement is not overwritten)."""
    await db.execute(
        delete(AuditFinding).where(
            AuditFinding.document_id == doc_id, AuditFinding.dismissed.is_(False)
        )
    )
    rows = []
    for f in findings:
        row = AuditFinding(
            document_id=doc_id,
            section_type=f["section_type"],
            description=f["description"],
            severity=f["severity"],
        )
        db.add(row)
        rows.append(row)
    await db.commit()
    sse_service.publish(str(doc_id), SSEEvent(
        type="audit_results",
        payload={"doc_id": str(doc_id), "has_problems": bool(rows), "count": len(rows)},
    ))
    return rows


def _validate_findings(findings: list, section_keys: set[str]) -> list[dict]:
    cleaned = []
    for f in findings:
        if not isinstance(f, dict):
            raise HTTPException(status_code=422, detail="Each finding must be an object.")
        st = str(f.get("section_type") or "").strip()
        desc = str(f.get("description") or "").strip()
        sev = str(f.get("severity") or "").strip().lower()
        if st not in section_keys:
            raise HTTPException(
                status_code=422, detail=f"Finding references unknown section: {st!r}."
            )
        if not desc:
            raise HTTPException(status_code=422, detail="Finding description must not be empty.")
        if sev not in VALID_SEVERITIES:
            raise HTTPException(
                status_code=422, detail=f"Severity must be one of {sorted(VALID_SEVERITIES)}."
            )
        cleaned.append({"section_type": st, "description": desc[:2000], "severity": sev})
    return cleaned


@router.post("/documents/{document_id}/quality-gate/run", response_model=list[AuditFindingResponse])
async def run_quality_gate(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Server-run gate: DocForge audits the document with AI. Consumes credits."""
    doc = await _get_owned_document(document_id, current_user, db)

    cost = settings.QUALITY_GATE_COST
    result = await db.execute(
        update(User)
        .where(User.id == current_user.id, User.credits >= cost)
        .values(credits=User.credits - cost)
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="No credits remaining for a server-run gate. "
            "Your agent can run the gate for free — see docforge://recipes/quality-gate.",
        )
    await db.commit()

    from app.phases.audit.ai import run_audit

    try:
        audit_result = await run_audit(
            str(document_id),
            document_type_id=str(doc.document_type_id) if doc.document_type_id else None,
            posthog_distinct_id=str(current_user.id),
        )
    except Exception as e:
        logger.error("[quality-gate] server run failed | doc_id={} err={}", document_id, e)
        # Refund — the user paid for a result they didn't get
        await db.execute(
            update(User).where(User.id == current_user.id).values(credits=User.credits + cost)
        )
        await db.commit()
        raise HTTPException(status_code=502, detail="Audit run failed; credit refunded.")

    problems = audit_result.get("problems", []) if audit_result.get("has_problems") else []
    findings = [
        {
            "section_type": p.get("section"),
            "description": p.get("issue"),
            "severity": p.get("severity", "low"),
        }
        for p in problems
        if p.get("section") and p.get("issue")
    ]
    await db_service.log_activity(
        db, document_id, "quality_gate_run",
        description=f"Server-run quality gate: {len(findings)} finding(s)",
    )
    rows = await _replace_open_findings(db, document_id, findings)
    capture_event(str(current_user.id), str(document_id), "quality_gate_run", {
        "route": "server", "findings": len(rows),
    })
    return [AuditFindingResponse.model_validate(r) for r in rows]


@router.post("/documents/{document_id}/quality-gate/findings", response_model=list[AuditFindingResponse])
async def submit_quality_findings(
    request: Request,
    document_id: uuid.UUID,
    payload: GateFindingsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Agent-run gate: the user's agent audited the document and reports findings.

    Free of charge (BYOA incentive). An empty list asserts the document passed.
    """
    await _get_owned_document(document_id, current_user, db)

    sections_result = await db.execute(
        select(Section).where(Section.document_id == document_id)
    )
    section_keys = {s.section_type for s in sections_result.scalars().all()}
    cleaned = _validate_findings(payload.findings, section_keys)

    api_key_id = getattr(request.state, "api_key_id", None)
    await db_service.log_activity(
        db, document_id, "quality_gate_run",
        description=f"Agent-run quality gate: {len(cleaned)} finding(s)",
        api_key_id=api_key_id,
    )
    rows = await _replace_open_findings(db, document_id, cleaned)
    capture_event(str(current_user.id), str(document_id), "quality_gate_run", {
        "route": "agent", "findings": len(rows),
    })
    return [AuditFindingResponse.model_validate(r) for r in rows]


async def open_high_findings(db: AsyncSession, document_id: uuid.UUID) -> int:
    """Count of open (non-dismissed) high-severity findings — the gate condition."""
    result = await db.execute(
        select(AuditFinding).where(
            AuditFinding.document_id == document_id,
            AuditFinding.dismissed.is_(False),
            AuditFinding.severity == "high",
        )
    )
    return len(result.scalars().all())


@router.get("/documents/{document_id}/quality-gate", response_model=None)
async def get_gate_status(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await _get_owned_document(document_id, current_user, db)
    findings = await db_service.get_audit_findings(db, document_id)
    high = sum(1 for f in findings if f.severity == "high")
    return {
        "require_gate_on_accept": doc.require_gate_on_accept,
        "open_findings": len(findings),
        "open_high_findings": high,
        "blocking": doc.require_gate_on_accept and high > 0,
        "findings": [AuditFindingResponse.model_validate(f).model_dump(mode="json") for f in findings],
    }


@router.get("/documents/{document_id}/sections-for-gate")
async def get_sections_for_gate(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full section contents in one call — what an agent needs to run the gate itself."""
    await _get_owned_document(document_id, current_user, db)
    result = await db.execute(
        select(Section)
        .options(selectinload(Section.versions))
        .where(Section.document_id == document_id)
    )
    sections = {}
    for s in result.scalars().all():
        active = next((v for v in s.versions if v.is_active), None)
        sections[s.section_type] = active.content if active else ""
    return {"sections": sections}
