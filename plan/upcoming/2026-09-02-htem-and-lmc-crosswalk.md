# HTEM and LMC crosswalk (Phase 4)

> **Status:** upcoming — agreed direction, nothing built.
> **Created:** 2026-09-02 · **Updated:** 2026-09-02
> **Ticket:** *child of the epic to be filed.* **Driver:** [SOF-7988](https://mat3ra.atlassian.net/browse/SOF-7988)
> **Parent:** [`./2026-09-02-experimental-data-overview.md`](./2026-09-02-experimental-data-overview.md)
> **Depends on:** [`./2026-09-02-process-and-vapor-deposition.md`](./2026-09-02-process-and-vapor-deposition.md)
> **Basis:** [`../context/2026-09-02-experimental-data-survey.md`](../context/2026-09-02-experimental-data-survey.md)
> §2–§3, [`../context/2026-09-02-experimental-data-plan-review-tb.md`](../context/2026-09-02-experimental-data-plan-review-tb.md)

The phase that makes SOF-7988's ingest possible: intermediate-format schemas for the NLR lab-system
records and the HTEM database exports (the `apse/` layer, as for Materials Project), the
per-position measured properties, and — as data, not prose (review change request i) — one
`crosswalk.yaml` per source that both the docs page and the ingest script consume, with a lint rule
that its targets resolve. Phase 5 (vendor SPM formats) is recorded in §6 as later work.

## 1. Deliverables

New schemas (each with a mirror example; the examples are trimmed real exports):

| Path | Purpose |
| --- | --- |
| `schema/apse/file/lmc/1.0/deposition.json`, `schema/apse/file/lmc/1.0/process_stage.json` | the `htem:deposition` / `htem:process_stage` records verbatim (survey §2), `format: lmc-1.0` |
| `schema/apse/db/htem/2026.8.18/sample_library.json`, `…/sample_properties.json`, `…/spectra.json` | the library record, the per-position table (one row) and the flattened spectra export (survey §3); versioned by export date like `apse/db/materials_project/2025.9.25` |
| `schema/techniques_category/experimental/characterization/{spectroscopy,diffraction,electrical,optical}.json` + leaves (`xray/xrf`, `xray/xrd`, `transport/four_point_probe`, `uv_vis_nir/transmittance`) | vocabulary |
| `schema/measurement/parameters/{x_ray_fluorescence,x_ray_diffraction,four_point_probe,ultraviolet_visible_spectroscopy}.json` | parameter blocks |
| `schema/measurements_directory/{spectroscopy/x_ray_fluorescence_composition,diffraction/x_ray_diffraction_pattern,electrical/four_point_probe_sheet_resistance,optical/transmittance_spectrum}.json` | catalogue entries |
| `schema/properties_directory/scalar/{resistivity,conductivity,sheet_resistance}.json`, `schema/properties_directory/non-scalar/{composition,xrd_pattern,optical_spectrum}.json` | properties; band gap reuses `band_gaps` |

Data files and tooling:

| Path | Change |
| --- | --- |
| `schema/apse/file/lmc/1.0/crosswalk.yaml`, `schema/apse/db/htem/2026.8.18/crosswalk.yaml` | rows `{source: <JSON path or column>, target: <$id>#<pointer>, transform: <unit or shape note>}` (§2.3) |
| `src/js/scripts/buildEntityGraph.ts` | lint **L11**: every `crosswalk.yaml` target resolves to a schema and pointer (the L6 join, generalized) |
| `src/js/scripts/buildDocsPages.ts` | fragment `<!-- generated:crosswalk:<source> -->` rendering a crosswalk as a table; used by `docs/10-experimental-data.md` |
| `tests/js/fixtures/lmc/`, `tests/js/fixtures/htem/` | trimmed real exports (relative paths only) validated against the `apse` schemas |
| `manifest/properties.yaml`, `enum_options.json`, `property/holder.json` (`data` union 54 → 60), `tests/js/entityGraph.tests.ts`, `plan/context/2026-08-16-schema-graph-measurements.md` | the usual five-touch and re-pinning |

## 2. Data model

### 2.1. `apse` intermediate formats

`apse/file/lmc/1.0/deposition.json` is the record as the lab system writes it — every key from
survey §2.1 with its observed type, `additionalProperties: true` (the vendor may add keys), a
description per key giving the implicit unit (`dep_torr` Torr, `flow` sccm, `sputter_time` min,
`fwd_pwr` W). `process_stage.json` = `allOf [deposition.json]` + `stage`, `stage_type`,
`stage_instrument`, `ramp_time`, `anneal_time`, `subsample`, `subsample_id`. The HTEM schemas are
the CSV/JSON exports one row (or one library) at a time, column names verbatim.

### 2.2. Target records

- **LMC `htem:deposition`** → one `process` with one stage (`categories.subtype: sputtering`):
  `targets[]` → `source/target` (`fwd_pwr`/`refl_pwr` → `power.forward`/`power.reflected` W,
  `supply` → `supply`, `position`, `volts` → `voltage`, `gun_angle` → `gunAngle`); `gas.gasses[]` →
  `source/gas` (sccm); `gas.cracker` → a `plasma` context item; `dep_torr`/`base_torr` →
  `environment.pressure` + `chamber` context item (Torr); `temp.setpoint`/`ideal` → `substrate`
  context `temperature` and a `logs[]` entry with legend `["measured", "setpoint"]`;
  `substrate.substrates[]` → `_inputSamples[]`; `substrate.rotation` → `substrate` context
  `rotation` (rpm); `presputter_time`/`sputter_time` → steps `pre_sputter`, `deposition` (min);
  `number` → `identifiers [{scheme: lmc}]`; `instrument` → stage `instrument.shortName`; `username`
  → `operators[]`; `date` → `startTime`; `notes` → stage `notes` and process `description`.
- **LMC `htem:process_stage`** → `stages[]` of one `process` keyed by `number`; `stage_type:
  annealing` → `categories {tier3: post_processing, subtype: rapid_thermal_annealing}` with steps
  `ramp` (`ramp_time`) and `hold` (`anneal_time`); `subsample {rows, columns, matrix}` → stage
  `parameters` plus `_outputSamples[]` child samples with `position.label = subsample_id`.
- **HTEM library** → `sample {form: library, external: {source: HTEM, id, url}, library.positions[44]
  (x_mm, y_mm → coordinate), identifiers}`; the `Deposition *` columns → the sputter process above
  (PLD columns → `parameters/pulsed_laser_deposition`); per-position `property.csv` → holders on
  the child samples: `thickness_um` → `film_thickness` (nm), `fpm_resistivity_ohmcm` →
  `resistivity`, `fpm_conductivity_spercm` → `conductivity`, `fpm_sheet_resistance_ohmpersq` →
  `sheet_resistance`, `xrf_compounds` + `xrf_concentration_percent` → `composition`,
  `opt_direct_bandgap_ev` → `band_gaps` (`type: direct`), `absolute_temp_c` → the per-position
  substrate temperature on the process; `spectra.json` → `xrd_pattern` and `optical_spectrum`
  measurements (`measurements_directory/diffraction/x_ray_diffraction_pattern`,
  `…/optical/transmittance_spectrum`) with `_sample` = the position sample and `data[]` a `2d_plot`
  channel (2θ vs intensity; wavelength vs response).

### 2.3. Crosswalk data

`schema/apse/file/lmc/1.0/crosswalk.yaml`:

```yaml
source_schema: apse/file/lmc/1.0/deposition
rows:
  - source: gas.dep_torr
    target: process/stage/mixin#/properties/environment
    transform: pressure in Torr → environment.pressure {value, units: Torr}
  - source: targets[].fwd_pwr
    target: process/source/target#/properties/power
    transform: watts → power.forward {value, units: W}
  - source: sputter_time
    target: process/step#/properties/duration
    transform: minutes → step type deposition, duration {value, units: min}
```

Lint L11 resolves every `target` (schema `$id` + JSON pointer, the L5 machinery); the docs fragment
renders the rows as a table; the SOF-7988 ingest script reads the same file, so the three cannot
drift. The `.ibw` crosswalk joins in Phase 5.

## 3. Examples

`example/apse/file/lmc/1.0/deposition.json` = `deposition__PDAC_COM11__26.json` verbatim;
`example/apse/file/lmc/1.0/process_stage.json` = `process_stage__PDAC_COM5__1558__2.json`
(annealing with a sub-sample matrix); `example/apse/db/htem/2026.8.18/sample_library.json` = library
6705's record; `sample_properties.json` = position 1's row; `spectra.json` = the first ten XRD
points of position 1. Fixtures under `tests/js/fixtures/{lmc,htem}/` hold the same files untrimmed
where small enough (the 750 KB XRD CSV is trimmed to two positions).

## 4. Tests

- Each `apse` example and fixture validates against its schema (existing harness + a fixture loop
  in `tests/js/experimentalSchemas.tests.ts`).
- L11: a deliberately broken `target` in a crosswalk fails the lint (falsification test, as for L1).
- `docsPages.tests.ts`: the `crosswalk:<source>` fragment expands; unknown source names throw.
- Counts re-pinned; holder `data` variants 54 → 60.

## 5. Acceptance criteria

- HTEM library 6705 (record, 44 positions, XRD patterns) and LMC processes 26, 1558 and 1699
  validate end to end as `sample` / `process` / `measurement` records via the crosswalks.
- The ingest script in the SOF-7988 repository consumes `crosswalk.yaml` unchanged.
- `docs/10-experimental-data.md` renders both crosswalk tables from the data files.

## 6. Later (Phase 5, timeboxed)

- `schema/apse/file/instruments/asylum_research/igor_binary_wave_note.json` (the note keys and
  layer labels from survey §4) + `crosswalk.yaml` to `measurement/parameters/scanning_probe_microscopy/*`
  and `measurement/data/channel`; `schema/apse/file/pycroscopy/universal_spectroscopy_imaging_data.json`
  for the UTK USID datasets (main dataset + position/spectroscopic indices).
- `schema/processes_directory/vapor_deposition/sputtering.json` (`parameters`: mode dc/rf/pulsed
  dc/hipims, guns[], working/base pressure, substrate bias/rotation) when AlphaFilm needs a typed
  entry rather than the generic stage.
- A NeXus (`NXspm`/`NXafm`/`NXstm`/`NXsts`) and NOMAD (`nomad-material-processing`) crosswalk table
  in the docs page — names aligned, not copied; NOMAD has no ALD, so the cycle model stays ESSE's.
