"""BYOA pipeline state machine (Ideia A, M2 slice).

The server owns durable step state over the RFC baseline; the user's agent
executes each step with its own tools and model, submitting results via MCP.
Human checkpoints block progress until approved in the browser. Generation
output flows through M1 suggestions — the human reviews diffs, not raw writes.

V1: the step list is built from the document type's SectionDefinitions
(hardcoded baseline shape). M4 replaces the builder input with a user-editable
PipelineDefinition; the run snapshot format stays the same.
"""

import datetime
import hashlib
import json
import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Document, PipelineDefinition, PipelineRun, Section
from app.models.document_type import DocumentType, SectionDefinition
from app.schemas.sse import SSEEvent
from app.services import db as db_service
from app.services import sse as sse_service

# Minimum content sizes — cheap structural enforcement against
# non-cooperative/imprecise agents (P4 gates come later).
MIN_DISCOVERY_CHARS = 80
MIN_SUMMARY_CHARS = 30
MIN_SECTION_CHARS = 200

VALID_SEVERITIES = {"high", "low"}


class PipelineError(Exception):
    """Validation/state error surfaced to the agent with a corrective message."""


def build_baseline_steps(section_keys: list[str]) -> list[dict]:
    """Baseline shape: discovery per section → alignment checkpoint →
    generation per section → audit → completed."""
    steps: list[dict] = []
    index = 0
    for key in section_keys:
        steps.append({"index": index, "phase": "discovery", "section_key": key, "status": "pending"})
        index += 1
    steps.append({
        "index": index, "phase": "alignment", "section_key": None,
        "status": "pending", "checkpoint": "human",
    })
    index += 1
    for key in section_keys:
        steps.append({"index": index, "phase": "generation", "section_key": key, "status": "pending"})
        index += 1
    steps.append({"index": index, "phase": "audit", "section_key": None, "status": "pending"})
    return steps


VALID_STEP_PHASES = {"discovery", "alignment", "generation", "audit"}


def validate_definition_steps(steps: list, section_keys: list[str]) -> None:
    """Structural validation for user-edited pipeline definitions."""
    if not isinstance(steps, list) or not steps:
        raise PipelineError("steps must be a non-empty list.")
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            raise PipelineError(f"Step {i} must be an object.")
        phase = step.get("phase")
        if phase not in VALID_STEP_PHASES:
            raise PipelineError(
                f"Step {i}: phase must be one of {sorted(VALID_STEP_PHASES)}, got {phase!r}."
            )
        key = step.get("section_key")
        if phase in ("discovery", "generation"):
            if key not in section_keys:
                raise PipelineError(
                    f"Step {i}: section_key must be one of {section_keys}, got {key!r}."
                )
        elif key is not None:
            raise PipelineError(f"Step {i}: {phase} steps must not have a section_key.")
        prompt = step.get("prompt")
        if prompt is not None and (not isinstance(prompt, str) or len(prompt) > 20_000):
            raise PipelineError(f"Step {i}: prompt must be a string of at most 20000 chars.")
        checkpoint = step.get("checkpoint")
        if checkpoint not in (None, "human"):
            raise PipelineError(f"Step {i}: checkpoint must be omitted or 'human'.")
        if phase == "alignment" and checkpoint != "human":
            raise PipelineError(f"Step {i}: alignment steps require checkpoint 'human'.")
    generation_keys = [s.get("section_key") for s in steps if s.get("phase") == "generation"]
    if len(set(generation_keys)) != len(generation_keys):
        raise PipelineError("Duplicate generation steps for the same section.")


