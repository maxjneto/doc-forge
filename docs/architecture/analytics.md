# Analytics

DocForge uses PostHog for product analytics, session recordings, heatmaps, web vitals and error tracking. All of it is off unless configured (`VITE_POSTHOG_KEY` in the frontend, `POSTHOG_ENABLED` + `POSTHOG_API_KEY` in the backend), and none of it ever carries document text.

## Where events come from

| Source | Code | Sent when |
|---|---|---|
| Browser | `packages/frontend/src/analytics/` (`track()`) | only after the person accepts cookies |
| Backend | `packages/backend/app/services/observability.py` | always, but anonymous unless the person accepted (see below) |
| MCP server | `POST /api/telemetry/mcp-tool`, forwarded by the backend as `mcp_tool_called` | always, under the same rule as backend events; `DOCFORGE_TELEMETRY=off` stops it |

Everything that matters for the funnel and the north star (documents created, agent changes reviewed, subscriptions) is a **backend** event, so it counts whether or not someone accepted cookies. Browser events describe how people use the editors and the marketing pages.

## Consent and identity

The cookie banner's choice is stored in the browser and on the account (`users.analytics_consent`, sent with `PATCH /api/users/me`).

| Choice | Browser | Backend `distinct_id` | Person profile |
|---|---|---|---|
| accepted | events, recordings, heatmaps, vitals, errors | Clerk user id (joins the browser's events) | yes: email, `created_at`, `plan`, `locale` |
| declined, or never answered (an MCP-only user never sees the banner) | nothing | `anon_<HMAC-SHA256(POSTHOG_ANON_SALT, user id)>` | no (`$process_person_profile: false`) |

The pseudonym is stable, so the funnel still counts one account as one, but nobody can tie it back to the account without the salt. **Never change `POSTHOG_ANON_SALT`** once set: that splits everyone's anonymous history.

Backend errors (`$exception`) are never tied to a person.

## What is never sent

- **Document text.** Session recordings mask every text node inside the document (`maskTextSelector` in `analytics/privacy.ts`): the Markdown editor and previews, the layout pages (their iframes get `data-ph-mask` on `<body>` through `maskForRecording()`), the side panels, comments, titles and presence. Images in documents and the slide thumbnails (SVGs that contain the slide's text) are blocked. Inputs are masked.
- **User text in attributes.** Masking only touches text nodes, so elements that carry a document or folder name in `title` are `ph-no-capture` (not recorded at all), and questions use `aria-labelledby` instead of `aria-label`.
- **Clicked text from content areas.** Autocapture skips anything inside `ph-sensitive` (canvas, editor, side panels, document rows).
- **Public link tokens.** `before_send` rewrites `/public/<token>` to `/public/:token` in every URL property, and public pages are never recorded.
- **API keys.** Copying a new key sends `api_key_copied` with no properties.

## Properties on every event

| Property | Values |
|---|---|
| `environment` | `production`, `staging`, `development`. Local runs do not send at all unless `VITE_POSTHOG_DEV=1` |
| `app_version` | the git SHA of the build (`VITE_APP_VERSION`, `APP_VERSION`) |
| `app` | `web` or `backend` |
| `locale` | browser events: `pt-BR` or `en` |

Inside a document, browser events also carry `document_id`, `document_mode` (`markdown` / `layout`), `document_kind` (`page` / `slides`) and `role`. Backend events about a document carry `document_id`, `document_mode` and `source` (`agent`: an API key, i.e. MCP; `person`: the app).

## Naming

`object_action`, snake_case, past tense. Who acted goes in `source`, never in the name. Editor-only interactions keep a `layout_` / `markdown_` prefix.

## Catalogue

### Lifecycle and funnel (backend)

| Event | Properties |
|---|---|
| `agent_connected` | `harness`. First use of an API key |
| `document_created` | `source`, `document_mode`, `document_kind`, `template` |
| `agent_changes_reviewed` | `document_mode`, `outcome` (`kept`, `undone`, `accepted`, `rejected`, `triaged`), `changes`. **North star** |
| `checkout_started` | `plan`, `currency` |
| `subscription_started` / `subscription_canceled` | `plan`; sets `plan` on the person |
| `analytics_consent_set` | `consent` |

The activation funnel (`packages/backend/scripts/setup_posthog_funnel.py`) is `agent_connected → document_created → agent_changes_reviewed → subscription_started`, production only. It uses server events only, because a pseudonymous account has different ids in the browser and on the server.

### Documents (backend)

`document_published`, `document_unpublished`, `document_exported` (`format`), `document_shared` / `document_unshared` (`via`: `person` / `public_link`, `role`), `document_moved`, `folder_created`, `public_document_read`, `version_saved`, `version_restored`, `version_renamed`, `comment_created` (`reply`, `for_agent`), `comment_status_changed`, `review_requested`, `review_answered`, `suggestion_created`, `markdown_changed`, `layout_changed` (`ops`, `op_types`, `side_effects`, `replaced`), `layout_checked` (`findings`, `codes`), `theme_saved`.

### Agents (backend)

| Event | Properties |
|---|---|
| `mcp_tool_called` | `tool`, `toolset` (`markdown`, `cgd`, `all`), `ok`, `duration_ms`, `response_chars`, `approx_tokens`, `image_bytes`, `detail_*` |
| `agent_request_failed` | `route` (template), `status`, `duration_ms`. Successful calls are already counted per tool |

### Editors (browser)

`document_opened`, `version_restored`, `document_exported` (layout PDF), `public_link_copied`, `markdown_changes_saved`, `collab_session_joined` (`people`, `agents`), and the layout editor's `layout_*` events: `panel_opened`, `block_inserted`, `block_copied`, `inline_edit`, `width_set`, `row_reordered`, `row_rebuilt`, `slide_changed`, `style_changed` (throttled), `style_reset`, `look_applied`, `master_changed`, `theme_previewed`, `theme_applied`, `health_fixed`, `health_ignored`, `agent_change_undone`, `version_viewed`, `presented`, `publish_opened`, `undo`, `redo`, `shortcut_used`.

### Marketing (browser)

`cta_clicked` (`target`: `start` / `pro_checkout`, `page`, `location`), `snippet_copied`, `mcp_snippet_copied`, `api_key_copied`, `demo_interacted`, `user_signed_up`. UTM parameters, referrers, heatmaps and web vitals come with the pageviews.

## Ingestion and configuration

In production the browser sends to `https://doc-forge.dev/ingest`, a Caddy proxy to PostHog (`deploy/Caddyfile`), so blockers that drop `*.posthog.com` do not erase the developer audience.

| Variable | Where | Purpose |
|---|---|---|
| `VITE_POSTHOG_KEY` | frontend build | project key; empty = off |
| `VITE_POSTHOG_HOST` | frontend build | `https://doc-forge.dev/ingest` in production |
| `VITE_POSTHOG_UI_HOST` | frontend build | PostHog's UI (toolbar); default `https://us.posthog.com` |
| `VITE_POSTHOG_DEV` | frontend | `1` to send from localhost |
| `VITE_APP_VERSION` | frontend build | the git SHA (set by CI) |
| `POSTHOG_ENABLED`, `POSTHOG_API_KEY`, `POSTHOG_HOST` | backend | server events |
| `POSTHOG_ANON_SALT` | backend | secret for pseudonyms; set once, never change |
| `APP_VERSION` | backend | the image tag (set by `docker-compose.prod.yml`) |
