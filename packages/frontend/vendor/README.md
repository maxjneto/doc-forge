# vendor/

Empty on purpose. `@docforge-lib/layout` comes from npm; `scripts/vendor-layout.sh` puts an
unreleased build of it here (and points package.json at it) to try it before a release.
The Dockerfile copies this folder either way.
