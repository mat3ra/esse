"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeEntityGraphLayout = computeEntityGraphLayout;
/** Layers ordered from the centre outward, following the dependency direction. */
const LAYER_BANDS = [
    ["definition", "primitive"],
    ["abstract"],
    ["reusable", "reference"],
    ["in-memory-entity", "system"],
    ["entity"],
    ["entity-component"],
    ["category"],
    ["directory", "application-parsing"],
];
/** Minimum arc length between neighbouring nodes on a ring, in graph units. */
const NODE_SPACING = 62;
/** Minimum radial distance between consecutive bands. */
const BAND_GAP = 190;
/** Radial wobble as a fraction of BAND_GAP, so bands read as belts rather than wireframe circles. */
const JITTER_FRACTION = 0.16;
/** Stable hash used for deterministic jitter; identical input always yields identical output. */
function hashToUnitInterval(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        // eslint-disable-next-line no-bitwise
        hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    }
    // eslint-disable-next-line no-bitwise
    return ((hash >>> 0) % 10000) / 10000;
}
/**
 * Assigns `x`/`y` to every node in place and returns the same array.
 *
 * Nodes are grouped into bands by layer, then ordered within a band by domain so that
 * schemas from the same corner of the corpus land next to one another on the ring.
 */
function computeEntityGraphLayout(nodes) {
    const nodesByLayer = new Map();
    nodes.forEach((node) => {
        if (!nodesByLayer.has(node.layer))
            nodesByLayer.set(node.layer, []);
        nodesByLayer.get(node.layer).push(node);
    });
    let previousRadius = 0;
    LAYER_BANDS.forEach((layers) => {
        const band = layers
            .flatMap((layer) => { var _a; return (_a = nodesByLayer.get(layer)) !== null && _a !== void 0 ? _a : []; })
            .sort((a, b) => {
            var _a, _b;
            return a.domain.localeCompare(b.domain) ||
                ((_a = a.ownerEntity) !== null && _a !== void 0 ? _a : "").localeCompare((_b = b.ownerEntity) !== null && _b !== void 0 ? _b : "") ||
                a.id.localeCompare(b.id);
        });
        if (band.length === 0)
            return;
        // Grow the ring until neighbours are at least NODE_SPACING apart along the arc.
        const circumferenceRadius = (band.length * NODE_SPACING) / (2 * Math.PI);
        const radius = Math.max(previousRadius + BAND_GAP, circumferenceRadius);
        band.forEach((node, index) => {
            const angle = (2 * Math.PI * index) / band.length;
            const jitter = (hashToUnitInterval(node.id) - 0.5) * BAND_GAP * JITTER_FRACTION;
            const effectiveRadius = radius + jitter;
            node.x = Math.round(Math.cos(angle) * effectiveRadius * 100) / 100;
            node.y = Math.round(Math.sin(angle) * effectiveRadius * 100) / 100;
        });
        previousRadius = radius;
    });
    // Any layer not named in LAYER_BANDS would be left without coordinates; the lint's
    // total-classification rule prevents that, but fail loudly rather than render at 0,0.
    const unplaced = nodes.filter((node) => node.x === undefined || node.y === undefined);
    if (unplaced.length > 0) {
        throw new Error(`Layout missed ${unplaced.length} node(s); add their layer to LAYER_BANDS: ` +
            `${unplaced.map((node) => node.layer).join(", ")}`);
    }
    return nodes;
}
