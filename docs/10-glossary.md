---
title: Glossary
order: 10
summary: The vocabulary of the repository, with pointers to where each idea is explained.
---

# Glossary

Terms as this repository uses them. Where a term names a schema, the name links to its place on
the [Entity Map](../map/index.html).

## The corpus

**Schema** — a JSON Schema (draft-07) file under `schema/`, declaring a `$id` derived from its
path. The authoritative definition of one entity or fragment.

**Example** — an instance under `example/` conforming to the schema at the mirrored path. A
versioned, reviewed asset, not documentation garnish. See
[Why ESSE exists](why-esse-exists.html).

**Resolved schema** — the published copy in `dist/js/schema` with `$ref`s inlined and `allOf`
merged. Self-contained and convenient, but it no longer shows which mixin a field came from. See
[The pipeline](the-pipeline.html).

**`$id`** — a schema's identity: its path with `.json` dropped and underscores replaced by dashes.
Consumers reference schemas by this, so moving a file is a breaking change.
[Conventions](conventions.html).

**Published path** — where a schema's resolved copy lives on the site, derived from the `$id`.
Not always the source path, because source directories may contain literal dashes.

## The layering

**Layer** — where a schema sits in the build-up: `primitive`, `abstract`, `reusable`, `reference`,
`definition`, `in-memory-entity`, `system`, `entity`, `entity-component`, `category`, `directory`,
`application-parsing`. Every schema has exactly one, and the classification is total — an
unclassifiable path fails the lint. [Schema layering](schema-layering.html).

**Primitive** — a custom type built only from default JSON Schema types, which cannot be
reconstructed from other primitives. The bottom of the stack.

**Abstract** — a unit-less mathematical structure: vectors, matrices, grids, plots.

**Reusable** — a domain building block carrying physical meaning, such as
[`core/reusable/energy`](../map/#/entity/core%2Freusable%2Fenergy).

**Mixin** — a schema from `in_memory_entity` or `system` composed into an entity with `allOf` to
add record behaviour rather than payload. [Behavioural mixins](behavioural-mixins.html).

**Entity reference** — [`system/entity-reference`](../map/#/entity/system%2Fentity-reference), a
partial copy of another entity: enough to identify and display it without embedding the whole
thing.

## The entities

**Material** — a structure plus what is known about it. Four variants exist: the canonical
`material`, the content-addressed `material-hashed`, the enriched `material-enhanced`, and both
combined. [Entity anatomy](entity-anatomy.html).

**Model** — the physical description of a system: what physics you claim applies. Requires a
method.

**Method** — the mathematical and numerical realization of a model: how it is actually computed.
Kept separate from the model so results stay comparable.

**Property** — a result. Individual schemas live in `properties_directory`, grouped by shape:
scalar, non-scalar, structural, elemental, workflow.

**Property holder** — [`property/holder`](../map/#/entity/property%2Fholder), whose `data` field
is a union over every property type. The widest schema in the corpus and the single answer to
"what property types exist?".

**Workflow / subworkflow / unit** — the executable decomposition of a calculation, three levels
deep. Units are typed: execution, assignment, condition, map, io, processing.

**Job** — a workflow bound to the compute, project and material it runs against.

## Categorization

**Tier** — one level of the CateCom categorization (`tier1`, `tier2`, `tier3`, plus `type` and
`subtype`), defined by
[`core/reusable/categories`](../map/#/entity/core%2Freusable%2Fcategories). Categories are a path,
not a tree node. [Categorization](categorization.html).

**Category schema** (`*_category`) — defines the **vocabulary**: which tier values exist.

**Directory schema** (`*_directory`) — the **catalogue**: the concrete entries.

**Manifest** — a YAML registry under `manifest/`, joining names to schema ids plus metadata such
as default units and the `isResult` / `isMonitor` flags. The join is lint-checked.

**Generative key** — a field flagged `isGenerative: true`, marking user input supplied before a
calculation rather than a computed result.

## Tooling

**Entity graph** — `graph.json`, the extracted reference graph: one node per schema, one edge per
cross-schema `$ref`. Described by
[`system/entity-graph`](../map/#/entity/system%2Fentity-graph) — the tooling that documents the
schemas is itself documented by one.

**Relationship kind** — what a `$ref` expresses, from its innermost enclosing keyword: `extends`
(`allOf`), `contains` (`properties`/`items`), `variant` (`oneOf`/`anyOf`).

**Same-document reference** — a `$ref` beginning with `#`, pointing inside its own document.
Twenty exist; they are not edges between schemas and are counted separately.

**Isolated schema** — one with no incoming or outgoing references. Mostly leaf definitions and
externally-consumed formats. Growth is reported by the lint as a warning.

**Schema lint** — the L1–L10 rules run on every pull request. [Conventions](conventions.html).

**Hub** — a heavily referenced schema. The map draws these larger; the top of the list is
[`definitions/units`](../map/#/entity/definitions%2Funits) and
[`core/primitive/scalar`](../map/#/entity/core%2Fprimitive%2Fscalar).

<!-- generated:hub-table -->

## The surfaces

**Schema explorer** — [the file browser](../index.html) over resolved schemas and examples.

**Entity Map** — [the map](../map/index.html) of all schemas and their references, laid out by
architectural layer.

**Concept documentation** — these pages.
