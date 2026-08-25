# Entity graph foundation (Phase 0)

> **Status:** review — built on `feature/SOF-8026`, waiting on CI and merge.
> **Created:** 2026-08-16 · **Updated:** 2026-08-16
> **Ticket:** [SOF-8026](https://mat3ra.atlassian.net/browse/SOF-8026)
> (epic: [SOF-8025](https://mat3ra.atlassian.net/browse/SOF-8025)).
> **Parent:** [`./2026-08-16-entity-map-and-docs-overview.md`](./2026-08-16-entity-map-and-docs-overview.md)
> **Basis:** measurements in [`../context/2026-08-16-schema-graph-measurements.md`](../context/2026-08-16-schema-graph-measurements.md)

## Status

**What shipped.** `src/js/scripts/buildEntityGraph.ts` (extractor + lint), `build_entity_graph.ts`
(CLI), `src/js/scripts/entity_graph.schema.json` (the schema `graph.json` validates against),
`tests/js/entityGraph.tests.ts`, npm scripts `build-entity-graph` / `lint-entity-graph`, and the
deploy step that publishes `graph.json`. The lint runs on every pull request via `npm test`.

**Divergences from the plan below.**

- **`meta.generatedAt` was dropped.** A timestamp makes output non-deterministic, contradicting the
  byte-identical acceptance criterion. `meta` instead carries counts that are actually useful:
  `edgeCountsByKind`, `layerCounts`, `sameDocumentRefCount`, `schemasWithExample`,
  `isolatedNodeCount`.
- **Baseline counts corrected.** The plan cited 937 edges (376/384/177) from a throwaway walker
  that counted same-document `$ref`s as edges. The real figures are **917 cross-schema edges**
  (372 extends / 375 contains / 170 variant) plus **20 same-document refs**, and 144 — not 164 —
  edges carry a JSON-pointer fragment. The context document records the correction.
- **`publishedPath` added to the node model.** The published path is not always the source path:
  `properties_directory/non-scalar/…` is published as `non_scalar` because the id round-trip
  converts dashes. Both paths are now carried, since the GitHub link needs one and the Explorer
  link needs the other.
- **`publishedPathToSchemaId` is a lookup, not a pure function.** The mapping is not invertible by
  string rules for the reason above, so the module exports `buildPublishedPathIndex(nodes)`
  instead. The round-trip test still holds.
  *(Superseded in [SOF-8029](./2026-08-16-site-integration-and-release.md): the inverse from
  published path to `$id` **is** exact — no `$id` contains an underscore, so the map is injective.
  Only the source path is unrecoverable. A pure `publishedPathToSchemaId` was added there.)*
- **Edge labels are preserved for all kinds**, not just `contains`. A union under
  `properties.data.oneOf` is recorded as a variant *of `data`*, which the detail panel can show.
- **L4 was dead on arrival, and now is not.** The reference walker started at a root context of
  `contains`, so every `$ref` came back classified and the L4 failure below could never fire —
  a documented rule enforcing nothing. The root context now carries no kind. No current edge
  changes (zero refs in the corpus reach a `$ref` without first passing `allOf`, `oneOf`,
  `anyOf`, `properties` or `items`), but a `$ref` in an unrecognized structural position now
  fails the lint by name instead of being silently labelled `contains`.
- **The graph schema lives outside `schema/`.** Deliverable 2 below proposed
  `schema/system/entity_graph.json`, on the reasoning that dogfooding is a virtue. It is not,
  here: the corpus is a vocabulary for digital materials science, and a description of this
  tool's own output is not part of that vocabulary. Shipping it in `schema/` also put it in the
  published npm/PyPI payload and in `schemas.json`, and it counted itself as a 565th node —
  a measurement instrument reading its own weight. It now sits beside the extractor as
  `src/js/scripts/entity_graph.schema.json` with `$id: "entity-graph"`, imported directly
  (`resolveJsonModule`) rather than read from disk. Node count and the isolated-node baseline
  are back to 564 and 34.

**Still open.** Nothing from this document. Layout coordinates (`x`/`y`) remain deliberately
absent until the map polish phase, as planned.

---

A build-time extraction of the schema reference graph into a single `graph.json` asset, plus a CI
lint derived from it. This is the shared foundation for the Entity Map and the concept docs, and
it ships first, as its own PR — the lint has standalone value even if nothing else were built.

## 1. Deliverables

1. `src/js/scripts/buildEntityGraph.ts` — extractor + lint (TypeScript, sibling of
   `setSchemaIds.ts`, reusing `walkDirSync` and `settings.ts`).
2. A JSON Schema that `graph.json` itself validates against (validated with the already-present
   `ajv`). Location may move at implementation time if maintainers prefer a different home.
   *(It did: see the Status section — it ships as `src/js/scripts/entity_graph.schema.json`,
   outside the corpus, because it describes a build artifact rather than an entity.)*
3. npm scripts: `build-entity-graph` (emit + validate) and `lint-entity-graph` (validate only,
   non-zero exit on hard failures) — the latter added to the JS test pipeline so pull requests
   fail on graph violations (review decision 8).
4. Mocha tests in `tests/js/entityGraph.tests.ts`.

**Critical constraint:** input is the *source* tree `schema/**/*.json` — never `dist/js/schema`.
Resolution merges `allOf` and inlines refs; the edges this graph exists to record are destroyed
there.

## 2. Data model

```typescript
interface EntityGraph {
    meta: {
        generatedAt: string;        // ISO date of the producing build (not committed, so no churn)
        nodeCount: number;
        edgeCount: number;
    };
    nodes: EntityGraphNode[];
    edges: EntityGraphEdge[];
}

interface EntityGraphNode {
    id: string;                     // "$id", dashed form, e.g. "in-memory-entity/named-defaultable"
    path: string;                   // source path, e.g. "schema/in_memory_entity/named_defaultable.json"
    title: string;                  // schema "title", may be ""
    description: string;            // schema "description", may be ""
    domain: string;                 // top-level directory, "(root)" for root files
    layer: EntityGraphLayer;        // see §3 — total classification, no "other"
    ownerEntity?: string;           // for layer "entity-component": the root entity it belongs to
    inDegree: number;
    outDegree: number;
    propertyCount: number;          // number of keys under "properties" after shallow inspection
    hasExample: boolean;            // mirror file exists under example/
    manifest?: {                    // present for property schemas listed in manifest/properties.yaml
        name: string;               // manifest key, e.g. "total_energy"
        isResult?: boolean;
        isMonitor?: boolean;
        defaultUnits?: string;
    };
    x?: number;                     // precomputed layout coordinates — absent until map polish phase
    y?: number;
}

type EntityGraphEdgeKind = "extends" | "contains" | "variant";

interface EntityGraphEdge {
    source: string;                 // node id
    target: string;                 // node id
    kind: EntityGraphEdgeKind;
    label?: string;                 // for "contains": the property name; "[]" appended when via items
    pointer?: string;               // JSON-pointer fragment when the $ref carried one, e.g. "/physicsBased"
}
```

Edge-kind mapping from JSON Schema structure (counts verifiable against the context doc:
372 extends / 375 contains / 170 variant = 917 edges):

| Structural context of the `$ref` | Kind |
| --- | --- |
| Inside an `allOf` item | `extends` |
| Under `properties.<name>` (any depth within that property's subtree), or under `items` | `contains` (label = property name) |
| Inside `oneOf` / `anyOf` arrays | `variant` |

A `$ref` matching none of these (none exist today) is a lint **failure**, forcing a conscious
classification decision rather than silent bucketing.

## 3. Layer classification — total by construction

Review decision 9: the first-pass taxonomy left 123 nodes unclassified; that is a defect of the
rules, not the data. The extractor implements the table below, applied top to bottom, and **fails
the lint if no rule matches** — adding a new top-level directory then requires a one-line rule
addition, keeping the taxonomy total forever.

| Rule (path prefix relative to `schema/`) | Layer |
| --- | --- |
| `core/primitive/**` | `primitive` |
| `core/abstract/**` | `abstract` |
| `core/reusable/**` | `reusable` |
| `core/reference/**` | `reference` |
| `definitions/**` | `definition` |
| `in_memory_entity/**` | `in-memory-entity` |
| `system/**` | `system` |
| Root-level files (`material.json`, `model.json`, …) | `entity` |
| `material/**`, `model/**`, `method/**`, `property/**`, `workflow/**`, `job/**`, `software/**`, `compute/**` | `entity-component` (with `ownerEntity` = first path segment) |
| `materials_category/**`, `models_category/**`, `methods_category/**`, `materials_category_components/**` | `category` |
| `properties_directory/**`, `models_directory/**`, `methods_directory/**`, `software_directory/**`, `context_providers_directory/**` | `directory` |
| `apse/**` | `application-parsing` (APSE: application parsers/formats — external-facing formats, not platform entities) |

Expected counts after reclassification (from the measurements): `entity-component` absorbs ~106 of
the former `other` bucket, `application-parsing` the remaining 17.

## 4. Lint rules

| # | Rule | Severity |
| --- | --- | --- |
| L1 | Every `$ref` resolves to a file under `schema/` (after stripping fragments) | **fail** |
| L2 | Every `$id` equals its path relative to `schema/`, extension dropped, `_` → `-` (the `setSchemaIds.ts` contract) | **fail** |
| L3 | Every path classifies to a layer (§3) | **fail** |
| L4 | Every `$ref` classifies to an edge kind (§2) | **fail** |
| L5 | Every fragment ref's pointer exists in the target document | **fail** |
| L6 | `manifest/properties.yaml` entries' `schemaId` resolves to an existing schema | **fail** (today unchecked and silently breakable) |
| L7 | No reference cycles (README rule; 0 today) | **fail** |
| L8 | Newly isolated nodes vs the committed baseline (34 today) | warn |
| L9 | Example coverage report (schemas without a mirror example; 355 today) | warn, with count in output |
| L10 | `graph.json` validates against `src/js/scripts/entity_graph.schema.json` via ajv | **fail** |

Warnings print in CI logs; failures exit non-zero. The lint runs in two places: the JS test job on
every pull request (fast — no assets written) and the deploy job (writes `site/graph.json`).

## 5. Emission and wiring

- `npm run build-entity-graph` → writes `graph.json` (pretty-printed, ~150 KB) into the Pages
  staging directory (`site/` after the integration-doc rename; `docs/` until then — the script
  takes the output directory as an argument to stay agnostic).
- Deterministic output: nodes sorted by `id`, edges by `(source, target, kind, label)` — byte-identical
  across runs on identical sources, so diffs of the published asset are reviewable.
- No `Date`-dependent content except `meta.generatedAt`, which exists only in the emitted asset
  (never committed), so determinism concerns don't arise in git.
- The emitter takes no site-specific inputs (review decision 6) — packaging `graph.json` into the
  npm/PyPI payloads later must be a packaging change only.

## 6. Tests (`tests/js/entityGraph.tests.ts`)

1. Totals match the measurement baseline (564 nodes / 917 edges — updated intentionally when
   schemas change; the test message says how).
2. Edge-kind partition sums to the total; per-kind counts match baseline.
3. Spot checks: `material --extends--> in-memory-entity/named-defaultable`;
   `model --contains[method]--> method`; a known `variant` edge from `property/holder`.
4. `schemaIdToPublishedPath` / `publishedPathToSchemaId` round-trip for every node (the
   dash/underscore duality helper, exported for the map and docs builds to reuse).
5. Layer classification is total and matches expected per-layer counts.
6. Manifest join: `total_energy` node carries `manifest.isResult === true` and `eV` units.
7. `graph.json` validates against its schema (L10 exercised in-process).

## 7. Acceptance criteria

- One PR containing extractor, schema, tests, and test-job wiring; green CI.
- `graph.json` published to the site on the next deploy after merge.
- A deliberately broken `$ref` in a scratch branch fails the PR's test job with a message naming
  the offending file and ref.
- Counts in the emitted asset reconcile with the measurements context doc.

## 8. Out of scope (lives in sibling documents)

Layout precomputation and coordinates (`x`/`y` stay absent — map polish phase), any rendering, the
`site/` rename itself (integration doc; this script just parameterizes its output path).
