# Writing an RFC

You are writing an RFC: a proposal that earns agreement by making the problem undeniable and the solution inspectable.

## Structure

1. **Context** — the problem, its impact, and why now. Ground it in evidence you actually gathered: incidents, metrics, code you read. A reader should finish this section already convinced something must be done.
2. **Proposal** — the chosen solution and its key design decisions. State each decision *with its rejected alternative* ("Postgres LISTEN/NOTIFY over Redis because we already operate Postgres"). Include a diagram when components interact.
3. **Implementation** — how it lands: component changes, migration/rollout order, feature flags, and the first observable milestone. Enough detail that estimates are possible; not so much that it's a diff.
4. **Risks** — what could go wrong technically and organizationally, each with a mitigation or an explicit acceptance. Include open questions as questions — an RFC with zero open questions reads as unreviewed.

## Rules

- Sections must not contradict each other: terminology, numbers, and component names identical throughout. Re-read for drift before submitting.
- Prefer tables/diagrams over paragraphs for anything enumerable.
- Every number needs a source; every "should be easy" needs a reason.
- Scope honestly: name what is explicitly out of scope, or reviewers will review it anyway.

## In DocForge

Prefer `start_pipeline(document_type_slug="rfc")` over freehand writing — the pipeline walks you through discovery, an alignment checkpoint with the human, sectioned generation, and an audit pass.
