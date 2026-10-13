# DocForge layout documents

A layout document is made of **components placed on a grid**. You never see the
page. Instead, every write returns **diagnostics** (what does not fit, what is
illegible, what is wrong) and a **text map** of where everything ended up.
Read the map, fix what the diagnostics say, and send the operations again.

Tools: `create_layout_document` → `get_layout_map` → `apply_layout_ops` (repeat).
`get_layout_document` returns the raw JSON when you need exact content.

## The grid

```
document
└─ sections            (id, optional name)
   └─ bands            (id, span: rows | "auto"), stacked top to bottom
      └─ items         (component id, colStart 1-based, colSpan) on 12 columns
```

- A band is a horizontal strip. Its items sit side by side; columns must not overlap and must end at column 12 or earlier.
- `span: "auto"` makes the band as tall as its tallest component, and is almost always what you want. A number fixes the height in row units (1 unit = 8px). A component whose content is taller than a fixed band gets an `overflow` error.
- Pages: a band never splits across pages; it moves whole to the next page. The exception is a band holding a single content component (text, list, table, code, steps or timeline), which can split between lines or items. Tables repeat their header.
- Ids use letters, digits, `-` and `_`. Every component listed in `components` must be placed exactly once.

## Reading the map

Level 1 (returned by every write):

```
s-intro r-kpis [16 rows · 128px]  [kpi-revenue kpi 1-4 · 221.9×128] [kpi-churn kpi 5-8 · 221.9×128]
```

That line reads: section `s-intro`, band `r-kpis`, 128px tall, holding `kpi-revenue` in columns 1–4 (221.9 px wide). Alerts follow the component: `!overflow 24px` is an error, and `~word-broken` is a warning.
Level 0 is a one-screen outline. Level 2 details the components you name: resolved styles, and which layer each value came from.

## Components (`components[]`: `{id, type, content, props?, labels?, style?}`)

| type | content | props |
| --- | --- | --- |
| `text` | `paragraphs: (string \| {role, text})[]` | `role` for the whole block |
| `list` | `items: (string \| {text, checked?, items?})[]` (nested) | `marker: bullet\|number\|check` |
| `table` | `columns: (string \| {header, width?, align?})[]`, `rows: inline[][]` | `header`, `zebra`, `repeatHeader` |
| `code` | `code`, `language?` | |
| `steps` | `steps: {title, text?}[]` | |
| `timeline` | `events: {date, title, text?}[]` | |
| `kpi` | `value`, `label`, `delta?`, `trend?: up\|down\|flat` | `href` |
| `card` | `title`, `eyebrow?`, `value?`, `text?`, `footer?` | `href` (the whole card links) |
| `chart` | `kind: bar\|line\|pie`, `categories[]`, `series: {name, values[]}[]` | `legend`, `values`, `unit` |
| `image` | `src` (https or data:image), `alt`, `width`, `height` (intrinsic px) | `fit: contain\|cover` |
| `divider` | none | `kind: line\|space` |

Text roles: `title-1`, `title-2`, `title-3`, `subtitle`, `body`, `quote`, `caption`. There is no separate title component; a title is a text with `role: "title-1"`.
Inline text is a string with `**bold**`, `*italic*`, `` `code` `` and `[link](https://…)`. Use runs (`[{text, bold?, italic?, code?, color?, highlight?, link?, size?}]`) only when you need colour or size.
Links: `https://`, `http://`, `mailto:` and `#id` (another component or a section).

Content components (text, list, table, code, steps, timeline) grow with their content. Area components (kpi, card, chart, image, divider) fill the area they are given. A chart needs a plot area of at least 80×60px (a pie, a 40px radius), and `chart-too-small` tells you when it falls short.

## Operations (`apply_layout_ops`)

```json
{"op": "add", "component": {...}, "at": {"section": "s-1", "band": "r-1", "colStart": 1, "colSpan": 12, "newBand": {"span": "auto", "after": "r-0"}}}
{"op": "place", "component": "id", "at": {...}}
{"op": "update", "component": "id", "content": {...}, "props": {...}, "labels": [...], "style": {...} | null}
{"op": "remove", "component": "id"}
{"op": "addSection", "section": {"id": "s-2", "name": "Results"}, "after": "s-1"}
{"op": "addBand", "section": "s-2", "band": {"id": "r-3", "span": "auto"}, "after": "r-2"}
{"op": "setBand", "band": "r-3", "span": 24}
{"op": "moveBand", "band": "r-3", "section": "s-1", "after": null}
{"op": "removeBand", "band": "r-3"}
{"op": "setStyle", "layer": "document", "selector": "text.title-1", "style": {...}}
{"op": "setStyle", "layer": "label", "label": "highlight", "style": {...}}
{"op": "setRegion", "region": {"id": "sidebar", "section": "s-1", "cols": [9, 12], "style": {...}}}
{"op": "setTokens", "tokens": {"color": {"primary": "#0b6e4f"}}}
```

- `newBand` creates the band if it does not exist yet. `after: null` means "first".
- `update` replaces `content` entirely and merges `props` and `style`.
- One call is all-or-nothing. If anything fails, nothing is saved, and you get the diagnostics and the revision you are still on.
- Pass `base_revision` (from the last response) when several writers may be working on the same document.

## Styles

The cascade, from least to most specific: preset → `document` (by type or `type.role`) → region (a grid area) → label → the component's own `style`. Prefer tokens over raw values:
`$color.text|muted|primary|surface|subtle|border|success|danger|warning|highlight|chart1-6`, `$size.xs|s|m|l|xl|xxl|display`, `$space.0-6`, `$radius.none|s|m`, `$lineHeight.tight|normal`.
Style props: `fontFamily fontSize fontWeight italic color lineHeight align background borderColor borderWidth radius padding gap accent muted`.

## A good first document

1. Add a band with a `title-1` text across all 12 columns.
2. Add a band of 3 KPIs or cards (4 columns each).
3. Add the body in 8 + 4 or 6 + 6 splits.
4. Read the map, fix every `!` error, and look at the `~` warnings.
