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
