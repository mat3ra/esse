/* global cytoscape */
/* eslint-disable no-use-before-define */

// ── Encoding ──────────────────────────────────────────────────────────────────
// Colour groups the 22 source directories into eight families. Twenty-two hues
// would be indistinguishable; these eight are the divisions a reader actually
// navigates by.
const FAMILIES = [
    { key: "entities", label: "Root entities", color: "#e6b422", domains: ["(root)"] },
    {
        key: "core",
        label: "Core & definitions",
        color: "#9cdcfe",
        domains: ["core", "definitions"],
    },
    {
        key: "materials",
        label: "Materials",
        color: "#4ec9b0",
        domains: ["material", "materials_category", "materials_category_components"],
    },
    {
        key: "models",
        label: "Models & methods",
        color: "#c586c0",
        domains: [
            "model",
            "models_category",
            "models_directory",
            "method",
            "methods_category",
            "methods_directory",
        ],
    },
    {
        key: "properties",
        label: "Properties",
        color: "#ce9178",
        domains: ["property", "properties_directory"],
    },
    {
        key: "workflow",
        label: "Workflow, jobs & compute",
        color: "#569cd6",
        domains: ["workflow", "job", "compute"],
    },
    {
        key: "software",
        label: "Software & parsing",
        color: "#d7ba7d",
        domains: ["software", "software_directory", "apse", "context_providers_directory"],
    },
    {
        key: "platform",
        label: "Platform mixins",
        color: "#9a9a9a",
        domains: ["system", "in_memory_entity"],
    },
];

const FAMILY_BY_DOMAIN = {};
FAMILIES.forEach((family) => {
    family.domains.forEach((domain) => {
        FAMILY_BY_DOMAIN[domain] = family;
    });
});

// Shape says which layer a schema belongs to. Five groups, not twelve: enough to
// tell a root entity from a catalogue entry at a glance without becoming noise.
const SHAPE_GROUPS = [
    { key: "entity", label: "Root entity", shape: "hexagon", layers: ["entity"] },
    { key: "component", label: "Entity component", shape: "diamond", layers: ["entity-component"] },
    {
        key: "core",
        label: "Core building block",
        shape: "ellipse",
        layers: ["primitive", "abstract", "reusable", "reference", "definition"],
    },
    {
        key: "mixin",
        label: "Behavioural mixin",
        shape: "round-tag",
        layers: ["system", "in-memory-entity"],
    },
    // Vocabulary and catalogue are opposites -- one says what is allowed, the other lists
    // what exists -- so they get their own shapes rather than the single "taxonomy" glyph
    // that used to cover 325 nodes.
    { key: "category", label: "Vocabulary (category)", shape: "triangle", layers: ["category"] },
    {
        key: "directory",
        label: "Catalogue (directory)",
        shape: "round-rectangle",
        layers: ["directory"],
    },
    {
        key: "parsing",
        label: "Application format",
        shape: "rhomboid",
        layers: ["application-parsing"],
    },
];

const SHAPE_BY_LAYER = {};
SHAPE_GROUPS.forEach((group) => {
    group.layers.forEach((layer) => {
        SHAPE_BY_LAYER[layer] = group;
    });
});

const EDGE_COLORS = { extends: "#8a8a8a", contains: "#6b6b6b", variant: "#6b6b6b" };
const GITHUB_BLOB = "https://github.com/mat3ra/esse/blob/dev/";
const FOCUS_HOPS = 2;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const animationDuration = reducedMotion ? 0 : 420;

// ── State ─────────────────────────────────────────────────────────────────────
let cy = null;
let graph = null;
const nodeById = new Map();
let labelTier = null;
let focusedId = null;
let searchHits = [];
let activeHit = -1;
let suppressHashHandling = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function familyFor(domain) {
    return FAMILY_BY_DOMAIN[domain] || FAMILIES[FAMILIES.length - 1];
}

/** Node radius grows with in-degree so the schemas everything depends on read as hubs. */
function nodeSize(node) {
    const base = node.layer === "entity" ? 26 : 13;
    return Math.min(58, base + Math.sqrt(node.inDegree) * 6.5);
}

function exampleHref(node) {
    return node.hasExample ? `../${node.publishedPath.replace(/^schema\//, "example/")}` : null;
}

