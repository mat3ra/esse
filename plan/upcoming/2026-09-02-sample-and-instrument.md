# Sample and instrument (Phase 1)

> **Status:** upcoming — agreed direction, nothing built.
> **Created:** 2026-09-02 · **Updated:** 2026-09-02
> **Ticket:** *child of the epic to be filed.* **Driver:** [SOF-7988](https://mat3ra.atlassian.net/browse/SOF-7988)
> **Parent:** [`./2026-09-02-experimental-data-overview.md`](./2026-09-02-experimental-data-overview.md)
> **Depends on:** [`./2026-09-02-experimental-data-foundation.md`](./2026-09-02-experimental-data-foundation.md)
> **Basis:** [`../context/2026-09-02-experimental-data-survey.md`](../context/2026-09-02-experimental-data-survey.md),
> [`../context/2026-09-02-experimental-data-plan-review-tb.md`](../context/2026-09-02-experimental-data-plan-review-tb.md)

The two nouns that measurements and processes point at: `sample` (mirror of `material`) and
`instrument` (mirror of `software/application`). This is also the first PR that creates a
`schema/<noun>/` directory, so it carries the tooling that keeps the layer taxonomy total
(`ENTITY_DOMAINS`), the map colour family, the docs categorization domain and the concept page —
with screenshots (review change requests h, k).

## 1. Deliverables

New schemas (each with a mirror example):

| Path | Purpose |
| --- | --- |
| `schema/sample.json` | root: `named_defaultable` + `sample/sample_properties` + `sample/metadata` |
| `schema/sample/sample_properties.json` | mirror of `material/material_properties` (§2.1) |
| `schema/sample/metadata.json`, `schema/sample/metadata/wafer_properties.json` | mirror of `material/metadata` + `slab_properties` |
| `schema/sample/layer.json`, `schema/sample/position.json`, `schema/sample/library.json` | stack, join key, combinatorial grid |
| `schema/system/_sample.json` | `entity_reference` narrowed to `cls: ["Sample"]`, mirror of `system/_material.json` |
| `schema/instrument.json` | root: `named_defaultable` + `instrument/instrument_properties` |
| `schema/instrument/instrument_properties.json` | mirror of `software/application_properties` (§2.2) |
| `schema/instrument/component.json`, `schema/instrument/location.json` | parts and where the instrument lives |
| `schema/instrument/instrument_property.json` | "has an instrument" mixin, mirror of `job/compute_property.json`; composed by `measurement/base` (Phase 2) and `process/stage/mixin` (Phase 3) |
| `schema/instruments_directory/scanning_probe_microscopy/asylum_research_jupiter.json` | seed catalogue entry (idiom of `software_directory/modeling/espresso.json`) |
| `schema/instruments_directory/deposition/nlr_pdac_combinatorial_sputtering_chamber.json` | seed catalogue entry for the NLR `pdac_com*` chambers |

Modified:

| Path | Change |
| --- | --- |
| `src/js/scripts/buildEntityGraph.ts` | `ENTITY_DOMAINS` += `"sample", "instrument", "measurement", "process"` (line 115) — otherwise lint L3 fails for `schema/<noun>/**`; `*_directory` and `*_category` are already routed; no new layer, so `EntityGraphLayer`, `entity_graph.schema.json` and `LAYER_BANDS` stay untouched |
| `src/html/map/map.js` | `FAMILIES` += `{ key: "experimental", label: "Samples, instruments, measurements & processes", color: "#f47067", domains: ["sample", "instrument", "measurement", "process", "instruments_directory", "measurements_directory", "processes_directory", "techniques_category"] }` before `platform`; the "22 source directories into eight families" comment updated |
| `src/js/scripts/buildDocsPages.ts` | `categorizationSchemesFragment`: `domains` += `"techniques-category"` (line 158); the docs test asserts only the three existing rows, so the extra row is safe |
| `docs/10-experimental-data.md` (new, `order: 10`) and `docs/10-glossary.md` → `docs/11-glossary.md` (`order: 11`, slug unchanged) | concept page carrying the mirror table and the "why"; glossary entries for Sample, Instrument, Measurement, Process, Technique category, Channel |
| `docs/02-schema-layering.md`, `docs/03-entity-anatomy.md`, `docs/09-contributing-a-schema.md` | forward-looking paragraph; "Where things go" rows: technique vocabulary → `techniques_category`, technique catalogue → `measurements_directory` / `processes_directory`; the "Eleven schemas" count changes in Phase 3 when all four roots exist |
| `tests/js/entityGraph.tests.ts` | counts; `classifyLayer("sample/sample-properties")` → `{layer: "entity-component", ownerEntity: "sample"}`; spot check `sample --extends--> in-memory-entity/named-defaultable` |
| `plan/context/2026-08-16-schema-graph-measurements.md` | dated addendum |

## 2. Data model

### 2.1. `sample`

```json
{
  "$id": "sample",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "sample schema",
  "description": "A physical specimen: substrate, film, stack, wafer library, piece or device. The experimental mirror of material, composed exactly as material.json is, with sample_properties in place of material_properties. No basis/lattice requirement because a specimen may have unknown or non-crystalline structure; the nominal structure is referenced through _material.",
  "type": "object",
  "allOf": [
    { "description": "in-memory entity", "$ref": "in_memory_entity/named_defaultable.json" },
    { "$ref": "sample/sample_properties.json" },
    { "$ref": "sample/metadata.json" }
  ]
}
```

```json
{
  "$id": "sample/sample-properties",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "sample properties schema",
  "description": "Domain-specific fields of a sample, mirroring material/material_properties: formula, external, src and derivedProperties are kept verbatim; basis and lattice are replaced by an optional reference to the nominal material; form, layers, library, position, _parent, composition and identifiers are new.",
  "type": "object",
  "properties": {
    "formula": { "description": "nominal reduced chemical formula, e.g. Al0.7Sc0.3N (of the top layer for stacks)", "type": "string" },
    "form": { "description": "physical form of the specimen", "type": "string", "enum": ["bulk", "thin_film", "multilayer", "powder", "wafer", "library", "piece", "device", "liquid", "other"] },
    "composition": { "description": "measured or nominal elemental fractions", "type": "array", "items": { "$ref": "../properties_directory/structural/elemental_ratio.json" } },
    "_material": { "description": "Subset of the full information about the nominal (idealized) material structure of this sample.", "$ref": "../system/_material.json" },
    "_parent": { "description": "Subset of the full information about the sample this one was cut, diced or selected from, e.g. the library a position belongs to.", "$ref": "../system/entity_reference.json" },
    "position": { "description": "Location of this sample on its parent, e.g. a library position.", "$ref": "position.json" },
    "identifiers": { "description": "External identifiers: HTEM sample id, LMC number, barcode.", "type": "array", "items": { "$ref": "../core/reusable/identifier.json" } },
    "layers": { "description": "Layer stack from substrate upward.", "type": "array", "items": { "$ref": "layer.json" } },
    "library": { "description": "Combinatorial library definition, present when form is library.", "$ref": "library.json" },
    "derivedProperties": { "description": "properties derived from the nominal formula, the same union as material", "$ref": "../properties_directory/derived_properties.json" },
    "external": { "description": "Record in an external database, e.g. HTEM.", "allOf": [ { "$ref": "../system/database_source.json" }, { "$ref": "../apse/db/third_party_sources.json" } ] },
    "src": { "description": "File information if the sample record was imported from a file (sample sheet, traveler).", "$ref": "../system/file_source.json" }
  },
  "required": ["form"]
}
```

- `sample/layer.json`: `{index (0 = substrate, increasing upward), role: substrate|buffer|seed|adhesion|bottom_electrode|film|top_electrode|capping|other, name, formula, composition[] (elemental_ratio), _material, thickness: quantity/length, crystallinity: single_crystal|epitaxial|textured|polycrystalline|amorphous|unknown, orientation ("(0001)"), _process: entity_reference}`, required `role`.
- `sample/position.json`: `{index, label ("R12"), row, column, coordinate: $ref ../core/abstract/coordinate_2d.json, units: units#/length, coordinateSystem: wafer_center|wafer_flat|library_grid|stage|custom (default wafer_center)}`, required `coordinate, units`. Together with the child-sample id this is the AlphaFilm join key; `coordinate_2d` is reused instead of a new `x`/`y` pair (review change request e).
- `sample/library.json`: `{type: composition_spread|thickness_gradient|temperature_gradient|discrete_array|other, grid: {rows, columns, pitch: quantity/length}, gradients: [{quantity: composition|thickness|temperature|other, element, axis: x|y|radial|custom, minimum, maximum, units}], positions: [position]}`, required `type, positions`. HTEM libraries are 4 × 11 = 44 positions on a 4 mm pitch.
- `sample/metadata.json` copies `material/metadata.json` byte-for-byte except `$id`, `title` ("sample metadata schema") and `anyOf: [{ "$ref": "metadata/wafer_properties.json" }]`; `wafer_properties.json` = `{isWafer, diameter, thickness (quantity/length), orientation, flatOrientation, dopant, resistivity {value, units: #/resistivity}, vendor, lot}`, `additionalProperties: true` as `slab_properties`.
- `system/_sample.json`: mirror of `system/_material.json` with `cls: ["Sample"]`.

Combinatorial libraries use the two-level pattern (review decision 3): the library is a `sample`
(`form: library`, `library.positions[]`) and each position is a child `sample` (`form: thin_film`,
`_parent`, `position`, `identifiers: [{scheme: htem, value: <sample_id>}]`); measurements point at
the child through `_sample`, so the join key is one id.

### 2.2. `instrument`

```json
{
  "$id": "instrument",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "instrument schema",
  "description": "A physical apparatus: the experimental mirror of software/application, composed the same way.",
  "type": "object",
  "allOf": [ { "$ref": "in_memory_entity/named_defaultable.json" }, { "$ref": "instrument/instrument_properties.json" } ]
}
```

```json
{
  "$id": "instrument/instrument-properties",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "instrument properties schema",
  "description": "Mirror of software/application_properties: shortName and summary kept; version becomes firmware; build becomes serialNumber; vendor, model, techniques, components, controlSoftware and location are new.",
  "type": "object",
  "properties": {
    "shortName": { "description": "The short name of the instrument. e.g. jupiter, pdac_com5", "type": "string" },
    "summary": { "description": "Instrument's short description.", "type": "string" },
    "vendor": { "description": "manufacturer, e.g. Asylum Research", "type": "string" },
    "model": { "description": "model name, e.g. Jupiter", "type": "string" },
    "serialNumber": { "description": "vendor serial number", "type": "string" },
    "firmware": { "description": "Controller/firmware version, the analogue of an application version, e.g. 19.34.88", "type": "string" },
    "techniques": { "description": "Techniques this instrument performs", "type": "array", "items": { "oneOf": [
      { "$ref": "../techniques_category/experimental/characterization.json" },
      { "$ref": "../techniques_category/experimental/synthesis.json" } ] } },
    "components": { "description": "probes, sources, detectors, heaters", "type": "array", "items": { "$ref": "component.json" } },
    "controlSoftware": { "description": "Software driving the instrument, reusing the application entity", "type": "array", "items": { "$ref": "../software/application.json" } },
    "location": { "description": "where the instrument lives", "$ref": "location.json" }
  },
  "required": ["vendor", "model"]
}
```

- `instrument/component.json`: `{kind: probe|cantilever|scanner|laser|detector|lock_in_amplifier|controller|heater|cryostat|chamber|stage|evaporation_source|target_holder|gas_line|mass_flow_controller|pump|gauge|other, name, vendor, model, serialNumber, parameters: {type: object, additionalProperties: true}}`, required `kind, name`. A cantilever carries `springConstant`, `resonanceFrequency`, `tipRadius`, `coating` in `parameters`.
- `instrument/location.json`: `{facility, laboratory, room, coordinates: $ref ../core/reference/experiment/location.json}`.
- `instrument/instrument_property.json`: `job/compute_property.json` with `compute` → `instrument: {"$ref": "../instrument.json"}`, title "Instrument Property Schema", not required (HTEM imports may lack instrument detail).
- Catalogue seed (mirror of `software_directory/modeling/espresso.json`): `instruments_directory/scanning_probe_microscopy/asylum_research_jupiter.json` narrows `vendor: ["Asylum Research"]`, `model: ["Jupiter", "Cypher", "MFP-3D"]`, `techniques[].type: ["spm"]`; the NLR chamber entry narrows `shortName: ["pdac_com5", "pdac_com11"]`, `techniques[].subtype: ["sputtering"]`.

## 3. Examples

- `example/sample.json`: HTEM library 6705 — `form: library`, `formula: AlScN`, `external: {source: "HTEM", id: "6705", url: "https://htem.nlr.gov/finder/sample-libraries/…"}`, `identifiers: [{scheme: htem, value: "6705"}, {scheme: internal, value: "NREL library 53"}]`, `layers: [{role: substrate, formula: "SiO2", name: "glass"}, {role: film, formula: "AlScN"}]`, `library: {type: composition_spread, grid: {rows: 4, columns: 11, pitch: {value: 4, units: mm}}, positions: [44 × {index, row, column, coordinate: [5.4, 6.65], units: mm}]}`.
- `example/sample/position.json`, `example/sample/layer.json`, `example/sample/library.json`, `example/sample/metadata/wafer_properties.json`, `example/system/_sample.json`: the child position sample (`form: thin_film`, `_parent`, `position` 17, `identifiers: [{scheme: htem, value: "262118"}]`) and parts.
- `example/instrument.json`: Asylum Research Jupiter, `firmware: "19.34.88"`, `components: [{kind: cantilever, name: "Multi75-EG", parameters: {springConstant: {value: 2.1868, units: "N/m"}}}]`, `controlSoftware: [{name: "asylum-research", shortName: "ar", summary: "Asylum Research AFM software", version: "19.34.88", build: "default"}]`.

## 4. Tests

- `tests/js/experimentalSchemas.tests.ts` (from Phase 0) covers descriptions and inline budgets for the new domains.
- `tests/js/entityGraph.tests.ts`: counts; `classifyLayer` cases; spot-check edges.
- `tests/js/docsPages.tests.ts`: `order` values stay unique (new page 10, glossary 11); the categorization fragment renders the `techniques-category` row.
- Existing suites: examples validate (JS and Python), titles unique ("sample metadata schema" vs "metadata schema" is fine; watch "Instrument Property Schema" vs "Compute Property Schema").

## 5. Acceptance criteria

- `npm test`, the Python suite and `npm run lint-entity-graph` are green; counts re-pinned.
- Before/after screenshots of the Ontology map (new family colour, two new root hexagons) and of the rendered `docs/experimental-data.html` are in the PR (TB-UI-2).
- HTEM library 6705 and its position sample validate as `sample` records.
- `npm run build-docs-pages -- --output site && npm run check-site-links -- --site site` pass.

## 6. Out of scope

`measurement` and `process` (Phases 2–3); `instruments_directory` population beyond two seeds;
instrument calibration records.
