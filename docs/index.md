---
title: Documentation
order: 0
summary: How ESSE is put together and why — the concepts behind the schemas.
---

# Documentation

ESSE — the **E**ssential **S**ource of **S**chemas and **E**xamples — is an **ontology for digital
materials science, written as JSON Schema**. It fixes what kinds of thing exist in the domain —
materials, models, methods, properties, workflows, jobs — and how they relate, then ships worked
examples of each. Because the ontology is expressed as JSON Schema rather than OWL, it validates
real records directly instead of describing a world something else must conform to.

That combination is what makes it useful as a data standard for machine learning and for agents:
the entity types, their fields, their units and their relationships are all declared, checkable,
and stable under a `$id`, so nothing has to be inferred from examples.

The [schema explorer](../index.html) shows you any single schema. The
[Entity Map](../map/index.html) shows you the ontology whole — every entity type and every
relationship between them. These pages explain *why* the schemas are shaped the way they are,
which is the part neither of the other two can tell you.

<!-- generated:corpus-totals -->

## Where to start

If you are new, read the first four pages in order — they are the argument, and the rest are
reference:

1. **[Why ESSE exists](why-esse-exists.html)** — schemas as the shared source of truth, and what
   the two papers behind this repository contribute.
2. **[Schema layering](schema-layering.html)** — the build-up from primitives to entities, and
   why the layers are separate.
3. **[Entity anatomy](entity-anatomy.html)** — the root entities, how they compose, and the
   material variant family.
4. **[Categorization](categorization.html)** — CateCom tiers for models and methods,
   composition for materials, and the `*_category` versus `*_directory` split that names half the
   repository.

Then, as you need them:

5. **[Behavioural mixins](behavioural-mixins.html)** — how `allOf` stacks platform behaviour onto
   domain payloads.
6. **[Conventions](conventions.html)** — `$id`s, includes, generative keys, formatting, and the
   URL contracts.
7. **[The pipeline](the-pipeline.html)** — how JSON sources become packages, types and this site,
   and what the two runtimes do and do not guarantee.
8. **[Consuming ESSE](consuming-esse.html)** — using the schemas from Python and JavaScript.
9. **[Contributing a schema](contributing-a-schema.html)** — a worked example, end to end.
10. **[Glossary](glossary.html)** — the vocabulary, in one place.

## Conventions in these pages

Every claim about the corpus — counts, relationships, coverage — is generated from the schema
sources at build time rather than typed by hand, so these pages cannot quietly fall out of step
with the schemas they describe. Schema names link to their place on the Entity Map.
