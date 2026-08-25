# Schema graph measurements

> **Type:** context — measurements backing the entity-map/docs plans; not a plan itself.
> **Created:** 2026-08-16 · **Updated:** 2026-08-16
> **Epic:** [SOF-8025](https://mat3ra.atlassian.net/browse/SOF-8025)
> **Measured by:** `npm run lint-entity-graph` (`src/js/scripts/buildEntityGraph.ts`), the
> production extractor built under [SOF-8026](https://mat3ra.atlassian.net/browse/SOF-8026).

**Corrected 2026-08-16 (SOF-8026).** The first pass used a throwaway Python walker that counted
*every* `$ref` as an edge, including the 20 that point inside their own document. Those are not
edges between schemas. The extractor separates them, so the totals below supersede the original
figures (937 edges / 376 / 384 / 177): the difference is exactly those 20 same-document refs.
The extractor is now the source of truth, and `tests/js/entityGraph.tests.ts` pins these numbers.

Method: every `schema/**/*.json` is parsed and each `$ref` classified by its innermost enclosing
structural keyword — inside an `allOf` item → *extends*; under `properties.<name>` or `items` →
*contains*; inside `oneOf`/`anyOf` → *variant*. Refs resolve as relative file paths after
stripping JSON-pointer fragments (`file.json#/pointer`).

## Totals

| Measure | Value |
| --- | --- |
| Schema files | 564 |
| Example files | 209 (a schema has a mirror example in 209/564 = 37% of cases) |
| Cross-schema reference edges | 917 |
| — of kind *extends* (`allOf`) | 372 |
| — of kind *contains* (`properties`/`items`) | 375 |
| — of kind *variant* (`oneOf`/`anyOf`) | 170 |
| Same-document refs (`#/…`), which are **not** edges | 20 |
| Edges carrying a JSON-pointer fragment | 144 (e.g. `enum_options.json#/physicsBased`) |
| Unresolvable refs | **0** |
| Reference cycles | **0** (README's no-circular-refs rule holds in practice) |
| Isolated schemas (no refs in or out) | 34 |

## Domains (top-level directories), by schema count

| Domain | Count | | Domain | Count |
| --- | --- | --- | --- | --- |
| `properties_directory` | 85 | | `models_directory` | 14 |
| `methods_category` | 79 | | *(root files)* | 11 |
| `core` | 73 | | `software_directory` | 11 |
| `workflow` | 62 | | `software` | 10 |
| `system` | 38 | | `material` | 7 |
| `materials_category_components` | 31 | | `in_memory_entity` | 7 |
| `models_category` | 25 | | `definitions` | 4 |
| `methods_directory` | 24 | | `property` | 4 |
| `context_providers_directory` | 22 | | `compute` | 3 |
| `apse` | 17 | | `job` | 3 |
| `materials_category` | 17 | | `method` | 3 |
| `model` | 14 | | | |

## Layer taxonomy

The first pass left a 123-node `other` bucket. Review decision 9 rejected that: the bucket was a
defect of the rules, not a property of the corpus. `classifyLayer` in the extractor now covers
every path, and an unclassifiable path is a **lint failure** — so a newly added top-level
directory forces a deliberate decision instead of silently landing in a catch-all.

| Layer | Count | What it holds |
| --- | --- | --- |
| directory | 156 | `*_directory` catalogs of concrete instances |
| category | 152 | `*_category` + `materials_category_components` taxonomies |
| **entity-component** | **106** | sub-schemas of root entities, keyed by `ownerEntity` |
| system | 38 | platform mixins (`system/*`) |
| reusable | 31 | `core/reusable` domain blocks |
| primitive | 23 | `core/primitive` custom scalars and arrays |
| **application-parsing** | **17** | `apse/*` application formats and parsers |
| entity | 11 | root-level schemas (material, model, workflow, …) |
| reference | 10 | `core/reference` provenance |
| abstract | 9 | `core/abstract` unit-less mathematics |
| in-memory-entity | 7 | behavioral mixins |
| definition | 4 | `definitions/` shared vocabularies |

The former `other` bucket resolved exactly as predicted: 106 entity-components plus 17
application-parsing schemas.

## Hubs — most referenced (in-degree)

| Schema | In-degree |
| --- | --- |
| `definitions/units` | 30 |
| `core/primitive/scalar` | 28 |
| `core/reusable/energy` | 15 |
| `workflow/unit/context/_base` | 15 |
| `core/primitive/array_of_3_numbers` | 14 |
| `materials_category_components/entities/core/three-dimensional/crystal` | 14 |
| `system/entity_reference` | 13 |
| `core/reusable/categories` | 12 |
| `method/unit_method` | 11 |
| `method` (root) | 10 |
| `core/abstract/2d_plot` | 10 |
| `methods_category/physical/qm/wf/enum_options` | 10 |

## Largest fan-out (out-degree)

| Schema | Out-degree |
| --- | --- |
| `property/holder` | 44 (the union over all property types) |
| `properties_directory/non-scalar/total_energy_contributions` | 15 |
| `workflow/unit/context/item` | 15 |
| `apse/file/applications/espresso/7.2/pw.x` | 10 |
| `model/model_parameters` | 9 |

The hub and fan-out tables above are unchanged by the same-document correction: those refs never
contributed to degree counts.

## Isolated schemas (sample of the 34)

`apse/db/materials_project/2025.9.25/summary`, `apse/db/materials_project/legacy/material`,
`apse/materials/builders/slab/pymatgen/parameters`,
`context_providers_directory/points_path_data_provider_rendering`, `core/abstract/coordinate_2d`,
`core/primitive/array_of_strings`, `core/reusable/atomic_data/value_string`,
`definitions/constants`, `definitions/material`, `material/conventional`,
`materials_category_components/entities/reusable/three-dimensional/repetitions`,
`properties_directory/electronic_configuration`, …

Mostly standalone leaf definitions and externally-consumed formats. The map parks these in a
labeled "islands" strip; the lint reports (but does not fail on) newly isolated schemas.

## Implications relied on by the plans

1. **Scale is trivial for client-side rendering** (~1.5k rendered elements; Cytoscape.js is
   comfortable to ~5k). No backend, no tiling, no WebGL needed at current size.
2. **The graph must be extracted from `schema/` sources.** The published resolved schemas
   (`dist/js/schema`) have `allOf` merged and refs inlined — the extraction target does not exist
   there.
3. **Same-document refs must be excluded from the edge set**, or a schema appears to reference
   itself. Twenty exist; the extractor counts them separately and checks their pointers resolve.
4. **Edge kinds partition cleanly into three renderable relationship types** (extends / contains /
   variant) with zero pathological cases (no cycles, no broken refs) — no special-case rendering
   required at launch.
5. **Fragment refs (144) resolve to file-level edges** and keep the pointer as an edge attribute;
   they never point to files outside the schema tree. The lint checks each pointer exists in its
   target, which nothing verified before.
