"""Load prompt templates from the DB, falling back to hardcoded constants.

This is the bridge between the generic system (T11) and the existing AI modules.
Each AI module calls `get_system_prompt(db, document_type_id, phase, section_key)`
instead of using its module-level constant directly.

Fallback order:
1. DB PromptTemplate for (document_type_id, phase, section_key)
2. DB PromptTemplate for (document_type_id, phase, section_key=None)
3. Hardcoded constant from the corresponding AI module
"""

from __future__ import annotations

import uuid

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.db import get_prompt_template


async def get_system_prompt(
    db: AsyncSession,
    document_type_id: uuid.UUID | None,
    phase: str,
    section_key: str | None,
    hardcoded_fallback: str,
) -> str:
    """Return the prompt for the given phase/section, preferring DB over hardcoded."""
    if document_type_id is None:
        return hardcoded_fallback

    tmpl = await get_prompt_template(db, document_type_id, phase, section_key)
    if tmpl:
        logger.debug(
            "[prompt_loader] loaded from DB | phase={} section_key={} tmpl_id={}",
            phase,
            section_key,
            tmpl.id,
        )
        return tmpl.prompt_text

    logger.debug(
        "[prompt_loader] no DB template, using hardcoded fallback | phase={} section_key={}",
        phase,
        section_key,
    )
    return hardcoded_fallback