// ── Build Cytoscape elements ──────────────────────────────────────────────────
function toElements(data) {
    const nodes = data.nodes.map((node) => ({
        group: "nodes",
        data: {
            id: node.id,
            label: node.id.split("/").pop(),
            family: familyFor(node.domain).key,
            color: familyFor(node.domain).color,
            shape: (SHAPE_BY_LAYER[node.layer] || SHAPE_GROUPS[2]).shape,
            group: (SHAPE_BY_LAYER[node.layer] || SHAPE_GROUPS[2]).key,
            size: nodeSize(node),
            inDegree: node.inDegree,
        },
        position: { x: node.x, y: node.y },
    }));

    const edges = data.edges.map((edge, index) => ({
        group: "edges",
        data: {
            id: `e${index}`,
            source: edge.source,
            target: edge.target,
            kind: edge.kind,
            color: EDGE_COLORS[edge.kind],
        },
        classes: edge.kind,
    }));

    return [...nodes, ...edges];
}

const CY_STYLE = [
    {
        selector: "node",
        style: {
            "background-color": "data(color)",
            shape: "data(shape)",
            width: "data(size)",
            height: "data(size)",
            "border-width": 0,
            label: "",
            color: "#d4d4d4",
            "font-size": 11,
            "text-valign": "bottom",
            "text-margin-y": 3,
            "text-outline-color": "#1e1e1e",
            "text-outline-width": 2.5,
            "min-zoomed-font-size": 6,
        },
    },
    { selector: "node.labelled", style: { label: "data(label)" } },
    // Cytoscape scales text with zoom, so a fixed font size vanishes once the whole map
    // fits on screen. Each tier gets a size that lands at roughly the same pixel height,
    // keeping the few labels shown at far zoom readable.
    { selector: "node.tier-landmarks", style: { "font-size": 30, "text-outline-width": 5 } },
    { selector: "node.tier-hubs", style: { "font-size": 16, "text-outline-width": 3 } },
    {
        selector: "edge",
        style: {
            width: 1,
            "line-color": "data(color)",
            "curve-style": "straight",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "data(color)",
            "arrow-scale": 0.55,
            opacity: 0.18,
        },
    },
    { selector: "edge.contains", style: { "line-style": "dashed" } },
    { selector: "edge.variant", style: { "line-style": "dotted" } },
    {
        selector: "node:selected",
        style: { "border-width": 3, "border-color": "#ffffff", label: "data(label)" },
    },
    {
        selector: "node.highlighted",
        style: { "border-width": 2, "border-color": "#ffffff", label: "data(label)" },
    },
    { selector: "edge.highlighted", style: { opacity: 0.95, width: 2 } },
    { selector: ".dimmed", style: { opacity: 0.06 } },
    { selector: "node.dimmed", style: { label: "" } },
    { selector: ".hidden", style: { display: "none" } },
];

// ── Semantic zoom ─────────────────────────────────────────────────────────────
// Labelling everything at every zoom is unreadable; labelling nothing makes the
// map useless. Three tiers: landmarks, then hubs, then everything.
function tierFor(zoom) {
    if (zoom < 0.3) return "landmarks";
    if (zoom < 0.75) return "hubs";
    return "all";
}

function applyLabelTier() {
    const tier = tierFor(cy.zoom());
    if (tier === labelTier) return;
    labelTier = tier;

    cy.batch(() => {
        cy.nodes().forEach((element) => {
            const node = nodeById.get(element.id());
            const show =
                tier === "all" ||
                (tier === "hubs" && (node.inDegree >= 3 || node.layer === "entity")) ||
                (tier === "landmarks" && (node.inDegree >= 8 || node.layer === "entity"));
            element.toggleClass("labelled", show);
            element.toggleClass("tier-landmarks", tier === "landmarks");
            element.toggleClass("tier-hubs", tier === "hubs");
        });
    });
}

// ── Highlighting ──────────────────────────────────────────────────────────────
function clearHighlight() {
    cy.elements().removeClass("highlighted");
}

