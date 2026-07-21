# Writing a Runbook

You are writing a runbook: instructions an on-call engineer executes at 3 AM under stress. Optimize for zero ambiguity, not completeness of prose.

## Structure

1. **Purpose** — one line: when to reach for this runbook ("API error rate > 5% alerts firing").
2. **Preconditions** — access/tools needed *before* starting: VPN, roles, CLIs and versions. The reader must be able to check each in under a minute.
3. **Diagnosis** — a decision tree, shortest path first: check X → if A, go to section 3; if B, go to section 4. Every check is a concrete command or dashboard link, with the *expected healthy output* shown.
4. **Remediation** — numbered steps. Each step: the exact command (copy-pasteable, no placeholders left to guess), what it does in one clause, expected output, and what to do if the output differs.
5. **Verification** — how to confirm recovery (specific metric back under threshold, specific probe passing).
6. **Escalation** — when to stop and page whom, with the actual channel/schedule name.

## Rules

- Commands must be real: pull them from the repo's scripts/CI/infra, never from memory. If you can't verify a command, flag it as UNVERIFIED for the human.
- State destructive steps loudly: **DESTRUCTIVE — takes the service down** before the command, and always pair with the rollback.
- No step may depend on knowledge that isn't in the runbook or linked from it.
- Test-read it as the 3 AM engineer: any step that makes you think "it depends" needs a branch, not a caveat.
