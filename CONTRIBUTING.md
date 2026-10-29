# Contributing

Thanks for looking. DocForge is a small project with one maintainer, so issues that explain a problem well are as valuable as pull requests.

## Getting set up

[docs/development.md](docs/development.md) covers running the stack, each package on its own, the design preview and the tests. The architecture pages in [docs/architecture](docs/architecture/overview.md) explain how the parts fit before you change one.

## Branches

```
feat/<short-name>  ─┐
fix/<short-name>   ─┼─► develop ─► main ─► production
chore/<short-name> ─┘
```

- Branch from `develop` and open the pull request against `develop`.
- `main` is what runs in production: every merge into it is built and deployed. It only receives `develop` (or an urgent `fix/*`).
- Both `main` and `develop` require the CI checks to pass; nothing is pushed to them directly.

## Before opening a pull request

Run the checks for the packages you touched (CI runs all of them):

| Package | Checks |
|---|---|
| backend | `ruff check .` · `pytest tests -q` · a migration if you changed a model |
| frontend | `npx tsc --noEmit` · `npm run lint:tokens` · `npm run test` · `npm run build` |
| mcp | `ruff check src/ tests/` · `pytest tests -q` |
| layout-service | `npm test` |

For interface changes, look at them in the design preview (`npm run dev:preview`) and follow the design rules in [packages/frontend/CLAUDE.md](packages/frontend/CLAUDE.md): tokens instead of literal colours, the primitives in `components/ui`, one primary action per view.

## Commits

[Conventional commit](https://www.conventionalcommits.org/) prefixes with the package as scope — `feat(backend): …`, `fix(frontend): …`, `refactor(mcp): …`, `chore(deploy): …`, `docs: …`. The subject says what changes for someone using DocForge; the body says why, and what was checked.

## Changes to the layout format

The document format and the layout engine belong to [`@docforge-lib/layout`](https://github.com/maxjneto/docforge-layout). A change there is released as a new version and then picked up here; [docs/development.md](docs/development.md#working-on-the-layout-library) shows how to try an unreleased build.

## Security

Please do not open public issues for vulnerabilities. Write to **maxjneto@gmail.com** instead.
