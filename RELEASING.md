# Releasing WIP builds for consumers

`dist/` is build output and is gitignored — it is not committed on any branch. Published
releases (`npm publish`, tagged versions) are unaffected: `npm pack`/`npm publish` build
their file list from the `files` field in `package.json` (`["dist"]`), not from what's
tracked in git.

To let a consumer (e.g. `web-app`) install a not-yet-mergeable WIP commit without
`github:mat3ra/esse#branch` (which has no way to build `dist/` on install), publish a
pre-release asset instead — automatically via CI (preferred) or manually.

Releases are tagged per **commit**, not per branch: `wip-<short-commit-sha>` (e.g.
`wip-e8ed741`). Each commit gets its own immutable tag/asset URL, so a consumer pinned to
a specific commit's tarball never has the content underneath that URL silently change.

## Automatic (CI)

Include `[release]` anywhere in a commit message and push. `.github/workflows/release-wip.yml`
runs the `js/release-wip` action (from [`mat3ra/actions`](https://github.com/mat3ra/actions))
on that push, which builds, packs, and publishes the pre-release tarball asset for that
commit — no local `gh` setup needed. Commits without the marker don't trigger it, so
routine pushes stay quiet.

## Manual (local)

```bash
npm run release:wip
```

This builds `dist/`, packs it, and creates a GitHub pre-release tagged after the current
commit (`wip-<short-sha>`), requiring the [GitHub CLI](https://cli.github.com/) (`gh`) to
be installed and authenticated (`gh auth login`) — the script exits with a clear error if
`gh` is missing. Pass an explicit tag to override the derived one:
`npm run release:wip -- <tag>`. Useful for iterating without wanting to push yet, or if
CI is down — otherwise prefer the `[release]` commit-message marker above, since it's
identical output with no local setup.

Either path produces the same download URL shape:

```text
https://github.com/mat3ra/esse/releases/download/wip-<short-sha>/esse.tgz
```

Re-running either path **on the same commit** (e.g. a manual re-trigger, or running
`release:wip` twice without committing in between) re-uploads over that commit's existing
asset (`gh release upload ... --clobber`) rather than minting a duplicate. A new commit
always gets a new tag/URL.

## Reinstalling in a consumer after a same-commit rebuild

Because a same-commit rebuild re-uploads over that commit's existing tag/asset, the
download URL doesn't change — which means a plain `npm install` in the consumer won't
pick up the rebuild: npm's cache stores the tarball keyed by URL, and
`package-lock.json` pins the `integrity` hash from the first install, so a
same-URL-but-changed-content refetch either gets served stale from cache or fails with
`EINTEGRITY`. (Normally this doesn't come up — a new commit means a new URL — but the
build isn't fully deterministic, e.g. the Python wheel/tarball step embeds a timestamp,
so even re-running CI on the exact same commit can produce different bytes.) Force a
real refetch instead. In `web-app`, use the wrapper script from repo root:

```bash
npm run mat3ra:install -- esse wip-<short-sha>
```

(`web-app/scripts/mat3ra-install.sh` — installs `@mat3ra/esse@<release-url>` with
`--legacy-peer-deps --force`.) `--force` bypasses npm's cache, and re-targeting the
dependency explicitly makes npm recompute and update the `integrity` hash in
`package-lock.json` instead of erroring on a mismatch. A plain
`npm install --legacy-peer-deps` with no explicit package argument will not refetch, since
nothing in `package.json`/the lockfile looks changed to npm.

Delete a pre-release once its commit merges and a real published version supersedes it:

```bash
gh release delete wip-<short-sha> --yes
```

See `scripts/release-wip.sh` for the exact steps if you'd rather run them manually.
