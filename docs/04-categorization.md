---
title: Categorization
order: 4
summary: Two categorization schemes, each with its own paper — CateCom tiers for models and methods, M-CODE composition for materials — and the category-versus-directory split.
---

# Categorization

There are thousands of computational models and methods, related to each other in more than one
way. A strict tree cannot hold them: an exchange-correlation functional is simultaneously "a DFT
thing", "a GGA thing" and "a Perdew-Burke-Ernzerhof thing", and different users arrive from
different directions. A flat list cannot hold them either.

The first thing to know is that **`*_category` names two different schemes**, not one, and that
each is a published design rather than an accident of history. Models and methods follow
**CateCom**: a small ordered vocabulary of *tiers*, carried as data on the entity. Materials follow
**M-CODE**: a structure class defined as a recipe over building blocks, positioned on three axes.
Reading a `materials_category/…` path expecting tiers is the single most likely way to misread the
corpus.

<!-- generated:categorization-schemes -->

## Scheme 1 — CateCom, for models and methods

The tier approach comes from the
[CateCom paper](https://pubs.acs.org/doi/abs/10.1021/acs.jcim.2c00112): categorize along a small
number of ordered tiers, and keep the vocabulary separate from the instances.

`core/reusable/categories` is the shape:

| Field | Meaning |
| --- | --- |
| `tier1` | top-level category, e.g. `pb` (physics-based) |
| `tier2` | second level, e.g. `qm` (quantum mechanical) |
| `tier3` | third level, e.g. `dft` |
| `type` | general type within that path |
| `subtype` | specific variant |

Each field is a `slugified_entry_or_slug` — either a bare slug string, or an object carrying the
slug plus a human-readable name. That duality is deliberate: compact records stay compact, while
records that need to render a label can carry one without a second lookup.

### The vocabulary is a chain of narrowings

A tier vocabulary is not one schema listing everything. It is a chain down the directory tree in
which **each schema `allOf`s its parent and narrows exactly one more field** to an enumeration held
in a sibling `enum_options.json`:

| Schema | Extends | Narrows |
| --- | --- | --- |
| [`models-category/pb`](../map/#/entity/models-category%2Fpb) | `core/reusable/categories` | `tier1` → `#/physicsBased` |
| `models-category/pb/qm` | `…/pb` | `tier2` → `#/quantumMechanical` |
| `models-category/pb/qm/dft` | `…/qm` | `tier3` |
| `models-category/pb/qm/dft/ksdft` | `…/dft` | `type` |
| `models-category/pb/qm/dft/ksdft/gga` | `…/ksdft` | `subtype` |

Depth in the tree therefore tracks depth in the tier scheme, and a leaf schema like
`…/ksdft/gga` transitively constrains all five fields. Sixty-six of the 73 vocabulary schemas
narrow exactly one field; the other seven pin `type` and `subtype` together as a leaf shortcut.

The `$ref`-with-a-fragment into `enum_options.json` is how enumerations are shared without
duplication — 144 references in the corpus carry a JSON pointer, and this is the dominant reason.

### Where the tiers actually land

The vocabulary constrains; it does not enumerate instances. The tiers reach real data through just
two entity components, listed in the table above: `model/model-without-method` and
`method/unit-method` each carry a `categories` object. Everything else in the tier tree exists to
say which combinations are legal.

## Scheme 2 — M-CODE, for materials

Nothing under `materials_category/` extends `core/reusable/categories`. Materials are not placed on
a tier ladder; a material category is **a recipe**. The scheme is
[M-CODE](https://arxiv.org/abs/2602.14384) — *Materials Categorization via Ontology, Dimensionality
and Evolution* (Biryukov, Choudhary, Bazhirov) — and its three axes are not merely *related* to the
`materials_category` tree: they **are** its directory structure.

| M-CODE axis | Where it lives | Values |
| --- | --- | --- |
| Structural complexity (ontology) | first path segment | `pristine_structures`, `compound_pristine_structures`, `defective_structures`, `processed_structures` |
| Dimensionality | second path segment | `zero-dimensional` through `three-dimensional` |
| Evolution | the operation reached through `allOf` | combinations `stack`, `merge`; modifications `repeat`, `strain`, `perturb` |

The third axis draws on `materials_category_components/`, which holds both the *entities* the
recipes are built from (`crystal`, `vacuum`, `atom`, `vacancy`, `void_region`, atomic layers…) and
the *operations* that combine them. The component entities carry the dimensionality axis too.

A category schema names an operation via `allOf` and lists its operands under `stack_components` or
`merge_components`. [`materials-category/pristine-structures/two-dimensional/slab`](../map/#/entity/materials-category%2Fpristine-structures%2Ftwo-dimensional%2Fslab)
reads, in full, as *a stack of [repeated unique atomic layers, vacuum]*:

```json
{
    "allOf": [{ "$ref": ".../operations/core/combinations/stack.json" }],
    "properties": {
        "stack_components": {
            "items": [
                { "$ref": ".../entities/reusable/two-dimensional/atomic_layers_unique_repeated.json" },
                { "$ref": ".../entities/core/two-dimensional/vacuum.json" }
            ]
        }
    }
}
```

Categories then compose on top of categories. An *island* defect is a stack of
*[slab, merge(slab, void_region), vacuum]* — a recipe whose ingredients include another recipe. This
is why the components layer is larger than the category layer it serves: a small set of entities and
six operations generates the structure space, and adding a structure type usually means writing a
new recipe rather than a new vocabulary.

The trade-off is deliberate. Tiers are good for *retrieval* — filter on `tier2 = qm` and you get
every quantum-mechanical model. Recipes are good for *construction* — the schema for a slab is
also, quite literally, the instructions for building one.

## Category versus directory

Underneath both schemes sits the distinction that names roughly half the directories in `schema/`:

- **`*_category`** schemas define the **vocabulary or the recipe** — what is allowed, or what a
  structure is made of. They constrain; they do not enumerate instances.
- **`*_directory`** schemas are the **catalogue** — the concrete, individually described entries.
  `models_directory/gw`, `properties_directory/scalar/total_energy`,
  `software_directory/modeling/espresso`.
- **`materials_category_components`** is the parts bin that scheme 2 draws from.

Two roughly equal-sized layers result:

<!-- generated:layer-inventory -->

## Worked example: finding an exchange-correlation functional

Suppose you want the PBE functional and you do not know where it lives.

1. **Start at the tier vocabulary.** A DFT functional is physics-based, so `tier1` is `pb`. The
   allowed values are in `models_category/enum_options.json`, referenced by
   [`models-category/pb`](../map/#/entity/models-category%2Fpb).
2. **Narrow through the tiers.** `tier2` is `qm`, `tier3` is `dft`, `type` is `ksdft`, and GGA is
   the `subtype` — which is exactly the path `models_category/pb/qm/dft/ksdft/gga.json`.
3. **Cross to the catalogue.** The concrete entries live under `models_directory/`. The functional
   itself is a `model/mixins/functional` concern composed into the model schema.
4. **Check the manifest.** `manifest/functional_lookup_table.yaml` and
   `manifest/dft_unit_functionals.yaml` are the registries for functionals, as
   `manifest/properties.yaml` is for properties.

The general shape of the answer: **categories tell you the coordinates, directories hold the
thing**. If you are looking for "what values are allowed", read a `*_category` schema. If you are
looking for "the actual entry for X", read a `*_directory` one.

## The manifests

`manifest/*.yaml` sits outside `schema/` because it is a registry rather than a format:

- **`properties.yaml`** — every property, its `schemaId`, default units, and `isResult` /
  `isMonitor` flags. This is what the platform reads to know which properties are computed results
  and which are progress monitors.
- **`models.yaml`**, **`functional_lookup_table.yaml`**, **`dft_unit_functionals.yaml`** — the
  equivalent registries for models and functionals.

The manifests are joined to the schemas by `schemaId`, and that join is checked: a manifest entry
naming a schema that does not exist fails the build. It used to be possible for the two to drift
apart silently.

## Why keep the tiers in the data?

The tier vocabulary is mirrored in the directory tree, so it is fair to ask why the tiers are also
carried as fields. Because the tree can express only one hierarchy, and it can express it only for
schemas. The `categories` object travels with an *instance*: a stored model record can be filtered
on any tier, surfaced under more than one route, and re-categorized without moving a file and
breaking every `$id` that points at it.

Materials pay a different price for a different benefit. Their recipes are precise enough to build
from, but there is no `categories` field on a material configuration to filter on, so retrieval
across the materials space works by structure class and dimensionality — the path — rather than by
query.

That asymmetry is deliberate. It is not the older scheme waiting to be extended to materials: the
two schemes were designed separately, by different papers, for domains whose questions differ —
the retrieval-versus-construction trade-off above. Encoding a recipe as five tier slugs would
flatten out exactly the part that makes it useful.
