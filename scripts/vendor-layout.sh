#!/usr/bin/env sh
# Pack @docforge/layout from the sibling repo and vendor it into the packages
# that use it. The lib has no public registry or remote, so the tarball is
# committed: Docker builds each package from its own folder and needs it there.
#
#   scripts/vendor-layout.sh [path-to-docforge-layout]   (default: ../docforge-layout)
#
# After running it, `npm install` in packages/frontend and packages/layout-service
# picks up the new tarball; commit the tarball and both lockfiles together.
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
