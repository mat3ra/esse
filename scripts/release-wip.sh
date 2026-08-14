#!/usr/bin/env bash
# Build, pack, and publish a WIP pre-release asset for the current commit so consumers
# (e.g. web-app) can install it without dist/ being committed to this repo. Each commit
# gets its own immutable tag/asset - no cache/integrity headaches from a URL whose
# content silently changed underneath the same tag.
# See RELEASING.md for the manual equivalent and details.
#
# Usage:
#   npm run release:wip                  # tag/asset derived from the current commit
#   npm run release:wip -- <tag>         # explicit tag override
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
    echo "ERROR: GitHub CLI ('gh') is not installed." >&2
    echo "Install it (e.g. 'brew install gh') and run 'gh auth login', then retry." >&2
    exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TAG="${1:-wip-$(git rev-parse --short HEAD)}"
ASSET_NAME="esse.tgz"

echo "== Building dist/ =="
npm run transpile-and-build-assets

echo "== Packing tarball =="
find . -maxdepth 1 -name "*.tgz" -delete
npm pack
mv mat3ra-esse-*.tgz "$ASSET_NAME"

echo "== Publishing release '$TAG' =="
if gh release view "$TAG" >/dev/null 2>&1; then
    gh release upload "$TAG" "$ASSET_NAME" --clobber
else
    gh release create "$TAG" "$ASSET_NAME" \
        --prerelease --title "esse WIP: $TAG" \
        --notes "Pre-release build for testing in consumers (not for production use)."
fi

echo
echo "Done. Install in a consumer with:"
echo "  https://github.com/mat3ra/esse/releases/download/$TAG/$ASSET_NAME"
