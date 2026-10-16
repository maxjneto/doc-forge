# DocForge layout documents

A layout document is made of **components placed on a grid of square units**. You never
see the page. You read a **text map** (each page drawn in ASCII, plus a table), you can
**measure** a component and **preview** any change for free, and every write tells you
what the layout did on its own.

Tools:
- `measure_component` — how tall something would be at a given width. Free.
- `preview_layout` — what ops (or a whole draft document) would produce. Free, saves nothing.
- `create_layout_document` → `apply_layout_ops` — write.
- `get_layout_map`, `find_layout` — read; `get_layout_document` for the raw JSON.
- `get_layout_notes` → `reply_layout_note` / `resolve_layout_note` — what people pinned to the page (threads; requests made to you come first) and what the layout did on its own.
- `list_layout_themes` → `apply_layout_theme`, `save_layout_theme` — themes (colors, page color, fonts, radii) people reuse across documents.
- `save_layout_version`, `list_layout_versions`, `restore_layout_version` — named versions and the edit timeline.
- `calibrate_style` — compare style variants (sizes, lines, what would move) before choosing one. Free.
- `render_page` — the page as an image (PNG), if you can see images: type, color and balance the map cannot show. Free.
- `review_layout` — what a reader would notice (empty boxes, ragged rows, edges off the guides, a near-empty last page), each with the ops that fix it. Free.

Publishing (the public link other sites load with `@docforge-lib/layout`) is the person's decision, made in the editor: there is no tool for it. Edits you make after it stay private until they publish again.

## Positions

Every component has `at: {page, x, y, w, h?}`:
- `page` starts at 1; `x`, `y`, `w`, `h` are **units** (8px by default), counted from the top-left corner of the page's content area. An A4 page with 40px margins is **89 units wide and 130 tall**. The map's first lines give the exact numbers.
- `h` is a **minimum** height. Text, lists, tables, code, steps, timelines and cards grow to fit their content; leave `h` out and they are exactly as tall as they need to be. KPIs, charts, images and dividers fill `h` (without it, they take a natural size).
- **Guide columns** (12 by default, with a 16px gutter) are only for alignment. The map lists them as `1:0–6 2:8–13 …` (x where each starts and ends). Place by guides with `cols: [first, last]` instead of x/w.

### What the layout does on its own

- **Something that grows pushes down only what it runs into** (overlapping columns), and that pushes what it runs into, and so on. Everything else stays where it was. Pushed boxes keep 2 units of space (`grid.gap`).
- The document stores the position **you** chose. A pushed box returns to its place when whatever pushed it shrinks.
- **Pages:** a box crossing the bottom of a page splits there when it can (text, list, table, code, steps, timeline; tables repeat their header). Otherwise it moves whole to the top of the next page. Either way it pushes what it meets.
- A box wider than the page is pulled back inside (`clamped`). Going over a page's `maxPages` is a warning.
- None of this refuses a write. Each write lists these side effects, and they stay as **notices** until they stop being true.

## What a write answers

`apply_layout_ops` and `preview_layout` (with ops) answer with a summary, not the whole map:

```
Saved. Revision 8.
you changed
  analise  p1 x0 y30 w44 h29 → h38
it moved on its own
  tabela   ↓9 (pushed by analise)
problems: none
pages: 2 · p1 0 free rows · p2 93 free rows
```

Pass `map: "pages"` with `pages: [1]` to get the drawing of some pages, `map: "full"` for all, or call `get_layout_map`.

## Reading the map (level 1)

```
document "Q3" · surface a4 (A4, 2 pages)
page 793.7×1122.5px · margins 40px · content 713.7px wide = 89 units × 130 rows · 1 unit = 8px
guides: 12 columns, gutter 16px → 1:0–6 2:8–13 3:15–21 …
classes: highlight [color] (2: kpi-a, kpi-b)

page 1/2 · 5 boxes · 17 free rows at the bottom
    0         10        20        30   ← x (units)
    1       2      3       4           ← guide columns
  0 +-title---------------------------…
 12 +---------------------------------…
 15 +-kpi-a-----------+  +-kpi-b v----…
 30 +-----------------+  +------------…
130 (end of page)
  id     type  x   y   w   h   class      content                      notes
  title  text  0   0   89  13  —          title-1: "Q3 results" (+1 ¶)
  kpi-b  kpi   30  15  29  16  highlight  kpi 31% "Margin"            moved ↓2 from y13 (pushed by title)
```

