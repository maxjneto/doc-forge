"""End-to-end smoke test of the layout flow, as an agent runs it over MCP.

Creates a report from the `relatorio` template, edits it, adds a row of KPIs,
runs the composition review, renders page 1 as a PNG, asks the person for a
review and reads the notes back. Prints, for every call, how long it took and
how much text it handed the agent (≈ characters / 4 tokens) — the same numbers
the usage telemetry reports, so it doubles as the token benchmark.

    pip install "mcp>=1.27,<2"
    DOCFORGE_API_KEY=df_... python scripts/smoke-mcp.py [--url http://localhost:8001/mcp] [--out page1.png]

Exit code 0 when every step worked.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import os
import re
import sys
import time

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client


def text_of(result) -> str:
    return "\n".join(getattr(c, "text", "") for c in result.content if getattr(c, "type", "") == "text")


async def run(url: str, key: str, out: str) -> int:
    rows: list[tuple[str, float, int, bool]] = []
    failures = 0

    async with streamablehttp_client(url, headers={"Authorization": f"Bearer {key}"}) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = {t.name for t in (await session.list_tools()).tools}
            print(f"connected: {len(tools)} tools")

            async def call(name: str, args: dict, expect: str | None = None):
                nonlocal failures
                start = time.perf_counter()
                result = await session.call_tool(name, args)
                ms = (time.perf_counter() - start) * 1000
                text = text_of(result)
                ok = not result.isError and (expect is None or re.search(expect, text) is not None)
                rows.append((name, ms, len(text), ok))
                if not ok:
                    failures += 1
                    print(f"\n✗ {name}: {text[:600]}\n")
                return result, text

            _, created = await call("create_layout_document", {"title": "Smoke test", "template": "relatorio"}, r"ID: [0-9a-f-]{36}")
            match = re.search(r"ID: ([0-9a-f-]{36})", created)
            if not match:
                print("could not create the document; stopping")
                return 1
            doc = match.group(1)
            await call("get_layout_map", {"document_id": doc, "level": 0}, r"page 1")
            await call(
                "apply_layout_ops",
                {"document_id": doc, "ops": [{"op": "replaceText", "find": "T3", "replace": "Q3"}], "note": "Trocando o trimestre para o padrão do time"},
                r"Saved",
            )
            kpi = lambda i, label: {"id": f"smoke-kpi-{i}", "type": "kpi", "content": {"value": str(10 * i), "label": label}}  # noqa: E731
            await call(
                "apply_layout_ops",
                {"document_id": doc, "ops": [{"op": "row", "below": "titulo", "h": 14, "items": [kpi(1, "Leads"), kpi(2, "Demos"), kpi(3, "Contratos")]}]},
                r"added at p1",
            )
            await call("preview_layout", {"document_id": doc, "ops": [{"op": "compact"}]}, r"Preview")
            await call("review_layout", {"document_id": doc}, r"finding|No composition problems")
            image, _ = await call("render_page", {"document_id": doc, "page": 1, "scale": 0.5, "highlight": ["smoke-kpi-1"]}, r"Page 1 of")
            pngs = [c for c in image.content if getattr(c, "type", "") == "image"]
            if pngs:
                data = base64.b64decode(pngs[0].data)
                with open(out, "wb") as f:
                    f.write(data)
                print(f"page 1 saved to {out} ({len(data) // 1024} KB)")
            else:
                failures += 1
                print("✗ render_page returned no image")
            await call(
                "request_review",
                {"document_id": doc, "summary": "Montei o relatório e adicionei uma linha de indicadores.", "focus": ["smoke-kpi-1"], "questions": [{"text": "Os indicadores ficam no topo?", "options": ["Sim", "Não"]}]},
                r"Review requested",
            )
            await call("get_layout_notes", {"document_id": doc, "kind": "annotation"}, r"review request")

    print(f"\n{'tool':<24}{'ms':>8}{'chars':>9}{'≈tokens':>9}  ok")
    for name, ms, chars, ok in rows:
        print(f"{name:<24}{ms:>8.0f}{chars:>9}{chars // 4:>9}  {'✓' if ok else '✗'}")
    total = sum(r[2] for r in rows)
    print(f"{'total':<24}{sum(r[1] for r in rows):>8.0f}{total:>9}{total // 4:>9}")
    print(f"\ndocument: {doc}")
    return 1 if failures else 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default=os.environ.get("DOCFORGE_MCP_URL", "http://localhost:8001/mcp"))
    parser.add_argument("--out", default="smoke-page1.png")
    args = parser.parse_args()
    key = os.environ.get("DOCFORGE_API_KEY")
    if not key:
        sys.exit("Set DOCFORGE_API_KEY (create one in the app: MCP page → API keys).")
    sys.exit(asyncio.run(run(args.url, key, args.out)))


if __name__ == "__main__":
    main()
