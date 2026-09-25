"""Seed the local preview database with one document per screen/phase.

Idempotent: wipes and recreates everything owned by the preview user, so each
run gives the same fixture set. Run from packages/backend with its venv:

    ../../packages/backend/.venv/bin/python seed.py
"""

import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "packages" / "backend"
sys.path.insert(0, str(BACKEND))

from app.config import settings  # noqa: E402
from app.models.api_key import ApiKey  # noqa: E402
from app.models.audit import AuditFinding  # noqa: E402
from app.models.chat import ChatMessage  # noqa: E402
from app.models.discovery import DiscoveryQuestion  # noqa: E402
from app.models.document import Document  # noqa: E402
from app.models.document_activity import DocumentActivity  # noqa: E402
from app.models.document_type import DocumentType  # noqa: E402
from app.models.section import Section, SectionVersion  # noqa: E402
from app.models.suggestion import Suggestion  # noqa: E402
from app.models.user import User  # noqa: E402
from dev_auth import PREVIEW_USER  # noqa: E402
from sqlalchemy import create_engine, delete, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

FIXTURE = json.loads((BACKEND / "app" / "fixtures" / "sample_document.json").read_text())
SAMPLE = {s["section_type"]: s for s in FIXTURE["sections"]}
GUIDED = ["context", "proposal", "implementation", "risks"]
NOW = datetime.now(timezone.utc).replace(tzinfo=None)


def _ago(**kw) -> datetime:
    return NOW - timedelta(**kw)


def _doc(db, dtype, title, phase, *, mode="guided", age=None, error=None):
    doc = Document(
        user_id=PREVIEW_USER["sub"],
        document_type_id=dtype.id if mode != "editor" else None,
        title=title,
        current_phase=phase,
        document_context="We need a shared async job queue so product teams stop "
        "building ad-hoc background workers.",
        document_mode=mode,
        error_message=error,
    )
    db.add(doc)
    db.flush()
    ts = _ago(**(age or {"hours": 1}))
    doc.created_at = ts - timedelta(days=2)
    doc.updated_at = ts
    return doc


def _sections(db, doc, statuses, *, with_content=True, versions=1):
    out = {}
    for key, status in zip(GUIDED, statuses):
        sec = Section(document_id=doc.id, section_type=key, status=status, summary=SAMPLE[key]["summary"])
        db.add(sec)
        db.flush()
        if with_content:
            parent = None
            for i in range(versions):
                v = SectionVersion(
                    section_id=sec.id,
                    parent_version_id=parent,
                    version_name="Initial" if i == 0 else f"Edit {i}",
                    change_summary=None if i == 0 else "Tightened wording and added metrics",
                    content=SAMPLE[key]["active_version_content"],
                    is_active=i == versions - 1,
                    created_at=_ago(hours=versions - i),
                )
                db.add(v)
                db.flush()
                parent = v.id
        out[key] = sec
    return out


