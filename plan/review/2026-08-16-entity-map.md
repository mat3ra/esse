# Entity Map (Phases 1 and 3)

> **Status:** review — built on `feature/SOF-8027`, waiting on CI and merge.
> **Created:** 2026-08-16 · **Updated:** 2026-08-16
> **Ticket:** [SOF-8027](https://mat3ra.atlassian.net/browse/SOF-8027)
> (epic: [SOF-8025](https://mat3ra.atlassian.net/browse/SOF-8025)).
> **Parent:** [`../upcoming/2026-08-16-entity-map-and-docs-overview.md`](../upcoming/2026-08-16-entity-map-and-docs-overview.md)
> **Depends on:** [`../review/2026-08-16-entity-graph-foundation.md`](../review/2026-08-16-entity-graph-foundation.md)

## Status

**What shipped.** `src/html/map/{index.html,map.js,style.css}`, published at
`schemas.mat3ra.com/map/`, plus `src/js/scripts/entityGraphLayout.ts` which bakes coordinates
into `graph.json` at build time. Both the MVP and the polish scope landed in one PR.

**Divergences from the plan below.**

- **No force layout, and no Cytoscape layout extensions.** The plan specified `fcose` client-side
  for the MVP, then baking it later. Force layout places schemas by reference density, which
  reproduces the directory tree — the very thing review decision 10 rejected. Instead the layout
  is a deterministic layered-radial arrangement computed at build time: primitives at the centre,
  root entities in a ring around them, catalogues on the rim. It reads outward as the build-up
  the concept docs describe. This is strictly better against the plan's own goal and removes
  three CDN dependencies (`fcose`, `cose-base`, `layout-base`) — Cytoscape renders with
  `preset` positions and lays nothing out.
- **Layout stability comes free.** Because placement is a pure function of the graph, unchanged
  schemas keep their coordinates between releases with no warm-start machinery.
- **No isolated-node "islands" strip.** That was a workaround for force layout scattering
  disconnected nodes; a deterministic layout places them in their own layer band correctly, so
  the strip has nothing to fix.
- **Label size varies by zoom tier.** Cytoscape scales text with zoom, so a fixed font size
  disappears entirely once the whole map fits on screen — the "landmarks" tier would have been
  unreachable. Each tier now uses a font size that lands at roughly the same pixel height.
- **`window.esseEntityMap` is exposed** as a deliberate debug handle for a page whose purpose is
  poking at the schema graph.
- **Deferred:** the in-degree heat overlay. It duplicates what node size already encodes; not
  worth the extra control. Not filed as a follow-up.

**Still open.** Nothing blocking. Verified in a real browser (Playwright): whole-map render,
search + fly-to, detail panel and its four link targets, relationship navigation, `#/entity/…`
deep link in a fresh tab, focus mode, semantic-zoom tiers and edge toggles, with zero console
errors.

---

An interactive map of the whole schema corpus at `schemas.mat3ra.com/map/` — every schema a
place, every reference a road. Pan, zoom, search, fly to an entity, inspect it, follow its
relationships, share the view as a URL. Feature name: **Entity Map** (review decision 4).

Ships in two PRs: **MVP** (Phase 1) makes the graph explorable; **polish** (Phase 3, timeboxed —
review decision g) makes it feel like a map.

## 1. What the map must teach (review decision 10)

Coloring by directory alone would make this a prettier `ls -R`. The map's job is to make ESSE's
architecture visible at a glance:

- **The layered build-up** — primitives → abstract → reusable → entities — reads as geography:
  core layers occupy the center, root entities and their components surround them, and the
  category/directory taxonomies form the periphery. Implemented as per-layer placement hints
  (concentric bias or per-layer gravity wells) feeding the layout; plain force layout is the
  committed fallback if the biased layout fights readability (prototype in Phase 3, but the
  visual encoding below is designed for it from day one).
- **The three relationship kinds** as distinct road types: *extends* (allOf), *contains*
  (properties/items), *variant* (oneOf/anyOf).
- **Hubness**: `definitions/units`, `core/primitive/scalar`, `core/reusable/energy` should look
  like the capitals they are.

## 2. Visual encoding

| Channel | Encodes | Spec |
| --- | --- | --- |
| Node color | Domain family | ~8 hue families grouping the 22 top-level directories plus root-level entities: core+definitions; material\*; model\*+method\*; properties; workflow+job; software+apse; system+in_memory_entity; root entities. Exact palette chosen against both light and dark backgrounds at implementation time |
| Node shape / border | Layer | e.g. circles for core layers, rounded squares for entities, diamonds for entity-components, hexagons for category/directory; border weight distinguishes taxonomy vs catalog |
| Node size | In-degree | sqrt scale, clamped; hubs visibly larger |
| Node badge | Manifest flags | small glyphs on property nodes: `isResult`, `isMonitor` (from the graph's `manifest` field) |
| Edge style | Kind | solid = extends, dashed = contains, dotted = variant; arrowhead points at the referenced schema |
| Edge visibility | Zoom + interaction | faded by default at far zoom; full opacity for hovered/selected node's edges |

A persistent legend (collapsible) explains all encodings — the legend is itself part of teaching
the architecture.

## 3. Interaction spec

### MVP (Phase 1)

| Interaction | Behavior |
| --- | --- |
| Pan / zoom | Drag + wheel/trackpad; pinch on touch (it is a map — mobile pan/pinch must work; anything further is out of scope) |
| Hover | Highlight node + its edges and direct neighbors; tooltip with `id` and title |
| Click | Open the detail panel (§4); select-highlight persists |
| Search | Input with fuzzy match over `id`, `title`, `description`; Enter or click **flies to** the node (animated pan+zoom) and opens its panel |
| Edge-kind toggles | Show/hide extends / contains / variant independently |
| Isolated nodes | Parked in a labeled "islands" strip at the map edge, not scattered by the layout |
| Permalinks | `#/entity/<id>` (fly to + open panel on load); `#/view/<x>,<y>,<zoom>` for a viewport. **This URL scheme is a public stability contract** (review decision 12) — documented in the integration doc, versioned additively only |
| Reset | "Whole map" button returning to the home viewport |

### Polish (Phase 3 — timeboxed)

| Interaction | Behavior |
| --- | --- |
| Semantic zoom | L0: domain regions + counts, only hub labels. L1: sub-clusters labeled. L2: all labels. Thresholds tuned by hand; label density is the main dial |
| Focus / ego mode | Double-click isolates the N-hop neighborhood (default 2), rest dimmed; breadcrumb to exit |
| Minimap | Overview inset with viewport rectangle |
| Domain filter | Multi-select to dim/hide domains |
| Layer-aware placement | The concentric/gravity layout of §1, behind a build flag until it beats force layout on the review checklist |
| Heat overlay | Optional in-degree heat mode |

## 4. Detail panel

Right-hand panel, mirroring the explorer's visual language:

1. Title, `$id`, description; badges for layer, domain, manifest flags.
2. **Relationships**, grouped and clickable (each row flies to that node):
   *extends* (outgoing `extends`), *contains* (with property-name labels), *variants*,
   and the reverse direction — *used by* (incoming, grouped by kind).
3. Links: open in Explorer (`../#schema/<published path>`), source on GitHub (`schema/<path>` at
   `dev`), raw resolved JSON, example (when `hasExample`).
4. Lazy-loads the resolved schema JSON for an inline collapsed preview (the already-published
   per-schema files; no new endpoints).

All id↔path conversions go through the shared `schemaIdToPublishedPath` /
`publishedPathToSchemaId` helper from Phase 0 — never reimplemented locally.

## 5. Technology

**Cytoscape.js** (canvas renderer) with the `fcose` layout extension.

- Fits the scale with 3× headroom: ~1.5k rendered elements now, comfortable to ~5k; `graph.json`
  is renderer-agnostic, so a future Sigma.js/WebGL swap touches only the view layer.
- Graph-native selectors/events cover hover/select/ego interactions without custom hit-testing;
  compound nodes support the Phase 3 domain regions.
- No framework, no bundler — one `map.js` in the repo's established vanilla-JS style.
- Loaded from CDN like Monaco, **pinned version + subresource integrity hash** (review decision 3;
  the explorer's Monaco tags get SRI in the same PR).

**Layout strategy.** MVP: client-side `fcose` with a fixed seed (deterministic per dataset;
~1–2 s at this size, behind a "laying out…" splash). Polish: layout runs at build time
(headless — `fcose` in headless Cytoscape, or graphology's ForceAtlas2; pick whichever proves
stable in Node), bakes `x`/`y` into `graph.json`, warm-starting from the previous release's
coordinates so unchanged schemas keep their positions — spatial memory across releases, instant
load, zero layout jank.

## 6. Page architecture

```
src/html/map/index.html     # published at /map/
src/html/map/map.js         # state, routing, cytoscape wiring — same conventions as ../app.js
src/html/map/style.css      # shares tokens/design language with the explorer stylesheet
```

Data loading: `fetch("../graph.json")` (one asset), then per-schema JSON lazily for the panel.
No state libraries; URL hash is the single source of truth for selection/viewport, mirroring the
explorer's deep-link approach.

## 7. Performance and accessibility budgets

- First contentful render < 1 s on a mid laptop (MVP allows +2 s one-time layout; polish removes
  it). Interaction at 60 fps for pan/zoom with edges faded at far zoom.
- Keyboard: search reachable via `/`, results navigable by arrows, Escape closes panel; focus
  states visible. Panel content is plain DOM (screen-reader accessible even though the canvas is
  not) — the panel is the accessible representation of the selection.
- `prefers-reduced-motion`: fly-to becomes a jump cut.

## 8. Acceptance criteria

**MVP:** a user can find any schema in under 10 seconds via search; answer "what uses X / what
does X use" from the panel; share a `#/entity/<id>` link that restores the view; toggle edge
kinds; use it on a phone (pan/pinch). Explorer↔map links work in both directions.

**Polish (exit criteria for the timebox):** instant load with baked layout; two consecutive
deploys from identical schema sources produce identical coordinates; zooming out reads as domain
regions (L0) without labels colliding; ego mode isolates `material` cleanly. Anything unfinished
when the timebox ends is filed as `upcoming/` follow-ups, not extended silently.

## 9. Out of scope

Examples as nodes (panel-only — review decision 5), any server/backend, WebGL migration,
authenticated features, editing. Versioned historical maps (map-per-release) — revisit only if
requested after launch.