function highlightNeighbourhood(element) {
    clearHighlight();
    const connected = element.connectedEdges();
    element.addClass("highlighted");
    connected.addClass("highlighted");
    connected.connectedNodes().addClass("highlighted");
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function relationRow(id, label) {
    return (
        `<div class="rel" data-goto="${escHtml(id)}" role="button" tabindex="0">` +
        `<span class="rel-id">${escHtml(id)}</span>` +
        (label ? `<span class="rel-label">${escHtml(label)}</span>` : "") +
        `</div>`
    );
}

function relationGroup(heading, rows) {
    if (rows.length === 0) return "";
    return `<div class="detail-group"><h3>${escHtml(heading)} (${rows.length})</h3>${rows.join(
        "",
    )}</div>`;
}

function showDetail(id) {
    const node = nodeById.get(id);
    if (!node) return;

    const outgoing = graph.edges.filter((edge) => edge.source === id);
    const incoming = graph.edges.filter((edge) => edge.target === id);
    const byKind = (list, kind, key) =>
        list.filter((edge) => edge.kind === kind).map((edge) => relationRow(edge[key], edge.label));

    const badges = [
        `<span class="badge">${escHtml(node.layer)}</span>`,
        `<span class="badge">${escHtml(node.domain)}</span>`,
        node.ownerEntity ? `<span class="badge">of ${escHtml(node.ownerEntity)}</span>` : "",
        node.manifest && node.manifest.isResult ? '<span class="badge result">result</span>' : "",
        node.manifest && node.manifest.isMonitor
            ? '<span class="badge monitor">monitor</span>'
            : "",
        node.manifest && node.manifest.defaultUnits
            ? `<span class="badge units">${escHtml(node.manifest.defaultUnits)}</span>`
            : "",
    ].join("");

    const example = exampleHref(node);

    document.getElementById("detail-empty").hidden = true;
    const body = document.getElementById("detail-body");
    body.hidden = false;
    body.innerHTML =
        `<div class="detail-title">${escHtml(node.title || node.id)}</div>` +
        `<div class="detail-id">${escHtml(node.id)}</div>` +
        (node.description ? `<p class="detail-description">${escHtml(node.description)}</p>` : "") +
        `<div class="badges">${badges}</div>` +
        facetChips(node) +
        `<div class="detail-stats">` +
        `<div><strong>${node.inDegree}</strong>used by</div>` +
        `<div><strong>${node.outDegree}</strong>references</div>` +
        `<div><strong>${node.propertyCount}</strong>properties</div>` +
        `</div>` +
        relationGroup("Extends", byKind(outgoing, "extends", "target")) +
        relationGroup("Contains", byKind(outgoing, "contains", "target")) +
        relationGroup("Variants", byKind(outgoing, "variant", "target")) +
        relationGroup(
            "Used by",
            incoming.map((edge) => relationRow(edge.source, edge.label)),
        ) +
        `<div class="detail-group"><h3>Open</h3><div class="detail-links">` +
        `<a href="../#${escHtml(node.publishedPath)}">In the schema explorer</a>` +
        `<a href="../${escHtml(node.publishedPath)}">Resolved JSON</a>` +
        (example ? `<a href="${escHtml(example)}">Example</a>` : "") +
        `<a href="${GITHUB_BLOB}${escHtml(
            node.path,
        )}" target="_blank" rel="noopener">Source on GitHub</a>` +
        `</div></div>`;

    body.querySelectorAll("button.facet").forEach((chip) => {
        chip.addEventListener("click", () =>
            isolateFacet(chip.getAttribute("data-axis"), chip.getAttribute("data-value")),
        );
    });

    body.querySelectorAll("[data-goto]").forEach((row) => {
        const target = row.getAttribute("data-goto");
        row.addEventListener("click", () => selectNode(target, true));
        row.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectNode(target, true);
            }
        });
    });

    document.getElementById("status-selection").textContent = node.publishedPath;
}

function clearDetail() {
    document.getElementById("detail-empty").hidden = false;
    document.getElementById("detail-body").hidden = true;
    document.getElementById("status-selection").textContent = "";
}

// ── Selection & navigation ────────────────────────────────────────────────────
function selectNode(id, fly) {
    // A facet is a transient lens: flying outside it would leave the map showing nothing.
    // Family and kind toggles are deliberate settings and are left alone.
    if (activeFacet && !nodeMatchesFacet(id)) clearFacet();

    const element = cy.getElementById(id);
    if (element.empty()) return;

    cy.elements().unselect();
    element.select();
    highlightNeighbourhood(element);
    showDetail(id);
    setHash(`#/entity/${id}`);

    if (fly) {
        cy.animate(
            { center: { eles: element }, zoom: Math.max(cy.zoom(), 1.1) },
            { duration: animationDuration },
        );
    }
}