- The drawing has one character per unit across. The number on the left is the row; rows that repeat the one above are left out.
- Marks in a box's top edge: `!` error, `~` warning, `v` moved from its declared place, `2/3` piece of a split box.
- The table has the drawn position, the classes, a summary of the content, and what the layout did.
- Long documents: `pages: [2]`, or `draw: false` for the tables only.
- Level 0 is the outline. Level 2 details components: declared vs drawn position, content, every style value with the layer it came from.

## Components (`{id, type, at, content, props?, labels?, style?}`)

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

- **Text roles:** `title-1`, `title-2`, `title-3`, `subtitle`, `body`, `quote`, `caption`. A title is a text with `role: "title-1"`.
- **Inline text:** `**bold**`, `*italic*`, `` `code` ``, `[link](https://…)`. Use runs (`[{text, bold?, italic?, code?, color?, highlight?, link?, size?}]`) only when you need a colour or a size.
- **Links:** `https://`, `http://`, `mailto:` and `#component-id`.
- Ids use letters, digits, `-` and `_`.

## Operations (`apply_layout_ops`, `preview_layout`)

```json
{"op": "add", "component": {...}, "at": {"page": 1, "x": 0, "y": 20, "w": 40}}
{"op": "add", "component": {...}, "at": {"below": "title", "cols": [1, 4]}}
{"op": "add", "component": {...}, "at": {"end": true, "page": 2, "cols": [1, 12]}}
{"op": "place", "component": "id", "at": {"x": 45, "w": 44}}
{"op": "place", "component": "id", "at": {"h": null}}
{"op": "update", "component": "id", "content": {...}, "props": {...}, "labels": [...], "style": {...} | null}
{"op": "edit", "component": "id", "set": {"paragraphs.1": "New text", "rows.2.0": "Sul"}, "remove": ["items.3"]}
{"op": "replaceText", "find": "T2", "replace": "Q2", "components": ["id"], "matchCase": false}
{"op": "row", "below": "title", "h": 16, "items": [{"id": "kpi-a", "type": "kpi", "content": {...}}, {...}, {...}]}
{"op": "row", "below": "kpi-a", "widths": [2, 1], "align": "top", "items": ["analysis", "chart"]}
{"op": "remove", "component": "id"}
{"op": "setStyle", "layer": "document", "selector": "text.title-1", "style": {...}}
{"op": "setStyle", "layer": "label", "label": "highlight", "style": {...}}
{"op": "setRegion", "region": {"id": "sidebar", "page": 1, "x": 60, "y": 0, "w": 29, "h": 130, "style": {...}}}
{"op": "setTokens", "tokens": {"color": {"primary": "#0b6e4f"}}}
{"op": "setGrid", "grid": {"columns": 6, "gutter": 24}}
{"op": "setSurface", "surface": {"id": "a4", "kind": "page", "size": "A4", "margin": 48, "maxPages": 2}}
{"op": "setMeta", "meta": {"title": "Q3", "locale": "pt-BR", "theme": "Executivo"}}
{"op": "page", "action": "insert" | "duplicate" | "remove" | "move", "page": 2, "to": 4}
{"op": "compact", "acrossPages": true}
{"op": "fit", "pages": 2, "strategies": ["compact", "spacing", "type"], "minScale": 0.85}
```

**Positions in `add` and `place`:**
- `below: "id"` puts the component right under where that component is drawn now (`gap` units apart, default 2) and takes its x/w unless you give them.
- `end: true` puts it under the lowest box of `page` (default: the last page).
- In `place`, whatever you leave out keeps its current value. `h: null` removes the minimum height.
- Relative positions are turned into absolute ones when the op runs.

