"""Document export: assemble Markdown and render it to PDF / DOCX.

Pure-Python rendering (markdown -> HTML -> PDF via xhtml2pdf; HTML -> DOCX via
htmldocx) so the VPS image needs no system binaries (no headless Chrome, no
pandoc). Mermaid diagrams are emitted as fenced code blocks — the same raw form
the Markdown export has always used; rendering them to images would require a
browser and is intentionally out of scope here.
"""

from __future__ import annotations

import io
import re

import markdown as _markdown

# format -> (mime type, file extension)
EXPORT_FORMATS: dict[str, tuple[str, str]] = {
    "md": ("text/markdown; charset=utf-8", "md"),
    "pdf": ("application/pdf", "pdf"),
    "docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx",
    ),
}

# Formats that cost real work / are a paid perk (Markdown stays free).
PAID_FORMATS = {"pdf", "docx"}

_PDF_CSS = """
@page { size: a4; margin: 2cm; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 20pt; margin: 0 0 12pt; }
h2 { font-size: 15pt; margin: 18pt 0 6pt; border-bottom: 1px solid #ddd; padding-bottom: 3pt; }
h3 { font-size: 12pt; margin: 12pt 0 4pt; }
p, li { margin: 0 0 6pt; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
th, td { border: 1px solid #bbb; padding: 4pt 6pt; text-align: left; font-size: 10pt; }
th { background: #f0f0f0; }
pre { background: #f5f5f5; border: 1px solid #e0e0e0; padding: 6pt; font-family: Courier, monospace; font-size: 9pt; }
code { font-family: Courier, monospace; font-size: 9pt; }
"""


def build_markdown(title: str | None, sections: list[tuple[str, str | None]]) -> str:
    """Assemble a full-document Markdown string.

    `sections` is an ordered list of (heading, content). Empty sections are kept
    with a placeholder so the export mirrors the document's structure.
    """
    parts: list[str] = []
    if title:
        parts.append(f"# {title.strip()}")
    for heading, content in sections:
        parts.append(f"## {heading}")
        body = (content or "").strip()
        parts.append(body if body else "_(empty)_")
    return "\n\n".join(parts).strip() + "\n"


def _markdown_to_html(md_text: str) -> str:
    return _markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "sane_lists", "nl2br"],
    )


def render_pdf(md_text: str) -> bytes:
    # Imported lazily so a missing optional dep only affects PDF, not import time.
    from xhtml2pdf import pisa

    html = _markdown_to_html(md_text)
    doc = f"<html><head><style>{_PDF_CSS}</style></head><body>{html}</body></html>"
    buf = io.BytesIO()
    result = pisa.CreatePDF(src=doc, dest=buf, encoding="utf-8")
    if result.err:
        raise RuntimeError("PDF generation failed")
    return buf.getvalue()


def render_docx(md_text: str) -> bytes:
    from docx import Document as DocxDocument
    from htmldocx import HtmlToDocx

    html = _markdown_to_html(md_text)
    docx = DocxDocument()
    HtmlToDocx().add_html_to_document(html, docx)
    buf = io.BytesIO()
    docx.save(buf)
    return buf.getvalue()


def render(fmt: str, md_text: str) -> bytes:
    if fmt == "md":
        return md_text.encode("utf-8")
    if fmt == "pdf":
        return render_pdf(md_text)
    if fmt == "docx":
        return render_docx(md_text)
    raise ValueError(f"Unsupported export format: {fmt}")


def safe_filename(title: str | None, ext: str) -> str:
    base = (title or "document").strip().lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-") or "document"
    return f"{base[:60]}.{ext}"
