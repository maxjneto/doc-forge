# Frontend — design rules

The design system lives in `src/index.css` (`@theme` + `:root`) and
`src/components/ui`. Source of truth for the reasoning:
`docs/product/design-system-consolidation.md`.

`npm run lint:tokens` (runs in CI) enforces most of what follows. Run it
before finishing any UI change.

## Tokens

- Use the ramp names: `var(--color-*)`, `--radius-*`, `--text-*`,
  `--tracking-*`, `--shadow-*`, `--z-*`, `--duration-*`, `--gradient-*`.
  The old `--df-*` names are gone.
- No hex/rgba literals in `components/` or `pages/`. If a colour you need has
  no name, add a semantic token to `index.css` (derive it with `color-mix`
  from a base colour; never a new literal) — the name says *when* to use it,
  never *how much* (`heat-wash`, not `heat-10`).
- No `var(--x, fallback)`. The fallback freezes the old value at the call site.
- Accent tiers, same for heat/steel/ok/warn/error: `tint` (active row, warm
  hover) · `wash` (chip, active card, callout) · `strong` (selection, input
  ring, progress) · `line` (every tinted border).
- Type scale only: 10 · 11.5 · 12.5 · 13 · 14 · 17 · 21 · 28 (hero sizes ≥ 30
  are marketing only). Prefer `textStyle.*` from `@/components/ui` in inline
  styles, or `text-label` / `text-caption` / `text-body`… in Tailwind.
- Radius only via `--radius-xs|sm|md|lg|pill`. Inside an `md` card nothing
  goes past `sm`.
- `zIndex` above 2 only via `--z-raised|sticky|popover|drawer|modal|toast`.

## Colour grammar

1. One filled heat button per view — it marks the next action. A second one is
   `secondary`.
2. Steel means "came from outside or does not change": agent via MCP, frozen or
   published version, artifact. Never "neutral", never "done".
3. Ok closes a loop: accepted, resolved, "published just now". If nothing
   finished, it is not green. "Published" as a standing state is steel (R2);
   only the confirmation of the act is ok.
4. Text on a heat fill is `on-heat`. Small warm text on dark is `heat-hi` or
   `heat-soft`; plain `heat` is for fills, borders and dots.
5. State has a shape, not only a colour: every status is a `<Pill>` with a
   label.

## Primitives

Reach for `@/components/ui` before writing a styled element by hand: `Pill`,
`Button` (`variant`, `size="lg"`, `icon`), `IconButton` (needs `label`),
`Card` (`tone`), `Input`, `Switch`, `Meter`, `Tab`, `Eyebrow`, `Kbd`,
`Dialog`, and for every signed-in screen `Page` (`width="wide"` for tables)
+ `PageHeader` (title, lead, actions — the page's one primary goes there).
Hover/focus/disabled for these live in `index.css` (`.df-btn`, `.df-input`,
`.df-icon-btn`, `.df-switch`), so don't re-implement them with `onMouseEnter`.

Lists share one row language: `.df-row` (hover lifts the row), secondary
actions inside `.df-row-actions` (shown on hover/focus), a `.df-row-chevron`
when the row opens something, `.df-row--drop` for a drop target. Side
navigation uses `.df-nav-item` + `.df-nav-count`. Times are relative
(`relativeTime` from `@/utils/time`) with the full date in `title`.

## Seeing the signed-in screens

`npm run dev:preview` serves the real app on :5199 with Clerk stubbed and
the API answered from `preview/fixtures.ts` (the CopaSim document from the
v4 mocks). Open `/home`, `/document/doc-copasim`, `/mcp`, `/billing`,
`/customize`, and the guided pipeline at each phase: `/document/doc-pipe-discovery`,
`/document/doc-pay-rfc` (alignment), `doc-pipe-generation`, `doc-pipe-refinement`,
`doc-pipe-audit`, `doc-pipe-completed`. Nothing in `preview/` ships in the build.

Gotcha: never assemble a token name at runtime (`var(--color-${tone}-tint)`).
Tailwind v4 only emits theme variables it finds spelled out in the source, so
the variable silently doesn't exist. Map to full names instead (the guard
enforces this).

Gotcha: CodeMirror themes (`EditorView.theme`) don't add `px` to numbers — use
strings there (`"var(--text-code)"`, `"13px"`).
