import json
import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.ai.client import client, DEFAULT_MODEL
from app.ai.context_builder import build_audit_context
from app.database import async_session
from app.models import Document, Section, SectionVersion

AUDIT_SYSTEM_PROMPT = """You are DocForge, a co-pilot specialized in creating technical RFCs.
You write in a direct, technical, and concise manner.
When requested, you generate valid Mermaid diagrams directly in Markdown.
You NEVER fabricate information that the user has not provided.

Your task is to identify inconsistencies and contradictions between the 4 sections of an RFC.
Be rigorous: were technologies in Implementation mentioned in the Proposal?
Do the Risks cover the actual Implementation?"""

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
    async with async_session() as db:
        result = await db.execute(
            select(Section)
            .options(selectinload(Section.versions))
            .where(Section.document_id == uuid.UUID(doc_id))
        )
        sections = result.scalars().all()

    sections_content = {}
    for section in sections:
        active = next((v for v in section.versions if v.is_active), None)
        if active:
            sections_content[section.section_type] = active.content

    system_prompt = AUDIT_SYSTEM_PROMPT
    user_content = build_audit_context(sections_content)

    response = await client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format=AUDIT_SCHEMA,
        temperature=0.2,
    )

    result = json.loads(response.choices[0].message.content)
    logger.info(
        "[AI:audit] audit done | doc_id={} has_problems={} problem_count={}",
        doc_id,
        result.get("has_problems"),
        len(result.get("problems", [])),
    )
    return result
