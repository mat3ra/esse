# Releasing WIP builds for consumers

`dist/` is build output and is gitignored — it is not committed on any branch. Published
releases (`npm publish`, tagged versions) are unaffected: `npm pack`/`npm publish` build
their file list from the `files` field in `package.json` (`["dist"]`), not from what's
tracked in git.

To let a consumer (e.g. `web-app`) install a not-yet-mergeable WIP branch without
`github:mat3ra/esse#branch` (which has no way to build `dist/` on install), publish a
pre-release asset instead — automatically via CI (preferred) or manually.

## Automatic (CI)

Include `[release]` anywhere in a commit message and push. `.github/workflows/release-wip.yml`
runs the `js/release-wip` action (from [`mat3ra/actions`](https://github.com/mat3ra/actions))
on that push, which builds, packs, and publishes/updates the pre-release tarball asset for
the current branch — no local `gh` setup needed. Commits without the marker don't trigger
it, so routine pushes stay quiet.

## Manual (local)

```bash
npm run release:wip
```

This builds `dist/`, packs it, and creates (or updates) a GitHub pre-release tagged after
the current branch, requiring the [GitHub CLI](https://cli.github.com/) (`gh`) to be
installed and authenticated (`gh auth login`) — the script exits with a clear error if
`gh` is missing. Pass an explicit tag to override the derived one:
`npm run release:wip -- <tag>`. Useful for iterating without wanting to push yet, or if
CI is down — otherwise prefer the `[release]` commit-message marker above, since it's
identical output with no local setup.

Either path produces the same download URL shape:

```text
https://github.com/mat3ra/esse/releases/download/<branch-slug>/esse.tgz
```

Repeating either path on the same branch (another `[release]`-marked push, or another
`npm run release:wip`) re-uploads over the existing asset (`gh release upload ...
--clobber`) rather than minting a new tag, so the URL stays stable across snapshots.

## Reinstalling in a consumer after a rebuild

Because a rebuild re-uploads over the same tag/asset, the download URL never changes
across snapshots — which means a plain `npm install` in the consumer won't pick up a
rebuild: npm's cache stores the tarball keyed by URL, and `package-lock.json` pins the
`integrity` hash from the first install, so a same-URL-but-changed-content refetch either
gets served stale from cache or fails with `EINTEGRITY`. Force a real refetch instead. In `web-app`, use the wrapper script from repo root:

```bash
npm run mat3ra:install -- esse <branch-slug>
```

(`web-app/scripts/mat3ra-install.sh` — installs `@mat3ra/esse@<release-url>` with
`--legacy-peer-deps --force`.) `--force` bypasses npm's cache, and re-targeting the
dependency explicitly makes npm recompute and update the `integrity` hash in
`package-lock.json` instead of erroring on a mismatch. A plain
`npm install --legacy-peer-deps` with no explicit package argument will not refetch, since
nothing in `package.json`/the lockfile looks changed to npm.

Delete the pre-release once the branch merges and a real published version supersedes it:

```bash
gh release delete <branch-slug> --yes
```

See `scripts/release-wip.sh` for the exact steps if you'd rather run them manually.