function resetView() {
    exitFocus();
    cy.elements().unselect();
    clearHighlight();
    clearDetail();
    cy.animate(
        { fit: { eles: cy.elements(":visible"), padding: 40 } },
        { duration: animationDuration },
    );
    setHash("");
}

// ── Focus (ego) mode ──────────────────────────────────────────────────────────
function enterFocus(id) {
    const element = cy.getElementById(id);
    if (element.empty()) return;

    let neighbourhood = element.closedNeighborhood();
    for (let hop = 1; hop < FOCUS_HOPS; hop += 1) {
        neighbourhood = neighbourhood.union(neighbourhood.closedNeighborhood());
    }

    focusedId = id;
    cy.batch(() => {
        cy.elements().addClass("dimmed");
        neighbourhood.removeClass("dimmed");
    });

    document.getElementById("focus-banner").hidden = false;
    document.getElementById("focus-label").textContent = `Focused on ${id} · ${FOCUS_HOPS} hops`;
    cy.animate({ fit: { eles: neighbourhood, padding: 60 } }, { duration: animationDuration });
}

function exitFocus() {
    if (!focusedId) return;
    focusedId = null;
    cy.elements().removeClass("dimmed");
    document.getElementById("focus-banner").hidden = true;
}

// ── Search ────────────────────────────────────────────────────────────────────
function runSearch(query) {
    const results = document.getElementById("search-results");
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
        results.hidden = true;
        document.getElementById("search-input").setAttribute("aria-expanded", "false");
        searchHits = [];
        return;
    }

    // Ids are dashed, but the names people arrive with are underscored: the published
    // path (properties_directory/scalar/total_energy.json), the Explorer's file tree,
    // the manifest key. Searching "total_energy" found nothing before this. No $id
    // contains an underscore, so folding them to dashes only ever widens the match.
    const idQuery = trimmed.replace(/_/g, "-");

    searchHits = graph.nodes
        .map((node) => {
            const id = node.id.toLowerCase();
            const title = (node.title || "").toLowerCase();
            let score = -1;
            if (id === idQuery) score = 0;
            else if (id.split("/").pop().startsWith(idQuery)) score = 1;
            else if (id.includes(idQuery)) score = 2;
            else if (title.includes(trimmed)) score = 3;
            else if ((node.description || "").toLowerCase().includes(trimmed)) score = 4;
            return { node, score };
        })
        .filter((hit) => hit.score >= 0)
        .sort((a, b) => a.score - b.score || b.node.inDegree - a.node.inDegree)
        .slice(0, 12)
        .map((hit) => hit.node);

    activeHit = -1;
    results.hidden = false;
    document.getElementById("search-input").setAttribute("aria-expanded", "true");

    if (searchHits.length === 0) {
        results.innerHTML = '<div class="search-empty">No schema matches.</div>';
        return;
    }

    const mark = (text) => {
        const index = text.toLowerCase().indexOf(trimmed);
        if (index === -1) return escHtml(text);
        return (
            escHtml(text.slice(0, index)) +
            `<mark>${escHtml(text.slice(index, index + trimmed.length))}</mark>` +
            escHtml(text.slice(index + trimmed.length))
        );
    };

    results.innerHTML = searchHits
        .map(
            (node, index) =>
                `<div class="search-hit" role="option" data-index="${index}" data-id="${escHtml(
                    node.id,
                )}"><span class="hit-id">${mark(node.id)}</span>` +
                `<span class="hit-title">${escHtml(node.title || node.layer)}</span></div>`,
        )
        .join("");

    results.querySelectorAll(".search-hit").forEach((hit) => {
        hit.addEventListener("click", () => {
            closeSearch();
            selectNode(hit.getAttribute("data-id"), true);
        });
    });
}

function closeSearch() {
    document.getElementById("search-results").hidden = true;
    document.getElementById("search-input").setAttribute("aria-expanded", "false");
    document.getElementById("search-input").value = "";
    searchHits = [];
    activeHit = -1;
}

function moveActiveHit(delta) {
    if (searchHits.length === 0) return;
    activeHit = (activeHit + delta + searchHits.length) % searchHits.length;
    document.querySelectorAll(".search-hit").forEach((hit, index) => {
        hit.classList.toggle("active", index === activeHit);
        if (index === activeHit) hit.scrollIntoView({ block: "nearest" });
    });
}

