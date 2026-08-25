---
title: Conventions
order: 6
summary: Ids, includes, generative keys, formatting rules, and the URLs that are contracts.
---

# Conventions

The rules that keep the schema corpus coherent. Most are enforced by the schema lint, which runs on
every pull request; where that is so, it is noted.

## `$id` is the path

Every schema declares an `$id` derived mechanically from its location under `schema/`: drop the
`.json`, and replace underscores with dashes.

```
schema/in_memory_entity/named_defaultable.json   ->   $id: in-memory-entity/named-defaultable
schema/material.json                             ->   $id: material
```

`npm run set-schema-ids` rewrites every `$id` to match its path, and the lint fails if any file
disagrees. Consequences worth knowing:

- **Moving a file changes its identity.** Consumers reference schemas by `$id`, so a move is a
  breaking change, not a refactor.
- **The dash/underscore duality is real and bites.** The published copy of a schema is written at
  the `$id` with dashes turned *back* into underscores — which is not always the original path.
  `schema/properties_directory/non-scalar/file_content.json` has `$id`
  `properties-directory/non-scalar/file-content` and publishes at
  `schema/properties_directory/non_scalar/file_content.json`, because the source directory name
  contains a literal dash. Going from `$id` to published path is a pure function; going back is
  not, and needs a lookup. Both paths are carried on every node in `graph.json` for this reason.

## Draft-07, and no circular references

All schemas declare `http://json-schema.org/draft-07/schema#`. Draft-07 is what the JavaScript and
Python validators, the pydantic generator and the TypeScript generator all agree on.

**Circular `$ref`s are forbidden.** The README's guidance is to leave the type as `object` and
explain the relationship in `description` instead. There are currently none, and the lint fails if
one appears. The reason is practical: the build resolves and merges references, and a cycle either
hangs it or forces a silent fallback to the unresolved form.

## `include()` statements

Beyond standard `$ref`, ESSE supports an `include()` mechanism (implemented in
`src/js/json_include`) that splices one document's keys into another at build time. It exists for
cases where `$ref` cannot express the composition, and it is resolved before validation — no
consumer of the published schemas ever sees an `include()`.

Prefer `$ref`. It is standard, it is visible on the Entity Map, and it survives into the resolved
output as structure rather than as a copy.

## Generative keys

Some property schemas describe values a user supplies *before* a calculation rather than results
that come out of one. Those fields are flagged in schema comments with `isGenerative: true`, which
marks them for inclusion in generated user-input forms. `properties_directory/non-scalar/file_content`
is the canonical example of a property carrying additional input-side tagging.

## Formatting

Enforced by prettier and the shared pre-commit hooks:

- **4-space indentation**, **100-character** print width
- **double quotes** (it is JSON), **trailing newline**, **bracket spacing**

## The manifests

`manifest/*.yaml` are registries keyed by name, joining to schemas by `schemaId`. A manifest entry
naming a schema that does not exist now fails the lint; previously the two could drift apart
unnoticed.

## URLs that are contracts

The published site's URLs are depended on by documentation, pull requests and the platform. These
are stable, and change only additively:

| URL | Meaning |
| --- | --- |
| `/#<published path>` | schema explorer deep link |
| `/map/#/entity/<$id>` | Entity Map: fly to a schema and open its panel |
| `/map/#/view/<x>,<y>,<zoom>` | Entity Map viewport |
| `/graph.json` | the entity graph asset, described by `src/js/scripts/entity_graph.schema.json` |
| `/docs/<slug>.html` | these pages |

## What the lint checks

`npm run lint-entity-graph`, run on every pull request:

| | Rule |
| --- | --- |
| L1 | every `$ref` resolves to a schema |
| L2 | every `$id` matches its path |
| L3 | every path classifies to a layer |
| L4 | every `$ref` classifies to a relationship kind |
| L5 | every JSON-pointer fragment exists in its target |
| L6 | every manifest `schemaId` resolves |
| L7 | no reference cycles |
| L8 | isolated-schema growth (warning) |
| L9 | example coverage (warning) |
| L10 | `graph.json` validates against its own schema |

L3 is the one that will catch you when adding a new top-level directory: the layer taxonomy is
total by design, so a path no rule covers is a failure rather than a silent fallback. Add a rule
to `classifyLayer` in the same change.

## General advice from the README

- Use unique ids for schemas.
- Do not use circular references; leave the type as `object` and explain it in the description.
- Fork, change, and open a pull request — the repository is Apache-2.0 and contributions are
  welcome.
