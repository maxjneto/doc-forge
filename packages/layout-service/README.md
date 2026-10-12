# layout-service

Internal HTTP service that runs [`@docforge/layout`](../../../docforge-layout) for the
Python backend. Stateless: every request carries the whole document; the backend
stores it, checks permissions and tracks revisions.

| Route | Body | Returns |
| --- | --- | --- |
| `GET /health` | | `{ ok }` |
| `POST /validate` | `{ doc, surface? }` | `{ ok, diagnostics, map, pages }` |
| `POST /apply` | `{ doc, ops, surface? }` | `{ ok, doc, diagnostics, map }` |
| `POST /map` | `{ doc, level, components?, surface? }` | `{ level, text }` |

Only on the internal network: no published port in production and no Caddy route.

```sh
npm install --workspaces=false   # standalone install, uses vendor/*.tgz
npm test
npm start                        # PORT=8002
```

The library is vendored. To update it, run `scripts/vendor-layout.sh` from the repo
root, then `npm install --workspaces=false` here and in `packages/frontend`.
