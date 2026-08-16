# Review: Entity Map & Concept Docs plan

> **Reviewed document:** `ENTITY_MAP_AND_DOCS_PLAN.md` at commit `ba30397` (since split into
> `plan/upcoming/` per this review).
> **Reviewer:** Timur Bazhirov — *persona review drafted by the coding agent at Timur's request,
> written from his perspective. Treat decisions below as provisional until confirmed by Timur
> directly; they are recorded as decisions so the split plan documents have one consistent basis.*
> **Created:** 2026-08-16 · **Updated:** 2026-08-16

## Verdict

Direction approved. The shared graph foundation is the right call — it is the data-centric way to
do this: extract the relationships once, as data with a schema, and let both the map and the docs
consume them. Two structural problems to fix before building, and a set of decisions made below so
implementation does not stall on "open questions".

Structural fixes:

1. **The plan itself violates our conventions.** A root-level `ENTITY_MAP_AND_DOCS_PLAN.md` is
   exactly what AGENTS.md HARD RULE 2 and section 6 exist to prevent — the repository top level
   stays clean, and plans live in `plan/` filed by status, dated, lowercase. Split it: one
   overview plus one document per workstream in `plan/upcoming/`, measurements into
   `plan/context/`. (Done as part of this restructure.)
2. **One plan document per deliverable PR.** The monolith mixes four separately shippable things
   (graph foundation, map, docs, site integration). Each needs its own document so it can move
   `upcoming/ → review/ → implemented/` independently — the folder a document sits in is the claim
   being made about it, and a monolith can never make four claims at once.

## Decisions on the plan's open questions (§8 of the reviewed doc)

1. **Docs directory: do not create `docs_src/`.** The plan treats `docs/` being the Pages staging
   directory as a constraint. It is not — the Pages deploy publishes to the `gh-pages` branch via
   `peaceiris/actions-gh-pages`, and the staging directory name is an incidental choice in one
   workflow file. Rename the CI staging output to `site/` (gitignored), and let `docs/` hold the
   actual documentation sources. Naming should say what a thing is; a folder named `docs` that
   must not contain docs is a bug in naming, and `docs_src` is a workaround for it.
2. **Docs tooling: option (a), the minimal `marked`-based build.** No static site generator. This
   repo deliberately has a zero-framework web surface; ten pages do not justify a toolchain.
   Revisit only if the docs outgrow ~15 pages or need versioned releases.
3. **CDN vs vendored: stay with CDN** (Monaco set the precedent), with two hard requirements: pin
   exact versions and add [subresource integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
   hashes to every CDN `<script>`/`<link>` — the explorer's existing Monaco tags should get the
   same treatment while we are in there. Revisit vendoring once, for all libraries together, if an
   air-gapped mirror of the site is ever needed.
4. **Naming: "Entity Map".** Not "Atlas". Descriptive names outlive clever ones, and
   `schemas.mat3ra.com/map` explains itself. No new brand surface to maintain.
5. **Examples are not map nodes.** Confirmed. But the example *coverage gap* must become visible:
   209 of 564 schemas (37%) have examples. Surface per-node `hasExample` in the map panel and add
   a coverage report to the graph lint output (warning, not failure). What gets measured gets
   fixed.
6. **`graph.json` stays site-only for now.** Do not add it to the npm/PyPI payloads until a
   downstream consumer exists — but keep the emitter free of site-specific assumptions so
   packaging it later is a packaging change, not a refactor.
7. **Landing page with the three-surface header: approved.** Docs · Explorer · Map.

## Change requests (address in the split documents before building)

- **(a) Ship the graph lint first, and wire it into the test job, not only the deploy job.** An
  unresolvable `$ref` should fail a pull request, not a deploy after merge. Phase 0 is a
  self-contained PR with standalone value regardless of when the map or docs land; there is no
  reason for it to wait on either.
- **(b) The map must teach the layering, not just the directory tree.** Coloring by top-level
  directory makes the map a prettier `ls -R`. The intellectual core of ESSE is the build-up —
  primitive → abstract → reusable → entities — plus the category/directory split from CateCom.
  Default placement should express architecture: core layers central, entities around them,
  category/directory taxonomies peripheral. Concretely: make layer drive the layout's coarse
  structure (e.g., concentric placement hints or per-layer gravity wells) and domain drive local
  clustering and color. Prototype in the polish phase with plain force layout as fallback — but
  design the encoding for it from the start.
- **(c) The layer classification must not leave 123 nodes in `other`.** The measured taxonomy
  (context doc) shows `other` would be the third-largest layer — that means the classification is
  incomplete, not that the schemas are unclassifiable. Sub-schemas of root entities
  (`workflow/unit/*`, `material/*`, `model/mixins/*`, …) are **entity components**; classify them
  as such, keyed off the owning entity. `apse`, `compute`, `context_providers_directory` get
  explicit assignments. The extractor spec must enumerate the rules and the lint must fail on an
  unclassified path, so the taxonomy stays total as directories are added.
- **(d) Represent the manifest registries.** `manifest/properties.yaml` carries `isResult` /
  `isMonitor` flags and default units — that is entity metadata and belongs on the map (badges on
  property nodes) and in the graph lint (manifest entries whose `schemaId` does not resolve to a
  schema are today silently broken). Small extractor addition, disproportionate value.
- **(e) Docs: write the "why" core first.** Pages 1 (why ESSE), 3 (layering), 4 (entity anatomy),
  and 6 (categorization) are the ones only we can write and the ones every onboarding needs; they
  ship as the first docs PR. Pages 2, 5, 7–10 follow. Add two topics the outline missed: the
  dual-runtime equivalence contract (what is and is not guaranteed identical between the PY and JS
  artifacts — the README hints at drift; the docs must state the contract) and the material
  variant family (`material` vs `material_hashed` vs `material_enhanced*` — why each exists).
- **(f) Deep links are a public contract.** `#/entity/<$id>` will be linked from docs pages, PRs,
  and eventually the platform. Document the URL scheme in the integration doc as a stability
  commitment, with the dash/underscore mapping handled by one shared helper (HARD RULE on naming:
  the helper is `schemaIdToPublishedPath` / `publishedPathToSchemaId`, not `id2path`).
- **(g) Timebox the map polish phase.** Semantic zoom, baked layouts, and minimaps are where
  projects go to gold-plate. Polish gets one timeboxed pass after the MVP ships publicly, driven
  by actual usage friction, not by the spec.

## Non-blocking notes

- Phase ordering overall: 0 (foundation) → 1 (map MVP) → 2 (core docs) → 3 (map polish, timeboxed)
  → 4 (remaining docs) → 5 (integration/release). Map MVP before docs: it is the demo that makes
  the docs legible, and the docs will link into it.
- Estimates are plausible. Keep each phase a single PR where possible.
- Mobile: pinch-zoom and pan must work (it is a map); anything beyond graceful degradation is out
  of scope now.
- Tickets: file one epic for the initiative and one ticket per `upcoming/` document (SOF project),
  then link them from the document headers per the plan-folder convention. Filing is on me
  [Timur] or whoever picks this up in Jira; the documents carry placeholders until then.
- The `BUILD_DOCS=true` path in `build_schemas.py` writes `docs/py/**` output that nothing in CI
  invokes — vestigial. The integration doc should schedule its removal rather than migrate it to
  the new layout.

## What good looks like

A new contributor opens the map, sees the core at the center and the entities built out of it,
clicks `material`, reads what it extends and contains, follows one link into the concept docs to
understand *why* it is layered that way, and one link into the explorer to see the JSON. Three
surfaces, one graph, no drift.
