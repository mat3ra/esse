# Concept documentation (Phases 2 and 4)

> **Status:** review — built on `feature/SOF-8028`, waiting on CI and merge.
> **Created:** 2026-08-16 · **Updated:** 2026-08-16
> **Ticket:** [SOF-8028](https://mat3ra.atlassian.net/browse/SOF-8028)
> (epic: [SOF-8025](https://mat3ra.atlassian.net/browse/SOF-8025)).
> **Parent:** [`./2026-08-16-entity-map-and-docs-overview.md`](./2026-08-16-entity-map-and-docs-overview.md)
> **Depends on:** [`./2026-08-16-entity-graph-foundation.md`](./2026-08-16-entity-graph-foundation.md)
> (generated fragments); benefits from the map (Phase 1) existing first for cross-links.

## Status

**What shipped.** Eleven pages in `docs/` (a landing page plus the ten planned),
`src/js/scripts/buildDocsPages.ts` + `build_docs_pages.ts` rendering them with `marked`, and the
enabling `docs/` → `site/` CI rename. Both the core and remainder phases landed in one PR.

**Divergences from the plan below.**

- **The `docs/` → `site/` rename landed here**, as the plan anticipated ("with Phase 2 at the
  latest"), because docs sources and the staging directory cannot both own `docs/`. The
  vestigial `BUILD_DOCS` branch in `build_schemas.py` was deleted rather than migrated, and
  `build_schemas.ts`'s stale default `BUILD_PATH` comment now matches reality.
- **No Mermaid, and no diagram CDN dependency.** The plan called for Mermaid diagrams. With the
  Entity Map shipped, a static diagram box would duplicate it worse; pages use generated
  relationship fragments and deep-link into the live map instead. One fewer CDN dependency.
- **Six fragment types, not five.** `corpus-totals` was added — several pages need the headline
  counts, and typing them by hand is exactly the drift the fragments exist to prevent.
- **Rendering is atomic.** All pages render before any is written, so a bad fragment fails the
  build instead of leaving a half-written site. Found by observing a partial write during
  testing.
- **Snippet smoke testing was not automated.** The plan proposed executing the JS/PY snippets
  against the built package in Phase 4. The snippets are the README's, which already exercise
  the same calls; automating a second copy earns little. Not filed as a follow-up.

**Still open.** The newcomer review the acceptance criteria call for — someone outside the schema
team confirming the 30-minute goal — has not happened and cannot be self-certified.

Markdown pages under `docs/` (real documentation sources — the staging-directory rename is in the
integration doc), rendered at build time to `schemas.mat3ra.com/docs/`, explaining ESSE's
approach, main concepts, and the reasoning behind them.

Ships in two PRs: **core** (Phase 2) — the four "why" pages only we can write; **remainder**
(Phase 4) — the how-to and reference pages plus generated fragments.

## 1. Audience and goal

1. New contributors needing the mental model before a first PR.
2. Downstream package authors (made, code, wode, ade, …) consuming schemas, pydantic models, TS types.
3. Researchers/evaluators deciding whether to adopt the formats.

Goal: a reader with JSON Schema basics understands the architecture in ~30 minutes and can locate
the right schema for a task unaided. Every page ends with deep links into the Explorer and the
Entity Map (`/map/#/entity/<id>` — the stable URL contract).

## 2. Pages

### Phase 2 — the core (review decision e)

**01 — Why ESSE exists.**
Data-centric materials science: entities-as-data with schemas as the single source of truth
shared by humans, validators, and code generators. Design goals: interoperability, validation,
codegen, human readability. What each paper contributes —
[the ecosystem paper](https://arxiv.org/pdf/1902.10838.pdf) (the entity model: material →
model/method → workflow → job → property) and
[CateCom](https://pubs.acs.org/doi/abs/10.1021/acs.jcim.2c00112) (the categorization approach).
Why schemas-first beats code-first for a multi-runtime, multi-consumer ecosystem.

**02 — Schema layering.**
The build-up, bottom to top, with the layer taxonomy from the graph foundation:
`core/primitive` (custom scalars/arrays extending JSON Schema's built-ins; why primitives "cannot
be re-constructed from each other") → `core/abstract` (unit-less mathematics: vectors, matrices,
grids, plots) → `core/reusable` (domain building blocks carrying meaning: energy, band gap,
atomic data, k-points) → `core/reference` (provenance: literature/experiment/exabyte) →
`definitions/units` (the most-referenced schema in the corpus — 30 inbound references — and why
units live in one place). Includes the measured layer inventory (generated fragment, Phase 4
retrofits it; hand-written numbers acceptable in Phase 2).

**03 — Entity anatomy.**
The root entities and how they compose: `material` (basis + lattice + properties + metadata
mixins), `model` (categorized physics + `method`), `workflow` → `subworkflow` → `unit` (the
executable decomposition; unit types: execution, assignment, condition, map, …), `job` (binds
workflow + compute + project + material references), `property` and `property/holder` (the
44-way union — how computed results attach to sources), `software`/`application` and the
`*_directory` catalogs. One composition diagram (Mermaid) per major entity plus a full-map
teaser linking to the Entity Map. Explicit subsection (review addition): the **material variant
family** — `material` vs `material_hashed` vs `material_enhanced`/`material_enhanced_hashed` —
what each exists for (canonical entity, content-addressed deduplication, enriched payloads) and
when a consumer should reach for which.

**04 — Categorization (CateCom).**
`core/reusable/categories` (tier1/tier2/tier3/type/subtype), slugified entries, why paths not
trees. The split that names the directories: `*_category` = taxonomies (the vocabulary),
`*_directory` = catalogs (the concrete instances), `materials_category_components` = the building
blocks categories are assembled from. Worked example: locating an exchange-correlation functional
— `models_category/pb` tier walk down to a `models_directory` entry, with live links at every
step. How `manifest/*.yaml` registries relate (the properties manifest as the platform-facing
index over `properties_directory`).

### Phase 4 — the remainder

**05 — Behavioral mixins.** `in_memory_entity/*` (base, named, defaultable, has-metadata,
runtime-items) and `system/*` (soft-removable, sharing, timestampable, status, entity
references): how `allOf` stacks platform behavior onto domain payloads; reading an entity schema
as base + mixins + payload. Generated: the mixin usage table (which entities extend which mixins).

**06 — Conventions.** `$id` = path (dashed) and the dash/underscore duality with the shared
helper; draft-07 baseline; no circular refs (lint-enforced — 0 today); `include()` statements
(`json_include`) and where they are allowed; generative keys (`isGenerative`) and what consumes
them; formatting rules (4-space, 100-char, double quotes — the ESSE conventions AGENTS.md points
other repos at).

**07 — The pipeline.** The full diagram: `set_schema_ids` → `build_schemas.ts` (resolve +
`mergeAllOf`) → `dist/js` assets → `datamodel-codegen` (pydantic v2 models) and
`json-schema-to-typescript` (TS types) → npm/PyPI packaging → Pages deploy. Pre-commit's role.
Explicit section (review addition): the **dual-runtime equivalence contract** — what is
guaranteed identical between PY and JS artifacts (the JSON assets), what is generated per-runtime
and may legitimately differ (models/types), and what that means for consumers pinning versions.

**08 — Consuming ESSE.** Runnable snippets: JS (`ESSE`, `JSONSchemasInterface.matchSchema`,
`getPatchedSchemaById`, `validateAndClean`, generated types) and PY (`ESSE`,
`mat3ra.esse.models.*` pydantic classes, `validate_and_clean`); patterns from downstream repos
(e.g. ade's `ApplicationSchemaBase` subclassing).

**09 — Contributing a schema, end to end.** Worked example: add a new scalar property — schema
file, example file, manifest entry, `npm run set-schema-ids`, rebuild, what the graph lint checks
(L1–L10 by name), tests, PR expectations. The page doubles as the checklist reviewers point at.

**10 — Glossary & FAQ.** Terms (entity, layer, category vs directory, manifest, resolved schema,
generative key, …) with one-line definitions, each linking to its concept page and map location.

## 3. Tooling (review decisions 1, 2)

- Sources: `docs/NN-<slug>.md` with a tiny front-matter block (title, nav order). The current
  `docs/README.md` (staging-dir explainer) is superseded by the rename.
- Renderer: `src/js/scripts/buildDocsPages.ts` using `marked` (one new dev dependency) — wraps
  rendered HTML in the site chrome (shared header: Docs · Explorer · Map), builds the sidebar
  nav from front matter, emits to `site/docs/`. No SSG; revisit only past ~15 pages.
- Diagrams: Mermaid via CDN (pinned + SRI), client-side, same pattern as Monaco.
- Code snippets in pages are checked by eye in Phase 2; Phase 4 adds a smoke script that executes
  the JS/PY snippets against the built package (they are the same snippets the README already
  makes, so drift is user-visible — worth automating).

## 4. Generated fragments (Phase 4)

Marker-delimited blocks (`<!-- generated:layer-inventory -->…<!-- /generated -->`) refreshed by
`buildDocsPages.ts` from `graph.json` at build time — not committed, so pages in git stay pure
prose while the published pages carry live numbers:

| Fragment | Used by | Content |
| --- | --- | --- |
| `layer-inventory` | 02 | per-layer counts table |
| `entity-relationships:<id>` | 03, 05 | extends / contains / used-by lists for a given entity |
| `mixin-usage` | 05 | entities × mixins matrix |
| `hub-table` | 02 | top in-degree schemas |
| `example-coverage` | 09 | current coverage number + worst domains (lint L9's data) |

Fragment markers failing to resolve (typo'd id) fail the docs build.

## 5. Writing style

Same register as the papers' expository sections: plain, declarative, no marketing. Every claim
about the corpus is either generated or carries a link to a live schema. British/American spelling
per existing README (American). Each page ≤ ~1500 words; longer means split.

## 6. Acceptance criteria

- **Phase 2:** pages 01–04 live under `/docs/`; each cross-links explorer + map; the categorization
  worked example's every link resolves; a newcomer review (one person outside the schema team)
  confirms the 30-minute goal.
- **Phase 4:** pages 05–10 live; all generated fragments render and fail the build when broken;
  snippet smoke passes; README slims down to install/usage and points here for concepts.
