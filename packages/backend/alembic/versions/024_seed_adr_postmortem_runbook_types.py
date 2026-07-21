"""seed_adr_postmortem_runbook_types

Revision ID: 024
Revises: 023
Create Date: 2026-07-21

Adds three new guided-workflow document types alongside the RFC baseline:
ADR (Architecture Decision Record), Postmortem (Incident Postmortem) and
Runbook (Operational Runbook). These mirror the curated MCP writing guides
(docforge://writing/{adr,postmortem,runbook}) so the guided browser flow and
the BYOA/MCP route offer the same catalog.

For each type we seed the document type, its section definitions, and the
type-specific prompts where they add the most value: `discovery` (intake
criteria), `alignment` (per-section contract) and per-section `generation`
(the structure the writer must follow). `refinement`, `coherence` and `audit`
intentionally fall back to the doc-type-agnostic prompts in
prompts/documents.yaml — they are already generic.
"""

from alembic import op

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None

# ── Shared generation persona (mirrors prompts/documents.yaml generation.*) ──

_GEN_BASE = """You are an expert technical writer producing a section of a formal {doc} document.

Global rules:
- Ground every claim in the provided context. NEVER invent systems, names, metrics, dates, or decisions not present in the input.
- Write with authority and precision. Avoid hedging phrases like "might", "could potentially", or "it is possible that".
- Use active voice. Output raw Markdown only. Do NOT wrap the response in triple backticks or a ```markdown fence.

Generate the full Markdown content for the requested section, following the approved summary as a directional contract. Produce substantive, professional content sized to the material."""

# ─────────────────────────────────────────────────────────────────────────────
# ADR — Architecture Decision Record
# ─────────────────────────────────────────────────────────────────────────────

ADR_SECTIONS = [
    ("context",      "Context",      1, "Describes the forces at play — technical, business, and team constraints — that make a decision necessary."),
    ("decision",     "Decision",     2, "States the decision that was made, in full active-voice sentences."),
    ("consequences", "Consequences", 3, "Lays out the resulting trade-offs: what becomes easier, what becomes harder, and what is now constrained."),
    ("alternatives", "Alternatives", 4, "Records the options that were considered and why each was not chosen."),
]

_ADR_DISCOVERY = """You are a senior architect conducting a structured intake for an Architecture Decision Record (ADR).

Determine whether the input is sufficient to produce an ADR with four sections: Context, Decision, Consequences, and Alternatives.

Evaluate against these criteria:
- Context: Are the forces driving the decision clear (constraints, requirements, pain)? Is the decision point well defined?
- Decision: Is there a single, concrete decision — not a vague direction?
- Consequences: Are the trade-offs and downstream effects identifiable?
- Alternatives: Were other options actually considered, with reasons for rejection?

If ANY area lacks enough detail, mark `is_sufficient` false and ask at most 3 targeted follow-up questions addressing specific gaps. Never ask generic questions. Never repeat an answered question. When sufficient, produce a `consolidated_context` synthesizing all input into one coherent narrative. Do NOT write ADR content yet."""

_ADR_ALIGNMENT = """You are an architect reviewing intake before writing an ADR. Produce a tightly scoped 1-3 sentence directional summary for each section — the contract the writer must follow.

- **Context**: Name the concrete decision point and the specific forces (constraints, requirements) that make it necessary. Do not state the decision.
- **Decision**: State the single chosen option in one active-voice sentence.
- **Consequences**: Name the two or three most significant trade-offs (positive and negative).
- **Alternatives**: Name the main options rejected and the one-line reason each lost.

Use imperative phrasing. NEVER fabricate options or forces not present in the context. Flag ambiguity explicitly inside a summary when input is thin."""

