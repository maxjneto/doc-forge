import json
import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.ai.context_builder import build_audit_context
from app.ai.guardrails import call_with_retry
from app.ai.token_budget import log_usage
from app.database import async_session
from app.models import Document, Section, SectionVersion

AUDIT_SYSTEM_PROMPT = """You are a technical editor performing a final consistency audit on a completed technical document.

Your task is to identify genuine inconsistencies and contradictions BETWEEN sections. You are NOT evaluating writing quality, style, or completeness of individual sections.

Check specifically for:
1. **Terminology drift** — A concept is called one thing in the Proposal and a different thing in Implementation or Risks.
2. **Technology contradictions** — A technology or component appears in Implementation but was never introduced in the Proposal.
3. **Risk coverage gaps** — The Implementation introduces mechanisms (e.g., a queue, a cache, a migration) that have no corresponding risk entry.
4. **Diagram inconsistencies** — A diagram in one section shows a component or flow that contradicts another section's description.
5. **Scope violations** — Implementation describes something explicitly marked out-of-scope in the Proposal.

Reporting rules:
- Only report genuine cross-section contradictions. Do NOT report style issues, grammar, or incomplete individual sections.
- Each problem must cite the specific section it appears in and name the other section it conflicts with.
- Severity `high`: the inconsistency would cause a reader to fundamentally misunderstand the design.
- Severity `low`: the inconsistency is a naming or minor detail mismatch that should be cleaned up.
- If the document is internally consistent, return `has_problems: false` and an empty `problems` array."""

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


async def run_audit(doc_id: str) -> dict:
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

    system_prompt = AUDIT_SYSTEM_PROMPT
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