**Other rules:**
- `update` replaces `content` entirely and merges `props` and `style`; `null` clears either (send `null`, then the new value, to replace).
- `row` places components side by side across guide columns in one op: objects are added, ids are moved. `widths` are proportions (`[2, 1]` = two thirds and one third), rounded to whole guide columns; `cols: [a, b]` limits the row to some columns; the y comes from `below`, `end` or `page` + `y`. `h` gives all of them the same minimum height; `align: "stretch"` makes them as tall as the tallest. The summary shows where each one landed.
- `edit` changes parts of `content` by dotted path, with numbers for list positions: `paragraphs.1`, `rows.2.0`, `items.0.text`, `events.1.date`. `set` replaces (one past the end appends), `remove` deletes. Use it to fix a cell or a paragraph without reading the JSON first.
- `replaceText` replaces words in every text of the document (or only in `components`); finding nothing refuses the call.
- `setGrid` with a new `unit` converts every position so nothing changes size. Changing guides moves nothing.
- `compact` moves components up into the empty space above them (only some with `components`, one `page`, or back across a page break with `acrossPages`).
- `fit` makes the document fit `pages` (default: the page limit) with the strategies you allow, mildest first: `compact`, `spacing` (tighter gaps and padding), `type` (text sizes down to `minScale`). It says what it did, or that it could not — and then changes nothing. Try it in `preview_layout` first.
- `page` works on whole pages (slides) by declared position: `insert` adds an empty one after `page` (0 = before the first), `duplicate` copies `page` right after it (copies get new ids, `<id>-2`), `remove` deletes it and what is on it, `move` puts it at `to`.
- A call is refused (nothing saved) only for a malformed op, an id that does not exist, or an invalid document.
- Pass `base_revision` (from the last response) when several writers may be working on the same document.

## Styles

The cascade, from least to most specific: preset → `document` (by type or `type.role`) → region (an area of the grid) → class (`labels`) → the component's own `style`.

**Prefer tokens over raw values:**
- colors: `$color.text|muted|primary|surface|subtle|border|success|danger|warning|highlight|chart1-6`
- sizes: `$size.xs|s|m|l|xl|xxl|display`
- spacing: `$space.0-6`
- radius: `$radius.none|s|m`
- line height: `$lineHeight.tight|normal`

**Fonts:** `$font.sans` (text), `$font.heading` (titles, KPI values, card titles), `$font.mono`. Families: Inter, Source Serif 4, Space Grotesk, JetBrains Mono.

**Themes:** a theme is a token set. `apply_layout_theme` writes every color, both fonts and the radii in one go; `$color.surface` is the page color, so a dark theme ("night") makes the page dark and the text light. Components follow a theme only through tokens: write `$color.primary`, not `#1f4fd8`. When the person likes a look you built, offer to keep it with `save_layout_theme(from_document=…)`.

**Style props:** `fontFamily fontSize fontWeight italic color lineHeight align background borderColor borderWidth radius padding gap accent muted`.

## Slides

A page surface with `"size": "Slide"` (1280 × 720 px, 16:9) is a deck: one slide per page, 146 × 76 units with the default 56px margin. Start with `create_layout_document(template="apresentacao")` or `format="slide"` (empty, with a type scale for slides: body 20px, titles 44px).
- Each slide is self-contained: a `title-1` at the top (one per slide is right here), then one idea — a row of KPIs, a chart beside two or three short paragraphs, steps or a timeline. Keep text short; split a crowded slide in two with `page` `duplicate` and remove half from each.
- Place every component with its slide's `at.page`; nothing should be pushed to the next slide (check the summary for `moved-page`).
- The person presents from the editor (full screen, one slide at a time) or exports a PDF.

## A good way to build one

1. For a report, a proposal, a one-pager or a deck, start from a template (`create_layout_document(template="relatorio" | "proposta" | "one-pager" | "apresentacao")`) and replace its sample content with `edit` and `replaceText`. Otherwise draft the whole document and check it with `preview_layout(content=…)`, or create it empty and add as you go.
2. A `title-1` text across the page (`cols: [1, 12]`), then a `row` of 3–4 KPIs or cards `below` it, with one `h`.
3. Body as a `row` with `widths: [2, 1]` or `[1, 1]` (text beside a chart: `align: "top"`, and leave the text without `h`). Before placing a long text next to something, `measure_component` it at both widths.
4. Read the summary of each write. When a page is done, run `review_layout`, check the map (`get_layout_map`) and, if you can see images, look at it with `render_page`. Fix every `!`, look at the `~`, and check the notes column for anything pushed or split you did not intend.
5. Give each write a `note` (why, in one sentence): the person reviews your changes one by one, with it.
6. When you are done, `request_review` with a summary, the components to look at and the questions only the person can answer. Their answers come back in `get_layout_notes`.
7. Before a big change, `save_layout_version` ("Before the new chart"), so the person can go back with one click.
8. Later: `get_layout_notes` shows what people pinned to the page and what moved since you last looked. Notes marked "for you" are requests: do them, `reply_layout_note` with what you did, then `resolve_layout_note`.
