# Categories in navigation (M-CODE and CateCom made visible)

> **Status:** upcoming — agreed direction, not built.
> **Created:** 2026-08-31 · **Updated:** 2026-08-31
> **Epic:** [SOF-8025](https://mat3ra.atlassian.net/browse/SOF-8025) (follow-on)
> **Basis:** the two categorization schemes documented in
> [`../../docs/04-categorization.md`](../../docs/04-categorization.md), now each
> traceable to a paper.

## The problem

152 of 564 schemas are category schemas — 27% of the corpus — and the ontology map gives
you no way to see them as a kind, let alone navigate them.

Two specific defects:

1. **The map collapses opposites.** `SHAPE_GROUPS` in `src/html/map/map.js` puts
   `category`, `directory` and `application-parsing` in a single shape labelled
   "Category / catalogue" — **325 nodes, 58% of the corpus, drawn identically**. The
   concept docs teach that "categories tell you the coordinates, directories hold the
   thing"; the map contradicts that by rendering the vocabulary and the catalogue the
   same.
2. **The family filter sorts by subject, not by kind.** `materials_category` sits with
   `material/` under "Materials"; `models_category` and `methods_category` sit with the
   directories under "Models & methods". There is no "show me the vocabularies" control.

The data to fix both already exists: `classifyLayer` assigns every node a layer, the lint
guarantees the taxonomy is total, and `layer` ships in `graph.json`. Nothing needs
re-extracting.

## The two schemes, and their papers

Both categorization schemes now have a citation, which is what makes a *structured*
navigation possible rather than a flat "category" toggle.

| Scheme | Applies to | Paper | Structure |
| --- | --- | --- | --- |
| **CateCom** | models, methods | [CateCom](https://pubs.acs.org/doi/abs/10.1021/acs.jcim.2c00112) | a 5-level tier ladder: `tier1` → `tier2` → `tier3` → `type` → `subtype` |
| **M-CODE** | materials | [arXiv:2602.14384](https://arxiv.org/abs/2602.14384) | three orthogonal axes (below) |

**M-CODE** — *Materials Categorization via Ontology, Dimensionality and Evolution*
(Biryukov, Choudhary, Bazhirov). Its three axes are not merely *related* to
`materials_category`; they **are** its directory structure. Verified against the tree:

| M-CODE axis | Where it lives | Values (with schema counts) |
| --- | --- | --- |
| Structural complexity | first path segment | `pristine` (5), `compound-pristine` (1), `defective` (10), `processed` (1) |
| Dimensionality | second path segment | `zero-` (4), `one-` (1), `two-` (10), `three-dimensional` (2) |
| Evolution / transformation | `materials_category_components/operations/` | combinations `stack`, `merge`; modifications `repeat`, `perturb`, `strain` |

The 25 component *entities* carry the dimensionality axis too: `zero-` (5), `one-` (3),
`two-` (9), `three-dimensional` (8).

## Directories: the catalogue layer

The categories are the vocabulary; the `*_directory` schemas are the catalogue — 156 named
instances, 28% of the corpus. They need organizing too, and the organizing principle is
different from the categories', because the structure is different. Verified facts:

**Each directory has one consuming entity.** Cross-domain edges into directories:

| Catalogue | Schemas | Consumed by | Its own facet | Reachable by any edge |
| --- | --- | --- | --- | --- |
| `properties_directory` | 85 | `property` (44 edges — the holder union) | value shape: structural 35 / non-scalar 22 / scalar 17 / elemental 3 / workflow 3 | 77 / 85 |
| `context_providers_directory` | 22 | `workflow` (19) | by application (6) / generic (16) | 21 / 22 |
| `methods_directory` | 24 | `method` (3) | mathematical / physical / legacy | 13 / 24 |
| `models_directory` | 14 | `model` (via manifest; 1 edge) | current 7 / legacy 7 | 6 / 14 |
| `software_directory` | 11 | `job` (1) | modeling 5 / scripting 3 | **1 / 11** |

**Catalogue entries carry their category coordinate.** 18 edges run directory → category,
17 of them through a property literally named `categories`, and zero run the other way.
All 7 current `models_directory` entries (`lda`, `gga`, `mgga`, `hybrid`, `double_hybrid`,
`gw`, `re`) map 1:1 onto a `models_category` subtype leaf; 10 `methods_directory` entries
do the same. Properties, software and context providers are categorized by neither paper
and have no such edge — their own facet *is* their organization.

**Graph edges cannot be the only way in.** 38 of 156 directory entries are referenced by
nothing: `software_directory` is 10/11 unreachable, and every `legacy/` subtree (7 models,
4 methods) is unreachable. A map that only walks edges will never show a user that
`vasp` or `espresso` exist. Catalogues are lists and need a listing view, not a graph walk.

**Models are deeper than the map knows.** `models_directory` (7 subtypes) fronts
`manifest/functional_lookup_table.yaml` — 67 named XC functionals (hybrid 36, gga 15,
lda 9, mgga 7) under exactly those four family names — which in turn decomposes into
`dft_unit_functionals.yaml` (Slater, PW92, …). Only the top level is schema; the two below
are YAML and invisible to `graph.json`. `manifest/models.yaml` is *not* that catalogue: it
is the CateCom ladder restated as a registry (35 slugs, leaves are subtypes).

**"Transformation types" are not a directory.** There is no `transformations_directory`.
The concrete transformations are the five M-CODE *operations* under
`materials_category_components/operations/` — `stack`, `merge`, `repeat`, `perturb`,
`strain`. Structurally they are catalogue entries (named instances, consumed by the
`materials_category` recipes) filed under a components folder. Navigation should treat
them as a catalogue regardless of where they live.

**Three layers, then, not two:**

| Layer | What it is | Organized by |
| --- | --- | --- |
| Vocabulary — `*_category` | what is allowed | its scheme: the CateCom ladder or the M-CODE axes |
| Catalogue — `*_directory` (+ operations) | named instances | its consuming entity, then its own facet |
| Registry — `manifest/*.yaml` | the platform's index over the catalogue | joins by `schemaId`; adds units and `isResult`/`isMonitor` flags; for models, two further levels |

### How to organize them

By consuming entity, then by the catalogue's own facet, with the category coordinate as the
cross-link where one exists:

1. **Catalogue** = the entity it feeds: Properties, Models, Methods, Software, Context
   providers, Operations.
2. **Facet** = that catalogue's own axis: value shape for properties, CateCom subtype for
   models and methods, modeling/scripting for software, application for context providers,
   combination/modification for operations.
3. **Entry**, with registry badges where a manifest exists (units, result/monitor), and for
   models the named functionals beneath.
4. **Cross-links both ways.** An entry with a `categories` edge shows its coordinate and
   flies to it on the map; a category leaf shows "N catalogue entries filed here". This is
   the category → directory drill-down the docs describe in prose but nothing yet lets you
   *do*.

`legacy/` subtrees should be collapsed by default: they are unreferenced by construction and
exist for old records, not for finding things.

## Deliverables

### 1. Docs correction (do first; independent of the map work)

`docs/04-categorization.md` currently describes the materials scheme accurately but
**anonymously**, and closes with:

> Whether that asymmetry is deliberate or simply the older scheme not yet extended to
> materials is a question for the maintainers; the corpus as it stands does not answer it.

That is now answered and the passage is misleading. Name M-CODE, cite it, and state the
three axes. Related follow-ons:

- `docs/01-why-esse-exists.md` §"What the two papers contribute" becomes **three** papers.
- `docs/index.md` says "the two papers behind this repository" — same fix.
- `docs/10-glossary.md` gains an **M-CODE** entry beside the existing CateCom **Tier**
  entry, and the "Composition (materials)" entry should name the scheme.
- `docs/04-categorization.md` §"Category versus directory" should state the mechanism it
  currently only gestures at: catalogue entries embed their coordinate through a
  `categories` property, every current model entry maps 1:1 to a subtype leaf, and the
  model catalogue runs two levels deeper in the manifests than in the schemas.

### 2. Split the shape group

Give `category`, `directory` and `application-parsing` their own shapes and legend rows.
Data-only change to `SHAPE_GROUPS`; makes the map teach the same distinction as the docs.

### 3. A "Kind" filter row

Alongside Families in the legend, add click-to-isolate filters over layer groups —
*Vocabulary* (category), *Catalogue* (directory), *Core*, *Entities*, *Mixins* — reusing
the existing family-filter interaction and `hiddenFamilies`-style state.

### 4. Scheme-aware facets (the substantive one)

With a category subtree isolated, offer the axes that scheme actually uses:

- **Materials** → three M-CODE facets: structural complexity, dimensionality, operation.
- **Models / methods** → the CateCom tier ladder. These form a tree up to 6 levels deep
  (depth histogram: 3 / 14 / 29 / 45 / 13 at depths 2–6), which the radial layout
  currently flattens into a single band, hiding the `pb → qm → dft → ksdft → gga`
  narrowing entirely.

- **Catalogues** → a listing view organized as in "How to organize them" above, entered
  from an entity ("what properties exist?") or from a category leaf ("what is filed
  under `gga`?"). This is what makes the 38 edge-unreachable entries — all of
  `software_directory`, every `legacy/` subtree — findable at all.

Facet values are derivable from the path today. Whether to *derive* them in the extractor
(a `facets` field on the node) or compute them client-side is the main open design
question — deriving them in `buildEntityGraph.ts` is more testable and keeps the map
dumb, at the cost of widening `graph.json`.

## Sequencing

1 is a docs-only change and should land on its own. 2 and 3 are small and can share a PR.
4 is the real work and deserves its own, after 2–3 prove the isolation interaction.

## Open questions

- Should M-CODE facets be derived into `graph.json` or computed in the map? (Leaning
  extractor: testable, and the docs builder could then use the same facets.)
- Does the tier ladder deserve layout treatment (radial sub-ordering by depth) or is
  filtering enough? Layout changes are the expensive kind — defer unless asked.
- `materials_category` is small (17 schemas) and lopsided: 10 of 17 are defective
  structures, and `compound-pristine` and `processed` have one schema each. Worth
  confirming with the maintainers whether that reflects the intended scope or simply what
  has been written so far, since a facet UI over a 1-item axis value looks broken.
- Should the manifests' deeper model catalogue (67 functionals, then unit components) be
  joined into `graph.json` so the catalogue view can show it? The extractor already joins
  `properties.yaml` onto property nodes, so the mechanism is precedented; the question is
  whether functionals should become nodes or stay attributes.
- Are the `legacy/` entries deprecated, or still written by the platform? Collapsed-by-default
  is safe either way; removal is not.
- The operations are catalogue entries living under `materials_category_components`. Naming
  them as a catalogue in the UI is enough for now; whether they deserve an actual
  `operations_directory` is a schema-organization question, out of scope here.
