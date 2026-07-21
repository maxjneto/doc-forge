# Writing a Postmortem

You are writing a blameless postmortem: a precise reconstruction of an incident that leaves the team with fewer ways to repeat it.

## Structure

1. **Summary** — 3–4 sentences: what broke, blast radius (users/duration/data), root cause in one clause, headline fix.
2. **Impact** — numbers, not adjectives: requests failed, users affected, minutes down, money/SLA burned. Say how each number was measured.
3. **Timeline** — timestamped (with timezone), from first trigger to full resolution. Include detection lag ("broken at 14:02, alerted at 14:31") — that gap is usually a finding of its own.
4. **Root cause** — follow the causal chain past the first answer (5 whys). "The deploy had a bug" is never the root cause; why did the bug pass review, tests, and rollout gates?
5. **What went well / what went poorly** — honest, specific, systems-focused.
6. **Action items** — each with an owner and a due date. Prefer structural fixes (guardrail, alert, gate) over "be more careful". If an item won't realistically be done, don't list it.

## Rules

- Blameless means *systems language*: "the deploy pipeline allowed X", never "Alice forgot to X".
- Reconstruct the timeline from real sources (logs, alerts, chat) — if you can't verify a time, mark it as approximate.
- Every unresolved question goes in an explicit "Open questions" list, not silently omitted.
- Write so an engineer who joins next year understands it without tribal context.
