"""One-time setup: create the DocForge activation funnel in PostHog (M3 —
product-plan §9 funnel: MCP connect → first doc → first suggestion reviewed
→ conversion; also the roadmap's suggested north star, "documents with
agent writing reviewed by a human, per week").

This is a script, not app code — it calls PostHog's Insights REST API once
to create a saved Funnel insight, wired to events already emitted by the
backend (app/services/observability.py + app/auth.py):
  1. mcp_connected           — first authenticated call from an agent's API key
  2. mcp_document_created    — first document created via MCP
  3. suggestion_accepted     — a suggestion was reviewed and accepted
  4. subscription_converted  — free → paid plan transition (Stripe webhook)

Requires TWO different PostHog credentials (not the app's ingestion key):
  POSTHOG_PERSONAL_API_KEY   Settings → Personal API Keys (needs insight:write)
  POSTHOG_PROJECT_ID         Project ID (Project Settings, or the number in
                             your PostHog app URL: /project/<id>/...)
  POSTHOG_HOST               Optional; defaults to https://us.i.posthog.com

Usage:
    POSTHOG_PERSONAL_API_KEY=phx_xxx POSTHOG_PROJECT_ID=12345 \
        python scripts/setup_posthog_funnel.py

Safe to re-run: if an insight with the same name already exists, it updates
it in place instead of creating a duplicate.

Schema note: the FunnelsQuery `kind`/`series` shape below is taken directly
from PostHog's own query schema (posthog/frontend/src/queries/schema/
schema-general.ts as of 2026-07) — not guessed. The Insight-creation
envelope (`name` + `query` + `saved`) follows PostHog's documented Insights
API. If PostHog's API has since changed shape, this script will fail loudly
with the API's error body rather than silently no-op.
"""

from __future__ import annotations

import os
import sys

import httpx

FUNNEL_NAME = "DocForge Activation Funnel"

FUNNEL_STEPS = [
    ("mcp_connected", "Agent connected via MCP"),
    ("mcp_document_created", "First document created via MCP"),
    ("suggestion_accepted", "First suggestion reviewed & accepted"),
    ("subscription_converted", "Converted to a paid plan"),
]


def _funnel_query() -> dict:
    return {
        "kind": "FunnelsQuery",
        "series": [
            {"kind": "EventsNode", "event": event, "name": event, "custom_name": label}
            for event, label in FUNNEL_STEPS
        ],
        "funnelsFilter": {
            "funnelVizType": "steps",
            "funnelWindowInterval": 14,
            "funnelWindowIntervalUnit": "day",
        },
    }


def main() -> int:
    personal_key = os.environ.get("POSTHOG_PERSONAL_API_KEY", "")
    project_id = os.environ.get("POSTHOG_PROJECT_ID", "")
    host = os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com").rstrip("/")

    if not personal_key or not project_id:
        print(
            "Missing POSTHOG_PERSONAL_API_KEY and/or POSTHOG_PROJECT_ID.\n"
            "See this script's docstring for where to find them.",
            file=sys.stderr,
        )
        return 1

    headers = {"Authorization": f"Bearer {personal_key}", "Content-Type": "application/json"}
    base = f"{host}/api/environments/{project_id}/insights/"

    with httpx.Client(timeout=30.0) as client:
        existing = client.get(base, headers=headers, params={"search": FUNNEL_NAME})
        existing.raise_for_status()
        matches = [
            r for r in existing.json().get("results", [])
            if r.get("name") == FUNNEL_NAME
        ]

        body = {"name": FUNNEL_NAME, "query": _funnel_query(), "saved": True}

        if matches:
            insight_id = matches[0]["id"]
            res = client.patch(f"{base}{insight_id}/", headers=headers, json=body)
            action = "Updated"
        else:
            res = client.post(base, headers=headers, json=body)
            action = "Created"

        if res.status_code >= 400:
            print(f"PostHog API error ({res.status_code}): {res.text}", file=sys.stderr)
            return 1

        data = res.json()
        print(f"{action} '{FUNNEL_NAME}' — view it at {host}/project/{project_id}/insights/{data.get('short_id', data.get('id'))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