async def clone_baseline_definition(
    db: AsyncSession,
    user_id: str,
    document_type: DocumentType,
    name: str | None = None,
) -> PipelineDefinition:
    """Clone the baseline into an editable definition with prompts materialized.

    Materializing puts the actual PromptTemplate/YAML text in front of the user
    so 'edit the prompts' is editing real text, not references.
    """
    from app.ai.core.prompt_loader import get_system_prompt
    from app.phases.generation.ai import build_generation_system_prompt

    section_keys = [
        sd.section_key for sd in sorted(document_type.section_definitions, key=lambda s: s.order)
    ]
    steps: list[dict] = []
    for key in section_keys:
        prompt = await get_system_prompt(db, document_type.id, "discovery", key)
        steps.append({"phase": "discovery", "section_key": key, "prompt": prompt})
    steps.append({
        "phase": "alignment", "section_key": None, "checkpoint": "human",
        "prompt": await get_system_prompt(db, document_type.id, "alignment"),
    })
    for key in section_keys:
        prompt = await build_generation_system_prompt(key, db, document_type.id)
        steps.append({"phase": "generation", "section_key": key, "prompt": prompt})
    steps.append({
        "phase": "audit", "section_key": None,
        "prompt": await get_system_prompt(db, document_type.id, "audit"),
    })

    definition = PipelineDefinition(
        user_id=user_id,
        base_document_type_id=document_type.id,
        name=name or f"{document_type.name} pipeline (custom)",
        steps=steps,
    )
    db.add(definition)
    await db.commit()
    await db.refresh(definition)
    return definition


def build_steps_from_definition(definition: PipelineDefinition) -> list[dict]:
    """Snapshot a definition's steps into runtime steps (adds index/status)."""
    steps = []
    for index, step in enumerate(definition.steps):
        runtime = {
            "index": index,
            "phase": step["phase"],
            "section_key": step.get("section_key"),
            "status": "pending",
        }
        if step.get("prompt"):
            runtime["prompt"] = step["prompt"]
        if step.get("checkpoint"):
            runtime["checkpoint"] = step["checkpoint"]
        steps.append(runtime)
    return steps


async def get_run(db: AsyncSession, document_id: uuid.UUID) -> PipelineRun | None:
    result = await db.execute(
        select(PipelineRun).where(PipelineRun.document_id == document_id)
    )
    return result.scalar_one_or_none()


async def start_pipeline(
    db: AsyncSession,
    user_id: str,
    document_type: DocumentType,
    title: str | None,
    context: str,
    definition: PipelineDefinition | None = None,
) -> tuple[Document, PipelineRun]:
    """Create a pipeline-mode document with sections + the pipeline run.

    With a custom `definition`, its steps (and prompt overrides) drive the run;
    otherwise the hardcoded baseline shape is used.
    """
    doc = Document(
        title=title or f"{document_type.name} — {datetime.datetime.utcnow().strftime('%b %d, %Y')}",
        document_context=context,
        user_id=user_id,
        document_type_id=document_type.id,
        current_phase="discovery",
        document_mode="pipeline",
    )
    db.add(doc)
    await db.flush()

    section_keys = [
        sd.section_key for sd in sorted(document_type.section_definitions, key=lambda s: s.order)
    ]
    for key in section_keys:
        db.add(Section(document_id=doc.id, section_type=key))
    if definition is not None:
        steps = build_steps_from_definition(definition)
        slug = f"custom:{definition.id}"
    else:
        steps = build_baseline_steps(section_keys)
        slug = f"{document_type.slug}-baseline"
    run = PipelineRun(
        document_id=doc.id,
        definition_slug=slug,
        steps=steps,
        current_step_index=0,
        status="running",
    )
    db.add(run)
    await db.commit()
    await db.refresh(doc)
    await db.refresh(run)
    logger.info("[pipeline] started | doc_id={} steps={}", doc.id, len(run.steps))
    return doc, run


def _current_step(run: PipelineRun) -> dict | None:
    if run.current_step_index >= len(run.steps):
        return None
    return run.steps[run.current_step_index]


async def _sections_by_key(db: AsyncSession, doc_id: uuid.UUID) -> dict[str, Section]:
    result = await db.execute(
        select(Section)
        .options(selectinload(Section.versions))
        .where(Section.document_id == doc_id)
    )
    return {s.section_type: s for s in result.scalars().all()}


