"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISOLATED_NODE_BASELINE = void 0;
exports.schemaIdToPublishedPath = schemaIdToPublishedPath;
exports.buildPublishedPathIndex = buildPublishedPathIndex;
exports.sourcePathToSchemaId = sourcePathToSchemaId;
exports.classifyLayer = classifyLayer;
exports.resolveJsonPointer = resolveJsonPointer;
exports.collectReferences = collectReferences;
exports.buildEntityGraph = buildEntityGraph;
exports.validateEntityGraph = validateEntityGraph;
exports.writeEntityGraph = writeEntityGraph;
/**
 * Extracts the schema reference graph from the ESSE sources.
 *
 * The graph records how schemas relate to one another: which schemas extend which
 * (`allOf`), which contain which (`properties`/`items`), and which are variants of a
 * union (`oneOf`/`anyOf`). It is emitted as a single `graph.json` asset for the site,
 * and doubles as a lint over the schema corpus.
 *
 * IMPORTANT: this reads the *source* schemas, never the resolved ones under `dist`.
 * Resolution inlines `$ref`s and merges `allOf`, which destroys exactly the structure
 * recorded here.
 */
const fs_1 = __importDefault(require("fs"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const path_1 = __importDefault(require("path"));
const settings_1 = require("../esse/settings");
const ajv_1 = require("../utils/ajv");
const filesystem_1 = require("../utils/filesystem");
/**
 * Isolated schemas at the time the lint baseline was taken; growth is reported, not failed.
 * These are leaf definitions and externally-consumed formats that nothing else references.
 */
exports.ISOLATED_NODE_BASELINE = 35;
const REPOSITORY_ROOT = path_1.default.resolve(__dirname, "../../../");
const ENTITY_DOMAINS = [
    "material",
    "model",
    "method",
    "property",
    "workflow",
    "job",
    "software",
    "compute",
];
/**
 * Maps a schema `$id` to the path of its resolved copy on the published site.
 *
 * The inverse is deliberately absent: dashes in `$id` may come from either an underscore
 * or a literal dash in the source path, so the mapping is not invertible by string rules.
 * Use {@link buildPublishedPathIndex} to go the other way.
 */
function schemaIdToPublishedPath(schemaId) {
    return `schema/${schemaId.replace(/-/g, "_")}.json`;
}
/** Builds the published-path to `$id` lookup that inverts {@link schemaIdToPublishedPath}. */
function buildPublishedPathIndex(nodes) {
    return Object.fromEntries(nodes.map((node) => [node.publishedPath, node.id]));
}
/** Derives the `$id` a schema at this source path must declare, per `setSchemaIds`. */
function sourcePathToSchemaId(sourcePath) {
    return path_1.default
        .relative(settings_1.SCHEMAS_DIR, sourcePath)
        .replace(/\.json$/, "")
        .replace(/_/g, "-");
}
function schemaIdSegments(schemaId) {
    // Work from the underscored form so that "non-scalar" and "non_scalar" agree.
    return schemaId.replace(/-/g, "_").split("/");
}
/**
 * Assigns a layer to every schema. The classification is total by contract: an
 * unclassifiable path is a lint failure, so a newly added top-level directory forces a
 * deliberate decision here instead of silently landing in a catch-all bucket.
 */
function classifyLayer(schemaId) {
    const segments = schemaIdSegments(schemaId);
    const [first, second] = segments;
    if (first === "core") {
        if (second === "primitive")
            return { layer: "primitive" };
        if (second === "abstract")
            return { layer: "abstract" };
        if (second === "reusable")
            return { layer: "reusable" };
        if (second === "reference")
            return { layer: "reference" };
        return undefined;
    }
    if (first === "definitions")
        return { layer: "definition" };
    if (first === "in_memory_entity")
        return { layer: "in-memory-entity" };
    if (first === "system")
        return { layer: "system" };
    if (segments.length === 1)
        return { layer: "entity" };
    if (ENTITY_DOMAINS.includes(first))
        return { layer: "entity-component", ownerEntity: first };
    if (first.endsWith("_category") || first === "materials_category_components") {
        return { layer: "category" };
    }
    if (first.endsWith("_directory"))
        return { layer: "directory" };
    if (first === "apse")
        return { layer: "application-parsing" };
    return undefined;
}
/** Resolves a JSON pointer within a document, returning undefined when it does not exist. */
function resolveJsonPointer(document, pointer) {
    if (pointer === "" || pointer === "/")
        return document;
    const tokens = pointer
        .replace(/^\//, "")
        .split("/")
        .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
    return tokens.reduce((current, token) => {
        if (current === null || typeof current !== "object")
            return undefined;
        const container = current;
        return token in container ? container[token] : undefined;
    }, document);
}
/**
 * Collects every `$ref` in a schema together with the relationship it expresses.
 *
 * The relationship comes from the innermost enclosing structural keyword: a `$ref` inside
 * `properties.foo.allOf[0]` extends, while one inside `allOf[0].properties.foo` is contained.
 * The enclosing property name travels with the reference regardless of kind, so a union
 * under `properties.data.oneOf` is recorded as a variant *of `data`*.
 */
function collectReferences(schema) {
    const references = [];
    const walk = (value, context) => {
        if (Array.isArray(value)) {
            value.forEach((item) => walk(item, context));
            return;
        }
        if (value === null || typeof value !== "object")
            return;
        const node = value;
        if (typeof node.$ref === "string") {
            references.push({ ref: node.$ref, kind: context.kind, label: context.label });
        }
        Object.entries(node).forEach(([key, child]) => {
            if (key === "$ref")
                return;
            if (key === "allOf") {
                walk(child, { kind: "extends", label: context.label });
            }
            else if (key === "anyOf" || key === "oneOf") {
                walk(child, { kind: "variant", label: context.label });
            }
            else if (key === "properties" && child !== null && typeof child === "object") {
                Object.entries(child).forEach(([propertyName, propertySchema]) => {
                    walk(propertySchema, { kind: "contains", label: propertyName });
                });
            }
            else if (key === "items") {
                walk(child, {
                    kind: "contains",
                    label: context.label ? `${context.label}[]` : "[]",
                });
            }
            else {
                walk(child, context);
            }
        });
    };
    // A `$ref` reached without passing any structural keyword still expresses containment.
    walk(schema, { kind: "contains" });
    return references;
}
function loadSchemas() {
    const loaded = [];
    (0, filesystem_1.walkDirSync)(settings_1.SCHEMAS_DIR, (filePath) => {
        if (!filePath.endsWith(".json"))
            return;
        loaded.push({
            sourcePath: filePath,
            relativePath: path_1.default.relative(REPOSITORY_ROOT, filePath),
            schema: JSON.parse(fs_1.default.readFileSync(filePath, "utf-8")),
        });
    });
    return loaded.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}
function readPropertiesManifest() {
    var _a;
    if (!fs_1.default.existsSync(settings_1.PROPERTIES_MANIFEST_PATH))
        return {};
    return ((_a = js_yaml_1.default.load(fs_1.default.readFileSync(settings_1.PROPERTIES_MANIFEST_PATH, "utf-8"))) !== null && _a !== void 0 ? _a : {});
}
function buildEntityGraph() {
    const failures = [];
    const warnings = [];
    const loadedSchemas = loadSchemas();
    const schemasBySourcePath = new Map(loadedSchemas.map((item) => [item.sourcePath, item]));
    const nodes = new Map();
    const nodeIdBySourcePath = new Map();
    loadedSchemas.forEach(({ sourcePath, relativePath, schema }) => {
        var _a, _b;
        const expectedId = sourcePathToSchemaId(sourcePath);
        const declaredId = typeof schema.$id === "string" ? schema.$id : undefined;
        if (declaredId !== expectedId) {
            failures.push(`L2 ${relativePath}: $id is ${JSON.stringify(declaredId)}, expected ${JSON.stringify(expectedId)} (run "npm run set-schema-ids")`);
        }
        const id = declaredId !== null && declaredId !== void 0 ? declaredId : expectedId;
        const classification = classifyLayer(id);
        if (!classification) {
            failures.push(`L3 ${relativePath}: no layer rule matches this path — add one to classifyLayer`);
        }
        const relativeToSchemas = path_1.default.relative(settings_1.SCHEMAS_DIR, sourcePath);
        const domain = relativeToSchemas.includes(path_1.default.sep)
            ? relativeToSchemas.split(path_1.default.sep)[0]
            : "(root)";
        const properties = ((_a = schema.properties) !== null && _a !== void 0 ? _a : {});
        nodes.set(id, {
            id,
            path: relativePath,
            publishedPath: schemaIdToPublishedPath(id),
            title: typeof schema.title === "string" ? schema.title : "",
            description: typeof schema.description === "string" ? schema.description : "",
            domain,
            layer: (_b = classification === null || classification === void 0 ? void 0 : classification.layer) !== null && _b !== void 0 ? _b : "entity",
            ...((classification === null || classification === void 0 ? void 0 : classification.ownerEntity) ? { ownerEntity: classification.ownerEntity } : {}),
            inDegree: 0,
            outDegree: 0,
            propertyCount: Object.keys(properties).length,
            hasExample: fs_1.default.existsSync(path_1.default.join(settings_1.EXAMPLES_DIR, relativeToSchemas)),
        });
        nodeIdBySourcePath.set(sourcePath, id);
    });
    const edges = [];
    let sameDocumentRefCount = 0;
    loadedSchemas.forEach(({ sourcePath, relativePath, schema }) => {
        const sourceId = nodeIdBySourcePath.get(sourcePath);
        collectReferences(schema).forEach(({ ref, kind, label }) => {
            var _a;
            const [filePart, pointerPart] = ref.split("#");
            const pointer = pointerPart ? `/${pointerPart.replace(/^\//, "")}` : undefined;
            if (!filePart) {
                // Same-document reference: valid, but not an edge between schemas.
                sameDocumentRefCount += 1;
                if (pointer && resolveJsonPointer(schema, pointer) === undefined) {
                    failures.push(`L5 ${relativePath}: pointer ${pointer} does not exist in itself`);
                }
                return;
            }
            const targetPath = path_1.default.resolve(path_1.default.dirname(sourcePath), filePart);
            const targetId = nodeIdBySourcePath.get(targetPath);
            if (!targetId) {
                failures.push(`L1 ${relativePath}: $ref "${ref}" does not resolve to a schema`);
                return;
            }
            if (pointer) {
                const targetSchema = (_a = schemasBySourcePath.get(targetPath)) === null || _a === void 0 ? void 0 : _a.schema;
                if (resolveJsonPointer(targetSchema, pointer) === undefined) {
                    failures.push(`L5 ${relativePath}: $ref "${ref}" points at ${pointer}, which does not exist in the target`);
                }
            }
            edges.push({
                source: sourceId,
                target: targetId,
                kind,
                ...(label ? { label } : {}),
                ...(pointer ? { pointer } : {}),
            });
        });
    });
    edges.forEach((edge) => {
        const source = nodes.get(edge.source);
        const target = nodes.get(edge.target);
        if (source)
            source.outDegree += 1;
        if (target)
            target.inDegree += 1;
    });
    // L7 — reference cycles. The README forbids them; keep it true as schemas are added.
    const adjacency = new Map();
    edges.forEach((edge) => {
        if (!adjacency.has(edge.source))
            adjacency.set(edge.source, new Set());
        adjacency.get(edge.source).add(edge.target);
    });
    const VISITING = 1;
    const VISITED = 2;
    const state = new Map();
    const trail = [];
    const visit = (id) => {
        var _a;
        state.set(id, VISITING);
        trail.push(id);
        [...((_a = adjacency.get(id)) !== null && _a !== void 0 ? _a : [])].sort().forEach((neighbour) => {
            if (state.get(neighbour) === VISITING) {
                const cycleStart = trail.indexOf(neighbour);
                failures.push(`L7 cycle: ${[...trail.slice(cycleStart), neighbour].join(" -> ")}`);
            }
            else if (state.get(neighbour) === undefined) {
                visit(neighbour);
            }
        });
        trail.pop();
        state.set(id, VISITED);
    };
    [...nodes.keys()].sort().forEach((id) => {
        if (state.get(id) === undefined)
            visit(id);
    });
    // L6 — every manifest entry must point at a schema that exists.
    const propertiesManifest = readPropertiesManifest();
    Object.entries(propertiesManifest).forEach(([name, entry]) => {
        var _a;
        const schemaId = entry === null || entry === void 0 ? void 0 : entry.schemaId;
        if (typeof schemaId !== "string")
            return;
        const node = nodes.get(schemaId);
        if (!node) {
            failures.push(`L6 manifest/properties.yaml: "${name}" references schemaId "${schemaId}", which does not exist`);
            return;
        }
        node.manifest = {
            name,
            ...(entry.isResult ? { isResult: true } : {}),
            ...(entry.isMonitor ? { isMonitor: true } : {}),
            ...(((_a = entry.defaults) === null || _a === void 0 ? void 0 : _a.units) ? { defaultUnits: String(entry.defaults.units) } : {}),
        };
    });
    const sortedNodes = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
    const sortedEdges = edges.sort((a, b) => {
        var _a, _b, _c, _d;
        return a.source.localeCompare(b.source) ||
            a.target.localeCompare(b.target) ||
            a.kind.localeCompare(b.kind) ||
            ((_a = a.label) !== null && _a !== void 0 ? _a : "").localeCompare((_b = b.label) !== null && _b !== void 0 ? _b : "") ||
            ((_c = a.pointer) !== null && _c !== void 0 ? _c : "").localeCompare((_d = b.pointer) !== null && _d !== void 0 ? _d : "");
    });
    const isolatedNodes = sortedNodes.filter((node) => !node.inDegree && !node.outDegree);
    if (isolatedNodes.length > exports.ISOLATED_NODE_BASELINE) {
        warnings.push(`L8 ${isolatedNodes.length} isolated schemas, up from a baseline of ${exports.ISOLATED_NODE_BASELINE}: ` +
            `${isolatedNodes.map((node) => node.id).join(", ")}`);
    }
    const schemasWithExample = sortedNodes.filter((node) => node.hasExample).length;
    warnings.push(`L9 example coverage: ${schemasWithExample}/${sortedNodes.length} schemas have an example ` +
        `(${Math.round((schemasWithExample / sortedNodes.length) * 100)}%)`);
    const edgeCountsByKind = {
        extends: 0,
        contains: 0,
        variant: 0,
    };
    sortedEdges.forEach((edge) => {
        edgeCountsByKind[edge.kind] += 1;
    });
    const layerCounts = {};
    sortedNodes.forEach((node) => {
        var _a;
        layerCounts[node.layer] = ((_a = layerCounts[node.layer]) !== null && _a !== void 0 ? _a : 0) + 1;
    });
    return {
        graph: {
            meta: {
                nodeCount: sortedNodes.length,
                edgeCount: sortedEdges.length,
                edgeCountsByKind,
                layerCounts: Object.fromEntries(Object.entries(layerCounts).sort()),
                sameDocumentRefCount,
                schemasWithExample,
                isolatedNodeCount: isolatedNodes.length,
            },
            nodes: sortedNodes,
            edges: sortedEdges,
        },
        lint: { failures, warnings },
    };
}
/**
 * L10 — validates the emitted graph against its own ESSE schema, so the asset that
 * describes the schemas is itself described by one.
 */
function validateEntityGraph(graph) {
    const schemaPath = path_1.default.join(settings_1.SCHEMAS_DIR, "system", "entity_graph.json");
    if (!fs_1.default.existsSync(schemaPath)) {
        return [`L10 ${path_1.default.relative(REPOSITORY_ROOT, schemaPath)} is missing`];
    }
    const schema = JSON.parse(fs_1.default.readFileSync(schemaPath, "utf-8"));
    const { isValid, errors } = (0, ajv_1.validate)(graph, schema);
    if (isValid)
        return [];
    return (errors !== null && errors !== void 0 ? errors : []).map((error) => { var _a; return `L10 graph.json${error.instancePath} ${(_a = error.message) !== null && _a !== void 0 ? _a : "is invalid"}`; });
}
/** Writes `graph.json` into the given directory, creating it when missing. */
function writeEntityGraph(graph, outputDir) {
    fs_1.default.mkdirSync(outputDir, { recursive: true });
    const outputPath = path_1.default.join(outputDir, "graph.json");
    fs_1.default.writeFileSync(outputPath, `${JSON.stringify(graph, null, 4)}\n`, "utf8");
    return outputPath;
}
