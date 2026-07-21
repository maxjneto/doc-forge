"""Helpers for reading bundled markdown resources from the MCP package."""

from __future__ import annotations

from importlib.resources import files


def read_resource(*parts: str) -> str:
    """Read a UTF-8 markdown file packaged under docforge_mcp/resources/."""
    return files("docforge_mcp.resources").joinpath(*parts).read_text(encoding="utf-8")


def list_recipes() -> list[str]:
    """Return dashed slugs for every recipe markdown file (e.g. 'safe-rewrite')."""
    recipes_dir = files("docforge_mcp.resources").joinpath("recipes")
    return sorted(
        p.stem.replace("_", "-")
        for p in recipes_dir.iterdir()
        if p.name.endswith(".md")
    )


def list_writing_guides() -> list[str]:
    """Return slugs for every curated writing guide (e.g. 'adr', 'postmortem')."""
    writing_dir = files("docforge_mcp.resources").joinpath("writing")
    return sorted(
        p.stem.replace("_", "-")
        for p in writing_dir.iterdir()
        if p.name.endswith(".md")
    )
