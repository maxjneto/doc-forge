# layout-service

The [`@docforge/layout`](../../../docforge-layout) HTTP server, packaged as an image for
the Python backend. There is no code here: the library ships the server
(`docforge-layout serve`), and this package only pins the version and runs it.

| Route | Body | Returns |
| --- | --- | --- |
| `GET /health` | | `{ ok }` |
| `POST /validate` | `{ doc, surface? }` | `{ ok, diagnostics, map, pages }` |
| `POST /apply` | `{ doc, ops, surface? }` | `{ ok, doc, diagnostics, map }` |
| `POST /map` | `{ doc, level, components?, surface? }` | `{ level, text }` |
| `POST /render` | `{ doc, surface?, grid? }` | `{ ok, page, pages, diagnostics }` |

Stateless and unauthenticated: it is only on the internal network (no published
port in production, no proxy route). The backend owns storage, auth and revisions.

```sh
npm install --workspaces=false   # standalone install, uses vendor/*.tgz
npm test                         # contract the backend relies on
npm start                        # port 8002
```

To update the library, run `scripts/vendor-layout.sh` from the repo root, then
`npm install --workspaces=false` here and `npm install` at the root.