async def _concatenate_sections_to_body(db: AsyncSession, doc: Document) -> str:
    """A-lite (docs/product/pipeline-collaboration-implementation.md, Fase 2/6):
    glue the N pipeline sections into one Markdown body, in SectionDefinition
    order, so the single-section EditorLayout has something to show once the
    pipeline hands off to free editing. Each section becomes a heading."""
    sections = await _sections_by_key(db, doc.id)
    section_defs: list[SectionDefinition] = []
    if doc.document_type_id is not None:
        dt_result = await db.execute(
            select(DocumentType)
            .options(selectinload(DocumentType.section_definitions))
            .where(DocumentType.id == doc.document_type_id)
        )
        doc_type = dt_result.scalar_one_or_none()
        if doc_type:
            section_defs = sorted(doc_type.section_definitions, key=lambda sd: sd.order)

    blocks = []
    for sd in section_defs:
        section = sections.get(sd.section_key)
        active = next((v for v in section.versions if v.is_active), None) if section else None
        content = (active.content if active else "").strip()
        if content:
            blocks.append(f"## {sd.display_name}\n\n{content}")
    return "\n\n".join(blocks)


async def _handoff_to_editing(db: AsyncSession, doc: Document) -> None:
    """Create/update the synthetic `body` section EditorLayout reads, then
    flip the phase. Trade-off accepted (Max, 23/07/2026): Gate/Review/Versions
    in the editor sidebar operate on this single concatenated section, not on
    the original N pipeline sections, from this point on."""
    concatenated = await _concatenate_sections_to_body(db, doc)
    result = await db.execute(
        select(Section).where(Section.document_id == doc.id, Section.section_type == "body")
    )
    body_section = result.scalar_one_or_none()
    if body_section is None:
        body_section = Section(document_id=doc.id, section_type="body", status="finalized")
        db.add(body_section)
        await db.flush()
    await db_service.create_section_version(
        db, body_section.id, "Pipeline complete", concatenated, doc_id=doc.id
    )
    await db_service.set_phase(db, doc.id, "editing")


async def _step_instructions(
    db: AsyncSession, doc: Document, step: dict
) -> tuple[str, dict]:
    """Return (instructions, context) served to the agent for a step.

    Instructions = the phase's PromptTemplate (DB-first, YAML fallback) wrapped
    in BYOA procedural guidance; context = the accumulated state the step needs.
    """
    from app.ai.core.prompt_loader import get_system_prompt

    phase = step["phase"]
    section_key = step.get("section_key")
    sections = await _sections_by_key(db, doc.id)

    role_by_key: dict[str, str] = {}
    if doc.document_type_id is not None:
        dt_result = await db.execute(
            select(DocumentType)
            .options(selectinload(DocumentType.section_definitions))
            .where(DocumentType.id == doc.document_type_id)
        )
        doc_type = dt_result.scalar_one_or_none()
        if doc_type:
            role_by_key = {
                sd.section_key: sd.role_description for sd in doc_type.section_definitions
            }

    if phase == "discovery":
        prompt = step.get("prompt") or await get_system_prompt(
            db, doc.document_type_id, "discovery", section_key
        )
        context = {
            "document_context": doc.document_context,
            "section_key": section_key,
            "previous_discovery": {
                k: s.discovery_context for k, s in sections.items() if s.discovery_context
            },
        }
        instructions = (
            f"STEP: discovery for section '{section_key}'.\n"
            "You are the executor of this step. The prompt below describes what a "
            "sufficient consolidated context for this section looks like. Gather the "
            "information yourself (read the repository, ask your user in your own "
            "conversation) instead of guessing. Only escalate questions that require "
            "human intent or decisions.\n\n"
            f"--- SECTION ROLE ---\n{role_by_key.get(section_key, '')}\n\n"
            f"--- PHASE PROMPT ---\n{prompt}\n\n"
            "SUBMIT: call submit_step with payload {\"content\": \"<consolidated "
            f"context for '{section_key}', min {MIN_DISCOVERY_CHARS} chars>\"}}."
        )
        return instructions, context

    if phase == "alignment":
        prompt = step.get("prompt") or await get_system_prompt(db, doc.document_type_id, "alignment")
        payload_shape = "{" + ", ".join(f'"{k}": "..."' for k in sections) + "}"
        context = {
            "document_context": doc.document_context,
            "discovery": {k: s.discovery_context for k, s in sections.items()},
        }
        instructions = (
            "STEP: alignment summaries.\n"
            "Produce one short summary per section describing what that section will "
            "contain, grounded in the discovery context. The human will review these "
            "summaries in the browser before any content is generated — this is a "
            "blocking checkpoint.\n\n"
            f"--- PHASE PROMPT ---\n{prompt}\n\n"
            f'SUBMIT: call submit_step with payload {{"summaries": {payload_shape}}} '
            f"(every section required, min {MIN_SUMMARY_CHARS} chars each). "
            "After submitting, the pipeline waits for human approval in the browser."
        )
        return instructions, context

    if phase == "generation":
        from app.phases.generation.ai import build_generation_system_prompt

        prompt = step.get("prompt") or await build_generation_system_prompt(
            section_key, db, doc.document_type_id
        )
        section = sections.get(section_key)
        done_sections = {
            k: (next((v.content for v in s.versions if v.is_active), None))
            for k, s in sections.items()
        }
        context = {
            "document_context": doc.document_context,
            "approved_summary": section.summary if section else None,
            "discovery_context": section.discovery_context if section else None,
            "sections_so_far": {k: v for k, v in done_sections.items() if v},
        }
        instructions = (
            f"STEP: generate section '{section_key}'.\n"
            "Write the full Markdown content for this section, consistent with the "
            "approved summary and the sections generated so far. Your submission "
            "becomes a pending SUGGESTION the human reviews as a diff — write "
            "accordingly (complete, self-contained section content).\n\n"
            f"--- PHASE PROMPT ---\n{prompt}\n\n"
            f"SUBMIT: call submit_step with payload {{\"content\": \"<full Markdown, min {MIN_SECTION_CHARS} chars>\"}}."
        )
        return instructions, context

    if phase == "audit":
        prompt = step.get("prompt") or await get_system_prompt(db, doc.document_type_id, "audit")
        contents = {
            k: next((v.content for v in s.versions if v.is_active), "")
            for k, s in sections.items()
        }
        context = {"sections": contents}
        instructions = (
            "STEP: audit the complete document.\n"
            "Check all sections against each other for contradictions, terminology "
            "drift, and inconsistencies, following the prompt below. Report findings "
            "honestly — an empty list means you assert the document is consistent.\n\n"
            f"--- PHASE PROMPT ---\n{prompt}\n\n"
            'SUBMIT: call submit_step with payload {"findings": [{"section_type": '
            '"...", "description": "...", "severity": "high"|"low"}, ...]} '
            '(empty list if none).'
        )
        return instructions, context

    raise PipelineError(f"Unknown step phase: {phase}")


