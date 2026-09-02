# Measurement and scanning-probe microscopy (Phase 2)

> **Status:** upcoming — agreed direction, nothing built.
> **Created:** 2026-09-02 · **Updated:** 2026-09-02
> **Ticket:** *child of the epic to be filed.* **Driver:** [SOF-7988](https://mat3ra.atlassian.net/browse/SOF-7988)
> **Parent:** [`./2026-09-02-experimental-data-overview.md`](./2026-09-02-experimental-data-overview.md)
> **Depends on:** [`./2026-09-02-sample-and-instrument.md`](./2026-09-02-sample-and-instrument.md)
> **Basis:** [`../context/2026-09-02-experimental-data-survey.md`](../context/2026-09-02-experimental-data-survey.md)
> §4 (the Asylum Research files), [`../context/2026-09-02-experimental-data-plan-review-tb.md`](../context/2026-09-02-experimental-data-plan-review-tb.md)

`measurement` (mirror of `job`), the scanning-probe-microscopy parameter blocks and catalogue
entries, and the first measured properties. Results are not embedded: they are `property/holder`
records whose `exabyteId` and `source.info` name the measurement, exactly as job results name the
job. The examples are built from the UTK Jupiter DART-PFM files in the survey.

## 1. Deliverables

New schemas (each with a mirror example):

| Path | Purpose |
| --- | --- |
| `schema/measurement.json` | root: `allOf [measurement/base]`; the optional `process` property is added in Phase 3 |
| `schema/measurement/base.json` | mirror of `job/base` (§2.1) |
| `schema/measurement/data/channel.json` | one acquired channel: `array_data` or `2d_plot` |
| `schema/measurement/parameters/scanning_probe_microscopy/{scan,probe,atomic_force_microscopy,scanning_tunneling_microscopy,scanning_tunneling_spectroscopy,piezoresponse_force_microscopy}.json` | typed parameter blocks (field names after NeXus NXspm/NXsts/NXafm and the Asylum note keys) |
| `schema/techniques_category/experimental/characterization/microscopy.json`, `…/microscopy/spm.json`, `…/spm/{afm,stm,sts,pfm}.json` | vocabulary leaves |
| `schema/measurements_directory/scanning_probe_microscopy/{atomic_force_microscopy_image,scanning_tunneling_microscopy_image,piezoresponse_force_microscopy_image,scanning_tunneling_spectroscopy,piezoresponse_force_microscopy_spectroscopy}.json` | catalogue entries (idiom of `models_directory/re.json`) |
| `schema/properties_directory/scalar/{surface_roughness,grain_size,piezoelectric_coefficient,coercive_field,remanent_polarization}.json`, `schema/properties_directory/non-scalar/hysteresis_loop.json` | measured properties, five-touch registered |

Modified: `schema/properties_directory/enum_options.json`, `schema/property/holder.json` (`data`
union 42 → 48 variants), `manifest/properties.yaml` (schemaId + `defaults.units`, **no**
`isResult` — that flag drives the platform's list of workflow-extractable results),
`tests/js/entityGraph.tests.ts`, `tests/js/fixtures/property_holder_measurement_source.json` (now a
`hysteresis_loop`), `docs/10-experimental-data.md` (the measured-holder example),
`plan/context/2026-08-16-schema-graph-measurements.md`.

## 2. Data model

### 2.1. `measurement` and `measurement/base`

```json
{
  "$id": "measurement",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "measurement schema",
  "description": "A characterization run: the experimental mirror of job. A job binds a workflow to compute and a material; a measurement binds an optional process (protocol, Phase 3) to an instrument and a sample. Results are property holders whose exabyteId and source.info reference this record, exactly as job results reference a job.",
  "type": "object",
  "allOf": [ { "$ref": "measurement/base.json" } ]
}
```

```json
{
  "$id": "measurement/base",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "measurement base schema",
  "description": "Mirror of job/base: the same platform mixin, an instrument instead of compute, a sample instead of a material, and the activity mixin for status and timing.",
  "type": "object",
  "allOf": [
    { "description": "in-memory entity", "$ref": "../in_memory_entity/named_defaultable_has_metadata.json" },
    { "description": "has an instrument, mirror of job/compute_property", "$ref": "../instrument/instrument_property.json" },
    { "description": "status, start/end time, operators, project", "$ref": "../system/activity.json" }
  ],
  "properties": {
    "categories": { "description": "Technique tiers; measurements_directory entries pin the leaf", "$ref": "../techniques_category/experimental/characterization.json" },
    "_sample": { "description": "Subset of the full information about the sample measured (the analogue of job._material).", "$ref": "../system/_sample.json" },
    "samplePosition": { "description": "Where on the sample the measurement was taken", "$ref": "../sample/position.json" },
    "parent": { "description": "Subset of the full information about the parent measurement, e.g. the grid acquisition a single spectrum was extracted from.", "$ref": "../system/entity_reference.json" },
    "environment": { "description": "ambient conditions during acquisition", "$ref": "../core/reusable/environment.json" },
    "parameters": { "description": "Technique-specific acquisition parameters; narrowed by measurements_directory entries", "type": "object" },
    "data": { "description": "Acquired channels", "type": "array", "items": { "$ref": "./data/channel.json" } },
    "rawFiles": { "description": "vendor files the record was derived from", "type": "array", "items": { "$ref": "../core/reusable/file_reference.json" } }
  },
  "required": ["categories", "status", "_sample"]
}
```

### 2.2. `measurement/data/channel.json`

```json
{
  "$id": "measurement/data/channel",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "measurement data channel schema",
  "description": "One acquired channel. array_data for rasters and grids, 2d_plot for curves; the two branches have disjoint required sets, so oneOf is unambiguous.",
  "type": "object",
  "properties": {
    "name": { "description": "Channel name, e.g. height, deflection, amplitude, phase, frequency, current, bias, differentialConductance, piezoresponseAmplitude, piezoresponsePhase", "type": "string" },
    "direction": { "description": "scan direction the channel was recorded in", "type": "string", "enum": ["forward", "backward"] },
    "description": { "type": "string" },
    "data": { "oneOf": [ { "$ref": "../../core/reusable/array_data.json" }, { "$ref": "../../core/abstract/2d_plot.json" } ] }
  },
  "required": ["name", "data"]
}
```

### 2.3. Parameter blocks (`measurement/parameters/scanning_probe_microscopy/`)

- `scan.json`: `{scanRange: {x, y} (quantity/length), scanOffset: {x, y}, scanAngle {value, units: #/angle}, scanPoints: {x, y: integer}, scanRate (quantity/frequency), scanDirection: up|down}`.
- `probe.json`: `{model, vendor, material, coating, tipRadius (length), springConstant {value, units: #/spring_constant}, resonanceFrequency (frequency), inverseOpticalLeverSensitivity {value, units: "nm/V"}, qualityFactor, conductive}`.
- `atomic_force_microscopy.json`: `{mode: contact|tapping|non_contact|peak_force|lateral_force, setpoint {value, units}, driveSignal {amplitude (voltage), frequency (frequency)}, feedbackGains {proportional, integral}, probe}`.
- `scanning_tunneling_microscopy.json`: `{feedbackMode: constant_current|constant_height, biasVoltage (voltage; sample bias), currentSetpoint (current), feedbackGains, probe}`.
- `scanning_tunneling_spectroscopy.json`: `{spectroscopyType: current_voltage|differential_conductance|current_distance, biasSweep {start, end (voltage), points, sweeps}, lockIn {modulationAmplitude, modulationFrequency, timeConstant, harmonic}, currentSetpoint, zOffset, feedbackOff}`.
- `piezoresponse_force_microscopy.json`: `{mode: single_frequency|dual_ac_resonance_tracking|band_excitation|contact_resonance, driveSignal {amplitude, frequency}, bandExcitation {centerFrequency, bandwidth, pulseDuration}, biasWaveform {type: triangular|bipolar_triangular|triangle_square|sinusoidal|step|custom, amplitude, frequency, cycles, pointsPerSecond, offField}, spectroscopyGrid {rows, columns}, contactSetpoint, probe}`.

### 2.4. Catalogue entries

```json
{
  "$id": "measurements-directory/scanning-probe-microscopy/atomic-force-microscopy-image",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "atomic force microscopy image measurement schema",
  "description": "A raster AFM image: a measurement with the AFM technique leaf pinned and the scan + AFM parameter blocks required.",
  "type": "object",
  "allOf": [ { "$ref": "../../measurement.json" } ],
  "properties": {
    "categories": { "$ref": "../../techniques_category/experimental/characterization/microscopy/spm/afm.json" },
    "parameters": { "allOf": [
      { "$ref": "../../measurement/parameters/scanning_probe_microscopy/scan.json" },
      { "$ref": "../../measurement/parameters/scanning_probe_microscopy/atomic_force_microscopy.json" } ] }
  },
  "required": ["categories", "parameters", "data"]
}
```

Siblings: `scanning_tunneling_microscopy_image` (STM leaf, `scan` + `scanning_tunneling_microscopy`
blocks), `piezoresponse_force_microscopy_image` (PFM leaf, `scan` + `piezoresponse_force_microscopy`),
`scanning_tunneling_spectroscopy` (STS leaf; channels are `2d_plot` curves), and
`piezoresponse_force_microscopy_spectroscopy` (PFM leaf; channels are `array_data` with axes
`[time]` for a single point or `[y, x, cycle, bias]` for a grid; per-position loop features become
holders). Narrowing an object-typed `parameters` follows the `models_directory` precedent; a
`oneOf`-typed field is never narrowed in an `allOf` child (`json-schema-merge-allof` has no
resolver for stacked `oneOf`s).

### 2.5. Properties (five-touch: schema, example, `enum_options.json`, holder union, manifest)

```json
{
  "$id": "properties-directory/scalar/surface-roughness",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "surface roughness property schema",
  "description": "Roughness of a measured surface; statistic says which estimator produced the value.",
  "type": "object",
  "allOf": [ { "$ref": "../../core/primitive/scalar.json" } ],
  "properties": {
    "name": { "enum": ["surface_roughness"] },
    "statistic": { "description": "estimator", "type": "string", "enum": ["rms", "ra", "rq", "peak_to_valley"] },
    "units": { "$ref": "../../definitions/units.json#/length" }
  },
  "required": ["name", "units"]
}
```

Others: `grain_size` (length), `piezoelectric_coefficient` (`#/piezoelectric_coefficient`, +
`component: d33|d31|d15|d33_eff`, required), `coercive_field` (`#/electric_field`),
`remanent_polarization` (`#/polarization`); non-scalar `hysteresis_loop` (`allOf 2d_plot`,
`loopType: polarization_electric_field|piezoresponse_bias|amplitude_bias|phase_bias|current_voltage`,
`legend[]`, e.g. `["on_field", "off_field"]`).

## 3. Examples (from the survey §4)

- `example/measurements_directory/scanning_probe_microscopy/piezoresponse_force_microscopy_image.json`
  from `PFM_DART_raw.ibw`: `categories {tier1: experimental, tier2: characterization, tier3:
  microscopy, type: spm, subtype: pfm}`, `status: finished`, `startTime: "2026-03-13T18:05:58Z"`,
  `instrument {name: "Jupiter", vendor: "Asylum Research", model: "Jupiter", firmware: "19.34.88"}`,
  `_sample` → the position sample from Phase 1, `parameters {mode: dual_ac_resonance_tracking,
  scanRange {x: {value: 2, units: um}, y: …}, scanOffset {x: -1.476 um, y: 0.871 um}, scanAngle
  {90, degree}, scanPoints {256, 256}, scanRate {2.0032, Hz}, scanDirection: down, contactSetpoint
  {0.8, V}, driveSignal {amplitude {0.5, V}, frequency {372.177, kHz}}, probe {model: "Multi75-EG",
  springConstant {2.1868, N/m}, inverseOpticalLeverSensitivity {82.055, nm/V}}}`; six `data[]`
  channels (`height`, `amplitude_1`, `amplitude_2`, `phase_1`, `phase_2`, `frequency`, `direction:
  backward`), each `array_data` with `shape [256, 256]`, axes `y, x` (`start 0, step 0.0078125,
  units um`), no inline `values`, `file {basename: "PFM_DART_raw.ibw", format: asylum_ibw, size:
  1688293, role: raw}`, `datasetPath: "HeightRetrace"` etc.; `rawFiles[]` the same file.
- `…/piezoresponse_force_microscopy_spectroscopy.json` from `PLZT_0005.ibw`: `biasWaveform {type:
  triangle_square, amplitude {9, V}, frequency {0.9058, Hz}, cycles: 2, pointsPerSecond: 2000}`,
  channels `bias, deflection, frequency, phase, phase_2, z_sensor, amplitude_1, amplitude_2` as
  `array_data` `shape [6431]`, axis `time (start 0, step 0.0005, units s)`.
- The derived loop is a holder, committed as the fixture and shown in the docs page
  (`example/property/holder.json` keeps the exabyte example, one example per schema):

```json
{
  "data": { "name": "hysteresis_loop", "loopType": "phase_bias", "legend": ["on_field", "off_field"],
            "xAxis": { "label": "bias", "units": "V" }, "yAxis": { "label": "phase", "units": "degree" },
            "xDataArray": [-9, -4.5, 0, 4.5, 9], "yDataSeries": [[178, 175, 20, 4, 3], [176, 170, 90, 6, 4]] },
  "source": { "type": "measurement", "info": { "measurementId": "mPfmSpec0005", "channel": "phase" } },
  "exabyteId": ["mPfmSpec0005"],
  "repetition": 0
}
```

## 4. Tests

- The fixture above validates against the resolved `property/holder` (extends the Phase 0 test).
- Descriptions and inline budgets (Phase 0 test) now cover `schema/measurement/**` and the catalogue.
- `tests/js/entityGraph.tests.ts`: counts; holder `data` variants 42 → 48; spot checks
  `measurement/base --contains[_sample]--> system/-sample` and
  `measurements-directory/scanning-probe-microscopy/atomic-force-microscopy-image --extends--> measurement`.
- Discriminator rule: every new `holder.data` branch declares `name` with `enum` and lists it in
  `required`.

## 5. Acceptance criteria

- The Jupiter image and the DART loop validate as catalogue-entry records; the loop holder validates.
- Technique slugs and parameter names reviewed with the NLR/UTK contacts before merge (review
  change request m).
- `npm test`, the Python suite and the lint are green; counts re-pinned; L9 coverage higher.

## 6. Out of scope

`measurement.process` (Phase 3); KPFM/MFM/c-AFM entries; BEPS feature-vector properties (decide
after inspecting the UTK USID files); grid-spectroscopy analysis conventions beyond the axis order.
