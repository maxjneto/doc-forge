# layout-service

The [`@docforge-lib/layout`](https://github.com/maxjneto/docforge-layout) HTTP server, packaged as an image for
the Python backend. There is no code here: the library ships the server
(`docforge-layout serve`), and this package only pins the version and runs it, with
`@resvg/resvg-js` installed so `/render-image` can draw pages as PNG without a browser.

| Route | Body | Returns |
| --- | --- | --- |
| `GET /health` | | `{ ok }` |
| `POST /validate` | `{ doc, surface? }` | `{ ok, diagnostics, map, pages }` |
| `POST /apply` | `{ doc, ops, pages?, draw?, surface? }` | `{ ok, doc, diagnostics, changes, map, summary }` (never saves: also the preview) |
| `POST /map` | `{ doc, level, components?, pages?, draw?, surface? }` | `{ level, text }` |
| `POST /render` | `{ doc, surface?, grid? }` | `{ ok, page, pages, diagnostics }` |
| `POST /measure` | `{ component, doc?, widths?, cols?, surface? }` | `{ ok, measurements, diagnostics, text }` |
| `POST /find` | `{ doc, query, surface? }` | `{ matches, text }` |
| `POST /diff` | `{ before, after, touched?, surface? }` | `{ changes }` |
| `POST /locate` | `{ doc, anchors, surface? }` | `{ anchors }` |
| `POST /review` | `{ doc, surface? }` | `{ findings, text }` |
| `POST /render-image` | `{ doc, page?, scale?, highlight?, surface? }` | `{ page, pages, png (base64), width, height }` |
| `POST /upgrade` | `{ doc }` | `{ ok, doc, notes }` |

`ok` is false only when the document cannot be used (invalid schema, duplicate ids,
a malformed op); layout consequences come back as `changes` and `diagnostics`.

Stateless and unauthenticated: it is only on the internal network (no published
port in production, no proxy route). The backend owns storage, auth and revisions.

```sh
npm install --workspaces=false   # standalone install
npm test                         # contract the backend relies on
npm start                        # port 8002
```

To update the library, change the version of `@docforge-lib/layout` in `package.json`
(here and in `packages/frontend`), then `npm install --workspaces=false` here, `npm run lock`
in `packages/frontend` and `npm install` at the root. To try an unreleased build first, see
`scripts/vendor-layout.sh`.
