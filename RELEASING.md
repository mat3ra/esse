# Releasing WIP builds for consumers

`dist/` is build output and is gitignored — it is not committed on any branch. Published
releases (`npm publish`, tagged versions) are unaffected: `npm pack`/`npm publish` build
their file list from the `files` field in `package.json` (`["dist"]`), not from what's
tracked in git.

To let a consumer (e.g. `web-app`) install a not-yet-mergeable WIP branch without
`github:mat3ra/esse#branch` (which has no way to build `dist/` on install), publish a
manual pre-release asset instead:

```bash
npm run release:wip
```

This builds `dist/`, packs it, and creates (or updates) a GitHub pre-release tagged after
the current branch, requiring the [GitHub CLI](https://cli.github.com/) (`gh`) to be
installed and authenticated (`gh auth login`) — the script exits with a clear error if
`gh` is missing. Pass an explicit tag to override the derived one:
`npm run release:wip -- <tag>`.

The resulting download URL is printed at the end and follows this shape:

```text
https://github.com/mat3ra/esse/releases/download/<branch-slug>/esse.tgz
```

Re-running `npm run release:wip` on the same branch re-uploads over the existing asset
(`gh release upload ... --clobber`) rather than minting a new tag, so the URL stays stable
across snapshots.

## Reinstalling in a consumer after a rebuild

Because `release:wip` re-uploads over the same tag/asset, the download URL never changes
across snapshots — which means a plain `npm install` in the consumer won't pick up a
rebuild: npm's cache stores the tarball keyed by URL, and `package-lock.json` pins the
`integrity` hash from the first install, so a same-URL-but-changed-content refetch either
gets served stale from cache or fails with `EINTEGRITY`. Force a real refetch instead:

```bash
npm install @mat3ra/esse@https://github.com/mat3ra/esse/releases/download/<branch-slug>/esse.tgz \
  --legacy-peer-deps --force
```

`--force` bypasses npm's cache, and re-targeting the dependency explicitly makes npm
recompute and update the `integrity` hash in `package-lock.json` instead of erroring on a
mismatch. A plain `npm install --legacy-peer-deps` with no explicit package argument will
not refetch, since nothing in `package.json`/the lockfile looks changed to npm.

Delete the pre-release once the branch merges and a real published version supersedes it:

```bash
gh release delete <branch-slug> --yes
```

See `scripts/release-wip.sh` for the exact steps if you'd rather run them manually.