async def describe_next_step(db: AsyncSession, doc: Document, run: PipelineRun) -> dict:
    """What the agent should do now — or the wait/completed state."""
    if run.status == "completed":
        return {"status": "completed", "message": "Pipeline finished. The document is complete."}
    if run.status == "waiting_human":
        return {
            "status": "waiting_human",
            "message": (
                "Waiting for the user to approve the alignment summaries in the "
                "browser. Ask your user to review, then call get_next_step again."
            ),
        }
    step = _current_step(run)
    if step is None:
        return {"status": "completed", "message": "Pipeline finished."}
    instructions, context = await _step_instructions(db, doc, step)
    context_hash = hashlib.sha256(
        json.dumps(context, sort_keys=True, default=str).encode()
    ).hexdigest()[:16]
    return {
        "status": "running",
        "step_index": step["index"],
        "total_steps": len(run.steps),
        "phase": step["phase"],
        "section_key": step.get("section_key"),
        "instructions": instructions,
        "context": context,
        "context_hash": context_hash,
    }


def _mark_done_and_advance(run: PipelineRun) -> None:
    steps = list(run.steps)
    step = dict(steps[run.current_step_index])
    step["status"] = "done"
    step["submitted_at"] = datetime.datetime.now(datetime.UTC).isoformat()
    steps[run.current_step_index] = step
    run.steps = steps
    run.current_step_index += 1


