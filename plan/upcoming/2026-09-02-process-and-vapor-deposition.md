# Process and vapor deposition (Phase 3)

> **Status:** upcoming — agreed direction, nothing built.
> **Created:** 2026-09-02 · **Updated:** 2026-09-02
> **Ticket:** *child of the epic to be filed.* **Driver:** [SOF-7988](https://mat3ra.atlassian.net/browse/SOF-7988)
> **Parent:** [`./2026-09-02-experimental-data-overview.md`](./2026-09-02-experimental-data-overview.md)
> **Depends on:** [`./2026-09-02-measurement-and-scanning-probe-microscopy.md`](./2026-09-02-measurement-and-scanning-probe-microscopy.md)
> **Basis:** [`../context/2026-09-02-experimental-data-survey.md`](../context/2026-09-02-experimental-data-survey.md)
> §2–§3 (the NLR records), [`../context/2026-09-02-experimental-data-plan-review-tb.md`](../context/2026-09-02-experimental-data-plan-review-tb.md)

`process` (mirror of `workflow`), its stages (mirror of subworkflows) and steps (mirror of units),
material sources, chamber environment, typed set-point blocks, and the PLD / CVD / ALD catalogue
entries. The NLR three-stage sputter-and-anneal record is the integration example and needs no
catalogue entry: the generic stage represents it with `sputtering` as a vocabulary value.

## 1. Deliverables

New schemas (each with a mirror example):

| Path | Purpose |
| --- | --- |
| `schema/process.json` | root, composed exactly as `workflow.json` |
| `schema/process/base.json` | mirror of `workflow/base` (§2.1) |
| `schema/process/stage.json`, `schema/process/stage/mixin.json` | mirror of `workflow/subworkflow` + `subworkflow/mixin` (§2.2) |
| `schema/process/step.json` | mirror of `workflow/unit/base` (§2.3) |
| `schema/process/step/context/_base.json`, `…/context/item.json`, `…/context/item/{chamber,substrate,gas_flow,laser,precursor_pulse,plasma}.json` | typed set-point blocks (the `workflow/unit/context/item` idiom) |
| `schema/process/source.json`, `schema/process/source/{base,target,precursor,gas}.json` | material sources, `oneOf` by `kind` |
| `schema/process/time_series.json` | `2d_plot` with a time axis and a legend (`measured`, `setpoint`) |
| `schema/process/parameters/{laser,pulsed_laser_deposition,chemical_vapor_deposition,atomic_layer_deposition}.json` | stage-level technique parameters |
| `schema/techniques_category/experimental/synthesis/vapor_deposition.json`, `…/vapor_deposition/{pvd,cvd}.json`, `…/pvd/pld.json`, `…/cvd/{ald,thermal_cvd}.json`, `…/synthesis/post_processing.json` | vocabulary leaves |
| `schema/processes_directory/vapor_deposition/{pulsed_laser_deposition,chemical_vapor_deposition,atomic_layer_deposition}.json` | catalogue entries narrowing a **stage** |
| `schema/properties_directory/scalar/{film_thickness,growth_rate,growth_per_cycle,leakage_current_density,breakdown_field,phase_fraction}.json` | film properties, five-touch registered |

Modified: `schema/measurement.json` gains `process` (`{"$ref": "process.json"}`, the analogue of
`job.workflow`, optional); `docs/03-entity-anatomy.md` ("Eleven schemas" → "Fifteen", plus
`<!-- generated:entity-relationships:sample -->`, `:instrument`, `:measurement`, `:process`
fragments); `docs/02-schema-layering.md` root list; `enum_options.json`, `property/holder.json`
(`data` union 48 → 54), `manifest/properties.yaml`, `tests/js/entityGraph.tests.ts`,
`plan/context/2026-08-16-schema-graph-measurements.md`.

## 2. Data model

### 2.1. `process` and `process/base`

```json
{
  "$id": "process",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "process schema",
  "description": "A synthesis, fabrication or measurement protocol and its executed instance: the experimental mirror of workflow, composed the same way. A recipe is a process with status draft and no startTime; an executed run carries per-step status and logs, as a workflow embedded in a job does.",
  "type": "object",
  "allOf": [
    { "$ref": "in_memory_entity/named.json" },
    { "$ref": "system/metadata.json" },
    { "$ref": "process/base.json" },
    { "$ref": "system/description.json" },
    { "$ref": "system/tags.json" }
  ]
}
```

```json
{
  "$id": "process/base",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "base process schema",
  "description": "Mirror of workflow/base: properties (names produced) kept; units become steps inside stages; subworkflows become stages; application becomes the instrument on each stage; samples consumed and produced are new.",
  "type": "object",
  "allOf": [ { "description": "status, start/end time, operators, project", "$ref": "../system/activity.json" } ],
  "properties": {
    "categories": { "description": "Synthesis or characterization tiers: a measurement protocol is a process with characterization categories", "oneOf": [
      { "$ref": "../techniques_category/experimental/synthesis.json" },
      { "$ref": "../techniques_category/experimental/characterization.json" } ] },
    "properties": { "description": "Array of characteristic properties produced by this process, by name, e.g. film_thickness, growth_rate", "type": "array", "items": { "type": "string" } },
    "stages": { "description": "Ordered stages, the analogue of workflow.subworkflows; each stage binds a technique and an instrument", "type": "array", "items": { "$ref": "stage.json" } },
    "_inputSamples": { "description": "Subsets of the full information about the samples consumed, e.g. substrates", "type": "array", "items": { "$ref": "../system/_sample.json" } },
    "_outputSamples": { "description": "Subsets of the full information about the samples produced or modified", "type": "array", "items": { "$ref": "../system/_sample.json" } },
    "identifiers": { "description": "External identifiers, e.g. the LMC run number", "type": "array", "items": { "$ref": "../core/reusable/identifier.json" } },
    "logFiles": { "description": "Tool logs the record was derived from", "type": "array", "items": { "$ref": "../core/reusable/file_reference.json" } }
  },
  "required": ["categories", "properties", "stages"]
}
```

### 2.2. `process/stage` and `process/stage/mixin`

`stage.json` = `allOf [../in_memory_entity/named.json, stage/mixin.json]` (mirror of
`workflow/subworkflow.json`). `stage/mixin.json`:

```json
{
  "$id": "process/stage/mixin",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "process stage mixin schema",
  "description": "Mirror of workflow/subworkflow/mixin: model becomes categories, application becomes the instrument mixin, units become steps; sources and environment are what a chamber adds. Catalogue entries narrow a stage because this is where a workflow binds its model.",
  "type": "object",
  "allOf": [ { "description": "has an instrument", "$ref": "../../instrument/instrument_property.json" } ],
  "properties": {
    "index": { "description": "1-based order of the stage", "type": "integer", "minimum": 1 },
    "categories": { "oneOf": [ { "$ref": "../../techniques_category/experimental/synthesis.json" }, { "$ref": "../../techniques_category/experimental/characterization.json" } ] },
    "_inputSamples": { "type": "array", "items": { "$ref": "../../system/_sample.json" } },
    "_outputSamples": { "type": "array", "items": { "$ref": "../../system/_sample.json" } },
    "sources": { "description": "Material sources available to the steps: targets, precursors, gases", "type": "array", "items": { "$ref": "../source.json" } },
    "environment": { "description": "Stage-level chamber conditions, e.g. base pressure", "$ref": "../../core/reusable/environment.json" },
    "parameters": { "description": "Technique parameters; narrowed by processes_directory entries", "type": "object" },
    "steps": { "description": "Ordered steps, the analogue of subworkflow.units, linked by flowchartId/next", "type": "array", "items": { "$ref": "../step.json" } },
    "duration": { "$ref": "../../core/reusable/quantity/time.json" },
    "startTime": { "type": "string", "format": "date-time" },
    "endTime": { "type": "string", "format": "date-time" },
    "status": { "type": "string", "enum": ["draft", "planned", "active", "finished", "error", "cancelled"] },
    "notes": { "description": "operator notes, verbatim", "type": "string" },
    "logs": { "description": "Time series logged during the stage", "type": "array", "items": { "$ref": "../time_series.json" } }
  },
  "required": ["categories", "steps"]
}
```

### 2.3. `process/step`, context items, sources, time series

```json
{
  "$id": "process/step",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "process step schema",
  "description": "One step of a stage, the analogue of a workflow unit: composes the unit sequencing mixin verbatim (flowchartId, head, next, status) and carries typed set-points as context items. repeat is the only place a cycle count lives. No nested steps (the lint forbids reference cycles); an ALD cycle is one step of type cycle whose half-cycle template is typed in the stage parameters.",
  "type": "object",
  "allOf": [
    { "$ref": "../in_memory_entity/named_defaultable.json" },
    { "$ref": "../system/status_track.json" },
    { "$ref": "../system/tags.json" },
    { "$ref": "../workflow/unit/mixins/base.json" }
  ],
  "properties": {
    "type": { "type": "string", "enum": ["setup", "pump_down", "heat", "ramp", "hold", "pre_sputter", "pre_ablation", "deposition", "pulse", "purge", "plasma", "cycle", "anneal", "cool", "vent", "transfer", "subsample", "other"] },
    "duration": { "$ref": "../core/reusable/quantity/time.json" },
    "startTime": { "type": "string", "format": "date-time" },
    "endTime": { "type": "string", "format": "date-time" },
    "repeat": { "description": "Times this step is repeated, e.g. the number of ALD cycles", "type": "integer", "minimum": 1, "default": 1 },
    "context": { "description": "Typed set-point blocks, the analogue of workflow unit context items", "type": "array", "default": [], "items": { "$ref": "step/context/item.json" } },
    "logs": { "description": "Time series logged during the step", "type": "array", "items": { "$ref": "time_series.json" } }
  },
  "required": ["type", "flowchartId"]
}
```

- `step/context/item.json`: `oneOf [item/chamber, item/substrate, item/gas_flow, item/laser, item/precursor_pulse, item/plasma]`, `discriminator: {propertyName: "name"}`; `_base.json` requires `name, data`. Items: `chamber.data = environment`; `substrate.data = {temperature, rotation {value, units: #/rotation_rate}, bias (voltage), distanceToSource (length)}`; `gas_flow.data = {source (id in sources), flowRate (flow_rate), partialPressure (pressure)}`; `laser.data = $ref ../../../parameters/laser.json`; `precursor_pulse.data = {source, duration (time), vesselTemperature, carrierFlowRate}`; `plasma.data = {power, frequency, gas (source id), duration}`.
- `source.json`: `oneOf [source/target, source/precursor, source/gas]`, `discriminator: {propertyName: "kind"}`; `source/base.json` `{id (required; referenced by context items), name, formula, purity {value, units: #/dimensionless}, vendor, lot, _material}`; `target.json` adds `kind: enum [target]`, `composition[]`, `position ("TL", "BC")`, `supply: rf|dc|pulsed_dc|hipims`, `power {forward, reflected (quantity/power)}`, `voltage`, `gunAngle`, `diameter`, `thickness`; `precursor.json` adds `kind: enum [precursor]`, `delivery: bubbler|flash_evaporator|mist|direct_liquid_injection|solid_sublimation|gas_cylinder|gas_line` (the NOMAD source kinds), `vesselTemperature`, `carrierGas` (source id), `carrierFlowRate`, `vaporPressure`; `gas.json` adds `kind: enum [gas]`, `role: carrier|reactive|purge|sputtering|plasma|background`, `flow`.
- `time_series.json`: `allOf [core/abstract/2d_plot]` + `name` (required), `xAxis.label: enum ["time"]`, `xAxis.units: units#/time`, `legend[]` (one label per y series, e.g. `["measured", "setpoint"]` — NOMAD `TimeSeries{value, set_value}` as two series on one time axis).

### 2.4. Catalogue entries and parameters

```json
{
  "$id": "processes-directory/vapor-deposition/atomic-layer-deposition",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "atomic layer deposition stage schema",
  "description": "Atomic layer deposition as a cycle-based CVD variant: one step of type cycle (its repeat is the number of cycles) whose half-cycle template lives in parameters.cycle.steps.",
  "type": "object",
  "allOf": [ { "$ref": "../../process/stage.json" } ],
  "properties": {
    "categories": { "$ref": "../../techniques_category/experimental/synthesis/vapor_deposition/cvd/ald.json" },
    "parameters": { "$ref": "../../process/parameters/atomic_layer_deposition.json" }
  },
  "required": ["categories", "parameters"]
}
```

- `parameters/atomic_layer_deposition.json`: `{reactorType: hot_wall|cold_wall|showerhead|spatial, substrateTemperature, wallTemperature, basePressure, workingPressure, carrierGas (source id), carrierFlowRate, plasma {enabled, power, frequency, gas}, cycle: {steps: [step]}, growthPerCycle {value, units: #/deposition_rate}}` — no cycle count here (single source of truth: the cycle step's `repeat`).
- `parameters/pulsed_laser_deposition.json`: `{laser: $ref laser.json, targetSubstrateDistance, targetRotation, substrateRotation, backgroundGas (source id), backgroundPressure, substrateTemperature}`; `laser.json` = `{type: krf_excimer|arf_excimer|xecl_excimer|nd_yag|other, wavelength, pulseDuration, repetitionRate, pulseEnergy {value, units: #/energy}, fluence {value, units: #/fluence}, spotArea {value, units: #/area}, pulseCount}` (NOMAD PLDLaser; HTEM `Deposition Target Pulses / Rep Rate / Energy / Ts Distance` map here).
- `parameters/chemical_vapor_deposition.json`: `{reactorType: hot_wall|cold_wall|showerhead|tubular, workingPressure, substrateTemperature, susceptorTemperature, wallTemperature, plasma {…}, totalFlowRate, depositionDuration, growthRate}`.
- Catalogue entries narrow `parameters` (an object) and `categories` (a pinned leaf), never `sources` (a `oneOf`).

### 2.5. Properties (five-touch)

`film_thickness` (`#/length`, + `layerIndex` into `sample.layers`), `growth_rate` and
`growth_per_cycle` (`#/deposition_rate`), `leakage_current_density` (`#/current_density`, +
`field {value, units: #/electric_field}`), `breakdown_field` (`#/electric_field`),
`phase_fraction` (`#/dimensionless`, + `phase: string`, required).

## 3. Examples (from the survey §2 and a synthetic ALD run)

- `example/process.json`: NLR LMC process 1699 as three stages — stage 1 sputter deposition on
  `pdac_com5` (`categories {…, tier3: vapor_deposition, type: pvd, subtype: sputtering}`, `sources:
  [{kind: target, id: "al", formula: "Al", position: "BC", supply: rf, power {forward {60, W},
  reflected {0, W}}, voltage {245, V}}, {kind: gas, id: "n2", formula: "N2", role: reactive, flow
  {5, sccm}}, {kind: gas, id: "ar", formula: "Ar", role: sputtering, flow {8, sccm}}]`, `environment
  {pressure {0.004, Torr}}`, steps `pre_sputter` (30 min) → `deposition` (30 min) with `chamber`
  (base pressure 8e-8 Torr) and `substrate` (temperature 20 degC, rotation 60 rpm) context items,
  `notes` verbatim), stage 2 (La + Mo targets, in-situ anneal 850 degC set / 747 degC read as a
  `substrate` context item plus a `logs[]` series `["measured", "setpoint"]`), stage 3 (Al again);
  `identifiers: [{scheme: lmc, value: "1699"}]`, `_inputSamples: [pSi substrate]`,
  `operators: [{first: "Rebecca", last: "Smaha"}]`, `startTime: "2022-11-14T00:00:00Z"`.
- `example/processes_directory/vapor_deposition/atomic_layer_deposition.json`: AlN plasma ALD, 200
  cycles — `sources: [{kind: precursor, id: "trimethylaluminium", formula: "Al(CH3)3", delivery:
  bubbler, vesselTemperature {20, degC}}, {kind: gas, id: "nh3", formula: "NH3", role: plasma},
  {kind: gas, id: "ar", formula: "Ar", role: carrier, purity {99.999, percent}}]`, `parameters
  {reactorType: hot_wall, substrateTemperature {300, degC}, workingPressure {0.15, Torr},
  carrierGas: "ar", carrierFlowRate {30, sccm}, plasma {enabled: true, power {300, W}, gas: "nh3"},
  cycle: {steps: [pulse 0.06 s (precursor_pulse trimethylaluminium) → purge 10 s (gas_flow ar) →
  plasma 20 s (plasma nh3) → purge 5 s]}}`, top-level `steps: [heat (substrate 300 degC) → cycle
  (repeat: 200, logs: substrate temperature vs time) → cool]`.
- `…/pulsed_laser_deposition.json` (KrF excimer, 248 nm, 2 J/cm², 10 Hz, 5000 pulses, 50 mTorr O2,
  700 degC) and `…/chemical_vapor_deposition.json` (thermal CVD, showerhead) as synthetic runs.

## 4. Tests

- Phase 0 tests now cover `schema/process/**` and the catalogue (descriptions, inline budgets).
- `tests/js/entityGraph.tests.ts`: counts; holder `data` variants 48 → 54; spot checks
  `process/step --extends--> workflow/unit/mixins/base`,
  `processes-directory/vapor-deposition/atomic-layer-deposition --extends--> process/stage`.
- Discriminator rule: every branch of `process/step/context/item` (`name`) and `process/source`
  (`kind`) declares its tag with `enum`/`const`, lists it in `required`, unique across the union.
- `tests/js/docsPages.tests.ts`: the four new `entity-relationships` fragments expand.

## 5. Acceptance criteria

- LMC process 1699 validates as a `process` (no sputtering catalogue entry needed); the ALD, PLD
  and CVD examples validate as catalogue-entry stages.
- `measurement` accepts a `process` protocol; the graph has no cycle (`measurement → process →
  stage → instrument` never returns to `measurement`).
- `docs/03-entity-anatomy.md` describes fifteen root schemas and renders the four new
  relationship fragments; `npm test`, the Python suite and the lint are green; counts re-pinned.

## 6. Out of scope

Sputtering, MBE and evaporation catalogue entries (vocabulary only; `sputtering.json` is a
one-file follow-up when Phase 4 needs it); recipe-vs-run split (`status: draft` covers it);
nested step trees.
