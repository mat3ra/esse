# Entity Map & Concept Docs — overview

> **Status:** upcoming — agreed direction, not built.
> **Created:** 2026-08-16 · **Updated:** 2026-08-16
> **Ticket:** [SOF-8025](https://mat3ra.atlassian.net/browse/SOF-8025) (epic; one child ticket per document below).
> **Review:** [`../context/2026-08-16-entity-map-plan-review-tb.md`](../context/2026-08-16-entity-map-plan-review-tb.md)
> — its decisions are incorporated throughout.
> **Measurements:** [`../context/2026-08-16-schema-graph-measurements.md`](../context/2026-08-16-schema-graph-measurements.md)

Two additions to [schemas.mat3ra.com](https://schemas.mat3ra.com/), joining the existing schema
explorer:

- **Concept documentation** — pages explaining ESSE's approach and main concepts: the schema
  layering, entity anatomy, CateCom categorization, conventions, and the build pipeline — the
  "why" that today lives only in the papers and in maintainers' heads.
- **Entity Map** — an interactive, zoomable, pannable map of all 564 schemas and their 937
  references ("Google Maps for the entity graph"), with search, fly-to, permalinks, and a
  per-entity detail panel.

Both are fed by one shared foundation: a build-time **schema graph** extraction (`graph.json`)
that also acts as a CI lint. Three surfaces, one graph, no drift.

## Child documents

| Document | Ticket | Scope | Ships as |
| --- | --- | --- | --- |
| [`2026-08-16-entity-graph-foundation.md`](./2026-08-16-entity-graph-foundation.md) | [SOF-8026](https://mat3ra.atlassian.net/browse/SOF-8026) | Graph extractor, `graph.json` + its schema, CI lint | Phase 0 PR |
| [`2026-08-16-entity-map.md`](./2026-08-16-entity-map.md) | [SOF-8027](https://mat3ra.atlassian.net/browse/SOF-8027) | The map page: UX, visual encoding, technology, phases MVP + polish | Phase 1 and 3 PRs |
| [`2026-08-16-concept-documentation.md`](./2026-08-16-concept-documentation.md) | [SOF-8028](https://mat3ra.atlassian.net/browse/SOF-8028) | Ten concept pages, tooling, generated fragments | Phase 2 and 4 PRs |
| [`2026-08-16-site-integration-and-release.md`](./2026-08-16-site-integration-and-release.md) | [SOF-8029](https://mat3ra.atlassian.net/browse/SOF-8029) | CI restructure (`docs/` vs `site/`), landing page, cross-linking, testing, release | Phase 5 PR (plus enabling changes pulled earlier) |

## Phasing (revised per review)

| Phase | Scope | Effort (focused days) |
| --- | --- | --- |
| **0 — Graph foundation** | Extractor + `graph.json` + lint in the *test* job; standalone PR, lands first | 1–2 |
| **1 — Entity Map MVP** | Map page with pan/zoom, search + fly-to, detail panel, permalinks | 3–5 |
| **2 — Concept docs, core** | The "why" pages: motivation, layering, entity anatomy, categorization | 2–3 |
| **3 — Map polish** | Baked layout, semantic zoom, layer-aware placement — **timeboxed**, driven by usage friction | 3–5 |
| **4 — Concept docs, remainder** | Mixins, conventions, pipeline, consuming, contributing, glossary; generated fragments | 2–3 |
| **5 — Integration & release** | Three-surface header, landing page, link checker, README, smoke tests | 1–2 |

Total ≈ 2–3 focused weeks. Map MVP ships before the docs so the docs can link into it; phases 1
and 2 may run in parallel after 0. Each phase is a single PR where practical; its child document
moves `upcoming/ → review/ → implemented/` with it.

## Decisions log (settled at review, 2026-08-16)

1. `docs/` becomes real documentation sources; the CI Pages staging directory is renamed to
   `site/` (gitignored). No `docs_src/`.
2. Docs tooling: minimal `marked`-based build-time rendering; no static site generator.
3. CDN dependencies stay (Monaco precedent) with pinned versions + subresource integrity hashes,
   applied to the explorer's existing tags too.
4. The feature is named **Entity Map** (no "Atlas").
5. Examples are panel content, not map nodes; example coverage (209/564) becomes a lint-reported
   metric.
6. `graph.json` is site-only for now; emitter stays packaging-ready.
7. Landing page gets the Docs · Explorer · Map header.
8. Graph lint runs on pull requests (test job), not only at deploy.
9. Layer taxonomy must be total — no `other` bucket; unclassifiable paths fail the lint.
10. Map placement encodes the layering (core central → entities → taxonomies peripheral), not just
    directory clustering; prototyped in polish phase with force layout as fallback.
11. `manifest/properties.yaml` flags (`isResult`, `isMonitor`, units) surface as node badges, and
    manifest→schema resolution joins the lint.
12. `#/entity/<$id>` deep links are a documented stability contract.

## Risks

| Risk | Mitigation |
| --- | --- |
| Corpus growth degrades map performance | Cytoscape comfortable to ~5k elements (~3× today); `graph.json` is renderer-agnostic, Sigma.js/WebGL is the escape hatch |
| Layout instability breaks spatial memory | Build-time layout, deterministic seed, warm-start from previous release coordinates |
| Docs drift from schemas | Relationship fragments generated from `graph.json` every build |
| Polish-phase gold-plating | Phase 3 timeboxed and friction-driven (review decision g) |
| Dash/underscore duality breaks deep links | Single shared `schemaIdToPublishedPath` / `publishedPathToSchemaId` helper, covered by tests |