async def submit_step(
    db: AsyncSession,
    doc: Document,
    run: PipelineRun,
    payload: dict,
    api_key_id: uuid.UUID | None = None,
) -> dict:
    """Validate and apply a step submission, then advance the state machine."""
    if run.status == "completed":
        raise PipelineError("Pipeline already completed.")
    if run.status == "waiting_human":
        raise PipelineError(
            "Pipeline is waiting for human approval in the browser — nothing to submit."
        )
    step = _current_step(run)
    if step is None:
        raise PipelineError("No pending step.")

    phase = step["phase"]
    section_key = step.get("section_key")
    sections = await _sections_by_key(db, doc.id)

    if phase == "discovery":
        content = str(payload.get("content") or "").strip()
        if len(content) < MIN_DISCOVERY_CHARS:
            raise PipelineError(
                f"Discovery context too short ({len(content)} chars, min {MIN_DISCOVERY_CHARS}). "
                "Submit the consolidated context for this section."
            )
        section = sections[section_key]
        await db_service.save_section_context(db, section.id, content)
        _mark_done_and_advance(run)

    elif phase == "alignment":
        summaries = payload.get("summaries")
        if not isinstance(summaries, dict):
            raise PipelineError('Payload must be {"summaries": {section_key: text}}.')
        missing = [k for k in sections if k not in summaries]
        if missing:
            raise PipelineError(f"Missing summaries for sections: {', '.join(missing)}.")
        short = [k for k, v in summaries.items() if len(str(v).strip()) < MIN_SUMMARY_CHARS]
        if short:
            raise PipelineError(
                f"Summaries too short (min {MIN_SUMMARY_CHARS} chars): {', '.join(short)}."
            )
        cleaned_summaries = {k: str(v).strip() for k, v in summaries.items() if k in sections}
        # Em bloco decision (docs/product/pipeline-collaboration-implementation.md
        # Fase 2/4): a section only counts as "addressed" a rejection when its
        # summary text actually changed on resubmission — unrelated sections
        # keep whatever open feedback they had.
        changed_keys = [
            k for k, v in cleaned_summaries.items() if v != (sections[k].summary or "")
        ]
        await db_service.save_summaries(db, doc.id, cleaned_summaries)
        if changed_keys:
            await db_service.resolve_feedback_for_sections(db, doc.id, changed_keys)
        await db_service.set_phase(db, doc.id, "alignment")
        run.status = "waiting_human"
        sse_service.publish(str(doc.id), SSEEvent(
            type="document_updated",
            payload={"doc_id": str(doc.id), "change": "pipeline_waiting_approval"},
        ))
        # Note: step is marked done on human approval, not here

    elif phase == "generation":
        content = str(payload.get("content") or "").strip()
        if len(content) < MIN_SECTION_CHARS:
            raise PipelineError(
                f"Section content too short ({len(content)} chars, min {MIN_SECTION_CHARS})."
            )
        section = sections[section_key]
        if doc.current_phase != "generation":
            await db_service.set_phase(db, doc.id, "generation")
        active = next((v for v in section.versions if v.is_active), None)
        if active is None:
            # First content for this section: write directly (nothing to diff against)
            await db_service.create_section_version(
                db, section.id, f"Generated: {section_key}", content, doc_id=doc.id
            )
        else:
            await db_service.create_suggestion(
                db, section.id, doc.id, content,
                note=f"Pipeline generation for '{section_key}'",
                api_key_id=api_key_id,
            )
        _mark_done_and_advance(run)

    elif phase == "audit":
        findings = payload.get("findings")
        if not isinstance(findings, list):
            raise PipelineError('Payload must be {"findings": [...]} (empty list if none).')
        cleaned = []
        for f in findings:
            if not isinstance(f, dict):
                raise PipelineError("Each finding must be an object.")
            st = str(f.get("section_type") or "").strip()
            desc = str(f.get("description") or "").strip()
            sev = str(f.get("severity") or "").strip().lower()
            if st not in sections:
                raise PipelineError(f"Finding references unknown section: {st!r}.")
            if not desc:
                raise PipelineError("Finding description must not be empty.")
            if sev not in VALID_SEVERITIES:
                raise PipelineError(f"Severity must be one of {sorted(VALID_SEVERITIES)}.")
            cleaned.append({"section_type": st, "description": desc, "severity": sev})
        await db_service.set_phase(db, doc.id, "audit")
        if cleaned:
            await db_service.save_audit_findings(db, doc.id, cleaned)
        _mark_done_and_advance(run)

    else:
        raise PipelineError(f"Unknown step phase: {phase}")

    # Completion check
    if run.current_step_index >= len(run.steps) and run.status == "running":
        run.status = "completed"
        # Document-facing phase is "editing", not "completed": the pipeline
        # RUN is done (agents see status="completed" via describe_next_step),
        # but the human always lands in the free editor now (A-lite, see
        # _handoff_to_editing) instead of the old dedicated completed screen.
        await _handoff_to_editing(db, doc)
        sse_service.publish(str(doc.id), SSEEvent(
            type="document_updated",
            payload={"doc_id": str(doc.id), "change": "pipeline_completed"},
        ))

    await db_service.log_activity(
        db, doc.id, "pipeline_step",
        description=f"Agent submitted pipeline step: {phase}"
        + (f" ({section_key})" if section_key else ""),
        api_key_id=api_key_id,
    )
    await db.commit()
    await db.refresh(run)
    return await describe_next_step(db, doc, run)


