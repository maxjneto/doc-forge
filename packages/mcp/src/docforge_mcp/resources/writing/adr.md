# Writing an ADR (Architecture Decision Record)

You are writing an ADR: a short, immutable record of one architectural decision. Optimize for a future reader asking "why is the system like this?"

## Structure

1. **Title** — imperative and specific: "Use Redis pub/sub for SSE fan-out", not "Caching".
2. **Status** — Proposed / Accepted / Deprecated / Superseded by [link].
3. **Context** — the forces at play: technical constraints, deadlines, team skills, prior incidents. State facts, not judgments. A reader must understand why a decision was needed *now*.
4. **Decision** — one paragraph, active voice: "We will …". Only one decision per ADR; split if you have two.
5. **Alternatives considered** — each with the *actual* reason it lost. "Too complex" is not a reason; "requires operating a second datastore for a 200-req/day workload" is.
6. **Consequences** — both directions: what becomes easier, what becomes harder, what debt is accepted. Include reversal cost: what would it take to undo this?

## Rules

- Keep it under a page. ADRs die when they take an afternoon.
- Ground every claim in the codebase or an incident — cite files, PRs, metrics you actually read.
- Never edit an accepted ADR's decision; write a superseding one and link it.
- Write dates and versions, not "currently" or "the new version".
- If you (the agent) cannot verify a claimed constraint in the repo, ask the user rather than inventing it.
