"""Prompt loading: DB primary → YAML fallback.

Fallback order:
1. DB PromptTemplate for (document_type_id, phase, section_key)
2. DB PromptTemplate for (document_type_id, phase, section_key=None)
3. prompts/{file}.yaml navigated by (*keys)
4. ConfigurationError — no silent empty-string fallback
"""

from __future__ import annotations

import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.db import get_prompt_template

# prompts/ directory sits at packages/backend/prompts/
# This file is at packages/backend/app/ai/core/prompt_loader.py
_PROMPTS_DIR = Path(__file__).parents[3] / "prompts"


class ConfigurationError(Exception):
    pass


@lru_cache(maxsize=16)
def _load_yaml_file(file: str) -> dict:
    """Load and cache a YAML prompt file by name (without .yaml extension)."""
    path = _PROMPTS_DIR / f"{file}.yaml"
    if not path.exists():
        raise ConfigurationError(f"Prompt file not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_yaml_prompt(file: str, *keys: str) -> str | None:
    """Navigate a YAML prompt file by key path and return the string value, or None."""
    data: Any = _load_yaml_file(file)
    for key in keys:
        if not isinstance(data, dict):
            return None
        data = data.get(key)
        if data is None:
            return None
    return str(data) if data is not None else None


async def get_system_prompt(
    db: AsyncSession,
    document_type_id: uuid.UUID | None,
    phase: str,
    section_key: str | None = None,
) -> str:
    """Return the system prompt for the given phase/section.

    Lookup order:
    1. DB PromptTemplate (document_type_id, phase, section_key)
    2. prompts/documents.yaml at [phase][system] (or [phase][section_key][system])
    3. ConfigurationError
    """
    if document_type_id is not None:
        tmpl = await get_prompt_template(db, document_type_id, phase, section_key)
        if tmpl:
            logger.debug(
                "[prompt_loader] loaded from DB | phase={} section_key={} tmpl_id={}",
                phase,
                section_key,
                tmpl.id,
            )
            return tmpl.prompt_text

    yaml_keys = (phase, section_key, "system") if section_key else (phase, "system")
    prompt = load_yaml_prompt("documents", *yaml_keys)
    if not prompt and section_key:
        # Section-specific YAML entry missing — fall back to the phase-wide
        # default (the YAML file is the doc-type-agnostic canonical fallback).
        prompt = load_yaml_prompt("documents", phase, "system")
    if prompt:
        logger.debug(
            "[prompt_loader] loaded from YAML | phase={} section_key={}", phase, section_key
        )
        return prompt

    raise ConfigurationError(
        f"No system prompt found for phase={phase!r} section_key={section_key!r}. "
        "Add an entry to prompts/documents.yaml or a DB PromptTemplate row."
    )
