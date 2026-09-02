---
title: Experimental data
order: 10
summary: The four experimental entities, and why each one mirrors a computational one.
---

# Experimental data

ESSE began as a description of simulation: a [material](entity-anatomy.html) is characterized by
properties produced by a model, realized by a method, run as a workflow inside a job. Experimental
work has the same shape and different nouns. A specimen is measured on an instrument; a film is
grown by a process on another instrument; the numbers that come out are properties like any other.

Rather than invent a parallel vocabulary, each experimental entity is built as the **mirror** of the
computational one it corresponds to, composing the same mixins and keeping the fields that transfer.

## The mirror

| Computational | Experimental | What the mirror keeps |
| --- | --- | --- |
| `material` | `sample` | the same `named_defaultable` mixin, `formula`, `external`, `src`; `basis` and `lattice` become an optional `_material` reference, because a specimen may have no known structure |
| `software/application` | `instrument` | `shortName` and `summary`; `version` becomes `firmware` and `build` becomes `serialNumber`, which is what identifies a physical unit |
| `job` | `measurement` | `status`, timing, `_project`; `compute` becomes `instrument`, `_material` becomes `_sample` |
| `workflow` | `process` | the five composition branches; `subworkflows` become `stages`, `units` become `steps`, and the `application` a workflow names becomes the instrument each stage runs on |
| `property` | `property` | unchanged — see below |

Read it as one sentence. A **sample** is characterized by **properties**; those properties are
produced by applying a **technique** on an **instrument** in a **measurement**; the sample itself is
produced by a **process** of **stages** and **steps**; measurements and processes belong to a
**project**, exactly as jobs do.

## Properties do not fork

This is the load-bearing decision. A measured film thickness is an ordinary `property/holder`: the
same `data` union, the same `exabyteId`, the same `repetition`. Only the source differs.

```json
{
    "data": { "name": "film_thickness", "value": 140, "units": "nm" },
    "source": {
        "type": "measurement",
        "info": { "measurementId": "mXrf0042", "channel": "thickness" }
    },
    "exabyteId": ["mXrf0042"],
    "repetition": 0
}
```

`source.info` is a union over where a value came from: `core/reference/exabyte` for a computed
result, `core/reference/measurement` for a measured one, `core/reference/process` for something read
off a fabrication record. The measurement reference is deliberately shaped like the job reference —
`measurementId` where a job has `jobId`, `channel` where a job has `unitId` — so a consumer that
already reads job provenance needs no new code path.

The consequence is that a query for "band gap of this material" and one for "band gap of this
sample" return the same shape, and a plot can mix them.

## Techniques are categorized, not enumerated

`techniques_category` narrows the same `core/reusable/categories` tiers that `models_category` and
`methods_category` use. An atomic force microscopy scan is `experimental / characterization /
microscopy / scanning_probe_microscopy / atomic_force_microscopy`, in the same five-tier ladder a
density functional theory model sits in. Techniques that are not yet modelled in detail — sputtering,
molecular beam epitaxy, X-ray diffraction — exist as vocabulary values before they have schemas.

## Where the split is visible

The computational and experimental entities sit side by side under `schema/`, as peers, because that
is what they are: `$id` is a public contract and neither family is a sub-domain of the other. What
separates them is:

- **the ontology map**, which colours the experimental entities as one family;
- **`categories.tier1`**, which is `experimental` on every measurement and process;
- **`source.type`** on a property, which says whether a number was computed or measured.

None of these is a hand-maintained tag that can disagree with the schemas. Each is derived from the
record or from the path.

## What a record looks like

A combinatorial library is a `sample` with `form: library` and a grid of positions; each position is
a child `sample` with a `_parent` and a `position`. That child's identity is the join key: a
measurement points at it with `_sample`, and every property holder produced from that measurement
carries it. This is how a per-position thickness from an X-ray fluorescence map and a per-position
piezoresponse loop end up on the same specimen without a shared spreadsheet.

Deposition records follow the process shape: one `process` per run, one `stage` per chamber, one
`step` per operation, with material `sources` (targets, precursors, gases) named once per stage and
referenced from the steps that use them. A cycle count lives on the step's `repeat`, which is the
only place it appears.
