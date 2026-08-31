---
title: Schema layering
order: 2
summary: The build-up from primitives to entities, and why each layer is kept separate.
---

# Schema layering

ESSE schemas are not a flat pile. They are built up in layers, each one constructed only from the
layers beneath it. This is the single most useful thing to understand about the repository: once
you know which layer a schema belongs to, you know roughly what it may contain, what may depend on
it, and where to add something new.

The [ontology map](../map/index.html) draws these layers literally — primitives sit at the centre and
each ring outward is a layer further up the build-up.

## The layers

<!-- generated:layer-inventory -->

### `core/primitive` — the atoms

Custom primitive types that extend what JSON Schema gives you: `scalar`, `array_of_3_numbers`,
`array_of_ids`, `slugified_entry`, `string`. The defining property, and the reason they are their
own layer, is stated in the repository README: **primitives are defined solely in terms of default
JSON Schema types and cannot be re-constructed from each other.** They are the bottom of the stack
by construction.

If you find yourself wanting a primitive that is "like `scalar` but…", it is not a primitive.

### `core/abstract` — unit-less mathematics

Structures with mathematical meaning but no physical interpretation: `vector_3d`, `matrix_3x3`,
`coordinate_3d`, `3d_grid`, `2d_plot`. An `array_of_3_numbers` is a primitive; a `vector_3d` is
that array understood as a vector. Nothing here carries units, because nothing here knows what it
is measuring.

Keeping this layer unit-less is what lets one `2d_plot` definition serve a density of states, a
convergence trace and a phonon dispersion alike.

### `core/reusable` — domain building blocks

The first layer that means something physically: `energy`, `band_gap`, `atomic_orbital`,
`kpoint`, `categories`, `file_metadata`. These combine primitives and abstracts and attach
meaning — an `energy` is a scalar *with units*, drawn from `definitions/units`.

This layer exists to stop the same block being redefined in a dozen property schemas. When you
notice two schemas describing the same physical quantity, the answer is usually a reusable.

### `core/reference` — provenance

How a record points at where it came from: `literature`, `experiment`, `modeling`, `exabyte`.
Provenance is deliberately separate from the data it describes, so the same property schema can
carry a computed value or a measured one without changing shape.

### `definitions` — shared vocabularies

Enumerations and constants shared across the whole corpus: `units`, `chemical_elements`,
`constants`, `material`. `definitions/units` is the most-referenced schema in ESSE, which is the
intended outcome: units are defined once, and every quantity points at that definition rather than
restating a list of strings.

### `in_memory_entity` and `system` — behaviour, not payload

These two layers do not describe materials science at all. They describe how an object behaves as
a record on a platform — that it has a name, that it has defaults, that it can be soft-removed,
shared, timestamped, referenced from elsewhere. They are mixed into entities with `allOf`, and
they are the subject of [Behavioural mixins](behavioural-mixins.html).

Keeping them out of the domain layers is what allows a consumer to take the science and leave the
platform behind.

### `entity` and `entity-component` — the nouns

The eleven root schemas (`material`, `model`, `method`, `workflow`, `job`, `project`, `element`,
`context-provider`, and the material variants) plus the components they are assembled from —
`material/material_properties`, `workflow/unit/*`, `model/mixins/*`, `method/unit_method`, and so
on. [Entity anatomy](entity-anatomy.html) covers these in detail.

### `category`, `directory` and `application-parsing` — the catalogues

The largest layers by file count, and the least surprising: `*_category` schemas express the
CateCom taxonomies, `*_directory` schemas are the concrete catalogues of models, methods,
properties and software, and `apse/*` describes application file formats and parser outputs.
[Categorization](categorization.html) explains the split.

## The hubs

Because each layer is built from the ones below it, the lower layers are referenced far more often
than the upper ones. The most-referenced schemas in the corpus are exactly what the layering
predicts:

<!-- generated:hub-table -->

A schema high in this table is one you should be careful changing: a great deal depends on it.
The ontology map draws these larger than their neighbours for the same reason.

## Why keep the layers separate at all?

It would be less typing to inline everything. Three things are bought by not doing so.

**Change has a blast radius you can see.** Adding a unit to `definitions/units` is a one-line
change that correctly reaches every quantity in the corpus. Inlined, it would be a hundred edits
and a guarantee that some were missed.

**Generated code stays small.** The pydantic models and TypeScript types mirror this structure, so
a shared block is a shared type rather than a hundred structurally identical anonymous ones.

**It documents intent.** Where a schema sits says what it is for. A new contributor wondering
where to put something can usually answer it by asking which layer it could be built from — and
if the answer is "none of them", that is itself informative.
