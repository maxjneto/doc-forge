import json
import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.ai.core import (
    build_context_report,
    get_system_prompt,
    log_usage,
    truncate_section,
)
from app.database import async_session
from app.guardrails import call_with_retry
from app.models import Section

AUDIT_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "audit_result",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "has_problems": {"type": "boolean"},
                "problems": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "section": {"type": "string"},
                            "issue": {"type": "string"},
                            "severity": {"type": "string", "enum": ["high", "low"]},
                        },
                        "required": ["section", "issue", "severity"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["has_problems", "problems"],
            "additionalProperties": False,
        },
    },
}


def _render_contract_block(contract: dict | None) -> str:
    if not contract:
        return ""
    parts = ["## Document Contract", ""]
    entities = contract.get("entities") or []
    if entities:
        parts.append("**Key Entities:** " + ", ".join(entities))
    decisions = contract.get("decisions") or []
    if decisions:
        parts.append("\n**Design Decisions:**")
        for d in decisions:
            parts.append(f"- {d}")
    terminology = contract.get("terminology") or {}
    if terminology:
        parts.append("\n**Terminology:**")
        for term, definition in terminology.items():
            parts.append(f"- **{term}**: {definition}")
    constraints = contract.get("constraints") or []
    if constraints:
        parts.append("\n**Constraints:**")
        for c in constraints:
            parts.append(f"- {c}")
    return "\n".join(parts)


def build_audit_context(
    sections_content: dict[str, str],
    section_order: list[str] | None = None,
    document_contract: dict | None = None,
) -> str:
    order = section_order or ["context", "proposal", "implementation", "risks"]
    build_context_report("audit", {k: v for k, v in sections_content.items()})
    parts = []
    contract_block = _render_contract_block(document_contract)
    if contract_block:
        parts.append(contract_block)
    for section_type in order:
        content = sections_content.get(section_type, "(Section not available)")
        content = truncate_section(content, "audit", section_type)
        parts.append(f"=== SECTION: {section_type.upper()} ===\n{content}")
    return "\n\n".join(parts)


async def run_audit(doc_id: str, document_type_id: str | None = None) -> dict:
    """Run audit on all 4 finalized sections."""
    logger.info("[AI:audit] run_audit | doc_id={}", doc_id)
    from app.services import db as db_service

    async with async_session() as db:
        result = await db.execute(
            select(Section)
            .options(selectinload(Section.versions))
            .where(Section.document_id == uuid.UUID(doc_id))
        )
        sections = result.scalars().all()
        db_contract = await db_service.get_document_contract(db, uuid.UUID(doc_id))
        dt_id = uuid.UUID(document_type_id) if document_type_id else None
        system_prompt = await get_system_prompt(db, dt_id, "audit")

    sections_content = {}
    for section in sections:
        active = next((v for v in section.versions if v.is_active), None)
        if active:
            sections_content[section.section_type] = active.content

    contract_dict = None
    if db_contract:
        contract_dict = {
            "entities": db_contract.entities,
            "decisions": db_contract.decisions,
            "terminology": db_contract.terminology,
            "constraints": db_contract.constraints,
        }
    user_content = build_audit_context(sections_content, document_contract=contract_dict)

    response = await call_with_retry(
        phase="audit",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format=AUDIT_SCHEMA,
        temperature=0.2,
        required_fields=["has_problems", "problems"],
    )

    log_usage("audit", response.usage)
    result = json.loads(response.choices[0].message.content)
    logger.info(
        "[AI:audit] audit done | doc_id={} has_problems={} problem_count={}",
        doc_id,
        result.get("has_problems"),
        len(result.get("problems", [])),
    )
    return result
