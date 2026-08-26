---
title: Contributing a schema
order: 9
summary: Adding a new scalar property, end to end — files, commands, checks and review.
---

# Contributing a schema

A worked example: adding a new scalar property. Most contributions follow this shape, and the
checks are the same whatever you are adding.

## Setup, once

Both runtimes are needed, because the pre-commit hook regenerates assets with both:

```bash
git clone https://github.com/mat3ra/esse.git && cd esse
npm install

python -m venv .venv
source .venv/bin/activate
pip install -e ".[all]"
```

The hook requires `.venv` at the repository root specifically, and refuses to run without it.

## 1. Write the schema

Say we are adding a *cohesive energy* scalar property. Scalar properties live in
`schema/properties_directory/scalar/`, and they compose an existing reusable rather than
redefining what an energy is:

`schema/properties_directory/scalar/cohesive_energy.json`

```json
{
    "$id": "properties-directory/scalar/cohesive-energy",
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "cohesive energy scalar property schema",
    "type": "object",
    "allOf": [
        {
            "$ref": "../../core/reusable/energy.json"
        }
    ],
    "properties": {
        "name": {
            "enum": ["cohesive_energy"]
        }
    },
    "required": ["name", "value"]
}
```

Points of style, each of which the lint or review will raise:

- The `$id` is the path with underscores turned into dashes. Do not hand-write it wrongly — run
  `npm run set-schema-ids` and let it be correct.
- Compose `core/reusable/energy` rather than restating `value` and `units`. If your quantity is
  not an energy, look for the reusable that fits before writing a new one.
- 4-space indent, double quotes, trailing newline.
- No circular references.

## 2. Write the example

Examples mirror the schema tree exactly. `example/properties_directory/scalar/cohesive_energy.json`:

```json
{
    "name": "cohesive_energy",
    "value": -4.32,
    "units": "eV/atom"
}
```

This is not optional decoration. Currently <!-- generated:example-coverage -->, and the coverage
figure is reported by the lint precisely so it goes up rather than down.

## 3. Register it in the manifest

If the property is one the platform should know about, add it to `manifest/properties.yaml`:

```yaml
cohesive_energy:
  defaults:
    units: eV/atom
  schemaId: properties-directory/scalar/cohesive-energy
  isResult: true
```

`isResult` marks a computed output; `isMonitor` marks something tracked during a run. The
`schemaId` must resolve — the lint fails if it does not, which is a check that did not exist
before and had been silently breakable.

## 4. Regenerate

```bash
npm run set-schema-ids          # normalize $ids
npm run transpile-and-build-assets
```

This resolves the schemas into `dist/js` (build output, gitignored), regenerates the TypeScript types
and transpiles. The pre-commit hook does it too, but running it yourself makes the diff
predictable.

Expect the diff to be larger than your one schema: the regenerated pydantic models under
`src/py/` come along, and `datamodel-codegen`'s global class numbering may renumber classes in
unrelated model files. That is normal, and [The pipeline](the-pipeline.html) explains why.
`dist/` itself is gitignored, so resolved assets do not appear in the diff.

## 5. Check it

```bash
npm run lint-entity-graph       # the schema lint, L1-L10
npm test                        # includes the lint plus the JS test suite
python -m unittest discover --verbose --catch --start-directory tests/py/esse/
```

The lint messages name the offending file and reference. The rules most likely to catch a new
contribution:

| | What it will tell you |
| --- | --- |
| L1 | a `$ref` points at a file that is not there — usually a wrong number of `../` |
| L2 | the `$id` does not match the path — run `set-schema-ids` |
| L3 | the path is in a directory no layer rule covers — add a rule to `classifyLayer` |
| L5 | a `$ref` fragment names something the target does not define |
| L6 | a manifest entry points at a schema that does not exist |

If you added a new top-level directory, L3 will fail by design: the layer taxonomy is total, and
adding a directory is a decision someone should make deliberately rather than let default.

## 6. Update the counts

`tests/js/entityGraph.tests.ts` pins the corpus baseline — node count, edge counts by kind, layer
counts. Adding a schema changes them, which is intended: update the constants in the same commit,
so the change to the corpus is visible in review rather than buried.

## 7. Open the pull request

Fork, branch, and open a pull request against `dev`. Useful things to say in the description:

- What the entity is and where it fits in the layering.
- Why it composes what it composes — especially if you added a new reusable.
- Whether it is a breaking change. Moving or renaming an existing schema is breaking, because
  consumers reference schemas by `$id`.

## Where things go

| Adding | Put it in |
| --- | --- |
| a custom scalar or array type | `schema/core/primitive/` |
| unit-less mathematics | `schema/core/abstract/` |
| a physical quantity reused across properties | `schema/core/reusable/` |
| a shared enumeration | `schema/definitions/` |
| a computed result | `schema/properties_directory/<shape>/` |
| record behaviour, not science | `schema/system/` or `schema/in_memory_entity/` |
| allowed category values | a `*_category` schema |
| a concrete catalogue entry | a `*_directory` schema |

When in doubt, find the closest existing schema and follow it. [Schema layering](schema-layering.html)
is the longer answer.
