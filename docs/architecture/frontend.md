# Frontend

`packages/frontend` — React 19, TypeScript, Vite, Tailwind CSS v4, CodeMirror 6, Clerk for sign-in. Built once into static files and served by nginx; every `VITE_*` variable is baked in at build time.

## Structure

```
src/
  App.tsx              routes; Clerk and PostHog providers; cookie consent
  pages/               one component per route
  components/
    editor/            the Markdown editor and its review panels
    layout-doc/        the layout editor (pages, slides, panels, publishing)
    dashboard/         the document library: folders, sharing, moving
    marketing/         the public pages' navigation
    shared/            top bar, dialogs, Markdown renderer, footer
    ui/                design-system primitives (Button, Pill, Card, Page…)
  hooks/               useDocument (data + SSE), useAutosave, PostHog identity
  utils/               API client, diff and hunks, document structure, time
  i18n/                English and Portuguese messages, one dictionary each
  legal/               the terms and privacy policy (Markdown, rendered as-is)
preview/               the design preview: the real app against fixtures
scripts/check-tokens.mjs   the design-token guard (runs in CI)
```

| Route | Page | Signed in? |
|---|---|---|
| `/`, `/how-it-works`, `/pricing`, `/legal/:doc` | marketing and legal pages | no |
| `/public/:token` | a published document (Markdown or layout) | no — the token is the capability |
| `/home` | the library: folders, shared with me, search, archive | yes |
| `/document/:id` | the Markdown editor or the layout editor, by `document_mode` | yes |
| `/mcp` | API keys and setup for each agent client | yes |
| `/billing` | plan, usage, upgrade | yes |

## Data

- `utils/api.ts` is the only place that calls the backend. It maps snake_case responses to camelCase types (`types/index.ts`) and attaches the Clerk token.
- `useDocument(id)` loads a document and keeps it fresh: it opens the SSE stream (`/documents/{id}/stream`, with the token in a header via `fetch-event-source`), refetches on every event, reconnects with exponential backoff, and resyncs after a reconnect in case events were missed.
- There is no global store. Each screen owns its state; the editors keep their own.

## The Markdown editor

`components/editor/` — the person writes in CodeMirror (source) or reads the preview; headings become the navigation on the left.

- **Autosave** (`useAutosave`): the text is saved after a short pause, and the status bar says when.
- **Review** (`EditorSuggestionPanel`, `EditorDiffView`): an agent's pending suggestion is shown as a diff against the current text, change by change (↑/↓ or j/k to move, a word-level diff inside each change). The person accepts, rejects, or triages: keeps some changes and drops others. The grouping into changes comes from `utils/diff.ts`, which the backend mirrors to apply the chosen hunks.
- **Structure** is derived, not stored (`utils/documentStructure.ts`): sections come from headings, with line ranges; a comment or finding is anchored by quote, then heading, then the document as a whole, so it survives edits around it.
- **Side panels**: versions (snapshots, restore, publish), the quality gate (findings underlined in the text), artifacts (cards where `::artefato[key]` appears), activity (people and agents, with the agent's harness).

## The layout editor

`components/layout-doc/` — the person edits the same JSON the agent writes, through the same operations.

- **The library runs in the browser.** `fonts.ts` loads the bundled fonts into a registry (`createBrowserRegistry`), and `createEngine` lays the document out locally, so measurements, the map and every side effect match the server exactly.
- **Pages are drawn by the library's own HTML**, inside a sandboxed iframe where no script runs (`PageCanvas`). Two iframes alternate, so an edit never flashes white. A selection layer on top uses the layout's coordinates for boxes, handles, drag and drop, and inline editors for text, tables and KPIs.
- **Every change is an operation** (`useLayoutEditor`): applied locally first, queued, and sent to `/layout/ops` with the revision it was based on. Keyboard nudges coalesce into one write and one undo step. On `409 STALE_REVISION` it reloads, shows what the other writer changed, and reapplies what was still pending.
- **Panels**: structure (rows, reorder by dragging), component content and style, design (themes, colors, type, spacing), page (size, margins, fit to N pages), review (what a reader would notice, with one-click fixes), comments (pinned to a component or an area, threads, "ask the agent"), history (revisions, named versions, compare, restore).
- **Slides** have a slide rail and a present mode; **publishing** copies the current revision and gives the public link other sites load with the library.
- The library and its fonts load only when a layout document is opened (`React.lazy`), so the rest of the app does not pay for them.

## Design system

The interface uses a forge metaphor: **heat** is what is happening now, **steel** is what came from outside or no longer changes. Everything is defined once, as tokens, in `src/index.css` (`@theme` and `:root`), and used through primitives in `components/ui`. The full rules are in [`packages/frontend/CLAUDE.md`](../../packages/frontend/CLAUDE.md).

- **A ramp of names, not values.** Surfaces in a few steps, text in four levels, accents with meaning: `heat` (action, active), `steel` (an agent via MCP, a frozen or published version), `ok` (a loop closed — accepted, resolved), `warn`, `error`. Each accent has the same four tiers — `tint`, `wash`, `strong`, `line` — derived from the base colour with `color-mix`, so a new accent is one literal, not twenty.
- **Names say when, not how much**: `heat-wash`, never `heat-10`.
- **One filled heat button per view**, marking the next action. State always has a shape (a `Pill` with a label), not only a colour.
- **A fixed type scale** (10 · 11.5 · 12.5 · 13 · 14 · 17 · 21 · 28) and radii (`xs`…`lg`, `pill`).
- **The guard** (`npm run lint:tokens`, in CI) fails on colour literals in components and pages, on fallbacks in `var()` (a fallback freezes the old value at the call site), on undefined tokens, and on token names assembled at runtime — Tailwind v4 only emits variables it finds spelled out in the source, so `var(--color-${tone}-tint)` would silently not exist.

## Internationalisation

`i18n/index.tsx` holds an English and a Portuguese dictionary and a `t(key, vars)` function; the locale comes from the browser and can be switched. Keys are flat (`editor.publishHint`); a key missing in Portuguese falls back to English.

## The design preview

```bash
npm run dev:preview      # http://localhost:5199
```

The real app with Clerk stubbed and every API call answered from `preview/fixtures.ts`, so every signed-in screen can be seen (and screenshotted) without a backend or an account. Layout documents keep state in the preview: operations run through the real library. Nothing in `preview/` ships in the build.

## Checks

```bash
npx tsc --noEmit         # types
npm run lint:tokens      # design-token guard
npm run test             # vitest: API mappers, diff, structure, i18n, the layout editor
npm run build
```
