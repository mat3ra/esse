---
title: Why ESSE exists
order: 1
summary: Schemas as the single source of truth shared by people, validators and code generators.
---

# Why ESSE exists

Computational materials science produces a great deal of structured data — crystal structures,
simulation parameters, converged energies, band structures, the provenance of all of it — and
almost none of it is structured the same way twice. Every group, code and database invents its own
record format. The result is well known: results that cannot be compared, pipelines that break at
every boundary, and a great deal of glue code whose only job is to translate one dialect into
another.

ESSE is one answer to that. It defines the entities of the domain as data, in JSON Schema, once,
and treats those definitions as the authoritative description that everything else derives from.

## Schemas first, not code first

The tempting alternative is to define entities in code — a `Material` class in Python, another in
TypeScript — and let the serialization format fall out of whatever the classes happen to contain.
That works until there is a second runtime, and then the two drift, because nothing forces them to
agree.

ESSE inverts it. The JSON Schema is the definition; the Python and TypeScript representations are
*generated from it*. That has several consequences worth being explicit about:

- **One definition, many consumers.** The same schema validates an API payload, generates a
  pydantic model, generates a TypeScript type, and documents itself for a human reader.
- **Validation is not an afterthought.** Any consumer can check a record against the schema with
  a standard, off-the-shelf validator. There is nothing bespoke to reimplement.
- **The format outlives the code.** A JSON document with a `$id` remains interpretable long after
  whatever wrote it has been rewritten. This matters for scientific records specifically, where
  the data is the deliverable and the code is scaffolding.
- **Disagreements surface as schema changes.** When two teams need different shapes, that shows up
  as a visible, reviewable change to a shared file, not as a silent divergence in two codebases.

The cost is real and worth naming: writing JSON Schema by hand is more tedious than writing a
dataclass, and expressing some constraints in it is awkward. ESSE accepts that cost because the
alternative — the drift — is worse and compounds.

## What the two papers contribute

Two publications underpin the design, and they answer different questions.

**[Data-centric online ecosystem for digital materials science](https://arxiv.org/pdf/1902.10838.pdf)**
sets out the entity model: what the nouns of the domain actually are, and how they connect. A
*material* is characterized by *properties*; those properties are computed by applying a *model*
(with its *method*) through a *workflow*, executed as a *job* on some *compute* resource, using
some *application*. The important claim is that these are separable concerns — a model is not
bound to the software that implements it, and a property is not bound to the workflow that
produced it — and that separating them is what makes results comparable across sources.

**[CateCom: A Practical Data-Centric Approach to Categorization of Computational Models](https://pubs.acs.org/doi/abs/10.1021/acs.jcim.2c00112)**
answers a different question: given that there are thousands of models and methods, how do you
organize them so a person can find the right one and a machine can reason about it? The answer is
a tiered categorization rather than a flat list or a rigid tree, described in
[Categorization](categorization.html). Roughly half the schemas in this repository exist to
express that scheme.

## Generic by design

The schemas are used to run [mat3ra.com](https://mat3ra.com), but they are deliberately not
platform-specific. Domain payloads — what a material *is*, what a band structure *contains* —
carry no platform concepts. The platform's own concerns (ownership, sharing, soft deletion,
timestamps) live in separate mixin schemas that are composed on top, as
[Behavioural mixins](behavioural-mixins.html) describes. A consumer who wants the domain formats
without the platform machinery can take exactly the parts they need.

## What is actually in here

Three kinds of asset, described in [The pipeline](the-pipeline.html):

- **Schemas** (`schema/`) — the rules. Every file declares a `$id` derived from its path.
- **Examples** (`example/`) — instances conforming to those rules, mirroring the schema directory
  layout. They are versioned, reviewed assets rather than documentation garnish: an example is
  often the fastest way to understand a schema, and it fails loudly when the schema changes under
  it. Currently <!-- generated:example-coverage -->.
- **Interfaces** (`src/`) — thin Python and JavaScript accessors, plus the generated models and
  types.

The corpus at a glance, and how densely it is cross-referenced:

<!-- generated:corpus-totals -->

Those references are not incidental. They are what makes the collection a system rather than a
folder of files, and they are what the [Entity Map](../map/index.html) draws.
