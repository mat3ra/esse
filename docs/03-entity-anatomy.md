---
title: Entity anatomy
order: 3
summary: The root entities, how they compose, and why there are four kinds of material.
---

# Entity anatomy

Fifteen schemas sit at the top level of `schema/`. They are the nouns of the domain — the things a
user creates, names, owns and looks at — and everything else in the repository exists to define,
categorize or support them.

Eleven of them describe computational work. The other four — `sample`, `instrument`, `measurement`
and `process` — describe experimental work, and each is built as the mirror of a computational one
rather than as a separate vocabulary. [Experimental data](experimental-data.html) sets out the
correspondence; the sections below cover the computational originals.

## Material

A material is a structure plus what is known about it. It is assembled entirely by composition:

<!-- generated:entity-relationships:material -->

`material/material_properties` carries the structural payload — the basis (atomic species and
coordinates), the lattice, and derived properties. `material/metadata` carries descriptive
metadata. `in-memory-entity/named-defaultable` supplies the platform behaviour of being a named
object with defaults.

Note that `material` itself declares no properties of its own. It is pure composition, which is
the idiom you will see throughout: the root schema names the parts, and the parts hold the
content.

### The material variant family

Four material schemas exist, and the difference between them trips people up.

| Schema | What it adds | Use it when |
| --- | --- | --- |
| `material` | the canonical entity | you mean "a material" |
| `material-hashed` | content hashes over the structure | you need to detect that two records describe the same structure |
| `material-enhanced` | additional derived payload on top of the base entity | you are consuming an enriched record |
| `material-enhanced-hashed` | both of the above | both reasons apply |

The hashed variants exist because structural equality is not string equality: two records can
describe the same crystal with different atom ordering, origin or cell choice. Hashing a
canonicalized form gives a stable identity for deduplication and lookup. Keeping that in a
separate schema means consumers who do not need identity do not pay for it, and the hash algorithm
can change without disturbing the base entity.

## Model and method

The separation of *model* from *method* is one of the load-bearing ideas from the CateCom paper,
and it is worth stating plainly:

- A **model** is the physical description of the system — what physics you claim applies. `type`
  and `subtype` (for example `dft` and `gga`), plus the method it is realized by.
- A **method** is the mathematical and numerical realization — how you actually compute it. Also
  `type` and `subtype` (for example `pseudopotential` and `ultra-soft`), plus `precision` and
  method-specific `data`.

`model` requires `method`, so a model is never specified without saying how it is to be computed:

<!-- generated:entity-relationships:model -->

The reason to separate them is comparability. "PBE" is a model choice; whether it was evaluated
with norm-conserving or ultrasoft pseudopotentials is a method choice. Two results are comparable
only if you can see both independently, and you can only see both independently if the format
keeps them apart.

Note also that neither refers to *software*. Which application computed it is a property of the
job, not of the physics. `software/application` and the `software_directory` catalogue cover that
separately.

## Workflow, subworkflow and unit

A workflow is the executable decomposition of a calculation, and it nests three levels deep:

- **`workflow`** — the top-level object a user runs.
- **`workflow/subworkflow`** — a stage, carrying the model and method it applies.
- **`workflow/unit/*`** — the individual steps. Units are typed: execution, assignment, condition,
  map, io, processing, and so on, each with its own schema under `workflow/unit/`.

`workflow/unit/context/_base` is one of the most-referenced schemas in the corpus, because almost
every unit type needs the context mechanism that carries values between steps.

## Job

A job binds a workflow to everything needed to actually run it:

<!-- generated:entity-relationships:job -->

`job/base` composes the platform mixins and the compute configuration; `job` adds the required
`workflow`. Notice `_project` and `_material` on the base: these are `system/entity_reference`
values — deliberately partial copies of another entity, not full embeddings — so a job record
stays self-describing without duplicating whole materials into itself.

## Property and the property holder

Properties are the results. Individual property schemas live in `properties_directory`, grouped by
shape: `scalar` (total energy, pressure, band gap), `non-scalar` (band structure, density of
states, charge density), `structural`, `elemental` and `workflow` (convergence monitors).

They are tied together by `property/holder`, which is the widest schema in the corpus: its `data`
field is a union over every property type, on top of one mixin and a `source` whose `info` is
itself a small union over where the value came from: a job, a measurement or a process. That
one file is why "what property types exist?" has a single answer, and it is the clearest
illustration of the union idiom in ESSE. On the [ontology map](../map/index.html) it is the node
with by far the largest fan-out.

`manifest/properties.yaml` is the registry that sits alongside: it maps a property name to its
schema id, its default units, and flags for whether it is a computed *result* or a runtime
*monitor*. The ontology map shows those flags as badges on property nodes.

## How it fits together

Reading the composition from the bottom: a **material** is characterized by **properties**; those
properties are produced by applying a **model** (realized by a **method**) through a
**workflow** of **units**; that workflow is executed as a **job** against **compute** resources
using a **software application**; and the job belongs to a **project**.

Each arrow in that sentence is a `$ref` you can follow on the map.
