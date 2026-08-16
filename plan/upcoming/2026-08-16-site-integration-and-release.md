# Site integration & release (Phase 5, plus enabling changes)

> **Status:** upcoming — agreed direction, not built.
> **Created:** 2026-08-16 · **Updated:** 2026-08-16
> **Ticket:** [SOF-8029](https://mat3ra.atlassian.net/browse/SOF-8029)
> (epic: [SOF-8025](https://mat3ra.atlassian.net/browse/SOF-8025)).
> **Parent:** [`2026-08-16-entity-map-and-docs-overview.md`](./2026-08-16-entity-map-and-docs-overview.md)

The changes that tie the three surfaces (Docs · Explorer · Entity Map) into one site, and the CI
restructure that enables them. Two of these changes are *enabling* and get pulled forward into
the phase that first needs them (noted per item); the rest ship as the final integration PR.

## 1. `docs/` → `site/` staging rename (enabling; lands with Phase 2 at the latest)

Review decision 1. The Pages deploy (`peaceiris/actions-gh-pages`) publishes the staging
directory's *contents* to the `gh-pages` branch — the staging directory's *name* is incidental,
and `schemas.mat3ra.com` is an external redirect to `mat3ra.github.io/esse`, so nothing outside
one workflow file cares. Rename frees `docs/` for real documentation sources.

Concrete diff, all in `.github/workflows/cicd.yml` (deploy-docs job) plus two housekeeping files:

| Change | Detail |
| --- | --- |
| Build step | `cp -r dist/js/example site/`, `cp -r dist/js/schema site/`, `cp dist/js/schemas.json site/` (was `docs/`); `mkdir -p site` replaces the `rm -rf docs/README.md` hack |
| Explorer step | copies `src/html/{index.html,style.css,app.js}` into `site/`; `files.json` generator reads/writes `site/` |
| Deploy step | `publish_dir: ./site` |
| `.gitignore` | add `site/` |
| `docs/README.md` | replaced by the docs landing source (concept-documentation doc); its current content (staging-dir explainer) is obsolete after the rename |
| `build_schemas.py` | the `BUILD_DOCS=true` branch writes `docs/py/**` and is invoked by nothing in CI — **delete the branch** rather than migrate it (review note; the JS build is the docs source of truth per README §5) |
| `build_schemas.ts` | default `BUILD_PATH` comment references `./docs/js/` — update to match reality (`dist/js` in CI); no behavior change |

Rollback story: the rename is a single-commit revert; `gh-pages` branch history is unaffected.

## 2. New CI steps (each lands with its phase)

Final deploy-docs job shape (additions marked):

```yaml
- npm install
- npm run build-entity-graph -- --output site/     # + Phase 0 (also runs in test job as lint)
- <existing dist→site copies>
- npm run build-docs-pages                          # + Phase 2 (docs/*.md → site/docs/)
- cp -r src/html/map site/map                       # + Phase 1
- <existing explorer copy + files.json>
- npm run check-site-links                          # + Phase 5 (see §5)
- peaceiris deploy (publish_dir: ./site)
```

The graph lint additionally runs in the pull-request test job from Phase 0 onward (review
decision 8) — deploy never discovers what a PR could have caught.

## 3. Shared header and landing page (Phase 5)

- A minimal shared header partial (Docs · Explorer · Map + the ESSE mark) injected into all three
  surfaces at build time — explorer and map keep their full-viewport workspaces; the header is a
  slim bar consistent with the existing titlebar styling.
- `index.html` (landing = the explorer today) gains the header and a first-visit blurb linking the
  three surfaces; the explorer remains the root page — no URL changes, nothing breaks.
- Explorer file rows gain a "View on map" affordance (maps `schema/<published path>` →
  `/map/#/entity/<id>` via the shared helper); the map panel links back (§4 of the map doc).

## 4. URL contracts (Phase 5 documents; Phase 1 implements)

Documented in `docs/` page 06 (conventions) as stability commitments:

| URL | Meaning | Stability |
| --- | --- | --- |
| `/#<published path>` | Explorer deep link (existing) | keep as-is |
| `/map/#/entity/<$id>` | Map: fly to + open panel | additive changes only |
| `/map/#/view/<x>,<y>,<zoom>` | Map viewport | additive changes only |
| `/graph.json` | The entity graph asset | schema-versioned via `schema/system/entity_graph.json` |
| `/docs/<slug>.html` | Concept pages | slugs stable once published |

## 5. Cross-surface verification (Phase 5)

- `check-site-links`: a build-time walker over `site/` that verifies every internal href/anchor
  resolves (docs↔explorer↔map↔graph.json). Fails the deploy on breakage; the docs build already
  fails on unresolvable generated-fragment ids (docs doc §4).
- Smoke checklist (manual, in the PR template for site-touching changes): load each surface,
  search+fly-to on the map, one explorer↔map round trip, one docs→map deep link, mobile pinch.
- SRI retrofit (review decision 3): all CDN tags — existing Monaco included — carry pinned
  versions + `integrity` attributes; done once in the first PR that touches `src/html`.

## 6. Release (Phase 5)

- README: "Documentation" section pointing at `/docs/`, "Entity Map" section with a screenshot
  (per AGENTS.md 4.3, screenshots land via Git LFS — `.gitattributes` entry added before the
  first image).
- Announce internally; collect the map-polish friction list (feeds the Phase 3 timebox — review
  decision g).
- Move this document set `upcoming/ → review/` when the branch opens, `→ implemented/` with
  `## Status` sections after deploy verification, per `plan/README.md`.

## 7. Acceptance criteria

- One deploy produces all three surfaces from a clean checkout with no manual steps.
- Link checker green; a deliberately broken docs link fails the deploy in a scratch branch.
- The `docs/` directory in git contains only documentation sources; `site/` never appears in git
  status.
- All existing explorer URLs (`/#schema/...` hashes) still resolve.