def main() -> None:
    url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg")
    engine = create_engine(url)
    with Session(engine) as db:
        uid = PREVIEW_USER["sub"]
        db.execute(delete(Document).where(Document.user_id == uid))
        db.execute(delete(ApiKey).where(ApiKey.user_id == uid))
        user = db.get(User, uid)
        if user is None:
            user = User(id=uid, email=PREVIEW_USER["email"], name=PREVIEW_USER["name"])
            db.add(user)
        user.credits = 5
        user.plan = "free"
        db.flush()

        rfc = db.execute(select(DocumentType).where(DocumentType.slug == "rfc")).scalar_one()
        adr = db.execute(select(DocumentType).where(DocumentType.slug == "adr")).scalar_one()

        key = ApiKey(
            user_id=uid,
            key_hash=hashlib.sha256(b"df_preview_key").hexdigest(),
            name="claude-laptop",
            harness="claude_code",
            last_used_at=_ago(minutes=12),
        )
        db.add(key)
        db.flush()

        # 1. Discovery — questions waiting for answers
        d = _doc(db, rfc, "RFC: Async Job Queue Service", "discovery", age={"minutes": 5})
        _sections(db, d, ["pending"] * 4, with_content=False)
        db.add_all([
            DiscoveryQuestion(document_id=d.id, section_key="context",
                              question="Which teams run background jobs today, and how?",
                              answer="Docs, Notifications and Exports — each with its own mechanism."),
            DiscoveryQuestion(document_id=d.id, section_key="context",
                              question="What failure prompted this RFC?"),
        ])

        # 2. Alignment — summaries awaiting approval
        d = _doc(db, rfc, "RFC: Multi-region Postgres Failover", "alignment", age={"hours": 2})
        _sections(db, d, ["pending"] * 4, with_content=False)

        # 3. Generation — half the sections drafted
        d = _doc(db, rfc, "RFC: Feature Flag Platform", "generation", age={"hours": 3})
        _sections(db, d, ["finalized", "drafting", "pending", "pending"])

        # 4. Refinement — workspace with chat + version history
        d = _doc(db, rfc, "RFC: Observability Stack Consolidation", "refinement", age={"hours": 5})
        secs = _sections(db, d, ["finalized", "refining", "refining", "pending"], versions=3)
        db.add_all([
            ChatMessage(document_id=d.id, section_id=secs["proposal"].id, role="user",
                        content="Can you make the proposal more concrete about retries?"),
            ChatMessage(document_id=d.id, section_id=secs["proposal"].id, role="agent",
                        content="Added an exponential backoff policy (max 5 attempts) and a dead-letter queue."),
        ])

        # 5. Audit — findings to review
        d = _doc(db, rfc, "RFC: Rate Limiting Gateway", "audit", age={"days": 1})
        _sections(db, d, ["finalized"] * 4)
        db.add_all([
            AuditFinding(document_id=d.id, section_type="implementation", severity="high",
                         description="Implementation mentions Redis Streams but Proposal commits to SQS."),
            AuditFinding(document_id=d.id, section_type="risks", severity="medium",
                         description="Risk section does not cover the dead-letter queue growing unbounded."),
            AuditFinding(document_id=d.id, section_type="context", severity="low",
                         description="Term 'worker pool' and 'executor pool' used interchangeably."),
        ])

        # 6. Completed guided document
        d = _doc(db, rfc, "RFC: Search Index Rebuild", "completed", age={"days": 3})
        _sections(db, d, ["finalized"] * 4, versions=2)

        # 7. Free editor document, written by an agent, with a pending suggestion
        d = _doc(db, rfc, "Onboarding Guide — Payments Team", "editing", mode="editor", age={"minutes": 12})
        d.agent_write_policy = "suggest"
        body = Section(document_id=d.id, section_type="body", status="refining")
        db.add(body)
        db.flush()
        md = (
            "# Onboarding Guide\n\nWelcome to the Payments team.\n\n## Local setup\n\n"
            "1. Clone the monorepo\n2. Run `make bootstrap`\n\n## Architecture\n\n"
            "Payments is split into **ledger**, **gateway** and **reconciler**.\n\n"
            "### Ledger\n\nDouble-entry, append-only.\n\n### Gateway\n\nTalks to Stripe and Adyen.\n\n"
            "## On-call\n\nSee the runbook.\n"
        )
        v1 = SectionVersion(section_id=body.id, version_name="Draft", content=md, is_active=True,
                            created_at=_ago(hours=4))
        db.add(v1)
        db.flush()
        v2 = SectionVersion(section_id=body.id, parent_version_id=v1.id, version_name="Agent suggestion",
                            change_summary="Add reconciler section",
                            content=md + "\n### Reconciler\n\nNightly job matching ledger vs. PSP reports.\n",
                            created_at=_ago(minutes=12))
        db.add(v2)
        db.flush()
        db.add(Suggestion(document_id=d.id, section_id=body.id, proposed_version_id=v2.id,
                          base_version_id=v1.id, api_key_id=key.id,
                          note="The architecture list mentions a reconciler but it had no section."))
        db.add_all([
            DocumentActivity(document_id=d.id, action_type="document_created",
                             description="Document created via MCP", api_key_id=key.id),
            DocumentActivity(document_id=d.id, action_type="suggestion_created",
                             description="Suggested: Add reconciler section", api_key_id=key.id,
                             bytes_delta=68, version_id=v2.id),
        ])

        # 8. Empty editor document
        d = _doc(db, rfc, "Untitled document", "editing", mode="editor", age={"days": 6})
        body = Section(document_id=d.id, section_type="body", status="refining")
        db.add(body)
        db.flush()
        db.add(SectionVersion(section_id=body.id, version_name="Draft", content="", is_active=True))

        # 9. Guided document that errored out
        d = _doc(db, rfc, "RFC: Billing Event Sourcing", "generation", age={"days": 9},
                 error="Generation failed after 3 retries (model timeout).")
        _sections(db, d, ["finalized", "pending", "pending", "pending"])

        # 10. BYOA pipeline driven by the agent, waiting on alignment approval
        d = _doc(db, adr, "ADR: Adopt OpenTelemetry for tracing", "alignment", mode="pipeline",
                 age={"minutes": 40})
        _sections(db, d, ["pending"] * 4, with_content=False)
        db.add(DocumentActivity(document_id=d.id, action_type="document_created",
                                description="Pipeline started via MCP", api_key_id=key.id))

        db.commit()
        n = len(db.execute(select(Document.id).where(Document.user_id == uid)).all())
        print(f"seeded {n} documents for {uid}")


if __name__ == "__main__":
    main()