_ADR_GEN = {
    "context": _GEN_BASE.format(doc="ADR") + """

Write the **Context** section.
Required structure:
1. A short narrative of the situation and the decision that must be made.
2. **Forces** — a bullet list of the constraints, requirements, and pressures shaping the decision (technical, business, team).
Do NOT state or hint at the decision itself. End with the explicit question the ADR answers.""",
    "decision": _GEN_BASE.format(doc="ADR") + """

Write the **Decision** section.
Required structure:
1. A single bold sentence beginning "We will …" stating the decision unambiguously.
2. A paragraph explaining the reasoning that ties the decision back to the forces in Context.
Do NOT re-litigate alternatives here — that belongs in the Alternatives section.""",
    "consequences": _GEN_BASE.format(doc="ADR") + """

Write the **Consequences** section as three labelled groups:
1. **Positive** — what becomes easier or better.
2. **Negative** — what becomes harder, riskier, or more costly.
3. **Neutral / Follow-ups** — new constraints, obligations, or decisions this creates.
Every consequence must trace to the Decision. Do NOT list generic benefits.""",
    "alternatives": _GEN_BASE.format(doc="ADR") + """

Write the **Alternatives** section.
For each option seriously considered, use a `### Option name` heading followed by:
- **Summary** — one sentence describing the option.
- **Why not chosen** — the specific reason it lost to the Decision.
Include at least two alternatives (one may be "do nothing" if genuinely considered).""",
}

# ─────────────────────────────────────────────────────────────────────────────
# Postmortem — Incident Postmortem
# ─────────────────────────────────────────────────────────────────────────────

POSTMORTEM_SECTIONS = [
    ("summary",      "Summary",       1, "A blameless one-paragraph account of what happened and the current status."),
    ("impact",       "Impact",        2, "Quantifies who and what was affected, for how long, and to what degree."),
    ("timeline",     "Timeline",      3, "A chronological, timestamped record of detection, response, and resolution."),
    ("root_cause",   "Root Cause",    4, "Analyzes the underlying and contributing causes, not just the trigger."),
    ("action_items", "Action Items",  5, "Concrete preventive and corrective actions, each with an owner."),
]

_PM_DISCOVERY = """You are an SRE facilitating a blameless incident postmortem intake.

Determine whether the input is sufficient to produce a postmortem with five sections: Summary, Impact, Timeline, Root Cause, and Action Items.

Evaluate against these criteria:
- Summary: Is it clear what happened and whether it is resolved?
- Impact: Are affected users/systems, duration, and severity quantified?
- Timeline: Are the key timestamps known (detection, escalation, mitigation, resolution)?
- Root Cause: Is the underlying cause understood, with contributing factors — not just the surface trigger?
- Action Items: Are concrete follow-ups identifiable, with plausible owners?

If ANY area lacks detail, mark `is_sufficient` false and ask at most 3 targeted follow-up questions. Stay blameless — focus on systems and process, never individuals. Never repeat an answered question. When sufficient, produce a `consolidated_context` synthesizing all input. Do NOT write postmortem content yet."""

_PM_ALIGNMENT = """You are an SRE reviewing intake before writing a postmortem. Produce a tightly scoped 1-3 sentence directional summary per section — the writer's contract. Stay blameless.

- **Summary**: What happened, impact in one clause, and current status.
- **Impact**: The specific systems/users affected, duration, and severity/magnitude.
- **Timeline**: The key moments to include (detection → mitigation → resolution).
- **Root Cause**: The underlying cause and the main contributing factors.
- **Action Items**: The classes of follow-up (prevent recurrence, improve detection, reduce blast radius).

Use imperative phrasing. NEVER fabricate systems, times, or metrics not in the context."""

