---
title: Behavioural mixins
order: 5
summary: How allOf stacks platform behaviour onto domain payloads, and why they are separate.
---

# Behavioural mixins

Two directories in `schema/` describe no materials science at all. `in_memory_entity` and `system`
describe how an object behaves *as a record*: that it has a name, that it can be shared, that it
was created by someone at some time, that another record can point at it.

They are composed into entities with `allOf`, which is JSON Schema's intersection: a document must
satisfy every branch. Read an entity schema as **base + mixins + payload**.

## Reading a composed schema

`material` is the clearest example. It declares no properties of its own; it is three `allOf`
branches:

```json
{
    "$id": "material",
    "type": "object",
    "allOf": [
        { "description": "in-memory entity", "$ref": "in_memory_entity/named_defaultable.json" },
        { "$ref": "material/material_properties.json" },
        { "$ref": "material/metadata.json" }
    ]
}
```

One branch is behaviour (it is a named object with defaults), two are payload (structure and
metadata). Swap the behaviour branch and you have the same material with different platform
semantics; drop it and you have the pure domain format.

## `in_memory_entity` — object identity and shape

The in-memory-entity layer is small and composes with itself, building up progressively:

- `base` — the minimum: an object with an identifier.
- `named` — has a `name`.
- `defaultable` — can be marked as a default choice among siblings.
- `named_defaultable` — both, and the most commonly used.
- `named_defaultable_has_metadata` — adds a metadata bag.
- `named_defaultable_runtime_items` — adds runtime items, for entities that accumulate state.
- `has_consistency_check_has_metadata_named_defaultable` — adds consistency checking.

The combinatorial naming is doing real work: rather than a deep inheritance chain, each
combination that is actually used gets a name, and entities reference the one they need. It is
composition, flattened.

## `system` — platform concerns

The `system` layer is larger and less regular, because platform concerns are. Some of the more
widely used:

- **`entity_reference`** — a partial copy of another entity: enough to identify and display it
  without embedding the whole thing. This is how a job records which project and material it
  belongs to without duplicating them. It is one of the most-referenced schemas in the corpus.
- **`soft_removable`** — marks a record as removed without deleting it.
- **`sharing`**, **`owner`**, **`creator`**, **`creator_account`** — who may see it and who made it.
- **`timestampable`** — creation and modification times.
- **`status`**, **`status_track`** — lifecycle state and its history.
- **`metadata`**, **`description`**, **`name`**, **`tags`** — descriptive fields.
- **`in_set`**, **`set`** — set membership.
- **`hashed`** — content hashing, used by the material hashed variants.
- **`schema_version`** — which version of the format a record claims to follow.

## Which mixins are actually used

Generated from the current schemas — the mixins with the most schemas extending them:

<!-- generated:mixin-usage -->

## Why keep them separate

**The domain formats stay portable.** A consumer who wants ESSE's description of a band structure
does not want the platform's sharing model. Because platform behaviour is only ever added by
composition, they can take the payload schemas and ignore the rest.

**Platform changes do not touch science.** Adding a field to `system/sharing` changes every entity
that composes it, in one place, without editing a single domain schema.

**It is legible.** An entity's `allOf` list is a summary of what kind of object it is. Reading
`job/base`'s branches tells you it is a named, defaultable, metadata-carrying record with compute
properties — before you read a single property.

## A caution about `allOf`

`allOf` is an intersection, not an override. A branch cannot relax a constraint another branch
imposes; both apply. This matters for two reasons:

- Composing two branches that constrain the same field in incompatible ways yields a schema that
  nothing can satisfy, and JSON Schema will not warn you.
- The published, resolved schemas have their `allOf` branches **merged** by the build (see
  [The pipeline](the-pipeline.html)). That is a convenience for consumers, but it means the
  published copy no longer shows you which mixin a field came from. The source is authoritative
  for provenance — which is exactly why the [Entity Map](../map/index.html) is built from the
  sources rather than the published output.
