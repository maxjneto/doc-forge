# Recipe: Quality Gate (agent-run)

Run a documentation audit yourself — free, with your own model — and record the result where the user reviews it. A server-run gate does the same but consumes the user's credits; prefer this route.

## When

- After finishing a draft or a significant rewrite.
- Before asking the user to review a batch of suggestions.
- When `get_quality_gate` shows the gate is ENABLED and blocking acceptance.

## Flow

1. **`get_quality_gate(document_id)`** — returns current findings, whether the gate blocks suggestion acceptance, and all section contents.
2. Audit the sections against each other. Look specifically for:
   - **Contradictions**: one section asserts what another denies (numbers, decisions, behavior).
   - **Terminology drift**: the same concept named differently across sections.
   - **Broken references**: a section referring to content that doesn't exist (anymore).
   - **Unsupported claims**: figures or promises with no grounding anywhere in the document.
3. **`submit_quality_findings(document_id, findings_json)`** with what you actually found:
   - Severity `high`: contradictions and factual conflicts — these block acceptance when the gate is on.
   - Severity `low`: drift, style, missing polish.
   - `[]` if the document is consistent — an empty submission is a positive assertion, so only send it after truly checking.
4. Fix what you can: write corrected content (it becomes a suggestion), then re-run the gate and resubmit so the findings list reflects reality.

## Rules

- Never submit `[]` just to unblock acceptance — the user sees who ran the gate and when.
- Findings must cite the section (`section_type`) they occur in; describe the *conflict*, not just the location.
- Dismissed findings belong to the human; your submissions never erase them.
