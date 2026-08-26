---
title: Consuming ESSE
order: 8
summary: Reading, validating and typing against the schemas from Python and JavaScript.
---

# Consuming ESSE

ESSE ships equivalent interfaces for both runtimes. Neither touches the filesystem at runtime —
the schemas are baked into generated modules at build time — so both work in restricted
environments and in the browser.

## Installing

```bash
pip install mat3ra-esse
npm install @mat3ra/esse
```

## Python

### Looking up a schema

```python
from mat3ra.esse import ESSE

helper = ESSE()
schema = helper.get_schema_by_id("material")
```

Schema ids are the dash-separated form described in [Conventions](conventions.html) —
`material`, `in-memory-entity/named-defaultable`, `properties-directory/scalar/total-energy`.

### Validating and cleaning

`validate_and_clean` validates a document and strips properties the schema does not declare. It
mutates in place:

```python
from mat3ra.esse import validate_and_clean

data = {"a": "x", "b": 1, "c": "drop"}
schema = {
    "type": "object",
    "properties": {"a": {"type": "string"}, "b": {"type": "integer"}},
}

validate_and_clean(data, schema)
print(data)  # {"a": "x", "b": 1}
```

Null values are removed; empty strings are kept, because an empty string is a meaningful
placeholder for an entity field that exists but is not yet filled in.

### Generated pydantic models

Every schema has a corresponding pydantic v2 model under `mat3ra.esse.models`, which is usually
the more ergonomic route — you get typing, coercion and IDE completion:

```python
from pydantic import ConfigDict
from mat3ra.esse.models.software.application import ApplicationSchemaBase


class Application(ApplicationSchemaBase):
    # drop keys the schema does not declare, at construction time
    model_config = ConfigDict(extra="ignore")


config = {"name": "espresso", "version": "6.3", "buildConfig": {"moduleName": "6.3-gnu"}}
app = Application(**config)
print(app.model_dump(exclude_none=True))
```

Subclassing to set `model_config` is the established pattern; [ade](https://github.com/mat3ra/ade)
does exactly this in its `application.py`.

**Depend on the named top-level model, not on generated inner class names.** As
[The pipeline](the-pipeline.html) explains, `datamodel-codegen` numbers generated classes globally,
so a name like `Units276` can change when an unrelated schema is added.

## JavaScript and TypeScript

### Looking up a schema

```javascript
const { ESSE } = require("@mat3ra/esse/lib/js/esse");

const helper = new ESSE();
const schema = helper.getSchemaById("material");
```

### Validating and cleaning

```javascript
const { validateAndClean } = require("@mat3ra/esse/lib/js/esse");

const data = { a: "x", b: 1, c: "drop" };
const schema = {
    type: "object",
    properties: { a: { type: "string" }, b: { type: "integer" } },
};

const result = validateAndClean(data, schema);
```

### `JSONSchemasInterface`

The richer accessor, used across the `@mat3ra/*` packages:

```typescript
import JSONSchemasInterface from "@mat3ra/esse/dist/js/esse/JSONSchemasInterface";

// exact lookup, throwing when absent
const material = JSONSchemasInterface.getRequiredSchemaById("material");

// regex search across ids and titles
const application = JSONSchemasInterface.matchSchema({
    $id: { $regex: "software-application" },
});

// a patched copy, leaving the cached original untouched
const patched = JSONSchemasInterface.getPatchedSchemaById("boundary-conditions-provider", {
    type: { default: "pbc" },
    offset: { default: 0 },
});
```

`getPatchedSchemaById` is worth knowing about: it returns a *copy* with defaults or constraints
overridden, which is how UI code specializes a shared schema for one context without mutating the
registry everyone else reads.

`JSONSchemasInterfaceServer` is the Node-only variant that can also read schemas from a folder.

### Generated types

```typescript
import type { MaterialSchema } from "@mat3ra/esse/dist/js/types";
```

## Which to reach for

| You want to | Use |
| --- | --- |
| check an untrusted payload | `validate_and_clean` / `validateAndClean` |
| construct entities in application code | the generated pydantic model or TS type |
| build a form or UI from a schema | `getSchemaById`, plus `getPatchedSchemaById` to specialize |
| find schemas by pattern | `matchSchema` |
| understand how schemas relate | `graph.json`, or the [Entity Map](../map/index.html) |

## Downstream packages

The `@mat3ra/*` ecosystem consumes ESSE throughout — `made` (materials), `mode` (models), `ade`
(applications), `wode` (workflows), `jode` (jobs), `prode` (properties), `code` (shared entity
machinery). They are worth reading as worked examples of entity classes built on these schemas.