// ── Facets ────────────────────────────────────────────────────────────────────
// Chip order, so a coordinate reads as a ladder rather than alphabetically.
const FACET_ORDER = [
    "tier1",
    "tier2",
    "tier3",
    "type",
    "subtype",
    "branch",
    "structuralClass",
    "dimensionality",
    "operation",
    "entityRole",
    "operationKind",
    "catalogue",
    "valueShape",
    "softwareKind",
    "scope",
    "application",
    "legacy",
    "scheme",
    "role",
];

function facetRank(axis) {
    const index = FACET_ORDER.indexOf(axis);
    return index === -1 ? FACET_ORDER.length : index;
}

function facetChips(node) {
    if (!node.facets) return "";

    const chips = Object.entries(node.facets)
        .sort((a, b) => facetRank(a[0]) - facetRank(b[0]) || a[0].localeCompare(b[0]))
        .map(
            ([axis, value]) =>
                `<button type="button" class="badge facet" data-axis="${escHtml(axis)}" ` +
                `data-value="${escHtml(value)}" title="Show only schemas where ${escHtml(
                    axis,
                )} is ${escHtml(value)}">${escHtml(axis)}: ${escHtml(value)}</button>`,
        )
        .join("");

    return (
        `<div class="detail-group"><h3>Facets <span class="legend-hint">click to isolate</span></h3>` +
        `<div class="badges">${chips}</div></div>`
    );
}

function isolateFacet(axis, value) {
    activeFacet = { axis, value };
    applyFilters();

    // Count from the predicate, not from ":visible" -- the class changes applyFilters made
    // inside cy.batch() have not flushed yet, so the rendered state is a frame behind.
    const matching = cy.nodes().filter((node) => nodeMatchesFacet(node.id()));
    document.getElementById("facet-label").textContent = `${axis} = ${value} · ${
        matching.length
    } schema${matching.length === 1 ? "" : "s"}`;
    document.getElementById("facet-banner").hidden = false;
    if (matching.nonempty())
        cy.animate({ fit: { eles: matching, padding: 80 } }, { duration: 260 });
    setHash(`#/facet/${encodeURIComponent(axis)}/${encodeURIComponent(value)}`);
}

function clearFacet() {
    if (!activeFacet) return;
    activeFacet = null;
    document.getElementById("facet-banner").hidden = true;
    applyFilters();
}

// ── Filters ───────────────────────────────────────────────────────────────────
const hiddenKinds = new Set();
const hiddenFamilies = new Set();
const hiddenGroups = new Set();
let activeFacet = null;

function nodeMatchesFacet(id) {
    if (!activeFacet) return true;
    const node = nodeById.get(id);
    return Boolean(node && node.facets && node.facets[activeFacet.axis] === activeFacet.value);
}

function applyFilters() {
    cy.batch(() => {
        cy.edges().forEach((edge) => {
            edge.toggleClass("hidden", hiddenKinds.has(edge.data("kind")));
        });
        cy.nodes().forEach((node) => {
            node.toggleClass(
                "hidden",
                hiddenFamilies.has(node.data("family")) ||
                    hiddenGroups.has(node.data("group")) ||
                    !nodeMatchesFacet(node.id()),
            );
        });
    });
    drawMinimap();
}

// ── Minimap ───────────────────────────────────────────────────────────────────
let minimapBounds = null;
let minimapFrame = null;

function drawMinimap() {
    const canvas = document.getElementById("minimap");
    if (!canvas || !cy) return;
    const context = canvas.getContext("2d");
    const { width, height } = canvas;

    if (!minimapBounds) minimapBounds = cy.elements().boundingBox();
    const box = minimapBounds;
    const scale = Math.min(width / box.w, height / box.h) * 0.92;
    const toCanvasX = (x) => (x - box.x1 - box.w / 2) * scale + width / 2;
    const toCanvasY = (y) => (y - box.y1 - box.h / 2) * scale + height / 2;

    context.clearRect(0, 0, width, height);

    cy.nodes(":visible").forEach((node) => {
        const position = node.position();
        context.fillStyle = node.data("color");
        context.globalAlpha = 0.75;
        context.fillRect(toCanvasX(position.x) - 1, toCanvasY(position.y) - 1, 2, 2);
    });

    const extent = cy.extent();
    context.globalAlpha = 1;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1;
    context.strokeRect(
        toCanvasX(extent.x1),
        toCanvasY(extent.y1),
        (extent.x2 - extent.x1) * scale,
        (extent.y2 - extent.y1) * scale,
    );
}

