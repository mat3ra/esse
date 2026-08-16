# Schema graph measurements

> **Type:** context — measurements backing the entity-map/docs plans; not a plan itself.
> **Created:** 2026-08-16 · **Updated:** 2026-08-16
> **Epic:** [SOF-8025](https://mat3ra.atlassian.net/browse/SOF-8025)
> **Measured on:** branch `claude/repo-docs-entity-map-plan-km8xiz` at `ba30397`
> (schema sources identical to `dev` at the time).

Method: a throwaway Python walker (not committed; the production extractor is specified in
[`../upcoming/2026-08-16-entity-graph-foundation.md`](../upcoming/2026-08-16-entity-graph-foundation.md))
parsed every `schema/**/*.json`, recorded each `$ref`, and classified it by structural context:
inside an `allOf` item → *extends*; under `properties.<name>` or `items` → *contains*; inside
`oneOf`/`anyOf` → *variant*. Refs were resolved as relative file paths after stripping JSON-pointer
fragments (`file.json#/pointer`).

## Totals

| Measure | Value |
| --- | --- |
| Schema files | 564 |
| Example files | 209 (a schema has a mirror example in 209/564 = 37% of cases) |
| Reference edges | 937 |
| — of kind *extends* (`allOf`) | 376 |
| — of kind *contains* (`properties`/`items`) | 384 |
| — of kind *variant* (`oneOf`/`anyOf`) | 177 |
| Refs carrying a JSON-pointer fragment | 164 (e.g. `enum_options.json#/physicsBased`) |
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

## Layer taxonomy, first pass

Classifying by path prefix (`core/primitive` → primitive, `*_category` → category, root files →
entity, …) gives:

| Layer | Count |
| --- | --- |
| directory (`*_directory` catalogs) | 156 |
| category (`*_category` + `materials_category_components` taxonomies) | 152 |
| **other (unclassified)** | **123** |
| system | 38 |
| reusable | 31 |
| primitive | 23 |
| entity (root files) | 11 |
| reference (`core/reference`) | 10 |
| abstract (`core/abstract`) | 9 |
| in-memory-entity | 7 |
| definition (`definitions/`) | 4 |

The 123-node `other` bucket is sub-schemas of the root entities (`workflow/unit/*`, `material/*`,
`model/mixins/*`, `method/*`, `software/*`, `job/*`, `property/*`, `compute` — 106 files) plus
`apse` (17 files). Review decision: these become an **entity-component**
layer (keyed to the owning entity) with explicit assignments for the rest, and the extractor must
fail on any path its rules cannot classify, keeping the taxonomy total over time.

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
3. **Edge kinds partition cleanly into three renderable relationship types** (extends / contains /
   variant) with zero pathological cases (no cycles, no broken refs) — no special-case rendering
   required at launch.
4. **Fragment refs (164) resolve to file-level edges** and keep the pointer as an edge attribute;
   they never point to files outside the schema tree.
