---
title: Categorization
order: 4
summary: CateCom tiers, and the category-versus-directory split that names half the repository.
---

# Categorization

There are thousands of computational models and methods, related to each other in more than one
way. A strict tree cannot hold them: an exchange-correlation functional is simultaneously "a DFT
thing", "a GGA thing" and "a Perdew-Burke-Ernzerhof thing", and different users arrive from
different directions. A flat list cannot hold them either.

The approach ESSE takes comes from the
[CateCom paper](https://pubs.acs.org/doi/abs/10.1021/acs.jcim.2c00112): categorize along a small
number of ordered tiers, and keep the vocabulary separate from the instances.

## The tier scheme

`core/reusable/categories` is the shape every categorized entity uses:

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

Categories are a *path*, not a tree node. Nothing forces `tier2` values to be unique across
`tier1`s, and nothing prevents an entity from being reachable by more than one route. The tiers
narrow the search; they do not impose a single taxonomy.

## Category versus directory

This is the distinction that names roughly half the directories in `schema/`, and once you see it
the layout stops looking arbitrary:

- **`*_category`** schemas define the **vocabulary** — which tier values exist and how they nest.
  `models_category/pb`, `methods_category/physical/qm/wf`, `materials_category/pristine_structures`.
  These constrain; they do not enumerate instances.
- **`*_directory`** schemas are the **catalogue** — the concrete, individually described entries.
  `models_directory/gw`, `methods_directory/physical/…`, `properties_directory/scalar/total_energy`,
  `software_directory/modeling/espresso`.
- **`materials_category_components`** is a third thing: the building blocks that material
  categories are assembled from — entities like `crystal` or `slab`, and the operations that
  transform them.

Two roughly equal-sized layers result:

<!-- generated:layer-inventory -->

A category schema typically composes the reusable categories block and then narrows one tier to an
enumeration. `models-category/pb` is the pattern in miniature: it `allOf`s
`core/reusable/categories`, then restricts `tier1` to the physics-based options defined in a
neighbouring `enum_options.json`. That last part — a `$ref` with a JSON-pointer fragment into
another document — is how enumerations are shared without duplication, and 144 references in the
corpus use it.

## Worked example: finding an exchange-correlation functional

Suppose you want the PBE functional and you do not know where it lives.

1. **Start at the tier vocabulary.** A DFT functional is physics-based, so `tier1` is `pb`. The
   allowed values are in `models_category/enum_options.json`, referenced by
   [`models-category/pb`](../map/#/entity/models-category%2Fpb).
2. **Narrow through the tiers.** `tier2` is `qm` (quantum mechanical), `tier3` is `dft`. The
   `methods_category/physical/qm/wf` subtree carries the corresponding method vocabulary.
3. **Cross to the catalogue.** The concrete entries live under `models_directory/`. The functional
   itself is a `model/mixins/functional` concern composed into the model schema.
4. **Check the manifest.** For properties, `manifest/properties.yaml` is the index that maps a
   name to its schema id and default units. There is an equivalent
   `manifest/functional_lookup_table.yaml` and `manifest/dft_unit_functionals.yaml` for
   functionals.

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

## Why not just use directories?

The directory tree already encodes something — that is why `properties_directory/scalar/…` reads
naturally. But a filesystem gives you exactly one hierarchy, and the whole point of the tier scheme
is that one hierarchy is not enough. The tiers live *in the data* so an entity can be found by more
than one route, filtered on any tier, and re-categorized without moving files and breaking every
`$id` that points at them.