function scheduleMinimap() {
    if (minimapFrame) return;
    minimapFrame = requestAnimationFrame(() => {
        minimapFrame = null;
        drawMinimap();
    });
}

function minimapJump(event) {
    const canvas = document.getElementById("minimap");
    const rect = canvas.getBoundingClientRect();
    const box = minimapBounds || cy.elements().boundingBox();
    const scale = Math.min(canvas.width / box.w, canvas.height / box.h) * 0.92;

    const graphX = (event.clientX - rect.left - canvas.width / 2) / scale + box.x1 + box.w / 2;
    const graphY = (event.clientY - rect.top - canvas.height / 2) / scale + box.y1 + box.h / 2;

    cy.pan({
        x: cy.width() / 2 - graphX * cy.zoom(),
        y: cy.height() / 2 - graphY * cy.zoom(),
    });
}

// ── Routing ───────────────────────────────────────────────────────────────────
function setHash(hash) {
    suppressHashHandling = true;
    window.history.replaceState(null, "", hash || window.location.pathname);
    window.setTimeout(() => {
        suppressHashHandling = false;
    }, 0);
}

function applyHash() {
    const hash = window.location.hash.slice(1);
    const entityMatch = hash.match(/^\/entity\/(.+)$/);
    if (entityMatch) {
        selectNode(decodeURIComponent(entityMatch[1]), true);
        return;
    }

    const facetMatch = hash.match(/^\/facet\/([A-Za-z0-9]+)\/(.+)$/);
    if (facetMatch) {
        isolateFacet(facetMatch[1], decodeURIComponent(facetMatch[2]));
        return;
    }

    const viewMatch = hash.match(/^\/view\/(-?[\d.]+),(-?[\d.]+),([\d.]+)$/);
    if (viewMatch) {
        const zoom = parseFloat(viewMatch[3]);
        cy.zoom(zoom);
        cy.pan({
            x: cy.width() / 2 - parseFloat(viewMatch[1]) * zoom,
            y: cy.height() / 2 - parseFloat(viewMatch[2]) * zoom,
        });
    }
}

function recordViewport() {
    if (cy.$(":selected").nonempty() || focusedId || activeFacet) return;
    const centre = {
        x: (cy.extent().x1 + cy.extent().x2) / 2,
        y: (cy.extent().y1 + cy.extent().y2) / 2,
    };
    setHash(`#/view/${centre.x.toFixed(1)},${centre.y.toFixed(1)},${cy.zoom().toFixed(3)}`);
}

// ── Legend ────────────────────────────────────────────────────────────────────
function buildLegend() {
    document.getElementById("legend-families").innerHTML = FAMILIES.map(
        (family) =>
            `<div class="legend-row legend-family" data-family="${family.key}" role="button" tabindex="0">` +
            `<span class="legend-swatch" style="background:${family.color}"></span>${escHtml(
                family.label,
            )}</div>`,
    ).join("");

    document.getElementById("legend-shapes").innerHTML = SHAPE_GROUPS.map(
        (group) =>
            `<div class="legend-row legend-toggle legend-group" data-group="${group.key}" ` +
            `role="button" tabindex="0"><span class="legend-shape ${group.key}"></span>${escHtml(
                group.label,
            )}<span class="legend-count">${
                graph.meta.layerCounts
                    ? group.layers.reduce(
                          (total, layer) => total + (graph.meta.layerCounts[layer] || 0),
                          0,
                      )
                    : ""
            }</span></div>`,
    ).join("");

    const wireToggleRow = (row, key, hiddenSet) => {
        const toggle = () => {
            if (hiddenSet.has(key)) hiddenSet.delete(key);
            else hiddenSet.add(key);
            row.classList.toggle("muted", hiddenSet.has(key));
            applyFilters();
        };
        row.addEventListener("click", toggle);
        row.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggle();
            }
        });
    };

    document
        .querySelectorAll(".legend-family")
        .forEach((row) => wireToggleRow(row, row.getAttribute("data-family"), hiddenFamilies));
    document
        .querySelectorAll(".legend-group")
        .forEach((row) => wireToggleRow(row, row.getAttribute("data-group"), hiddenGroups));
}

