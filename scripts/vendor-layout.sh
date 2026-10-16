#!/usr/bin/env sh
# Pack @docforge/layout from the sibling repo and vendor it into the packages
# that use it. The lib has no public registry or remote, so the tarball is
# committed: Docker builds each package from its own folder and needs it there.
#
#   scripts/vendor-layout.sh [path-to-docforge-layout]   (default: ../docforge-layout)
#
# It also rewrites the tarball's integrity hash in every lockfile: npm keeps the
# old hash when the version did not change, and `npm ci` then fails with
# EINTEGRITY. Afterwards run `npm install --workspaces=false` in
# packages/layout-service, `npm run lock` in packages/frontend and `npm install`
# at the root, and commit the tarballs and the lockfiles together.
set -eu

root="$(cd "$(dirname "$0")/.." && pwd)"
lib="${1:-$root/../docforge-layout}"
lib="$(cd "$lib" && pwd)"

(cd "$lib" && npm run build >/dev/null)
tarball="$(cd "$lib" && npm pack --silent --pack-destination "$root")"

for pkg in frontend layout-service; do
  dir="$root/packages/$pkg/vendor"
  mkdir -p "$dir"
  rm -f "$dir"/docforge-layout-*.tgz
  cp "$root/$tarball" "$dir/"
  echo "vendored $tarball -> packages/$pkg/vendor/"
done
rm "$root/$tarball"

# npm keeps an installed package whose version did not change, even when the
# tarball did: drop the installed copies (and Vite's pre-bundle) so the next
# install really takes the new build.
rm -rf "$root/node_modules/@docforge/layout"   "$root/packages/frontend/node_modules/@docforge/layout"   "$root/packages/layout-service/node_modules/@docforge/layout"   "$root/packages/frontend/node_modules/.vite"

# Point every lock entry for the vendored tarball at its real hash.
node - "$root" "$tarball" <<'JS'
const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const [root, tarball] = process.argv.slice(2);
const integrity =
  "sha512-" + createHash("sha512").update(readFileSync(join(root, "packages/frontend/vendor", tarball))).digest("base64");
for (const lock of ["package-lock.json", "packages/layout-service/package-lock.json", "packages/frontend/package-lock.json"]) {
  const path = join(root, lock);
  let text;
  try { text = readFileSync(path, "utf8"); } catch { continue; }
  const data = JSON.parse(text);
  let changed = 0;
  for (const entry of Object.values(data.packages ?? {})) {
    if (typeof entry.resolved === "string" && entry.resolved.endsWith(tarball) && entry.integrity !== integrity) {
      entry.integrity = integrity;
      changed++;
    }
  }
  if (changed) {
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    writeFileSync(path, JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol);
    console.log(`updated ${changed} integrity hash(es) in ${lock}`);
  }
}
JS
