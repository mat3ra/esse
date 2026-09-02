# Experimental data support: sample, instrument, measurement, process (overview)

> **Status:** upcoming — agreed direction, nothing built.
> **Created:** 2026-09-02 · **Updated:** 2026-09-02
> **Ticket:** *epic to be filed* (one child per phase document below).
> **Driver:** [SOF-7988](https://mat3ra.atlassian.net/browse/SOF-7988) — prototype cross-org
> data/provenance exchange (AlphaFilm).
> **Basis:** [`../context/2026-09-02-experimental-data-survey.md`](../context/2026-09-02-experimental-data-survey.md)
> (what the NLR and UTK files contain) and
> [`../context/2026-09-02-experimental-data-plan-review-tb.md`](../context/2026-09-02-experimental-data-plan-review-tb.md)
> (review decisions applied here).
> **Children:** [foundation](./2026-09-02-experimental-data-foundation.md) ·
> [sample and instrument](./2026-09-02-sample-and-instrument.md) ·
> [measurement and scanning-probe microscopy](./2026-09-02-measurement-and-scanning-probe-microscopy.md) ·
> [process and vapor deposition](./2026-09-02-process-and-vapor-deposition.md) ·
> [HTEM and LMC crosswalk](./2026-09-02-htem-and-lmc-crosswalk.md).

## 1. Context

ESSE describes the *simulation* side of materials science: a `material` (structure) is
characterized by `property` records produced by a `workflow` of `unit`s, executed as a `job` on
`compute` with a `software/application`. The only experimental concept is provenance
(`core/reference/experiment.json`, a bibliographic stub with a free-text `method` and string-valued
`conditions`), and `property/holder.json` accepts only an Exabyte job as a property's source. There
is no sample, instrument, measurement or process concept, no 2-D raster / N-D array shape, and no
experimental units (temperature, time, current, voltage, Torr, sccm).

AlphaFilm (SOF-7988) needs those nouns now: NLR (National Lab of the Rockies; HTEM database)
deposits combinatorial Al(1-x)Sc(x)N gradient libraries and measures per-position composition,
thickness, phase/texture, leakage and breakdown; UTK measures PFM/BEPS per position and derives
feature vectors (d33, coercive field, loop area, nucleation bias). The join key is *sample +
position*. The broader request is generic scanning-probe microscopy data (AFM/STM/STS/PFM) and vapor
deposition (PLD/CVD/ALD).

**Decisions taken with the user (2026-09-02):** reuse existing concepts by explicit mapping —
`material → sample`, `application → instrument`, `workflow → process`, `job → measurement`,
`property → property`; first concrete techniques are SPM imaging, SPM spectroscopy and PLD + CVD +
ALD (sputtering is a vocabulary value only); measurements are tracked like jobs, so a measured value
is an ordinary `property/holder` whose `exabyteId` names the measurement and whose `source.info`
mirrors `{jobId, unitId}`.

## 2. What the data forces (from the survey)

1. A **process is multi-stage** (deposition → anneal → sub-sample), each stage on its own
   instrument — exactly `workflow → subworkflow → unit`, hence `process → stage → step`.
2. A **sample is hierarchical**: library → 44 positions (each an HTEM `sample_id`) → sub-sample
   pieces (`R12`). `sample` needs `_parent`, `position` and a `library` grid.
3. **SPM data is multi-channel and N-dimensional** (image: y × x per channel; spectroscopy: time ×
   channel; grid spectroscopy: y × x × bias × channel). One `array_data` reusable with named axes
   covers all.
4. Most measured quantities are **ordinary properties** (thickness, resistivity, sheet resistance,
   band gap, XRD pattern, hysteresis loop): the property layer is reused; only `source` learns about
   measurements.
5. Vendor files (`.ibw`, `.npy`, LMC JSON, HTEM CSV) are **referenced, not embedded**; their
   intermediate formats belong in `apse/`, the existing external-format layer.

## 3. Concept mapping (the centrepiece)

| Simulation noun | Experimental mirror | Reused verbatim | Renamed / adapted | New |
| --- | --- | --- | --- | --- |
| `material` = `in_memory_entity/named_defaultable` + `material/material_properties` + `material/metadata` | **`sample`** = same mixin + `sample/sample_properties` + `sample/metadata` | mixin; `formula`; `external` (`system/database_source` + `apse/db/third_party_sources`, enum += `HTEM`); `src` (`system/file_source`); `derivedProperties`; metadata-bag idiom | `basis`+`lattice` (required) → `_material` (`system/_material`, optional nominal structure); `metadata/slab_properties` → `sample/metadata/wafer_properties` | `form`, `composition[]` (`properties_directory/structural/elemental_ratio`), `layers[]`, `library`, `position`, `_parent`, `identifiers[]` |
| `software/application` = `named_defaultable` + `application_properties`; catalogue `software_directory/*` | **`instrument`** = `named_defaultable` + `instrument/instrument_properties`; catalogue `instruments_directory/*` | mixin; `shortName`, `summary`; catalogue idiom (`software_directory/modeling/espresso.json` narrows `name`/`version` with enums); `software/application` reused as `controlSoftware[]` | `version` → `firmware`; `build` → `serialNumber` | `vendor`, `model`, `techniques[]`, `components[]`, `location` |
| `model` + `method`, categorized by `core/reusable/categories` tiers via `models_category/**` + `enum_options.json` | **technique** = `techniques_category/**` + `enum_options.json` | `core/reusable/categories`; one-narrowing-per-file chain; `enum_options.json#/…` pointer refs | tier values (foundation doc §2.7) | — |
| `workflow` = `named` + `system/metadata` + `workflow/base` + `system/description` + `system/tags`; `subworkflow` = `named` + mixin (`model`, `application`, `units`); `unit` = `named_defaultable` + `runtime_items` + `tags` + `status_track` + `mixins/base` | **`process`** = same five branches with `process/base` (+ `system/activity`); **`process/stage`** = `named` + `stage/mixin` (`categories`, `instrument_property`, `sources`, `environment`, `steps`); **`process/step`** = `named_defaultable` + `status_track` + `tags` + `workflow/unit/mixins/base` | all mixins; `properties[]` (names produced); `workflow/unit/mixins/base` (`flowchartId`/`head`/`next`/`status`) composed verbatim into every step; the `context/item` typed-parameter idiom | `subworkflows[]` → `stages[]`; `units[]` → `steps[]`; `application` → `instrument` (embedded, as subworkflow embeds `application`); `model` → `categories` | `sources[]`, `environment`, `_inputSamples[]`/`_outputSamples[]`, step `type`/`duration`/`repeat`/`context[]`/`logs[]` |
| `job` = `job/base` (`named_defaultable_has_metadata` + `job/compute_property` + `status`, `startTime`, `_project`, `_material`, `parent`) + required `workflow` | **`measurement`** = `measurement/base` (`named_defaultable_has_metadata` + `instrument/instrument_property` + `system/activity` + `_sample`, `parent`) + optional `process` | mixin; `status`, `startTime`, `_project`, `parent`; `job/compute_property` shape → `instrument/instrument_property` | `_material` → `_sample` (`system/_sample`, mirror of `system/_material`); `compute` → `instrument`; `workflow` (required) → `process` (optional protocol; single scans carry flat `parameters`) | `categories`, `samplePosition`, `endTime`, `operators[]`, `environment`, `parameters`, `data[]` channels, `rawFiles[]` |
| `property` / `property/holder` | **unchanged** | everything: a measured value is a holder with `exabyteId: [measurementId]`, `repetition`, `source: {type: "measurement", info: {measurementId, channel}}` — the exact analogue of a job result (`exabyteId: [jobId]`, `info: {jobId, unitId}`) | `source.info` → `oneOf [exabyte, measurement, process]` | measured / film property schemas |
| `core/reference/exabyte` `{jobId, unitId}` | `core/reference/measurement` `{measurementId, channel}`; `core/reference/process` `{processId, stepFlowchartId}` | shape | `jobId` → `measurementId`/`processId`; `unitId` → `channel`/`stepFlowchartId` | — |
| `project` | `project` | as is (`_project` via `system/activity`) | — | — |
| `apse/file/applications/<app>/<version>/…`, `apse/db/<db>/<version>/…` | `apse/file/lmc/1.0/…`, `apse/db/htem/<export date>/…`, `apse/file/instruments/<vendor>/…` | layer + naming | — | LMC and HTEM export formats, Asylum `.ibw` note, plus one `crosswalk.yaml` per source |

Reading rule: a `job` is *a workflow run against a material on compute*; a `measurement` is *a
protocol run against a sample on an instrument*. A workflow embedded in a job carries per-unit
status; likewise one `process` record is both recipe (`status: draft`, no `startTime`) and executed
instance (per-step `status`, `startTime`, `logs[]`) — no recipe/run split. The sentence in
`docs/03-entity-anatomy.md` gets a mirror: *a **sample** is characterized by **properties**; those
properties are produced by applying a **technique** on an **instrument** in a **measurement**; the
sample itself is produced by a **process** of **stages** and **steps** on an instrument; measurements
and processes belong to a **project**.*

## 4. Phasing

One PR per phase against `dev`, branch `feature/SOF-<child>`, commits `feat(SOF-<child>): …`;
every phase is additive and green on its own.

| Phase | Document | Scope | New schemas (≈, each with an example) |
| --- | --- | --- | --- |
| 0 | [foundation](./2026-09-02-experimental-data-foundation.md) | units, `multidimensional_array`, `array_data`, `file_reference`, `environment`, `identifier`, `quantity/*`, `system/activity`, `core/reference/{measurement,process}`, holder `source.info` union, `techniques_category` top files, tests | ~22 |
| 1 | [sample and instrument](./2026-09-02-sample-and-instrument.md) | `sample`, `instrument`, catalogue seeds, `ENTITY_DOMAINS`, map family, docs page (screenshots) | ~14 |
| 2 | [measurement and SPM](./2026-09-02-measurement-and-scanning-probe-microscopy.md) | `measurement`, SPM parameter blocks, five catalogue entries, six measured properties, examples from the Jupiter files | ~27 |
| 3 | [process and vapor deposition](./2026-09-02-process-and-vapor-deposition.md) | `process`, stages/steps/sources/context items, PLD/CVD/ALD catalogue entries, six film properties, examples incl. the LMC 3-stage process | ~37 |
| 4 | [HTEM and LMC crosswalk](./2026-09-02-htem-and-lmc-crosswalk.md) | `apse` formats + `crosswalk.yaml` + lint L11 + docs fragment, four HTEM catalogue entries, six properties, fixtures from real exports; Phase 5 (vendor SPM formats, sputtering) recorded as later | ~24 |

Count estimates, to be recomputed from the lint and never pasted from here: today 564 schemas /
209 examples / 917 edges → ≈586/231 after 0, ≈600/245 after 1, ≈627/272 after 2, ≈664/309 after
3, ≈688/333 after 4. Each phase re-pins `tests/js/entityGraph.tests.ts` and appends a dated row to
`../context/2026-08-16-schema-graph-measurements.md`.

## 5. Decisions (from the review)

1. Holder: keep `exabyteId` and `repetition` required; widen `source.info` only; a discriminated
   `source` is a later migration recorded in a `$comment`.
2. Names: `sample`, `instrument`, `measurement`, `process`, `stage`; acronyms only as category slugs
   with full names; catalogue and core files spelled out.
3. Combinatorial positions: library `sample` with `library.positions[]` plus one child `sample` per
   position; the child id is the join key.
4. Tickets: epic + one child per phase document, linked from the headers before merging.
5. Timestamps: ISO 8601 strings with `format: date-time`.
6. Technique vocabulary: `techniques_category/` tree.
7. Cycle counts, status vocabularies, identifiers and "has an instrument" each have one definition.
8. Crosswalks are data files consumed by both the docs and the ingest script.

## 6. Risks and open questions

1. **Blocker before Phase 0:** how `dist/py` codegen output is synced into
   `src/py/mat3ra/esse/models/` (the pre-commit hook writes one, the repository commits the other).
2. Inline arrays: `src/py/mat3ra/esse/data/examples.py` embeds every example as source and
   `schemas.json` ships in npm — examples keep `values` to tens of numbers; real data goes out of
   line; a test guards the budget.
3. `validateAndClean` injects `additionalProperties: false` on objects with `properties`: open bags
   (`metadata`, `component.parameters`) declare `additionalProperties: true`; root `parameters` has
   no `properties`, so it stays open until a catalogue entry narrows it.
4. `json-schema-merge-allof`: narrow objects (`parameters`), never stacked `oneOf`s (`sources`,
   `techniques`, `categories`).
5. Phase ordering: `measurement.process` needs `process.json` (Phase 3); `instrument.techniques[]`
   and `process.categories` need the Phase-0 category files.
6. `format: date-time`: ajv enforces it, Python `jsonschema` ignores it — examples must be valid
   RFC 3339.
7. Vocabulary correctness: slug review with the NLR/UTK contacts before Phase 2 (renaming a slug
   later is a data migration).
8. Generated `measurement.py` / `process.py` will be large (like `holder.py`, 4 003 lines) —
   accepted; the docs already tell consumers not to depend on inner class names.

## 7. Out of scope (later)

XRD/XRF/electrical/optical catalogue entries beyond the four HTEM ones; KPFM/MFM/c-AFM entries;
BEPS feature-vector properties (decide after inspecting the UTK USID files); `instruments_directory`
population; recipe-vs-run split; vendor parsers (3PSE/apse consumers); NeXus/NOMAD exporters;
README/API-doc cleanup and `database_source.origin` deprecation (separate tickets).

## 8. What good looks like

A UTK PFM scan and an NLR library arrive as files. The ingest script maps them through the
crosswalk data into `sample`, `measurement` and `process` records that validate; the Ontology map
shows the experimental ring next to the simulation nouns in its own colour; and a holder for film
thickness on library position 17 looks exactly like a holder for a DFT band gap, except that its
`exabyteId` and `source.info` name a measurement instead of a job.