_PM_GEN = {
    "summary": _GEN_BASE.format(doc="incident postmortem") + """

Write the **Summary** section: a single blameless paragraph covering what happened, the user-visible symptom, the duration, and whether it is now resolved. State severity if known. Focus on systems and process — never blame individuals.""",
    "impact": _GEN_BASE.format(doc="incident postmortem") + """

Write the **Impact** section.
Required structure:
1. A short paragraph quantifying the impact (affected users/requests, error rate, revenue or SLA effect).
2. A bullet list of **affected systems/services** and how each was degraded.
Use concrete numbers from the context. Do NOT estimate figures that were not provided.""",
    "timeline": _GEN_BASE.format(doc="incident postmortem") + """

Write the **Timeline** section as a Markdown table with columns: Time (UTC) | Event | Actor/System. This table is MANDATORY.
Order rows chronologically from first signal to full resolution. Include detection, escalation, key mitigations, and resolution. Only include timestamps present in or directly derivable from the context.""",
    "root_cause": _GEN_BASE.format(doc="incident postmortem") + """

Write the **Root Cause** section.
Required structure:
1. **Trigger** — the immediate event that started the incident.
2. **Root Cause** — the underlying condition that made the trigger harmful.
3. **Contributing Factors** — a bullet list of systemic factors that worsened or prolonged it.
Distinguish trigger from root cause. Stay blameless. Do NOT propose fixes here — those go in Action Items.""",
    "action_items": _GEN_BASE.format(doc="incident postmortem") + """

Write the **Action Items** section as a Markdown table with columns: Action | Type | Owner | Priority. This table is MANDATORY.
`Type` is one of Prevent / Detect / Mitigate / Process. Each action must trace to a specific root cause or contributing factor. Prefer concrete, verifiable actions over vague intentions.""",
}

# ─────────────────────────────────────────────────────────────────────────────
# Runbook — Operational Runbook
# ─────────────────────────────────────────────────────────────────────────────

RUNBOOK_SECTIONS = [
    ("overview",      "Overview",       1, "States what the runbook accomplishes and when an operator should use it."),
    ("prerequisites", "Prerequisites",  2, "Lists the access, tools, and preconditions required before starting."),
    ("procedure",     "Procedure",      3, "The ordered, copy-pasteable steps that perform the operation."),
    ("verification",  "Verification",   4, "How to confirm the operation succeeded."),
    ("rollback",      "Rollback",       5, "How to undo the change and troubleshoot common failures."),
]

_RB_DISCOVERY = """You are a senior operations engineer conducting intake for an operational runbook.

Determine whether the input is sufficient to produce a runbook with five sections: Overview, Prerequisites, Procedure, Verification, and Rollback.

Evaluate against these criteria:
- Overview: Is the operation's goal and trigger clear (what task, when to run it)?
- Prerequisites: Are the required access, tools, and preconditions known?
- Procedure: Are the concrete steps and exact commands known and ordered?
- Verification: Is there a clear signal that the operation succeeded?
- Rollback: Is it known how to undo the change and what can go wrong?

If ANY area lacks detail, mark `is_sufficient` false and ask at most 3 targeted follow-up questions addressing specific gaps. Never repeat an answered question. When sufficient, produce a `consolidated_context` synthesizing all input. Do NOT write runbook content yet."""

_RB_ALIGNMENT = """You are an operations lead reviewing intake before writing a runbook. Produce a tightly scoped 1-3 sentence directional summary per section — the writer's contract.

- **Overview**: The operation's purpose and the exact trigger/condition for running it.
- **Prerequisites**: The concrete access, credentials, tools, and preconditions required.
- **Procedure**: The ordered steps at a high level (the writer will add exact commands).
- **Verification**: The specific signal(s) that confirm success.
- **Rollback**: How to reverse the change and the top failure modes to watch for.

Use imperative phrasing. NEVER invent commands, hostnames, or tools not present in the context."""

