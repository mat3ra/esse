# Review: experimental data plan (sample, instrument, measurement, process)

> **Reviewed document:** the first complete draft of the experimental-data design, since split into
> [`../upcoming/2026-09-02-experimental-data-overview.md`](../upcoming/2026-09-02-experimental-data-overview.md)
> and its phase documents per this review.
> **Reviewer:** Timur Bazhirov — *persona review drafted by the coding agent at Timur's request,
> using the rule catalog in `mat3ra/agent-code-review-tb` (`AGENTS-code-review-tb.md`,
> `AGENTS.md`; rules cited as `TB-*`), three passes. Treat the decisions below as provisional
> until confirmed by Timur directly; they are recorded as decisions so the split documents have one
> consistent basis.*
> **Created:** 2026-09-02 · **Updated:** 2026-09-02
> **Driver:** [SOF-7988](https://mat3ra.atlassian.net/browse/SOF-7988)

## 1. Verdict

Direction approved. Mirroring the four nouns instead of inventing an "experiment" island is the
data-centric answer: a measured film thickness is a `property/holder` that looks exactly like a
DFT band gap except for its `source`, and that is what lets the platform, the map and the docs treat
both without special cases. Two structural fixes before anything is built, then decisions so
implementation does not stall on "open questions".

1. **One plan document per PR** (as in the 2026-08-16 set). A six-phase monolith can never make
   six `upcoming/ → review/ → implemented/` claims at once. Split: overview + one document per PR +
   context documents. *(Done as part of this restructure.)*
2. **Names, spelled out (TB-NAME-1, `AGENTS.md` HARD RULE 4).** `afm_image.json`, `nd_array.json`,
   `didv`, `rta`, `acDrive` are abbreviations in schema and field names. Acronyms live only as
   category *slugs*, paired with the full `name` in the `slugified_entry` object — that is exactly
   what `core/primitive/slugified_entry_or_slug.json` exists for. Catalogue and core files get full
   names: `atomic_force_microscopy_image.json`, `multidimensional_array.json`,
   `differentialConductance`, `rapid_thermal_annealing`. Category-tree *files* keep slug names for
   consistency with `models_category/pb/qm/dft.json` — one documented exception, not a precedent
   for new ones. *(Applied.)*

## 2. Decisions on the plan's open questions

1. **Holder.** Keep `exabyteId` and `repetition` required. `exabyteId` is the entity-bank id of the
   record the property was obtained from — in `example/property/holder.json` it is literally the
   job id — and `repetition` is the run repetition; both mean the same thing for a measurement. So a
   measured value is a holder with `exabyteId: [measurementId]` and `source.info: {measurementId,
   channel}`, the mirror of `{jobId, unitId}`. Widen `source.info` only. A discriminated `source`
   (`type` const + matching `info`) is the right end state, but `type` is a free string in the wild
   today (`"exabyte"` in the example); that is a separate migration with its own ticket, and the
   schema gets a `$comment` saying so (TB-DOC-3: label the interim shape, don't hide it).
2. **Naming.** `sample`, `instrument`, `measurement`, `process` as mapped; `stage` stays — it is the
   subworkflow analogue and the NLR data literally calls it a stage. No `specimen`, no `synthesis`.
3. **Combinatorial positions.** Two-level samples. The library is a `sample` with
   `library.positions[]` (so the grid renders without 44 lookups); each position is a child
   `sample`, and the child's id is the AlphaFilm join key. Measurements point at the child through
   `_sample`; holders reach the sample through the measurement.
4. **Tickets.** File an epic ("Experimental data support: sample, instrument, measurement,
   process") with one child per `upcoming/` document, linked from the headers before the plan
   merges — same as SOF-8025 / SOF-8026–8029. SOF-7988 is the *consumer* of this work and is
   linked as the driver, not as the ticket.
5. **Timestamps.** ISO 8601 strings with `format: date-time` for `startTime`/`endTime`, matching
   `job/base.startTime` being a string; the description says why we do not use epoch numbers
   (readable in six months without a converter). `core/reference/experiment.timestamp` (epoch) is
   left alone.
6. **Technique vocabulary.** A `techniques_category/` tree with `enum_options.json`, not a new
   `definitions/techniques.json` bag — the mechanism exists, `classifyLayer` already routes it, and
   the docs categorization fragment picks it up with one word (TB-DRY-1).

## 3. Change requests (all applied in the split documents)

- **(a) TB-DOC-4 / plan convention — split and number.** One document per PR; numbered headings.
- **(b) TB-NAME-1 — spell out names.** See 1.2. Also: `acDrive` → `driveSignal`, `dcBiasWaveform`
  → `biasWaveform`, `didv` → `differentialConductance`, `rta` → `rapid_thermal_annealing`,
  `nd_array` → `multidimensional_array`, `tma` (example id) → `trimethylaluminium`.
- **(c) TB-ARCH-4 — single source of truth.** The ALD cycle count appeared twice (`step.repeat` and
  `parameters.cycle.count`); the step's `repeat` is the only count, the parameters block holds the
  half-cycle *template* only. The measurement and process `status` vocabularies were two
  hand-maintained lists; now one, in the shared mixin (d). `identifiers[]` was inlined twice; now
  `core/reusable/identifier.json`.
- **(d) TB-ARCH-2 — mixins, not repeated fields.** `status`, `startTime`, `endTime`, `operators`,
  `_project` were copied onto `measurement/base` and `process/base`. They are one concept — a
  record of something that was done, when, by whom, in which project — so they become
  `system/activity.json`, composed by both, the way `job/base` composes
  `named_defaultable_has_metadata`. Likewise "has an instrument" is defined once:
  `instrument/instrument_property.json` (mirror of `job/compute_property.json`), composed by
  `measurement/base` and `process/stage/mixin`.
- **(e) TB-DRY-1 — reuse what exists.** `sample/position` composes `core/abstract/coordinate_2d` for
  the `[x, y]` pair instead of a new `x`/`y`; `wafer_properties` uses `quantity/length`; time series
  stay `core/abstract/2d_plot`; blobs stay `object_storage_container_data`.
- **(f) TB-DOC-1 / TB-DOC-2 — descriptions are the docstrings.** Every new schema has a top-level
  `description` saying what it mirrors and *why* it deviates, and every property has a
  `description` (they become the pydantic docstrings via `--use-field-description`). Measured, not
  hoped: a mocha test asserts every schema under the new domains has a non-empty `description`.
- **(g) TB-TEST-1 — tests for the new logic.** (1) a fixture holder with a measurement source
  validates against `property/holder`, and the existing exabyte holder example still validates
  (regression for the union); (2) the real-data examples (Jupiter DART scan, LMC process 1699, HTEM
  library 6705) *are* the integration tests; (3) Phase 4 `apse` schemas are validated against
  trimmed real exports committed as fixtures — relative paths only (TB-TEST-2); (4) a test that no
  example's inline `values` exceeds the documented budget.
- **(h) TB-UI-2 — visual proof.** The map change (new colour family) and the docs page are UI: the
  PR that lands them carries before/after screenshots of the Ontology map and the rendered page.
- **(i) Crosswalks are data, not prose.** LMC→ESSE, HTEM→ESSE and `.ibw`→ESSE mappings become one
  YAML per source (`apse/…/crosswalk.yaml`), consumed by both the docs (a generated fragment) and
  the SOF-7988 ingest script, with an L6-style lint that every target `$id`/pointer resolves.
  Otherwise the docs table and the script drift, which is the failure mode `graph.json` was built
  to prevent.
- **(j) `process.categories` accepts both trees.** A measurement *protocol* (the `job.workflow`
  analogue) is a `process` with characterization categories; `oneOf` over both branches, as
  `instrument.techniques[]` already does.
- **(k) TB-PR-1 — focused PRs.** Phase 0 mixed schema foundation with tooling and docs scaffolding.
  Foundation is schema-only; `ENTITY_DOMAINS`, the map family, the categorization-fragment domain
  and the docs page land with Phase 1 — the first PR that creates a `schema/<noun>/` directory (add
  the rule when the directory arrives, not before).
- **(l) Blocker before Phase 0.** Confirm how `dist/py` (codegen output) is synced into
  `src/py/mat3ra/esse/models/` — the pre-commit hook writes one, the repository commits the other.
  A foundation PR that cannot regenerate models correctly blocks every later phase.
- **(m) Vocabulary review before Phase 2.** The technique slugs and parameter names get a pass from
  the NLR/UTK contacts; renaming a slug later is a data migration.

## 4. Non-blocking notes

- `README.md` still documents `require("@mat3ra/esse/lib/js/esse")` and an `ESSE` class that
  `src/js/esse/` does not export, and `package.json.main` points at a file nothing produces.
  Separate ticket; do not touch it in these PRs.
- `system/database_source` requires the deprecated `origin` flag; `sample.external` reuses it as is.
  Separate cleanup.
- `property/source.json` is unreferenced; schedule its removal separately rather than wiring it in.
- Phases 2 and 3 are large (≈27 and ≈37 schemas). Acceptable as single PRs because every file is a
  mirror with an example, but if review stalls, land the root + one catalogue entry first.
- Timebox Phase 5 (vendor formats) to what the ingest script actually needs.

## 5. What good looks like

A UTK PFM scan and an NLR library arrive as files. The ingest script maps them through the
crosswalk data into `sample`, `measurement` and `process` records that validate; the Ontology map
shows the experimental ring next to the simulation nouns in its own colour; and a holder for film
thickness on library position 17 looks exactly like a holder for a DFT band gap, except that its
`exabyteId` and `source.info` name a measurement instead of a job.
