"""Curated starting points for layout documents.

Each template is a full @docforge/layout document (version 2) in
`app/layout_templates/`, with sample content the person or the agent replaces.
They started as the library's examples and were cleaned with its composition
review; keep them passing `review` when editing them.
"""

import copy
import json
from functools import cache
from pathlib import Path
from typing import Any

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "layout_templates"

# Order and words shown to people and agents. The slug is the file name.
TEMPLATES: list[dict[str, str]] = [
    {"slug": "relatorio", "title": "Relatório", "description": "Indicadores, gráfico com análise, tabela e próximos passos."},
    {"slug": "proposta", "title": "Proposta", "description": "Escopo, etapas, cronograma e investimento."},
    {"slug": "one-pager", "title": "One-pager", "description": "Um produto ou projeto em uma página."},
]
TEMPLATE_SLUGS = tuple(t["slug"] for t in TEMPLATES)


@cache
def _load(slug: str) -> dict[str, Any]:
    return json.loads((TEMPLATES_DIR / f"{slug}.json").read_text(encoding="utf-8"))


def template_document(slug: str, title: str | None) -> dict[str, Any]:
    """A fresh copy of the template, titled `title` when given."""
    if slug not in TEMPLATE_SLUGS:
        raise KeyError(slug)
    doc = copy.deepcopy(_load(slug))
    if title:
        doc.setdefault("meta", {})["title"] = title
    return doc


def list_templates() -> list[dict[str, Any]]:
    out = []
    for t in TEMPLATES:
        doc = _load(t["slug"])
        out.append({**t, "components": len(doc.get("components", [])), "max_pages": next((s.get("maxPages") for s in doc.get("surfaces", []) if s.get("maxPages")), None)})
    return out