// ── Init ──────────────────────────────────────────────────────────────────────
fetch("../graph.json")
    .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    })
    .then((data) => {
        graph = data;
        data.nodes.forEach((node) => nodeById.set(node.id, node));

        document.getElementById(
            "titlebar-counts",
        ).textContent = `${data.meta.nodeCount} schemas · ${data.meta.edgeCount} references`;

        cy = cytoscape({
            container: document.getElementById("cy"),
            elements: toElements(data),
            style: CY_STYLE,
            // Coordinates are baked at build time, so nothing needs laying out here:
            // the map opens instantly and a schema keeps its place between releases.
            layout: { name: "preset" },
            wheelSensitivity: 0.25,
            minZoom: 0.08,
            maxZoom: 4,
        });

        // Deliberate debug handle: this page exists for poking at the schema graph, and
        // the console is a reasonable place to keep doing that.
        window.esseEntityMap = { cy, graph, nodeById };

        minimapBounds = cy.elements().boundingBox();
        cy.fit(cy.elements(), 40);
        applyLabelTier();
        buildLegend();
        drawMinimap();

        document.getElementById("map-loading").classList.add("hidden");

        // Interaction ---------------------------------------------------------
        let lastTapId = null;
        let lastTapAt = 0;

        cy.on("tap", "node", (event) => {
            const id = event.target.id();
            const now = Date.now();
            if (id === lastTapId && now - lastTapAt < 350) {
                enterFocus(id);
            } else {
                selectNode(id, false);
            }
            lastTapId = id;
            lastTapAt = now;
        });

        cy.on("tap", (event) => {
            if (event.target === cy) {
                cy.elements().unselect();
                clearHighlight();
                clearDetail();
                exitFocus();
                setHash("");
            }
        });

        cy.on("mouseover", "node", (event) => {
            if (cy.$(":selected").empty()) highlightNeighbourhood(event.target);
        });
        cy.on("mouseout", "node", () => {
            if (cy.$(":selected").empty()) clearHighlight();
        });

        cy.on("zoom", () => {
            applyLabelTier();
            scheduleMinimap();
        });
        cy.on("pan", scheduleMinimap);
        cy.on("viewport", () => {
            window.clearTimeout(recordViewport.timer);
            recordViewport.timer = window.setTimeout(recordViewport, 400);
        });

        applyHash();
    })
    .catch((error) => {
        document.getElementById(
            "map-loading",
        ).innerHTML = `<span style="color:#f88">Could not load the entity graph: ${escHtml(
            error.message,
        )}</span>`;
    });

// ── Chrome wiring ─────────────────────────────────────────────────────────────
const searchInput = document.getElementById("search-input");
let searchTimer = null;

searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => runSearch(searchInput.value), 120);
});

searchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActiveHit(1);
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActiveHit(-1);
    } else if (event.key === "Enter") {
        event.preventDefault();
        const chosen = searchHits[activeHit >= 0 ? activeHit : 0];
        if (chosen) {
            closeSearch();
            selectNode(chosen.id, true);
        }
    } else if (event.key === "Escape") {
        closeSearch();
        searchInput.blur();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== searchInput) {
        event.preventDefault();
        searchInput.focus();
    } else if (event.key === "Escape" && document.activeElement !== searchInput) {
        exitFocus();
        if (cy) {
            cy.elements().unselect();
            clearHighlight();
        }
        clearDetail();
    }
});

document.getElementById("reset-view").addEventListener("click", resetView);
document.getElementById("focus-exit").addEventListener("click", exitFocus);
document.getElementById("facet-clear").addEventListener("click", clearFacet);

document.getElementById("legend-toggle").addEventListener("click", (event) => {
    const body = document.getElementById("legend-body");
    body.hidden = !body.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!body.hidden));
});

document.querySelectorAll("#edge-toggles input").forEach((input) => {
    input.addEventListener("change", () => {
        const kind = input.getAttribute("data-kind");
        if (input.checked) hiddenKinds.delete(kind);
        else hiddenKinds.add(kind);
        applyFilters();
    });
});

document.getElementById("minimap").addEventListener("click", minimapJump);

window.addEventListener("hashchange", () => {
    if (!suppressHashHandling && cy) applyHash();
});

window.addEventListener("resize", scheduleMinimap);