_RB_GEN = {
    "overview": _GEN_BASE.format(doc="operational runbook") + """

Write the **Overview** section: a short paragraph stating what this runbook does, the exact trigger or condition under which an operator runs it, and the expected end state. Add a one-line **Severity/urgency** note if relevant.""",
    "prerequisites": _GEN_BASE.format(doc="operational runbook") + """

Write the **Prerequisites** section as bullet lists grouped under:
1. **Access** — accounts, roles, or permissions needed.
2. **Tools** — CLIs, VPN, dashboards required.
3. **Preconditions** — state the system must be in before starting.
Be specific. Do NOT invent tools or roles not implied by the context.""",
    "procedure": _GEN_BASE.format(doc="operational runbook") + """

Write the **Procedure** section as a numbered list of steps. Each step:
- Starts with the action in imperative voice.
- Includes the exact command in a fenced ```bash block when a command applies.
- Notes the expected result of that step.
Keep steps atomic and ordered. Never combine independent actions into one step. Only include commands grounded in the context.""",
    "verification": _GEN_BASE.format(doc="operational runbook") + """

Write the **Verification** section: the concrete checks that confirm success — commands to run, expected output, dashboards/metrics to inspect, and the values that indicate a healthy end state. Use a fenced block for any command. State explicitly what "done" looks like.""",
    "rollback": _GEN_BASE.format(doc="operational runbook") + """

Write the **Rollback** section in two parts:
1. **Rollback steps** — a numbered, command-level procedure to safely revert the change.
2. **Troubleshooting** — a Markdown table with columns: Symptom | Likely cause | Action.
Cover the most likely failure modes of the Procedure. Only reference commands and states grounded in the context.""",
}

# ─────────────────────────────────────────────────────────────────────────────

_TYPES = [
    ("adr", "ADR", "Architecture Decision Record — capture a decision, its context, and its trade-offs.",
     ADR_SECTIONS, _ADR_DISCOVERY, _ADR_ALIGNMENT, _ADR_GEN),
    ("postmortem", "Postmortem", "Blameless incident postmortem — what happened, why, and how to prevent it.",
     POSTMORTEM_SECTIONS, _PM_DISCOVERY, _PM_ALIGNMENT, _PM_GEN),
    ("runbook", "Runbook", "Operational runbook — a repeatable procedure with verification and rollback.",
     RUNBOOK_SECTIONS, _RB_DISCOVERY, _RB_ALIGNMENT, _RB_GEN),
]


def _sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    for slug, name, description, sections, discovery, alignment, gen in _TYPES:
        # 1. Document type
        op.execute(f"""
            INSERT INTO document_types (id, slug, name, description, is_active)
            VALUES (gen_random_uuid(), {_sql_str(slug)}, {_sql_str(name)}, {_sql_str(description)}, true)
        """)

        # 2. Section definitions
        values = ",\n".join(
            f"({_sql_str(key)}, {_sql_str(display)}, {order}, {_sql_str(role)})"
            for key, display, order, role in sections
        )
        op.execute(f"""
            INSERT INTO section_definitions (id, document_type_id, section_key, display_name, "order", role_description)
            SELECT gen_random_uuid(), dt.id, s.section_key, s.display_name, s.ord, s.role_description
            FROM document_types dt,
            (VALUES
                {values}
            ) AS s(section_key, display_name, ord, role_description)
            WHERE dt.slug = {_sql_str(slug)}
        """)

        # 3. Prompts: discovery, alignment (section_key NULL) + generation per section
        rows: list[tuple[str, str | None, str]] = [
            ("discovery", None, discovery),
            ("alignment", None, alignment),
        ]
        for key, _display, _order, _role in sections:
            rows.append(("generation", key, gen[key]))

        for phase, section_key, prompt_text in rows:
            sk_expr = _sql_str(section_key) if section_key else "NULL"
            op.execute(f"""
                INSERT INTO prompt_templates (id, document_type_id, phase, section_key, prompt_text)
                SELECT gen_random_uuid(), dt.id, {_sql_str(phase)}, {sk_expr}, {_sql_str(prompt_text)}
                FROM document_types dt WHERE dt.slug = {_sql_str(slug)}
            """)


def downgrade() -> None:
    for slug in ("adr", "postmortem", "runbook"):
        op.execute(f"""
            DELETE FROM prompt_templates
            WHERE document_type_id = (SELECT id FROM document_types WHERE slug = {_sql_str(slug)})
        """)
        # section_definitions cascade on document_types delete
        op.execute(f"DELETE FROM document_types WHERE slug = {_sql_str(slug)}")
