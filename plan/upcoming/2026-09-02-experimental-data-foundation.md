# Experimental data foundation (Phase 0)

> **Status:** upcoming — agreed direction, nothing built.
> **Created:** 2026-09-02 · **Updated:** 2026-09-02
> **Ticket:** *child of the epic to be filed.* **Driver:** [SOF-7988](https://mat3ra.atlassian.net/browse/SOF-7988)
> **Parent:** [`./2026-09-02-experimental-data-overview.md`](./2026-09-02-experimental-data-overview.md)
> **Basis:** [`../context/2026-09-02-experimental-data-survey.md`](../context/2026-09-02-experimental-data-survey.md),
> [`../context/2026-09-02-experimental-data-plan-review-tb.md`](../context/2026-09-02-experimental-data-plan-review-tb.md)

Schema-only plumbing that every later phase composes: unit families, the N-dimensional array and
file-reference reusables, the shared "activity" mixin, provenance references for measurements and
processes, the widening of `property/holder.source.info`, and the top of the technique vocabulary.
No new root entity, no tooling change — those land with the first directory that needs them
(review change request k). This PR is worth merging on its own: after it, a measured property is
already a valid `property/holder`.

## 1. Deliverables

**Critical constraint (review, change request l):** before starting, confirm how the pre-commit
`datamodel-codegen` output in `dist/py` is synced into the committed `src/py/mat3ra/esse/models/`
tree. A foundation PR that cannot regenerate models correctly blocks every later phase.

New schemas (each with a mirror example under `example/`, except `enum_options.json`):

| Path | Purpose |
| --- | --- |
| `schema/core/abstract/multidimensional_array.json` | unit-less N-dimensional array: `shape`, optional row-major `values`, one `axes[]` descriptor per dimension |
| `schema/core/reusable/array_data.json` | `multidimensional_array` + units, data type, and out-of-line storage (`file` + `datasetPath`) |
| `schema/core/reusable/file_reference.json` | `file_metadata` + vendor `format`, checksum, size, url, `objectData`, role |
| `schema/core/reusable/environment.json` | temperature, pressure, atmosphere, humidity, medium |
| `schema/core/reusable/identifier.json` | `{scheme, value}` — external identifiers (HTEM sample id, LMC number, barcode) |
| `schema/core/reusable/quantity/{temperature,pressure,time,length,voltage,current,frequency,flow_rate,power}.json` | `scalar` + one units family each (the `core/reusable/energy.json` pattern; `name` not required) |
| `schema/system/activity.json` | "record of something that was done": `status`, `startTime`, `endTime`, `operators[]`, `_project` — composed by `measurement/base` and `process/base` |
| `schema/core/reference/measurement.json` | `{type, measurementId, channel, sampleId, instrumentId}` — mirror of `core/reference/exabyte.json` |
| `schema/core/reference/process.json` | `{type, processId, stepFlowchartId, sampleId}` |
| `schema/techniques_category/enum_options.json` | technique slugs with full names (see §2.7) |
| `schema/techniques_category/experimental.json` | `allOf categories`, `tier1 → #/experimental` |
| `schema/techniques_category/experimental/characterization.json` | `tier2` const, `tier3 → #/characterizationTier3` |
| `schema/techniques_category/experimental/synthesis.json` | `tier2` const, `tier3 → #/synthesisTier3` |

Modified:

| Path | Change |
| --- | --- |
| `schema/definitions/units.json` | families added / extended (§2.8); additive only |
| `schema/property/holder.json` | `source.info` → `oneOf [exabyte, measurement, process]`; `$comment` recording that a discriminated `source` is a later migration |
| `schema/core/reference.json` | `anyOf` += measurement, process |
| `schema/apse/db/third_party_sources.json` | `source` enum += `HTEM` (so `sample.external` can reuse the `material` composition verbatim) |
| `tests/js/entityGraph.tests.ts` | pinned counts; the `property/holder` assertion becomes 1 extends + 42 `data` variants + 3 `source` variants, 0 contains |
| `tests/js/experimentalSchemas.tests.ts` (new) | §3 |
| `tests/js/fixtures/property_holder_measurement_source.json` (new) | §3 |
| `plan/context/2026-08-16-schema-graph-measurements.md` | dated addendum with the new totals |

## 2. Data model

Every schema and every property carries a `description` (they become the pydantic docstrings). `$id`
values are what `npm run set-schema-ids` writes; shown compact, committed with 4-space indent.

### 2.1. `core/abstract/multidimensional_array.json`

```json
{
  "$id": "core/abstract/multidimensional-array",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "multidimensional array schema",
  "description": "Unit-less N-dimensional array: a shape, optional flattened row-major values, and one axis descriptor per dimension. Unit-less because, like 2d_plot, the same shape serves an SPM image, a spectroscopy grid and a time series.",
  "type": "object",
  "properties": {
    "shape": { "description": "length of each dimension, outermost first", "type": "array", "minItems": 1, "items": { "type": "integer", "minimum": 0 } },
    "values": { "description": "flattened values in row-major (C) order, length = product of shape; omitted when stored out of line", "type": "array", "items": { "type": "number" } },
    "axes": { "description": "one entry per dimension, in shape order; explicit values or start/step", "type": "array", "items": { "type": "object",
      "properties": { "name": { "type": "string" }, "values": { "type": "array", "items": { "type": "number" } }, "start": { "type": "number" }, "step": { "type": "number" } },
      "required": ["name"] } }
  },
  "required": ["shape", "axes"]
}
```

### 2.2. `core/reusable/array_data.json`

```json
{
  "$id": "core/reusable/array-data",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "array data schema",
  "description": "A multidimensional array with units on values and axes, stored inline (values) or in a referenced file (file + datasetPath). One of the two must be present; this is stated here rather than as anyOf-of-required because a type-less anyOf makes datamodel-codegen emit a root union.",
  "$comment": "Inline values are limited to 65536 elements (a 256x256 image); larger arrays go out of line. tests/js/experimentalSchemas.tests.ts enforces this on examples.",
  "type": "object",
  "allOf": [ { "$ref": "../abstract/multidimensional_array.json" } ],
  "properties": {
    "units": { "description": "units of values", "type": "string" },
    "axes": { "type": "array", "items": { "type": "object", "properties": { "units": { "description": "units of this axis", "type": "string" } } } },
    "dataType": { "description": "storage type of values", "type": "string", "enum": ["float32", "float64", "int8", "int16", "int32", "int64", "uint8", "uint16", "uint32", "uint64", "complex64", "complex128"] },
    "file": { "description": "out-of-line storage", "$ref": "file_reference.json" },
    "datasetPath": { "description": "dataset path inside the file, e.g. an HDF5 path or an Igor layer label", "type": "string" }
  }
}
```

### 2.3. `core/reusable/file_reference.json`

`allOf [file_metadata.json]` + `format` (enum, each value described: `asylum_ibw`, `nanonis_sxm`,
`nanonis_dat`, `nanonis_3ds`, `gwyddion_gwy`, `bruker_nanoscope`, `park_tiff`, `wsxm`, `nexus_hdf5`,
`usid_hdf5`, `hdf5`, `npy`, `csv`, `tsv`, `xlsx`, `tiff`, `png`, `json`, `xml`, `txt`, `other`),
`mimeType`, `size` (bytes), `checksum {algorithm: md5|sha1|sha256, value}`, `url`, `objectData`
(`$ref object_storage_container_data.json`), `role: raw|processed|log|image|metadata|other`;
required `basename`.

### 2.4. `core/reusable/quantity/*.json` and `core/reusable/environment.json`

```json
{
  "$id": "core/reusable/quantity/temperature",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "temperature quantity schema",
  "description": "A scalar with temperature units; the core/reusable/energy pattern without the property name.",
  "type": "object",
  "allOf": [ { "$ref": "../../primitive/scalar.json" } ],
  "properties": { "units": { "$ref": "../../../definitions/units.json#/temperature" } },
  "required": ["units"]
}
```

`environment.json`: `{temperature: quantity/temperature, pressure: quantity/pressure, atmosphere:
ambient|vacuum|high_vacuum|ultra_high_vacuum|nitrogen|argon|oxygen|forming_gas|liquid|other,
humidity {value, units: #/dimensionless}, medium}`.

### 2.5. `system/activity.json` and `core/reusable/identifier.json`

```json
{
  "$id": "system/activity",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "activity schema",
  "description": "Behaviour of a record of something that was done: its status, when it started and ended, who did it and which project it belongs to. Composed by measurement and process the way job/base carries the same fields; defined once so the two status vocabularies cannot drift.",
  "type": "object",
  "properties": {
    "status": { "description": "draft = recipe or plan, not executed", "type": "string", "enum": ["draft", "planned", "active", "finished", "error", "cancelled"] },
    "startTime": { "description": "ISO 8601 (readable without a converter; job.startTime is a string too)", "type": "string", "format": "date-time" },
    "endTime": { "type": "string", "format": "date-time" },
    "operators": { "description": "people who ran it", "type": "array", "items": { "$ref": "../core/reference/literature/name.json" } },
    "_project": { "description": "Subset of the full information about the project this activity belongs to.", "$ref": "entity_reference.json" }
  }
}
```

`identifier.json`: `{scheme: internal|htem|lmc|igsn|doi|barcode|vendor|other, value}`, both required.

### 2.6. Provenance references and the holder change

`core/reference/measurement.json`: `{type: enum [measurement], measurementId (required), channel
("data channel or analysis step the value was extracted from, the analogue of unitId"), sampleId,
instrumentId}`. `core/reference/process.json`: `{type: enum [process], processId (required),
stepFlowchartId, sampleId}`.

`property/holder.json` — the only change is `source.info`:

```json
"source": {
  "type": "object",
  "$comment": "type is a free string today (\"exabyte\" in the wild); a discriminated union (type const + matching info) is a later migration with its own ticket.",
  "properties": {
    "type": { "description": "Type of the material property's source.", "type": "string" },
    "info": { "oneOf": [
      { "$ref": "../core/reference/exabyte.json" },
      { "$ref": "../core/reference/measurement.json" },
      { "$ref": "../core/reference/process.json" } ] }
  },
  "required": ["type", "info"]
}
```

`exabyteId` (the entity-bank id of the record the property was obtained from — the job id in the
existing example, the measurement id for measured properties), `repetition` and `data` are
untouched. Existing `{jobId, unitId}` records match exactly one branch because the new branches
require `measurementId` / `processId`.

### 2.7. Technique vocabulary top (`techniques_category/`)

The CateCom idiom: one file per narrowing, `enum_options.json` holding the slugs under camelCase keys
(as `models_category/enum_options.json` does), every `title` spelling the name out. Files are named
by slug for consistency with `models_category/pb/qm/dft.json` — the documented exception to the
spelled-out rule. Phase 0 ships the top three files; leaves ship with the phase that pins them.

```json
{
  "$id": "techniques-category/experimental",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "experimental techniques category schema",
  "description": "Root of the experimental technique vocabulary, the mirror of models_category and methods_category.",
  "type": "object",
  "allOf": [ { "$ref": "../core/reusable/categories.json" } ],
  "properties": { "tier1": { "$ref": "enum_options.json#/experimental" } }
}
```

| Field | Values (slug — the full name lives in `enum_options.json` and in `slugified_entry.name`) |
| --- | --- |
| `tier1` | `experimental` |
| `tier2` | `characterization`, `synthesis` |
| `tier3` (characterization) | `microscopy`, `spectroscopy`, `diffraction`, `electrical`, `optical` |
| `type` / `subtype` (microscopy) | `spm` / `afm`, `stm`, `sts`, `pfm`, `kpfm`, `c_afm`, `mfm`, `efm` |
| `type` / `subtype` (spectroscopy, diffraction) | `xray` / `xrf`, `xps`, `eds`; `xray` / `xrd`, `gixrd`, `xrr` |
| `type` / `subtype` (electrical) | `transport` / `four_point_probe`, `hall`, `current_voltage`; `dielectric` / `leakage_current`, `breakdown`, `capacitance_voltage`, `polarization_hysteresis` |
| `type` / `subtype` (optical) | `uv_vis_nir` / `transmittance`, `reflectance`, `absorbance`; `ellipsometry`, `raman`, `photoluminescence` |
| `tier3` (synthesis) | `vapor_deposition`, `solution_processing`, `bulk_growth`, `post_processing` (`rapid_thermal_annealing`, `furnace_annealing`, `subsampling`) |
| `type` / `subtype` (vapor_deposition) | `pvd` / `pld`, `sputtering`, `mbe`, `thermal_evaporation`, `electron_beam_evaporation`; `cvd` / `ald`, `peald`, `thermal_cvd`, `mocvd`, `pecvd`, `lpcvd` |

`sputtering`, `mbe`, `kpfm`, `xrd`, … are vocabulary values until a catalogue entry needs them. The
slugs get a review pass from the NLR/UTK contacts before Phase 2 (renaming a slug later is a data
migration).

### 2.8. Units (`definitions/units.json`, additive; snake_case keys)

Extend: `pressure` += `Torr, mTorr, mbar, bar, atm`; `force` += `uN, nN, pN`; `frequency` += `Hz,
kHz, MHz, GHz`; `energy` += `J, mJ`. New: `temperature` (K, degC; default K), `time` (s, ms, us, ns,
ps, min, h), `voltage` (V, mV, uV, kV), `current` (A, mA, uA, nA, pA), `current_density` (A/cm^2,
mA/cm^2, uA/cm^2, nA/cm^2, A/m^2), `power` (W, mW, kW), `flow_rate` (sccm, slm), `deposition_rate`
(nm/s, angstrom/s, nm/min, angstrom/pulse, nm/cycle, angstrom/cycle), `fluence` (J/cm^2, mJ/cm^2),
`spring_constant` (N/m), `mass` (kg, g, mg, ug), `conductance` (S, mS, uS, nS), `conductivity` (S/m,
S/cm), `resistivity` (ohm*m, ohm*cm), `sheet_resistance` (ohm/sq), `electric_field` (V/m, V/cm,
kV/cm, MV/cm, V/nm), `polarization` (uC/cm^2, C/m^2), `piezoelectric_coefficient` (pm/V, pC/N),
`area` (m^2, cm^2, mm^2, um^2, nm^2), `rotation_rate` (rpm), `dimensionless` (unitless, percent,
ppm, fraction). No defaults on families used by existing computed properties.

## 3. Tests

1. `tests/js/fixtures/property_holder_measurement_source.json` — a holder with
   `exabyteId: ["<measurement id>"]`, `repetition: 0`, `source: {type: "measurement", info:
   {measurementId, channel: "phase"}}` and a `hysteresis_loop`-shaped `data` (until Phase 2 lands the
   property, use an existing scalar such as `pressure`). `tests/js/experimentalSchemas.tests.ts`
   asserts it validates against the resolved `property/holder`, and that
   `example/property/holder.json` (job-sourced) still validates — the regression test for the union.
2. Same file: every schema under `schema/techniques_category/`, `schema/core/reusable/quantity/`
   and, from Phase 1 on, `schema/{sample,instrument,measurement,process}/`,
   `schema/*_directory/{scanning_probe_microscopy,vapor_deposition,…}` has a non-empty top-level
   `description`.
3. Same file: no example under `example/` has an inline `values` array longer than the budget in
   `array_data`'s `$comment`.
4. `tests/js/entityGraph.tests.ts`: re-pinned counts from the lint output; the holder assertion;
   `classifyLayer("techniques-category/experimental")` → `category`.
5. `tests/js/validate.ts` needs no change but bites: titles must be unique corpus-wide, and every
   example must validate against its resolved schema.

## 4. Wiring and commands

```bash
npm run set-schema-ids && npm run transpile-and-build-assets
npm run lint-entity-graph            # prints "Entity graph: N schemas, M references (a extends, b contains, c variant) plus k same-document refs."
npm run build-entity-graph && node -e "console.log(JSON.stringify(require('./site/graph.json').meta, null, 2))"   # layerCounts, schemasWithExample → paste into the tests
npm test
python -m venv .venv && . .venv/bin/activate && pip install -e ".[all]"
git add schema example manifest && pre-commit run --all-files   # the codegen hook only runs when staged paths contain "schema"
python -m unittest discover --verbose --catch --start-directory tests/py/esse/
```

Discriminator rule (ajv compiles at build): every branch of `property/holder.data` declares `name`
with `enum`/`const`, lists it in `required`, unique across the union — unchanged here, but the
`source.info` union must keep `measurementId` / `processId` / `jobId` mutually exclusive in
`required`.

## 5. Acceptance criteria

- `npm test` and the Python suite are green; pinned counts updated in the same commit.
- The fixture holder validates; the job-sourced example still validates.
- Every new schema has an example and a description; L9 coverage is higher than 209/564.
- `lint-entity-graph`: 0 cycles, 0 unresolved refs, no new isolated nodes beyond the three
  `techniques_category` files (which Phase 1 wires in).
- The PR description states: additive, non-breaking; existing `units.json` families only extended.

## 6. Out of scope

Root entities, tooling (`ENTITY_DOMAINS`, map, docs) — Phase 1. Technique leaves — with the phase
that pins them. Discriminated holder `source` — separate ticket.
