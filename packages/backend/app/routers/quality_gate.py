"""Quality gates — 'CI for documents'.

The person's agent audits the document with its own model and submits findings
here (the docforge://recipes/quality-gate recipe explains how); DocForge never
calls a model itself. Findings feed the gate panel and — when the document opts
in via require_gate_on_accept — block suggestion acceptance and publishing until
open high-severity findings are resolved or dismissed.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models import AuditFinding, Document, Section
from app.models.user import User
from app.schemas.audit import AuditFindingResponse
from app.schemas.sse import SSEEvent
from app.services import access
from app.services import db as db_service
from app.services import sse as sse_service
from app.services.observability import capture_event

router = APIRouter(tags=["quality-gate"])

VALID_SEVERITIES = {"high", "low"}


class GateFindingsRequest(BaseModel):
    findings: list[dict] = Field(max_length=50)


async def _get_owned_document(
    document_id: uuid.UUID, current_user: User, db: AsyncSession, capability: access.Capability = "read"
) -> Document:
    return await access.require(db, document_id, current_user, capability)


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
            # Optional: lets the browser underline the exact phrase in the text
            # instead of only naming the section.
            quote=f.get("quote"),
            category=f.get("category"),
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
        quote = (f.get("quote") or "").strip() or None
        category = (f.get("category") or "").strip() or None
        cleaned.append({
            "section_type": st,
            "description": desc[:2000],
            "severity": sev,
            "quote": quote[:1000] if quote else None,
            "category": category[:40] if category else None,
        })
    return cleaned


@router.post("/documents/{document_id}/quality-gate/findings", response_model=list[AuditFindingResponse])
async def submit_quality_findings(
    request: Request,
    document_id: uuid.UUID,
    payload: GateFindingsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Agent-run gate: the user's agent audited the document and reports findings.

    Free of charge. An empty list asserts the document passed.
    """
    await _get_owned_document(document_id, current_user, db, "write")

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