async def approve_alignment(db: AsyncSession, doc: Document, run: PipelineRun) -> dict:
    """Human checkpoint: unblock the pipeline after reviewing summaries."""
    step = _current_step(run)
    if run.status != "waiting_human" or step is None or step["phase"] != "alignment":
        raise PipelineError("Pipeline is not waiting for alignment approval.")
    # Server-side gate (em bloco decision, docs/product/pipeline-collaboration-
    # implementation.md Fase 2/4): don't trust the client's local "all
    # approved" state — refuse to release generation while a per-section
    # rejection is still unresolved (section_id set, not a suggestion review).
    open_items = await db_service.list_feedback(db, doc.id, status="open")
    if any(f.section_id is not None and f.suggestion_id is None for f in open_items):
        raise PipelineError(
            "Some sections still have open feedback from a rejection — wait for "
            "the agent to address it and resubmit before approving."
        )
    _mark_done_and_advance(run)
    run.status = "running"
    await db_service.set_phase(db, doc.id, "generation")
    sse_service.publish(str(doc.id), SSEEvent(
        type="document_updated",
        payload={"doc_id": str(doc.id), "change": "pipeline_alignment_approved"},
    ))
    await db_service.log_activity(
        db, doc.id, "pipeline_approved",
        description="You approved the alignment summaries",
    )
    await db.commit()
    await db.refresh(run)
    return await describe_next_step(db, doc, run)


async def reject_alignment(
    db: AsyncSession,
    doc: Document,
    run: PipelineRun,
    comment: str,
    section_key: str | None = None,
    author_user_id: str | None = None,
) -> dict:
    """Human checkpoint: send the summaries back to the agent with feedback.

    The alignment step stays current; the run returns to `running` so the
    agent's next get_next_step serves alignment again — with the rejection
    comment waiting in the feedback queue. `section_key`, when given, scopes
    the feedback to that section (services.db.create_feedback's `section_id`)
    instead of the whole checkpoint — the "em bloco" decision
    (docs/product/pipeline-collaboration-implementation.md Fase 2/4) still
    resubmits all sections together, but this lets the agent (via
    get_pending_feedback) and the human (via the per-section card) see which
    section the note is actually about.
    """
    step = _current_step(run)
    if run.status != "waiting_human" or step is None or step["phase"] != "alignment":
        raise PipelineError("Pipeline is not waiting for alignment approval.")
    if not comment.strip():
        raise PipelineError("A rejection comment is required — it becomes agent feedback.")
    section_id = None
    if section_key is not None:
        sections = await _sections_by_key(db, doc.id)
        section = sections.get(section_key)
        if section is None:
            raise PipelineError(f"Unknown section_key: {section_key!r}.")
        section_id = section.id
    run.status = "running"
    label = f"Alignment summary for '{section_key}' rejected" if section_key else "Alignment summaries rejected"
    await db_service.create_feedback(
        db, doc.id, f"{label}: {comment.strip()}",
        section_id=section_id,
        author_user_id=author_user_id,
    )
    await db_service.log_activity(
        db, doc.id, "pipeline_rejected",
        description=f"You sent the alignment summaries back: {comment.strip()[:200]}",
    )
    await db.commit()
    await db.refresh(run)
    return await describe_next_step(db, doc, run)
