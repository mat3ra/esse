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

Delete the pre-release once the branch merges and a real published version supersedes it:

```bash
gh release delete <branch-slug> --yes
```

See `scripts/release-wip.sh` for the exact steps if you'd rather run them manually.
