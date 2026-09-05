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
import fs from "fs";
import yaml from "js-yaml";
import path from "path";

import { EXAMPLES_DIR, PROPERTIES_MANIFEST_PATH, SCHEMAS_DIR } from "../esse/settings";
import type { AnyObject } from "../esse/types";
import type { JSONSchema } from "../esse/utils";
import { validate } from "../utils/ajv";
import { walkDirSync } from "../utils/filesystem";
import entityGraphSchema from "./entity_graph.schema.json";
import { computeEntityGraphLayout } from "./entityGraphLayout";

export type EntityGraphEdgeKind = "extends" | "contains" | "variant";

export type EntityGraphLayer =
    | "primitive"
    | "abstract"
    | "reusable"
    | "reference"
    | "definition"
    | "in-memory-entity"
    | "system"
    | "entity"
    | "entity-component"
    | "category"
    | "directory"
    | "application-parsing";

export interface EntityGraphNodeManifest {
    name: string;
    isResult?: boolean;
    isMonitor?: boolean;
    defaultUnits?: string;
}

/**
 * Navigation facets derived at build time. Keys are sorted; a value is the slug as the
 * corpus spells it — the enum a CateCom vocabulary schema narrows, or a path segment for
 * M-CODE and the catalogues. A narrowing to several values is joined with "|" in enum
 * order, because such a schema is the branch rather than a point on the ladder.
 *
 * Present on every `category` and `directory` node, absent on every other layer.
 */
export type EntityGraphFacets = Record<string, string>;

/** The five coordinate fields of `core/reusable/categories`, in ladder order. */
export const CATECOM_FIELDS = ["tier1", "tier2", "tier3", "type", "subtype"] as const;

export interface EntityGraphNode {
    /** Schema `$id`, dash-separated, e.g. "in-memory-entity/named-defaultable". */
    id: string;
    /** Source path relative to the repository root, e.g. "schema/material.json". */
    path: string;
    /**
     * Path of the resolved copy on the published site. Derived from `$id` the same way
     * JSONSchemasGenerator derives it, which is NOT always the source path: source
     * directories may contain dashes (`properties_directory/non-scalar`) that become
     * underscores once the id round-trips through `$id`.
     */
    publishedPath: string;
    title: string;
    description: string;
    /** Top-level source directory, or "(root)" for schemas at the top of `schema/`. */
    domain: string;
    layer: EntityGraphLayer;
    /** For "entity-component" nodes, the root entity the component belongs to. */
    ownerEntity?: string;
    inDegree: number;
    outDegree: number;
    propertyCount: number;
    hasExample: boolean;
    manifest?: EntityGraphNodeManifest;
    /** Navigation facets — see EntityGraphFacets. Category and directory nodes only. */
    facets?: EntityGraphFacets;
    /** Map coordinates, baked at build time so the client renders without laying out. */
    x?: number;
    y?: number;
}

export interface EntityGraphEdge {
    source: string;
    target: string;
    kind: EntityGraphEdgeKind;
    /** Property name for "contains" edges; "[]" suffix marks a reference through `items`. */
    label?: string;
    /** JSON pointer when the `$ref` carried a fragment, e.g. "/physicsBased". */
    pointer?: string;
}

export interface EntityGraphMeta {
    nodeCount: number;
    edgeCount: number;
    edgeCountsByKind: Record<EntityGraphEdgeKind, number>;
    layerCounts: Record<string, number>;
    sameDocumentRefCount: number;
    schemasWithExample: number;
    isolatedNodeCount: number;
}

export interface EntityGraph {
    meta: EntityGraphMeta;
    nodes: EntityGraphNode[];
    edges: EntityGraphEdge[];
}

export interface EntityGraphLintResult {
    failures: string[];
    warnings: string[];
}

/**
 * Isolated schemas at the time the lint baseline was taken; growth is reported, not failed.
 * These are leaf definitions and externally-consumed formats that nothing else references.
 */
export const ISOLATED_NODE_BASELINE = 34;

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../");
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
 * Exactly invertible by {@link publishedPathToSchemaId}: an `$id` is a path with underscores
 * replaced by dashes, so no `$id` ever contains an underscore and the mapping is injective.
 *
 * What is *not* recoverable is the **source** path, because a source directory may contain a
 * literal dash (`properties_directory/non-scalar`) that the round-trip through `$id` turns into
 * an underscore. Read `node.path` for that.
 */
export function schemaIdToPublishedPath(schemaId: string): string {
    return `schema/${schemaId.replace(/-/g, "_")}.json`;
}

/** Recovers a schema `$id` from the path of its published copy. */
export function publishedPathToSchemaId(publishedPath: string): string {
    return publishedPath
        .replace(/^schema\//, "")
        .replace(/\.json$/, "")
        .replace(/_/g, "-");
}

/** Builds the published-path to `$id` lookup, for callers that prefer a map to a function. */
export function buildPublishedPathIndex(nodes: EntityGraphNode[]): Record<string, string> {
    return Object.fromEntries(nodes.map((node) => [node.publishedPath, node.id]));
}

/** Derives the `$id` a schema at this source path must declare, per `setSchemaIds`. */
export function sourcePathToSchemaId(sourcePath: string): string {
    return path
        .relative(SCHEMAS_DIR, sourcePath)
        .replace(/\.json$/, "")
        .replace(/_/g, "-");
}

function schemaIdSegments(schemaId: string): string[] {
    // Work from the underscored form so that "non-scalar" and "non_scalar" agree.
    return schemaId.replace(/-/g, "_").split("/");
}

/**
 * Assigns a layer to every schema. The classification is total by contract: an
 * unclassifiable path is a lint failure, so a newly added top-level directory forces a
 * deliberate decision here instead of silently landing in a catch-all bucket.
 */
export function classifyLayer(
    schemaId: string,
): { layer: EntityGraphLayer; ownerEntity?: string } | undefined {
    const segments = schemaIdSegments(schemaId);
    const [first, second] = segments;

    if (first === "core") {
        if (second === "primitive") return { layer: "primitive" };
        if (second === "abstract") return { layer: "abstract" };
        if (second === "reusable") return { layer: "reusable" };
        if (second === "reference") return { layer: "reference" };
        return undefined;
    }
    if (first === "definitions") return { layer: "definition" };
    if (first === "in_memory_entity") return { layer: "in-memory-entity" };
    if (first === "system") return { layer: "system" };
    if (segments.length === 1) return { layer: "entity" };
    if (ENTITY_DOMAINS.includes(first)) return { layer: "entity-component", ownerEntity: first };
    if (first.endsWith("_category") || first === "materials_category_components") {
        return { layer: "category" };
    }
    if (first.endsWith("_directory")) return { layer: "directory" };
    if (first === "apse") return { layer: "application-parsing" };

    return undefined;
}

/** Resolves a JSON pointer within a document, returning undefined when it does not exist. */
export function resolveJsonPointer(document: unknown, pointer: string): unknown {
    if (pointer === "" || pointer === "/") return document;

    const tokens = pointer
        .replace(/^\//, "")
        .split("/")
        .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));

    return tokens.reduce<unknown>((current, token) => {
        if (current === null || typeof current !== "object") return undefined;
        const container = current as Record<string, unknown>;
        return token in container ? container[token] : undefined;
    }, document);
}

interface RawReference {
    ref: string;
    /** Absent when no structural keyword encloses the `$ref` — an L4 failure. */
    kind?: EntityGraphEdgeKind;
    label?: string;
}

interface WalkContext {
    kind?: EntityGraphEdgeKind;
    label?: string;
}

/**
 * Collects every `$ref` in a schema together with the relationship it expresses.
 *
 * The relationship comes from the innermost enclosing structural keyword: a `$ref` inside
 * `properties.foo.allOf[0]` extends, while one inside `allOf[0].properties.foo` is contained.
 * The enclosing property name travels with the reference regardless of kind, so a union
 * under `properties.data.oneOf` is recorded as a variant *of `data`*.
 */
export function collectReferences(schema: JSONSchema): RawReference[] {
    const references: RawReference[] = [];

    const walk = (value: unknown, context: WalkContext) => {
        if (Array.isArray(value)) {
            value.forEach((item) => walk(item, context));
            return;
        }
        if (value === null || typeof value !== "object") return;

        const node = value as Record<string, unknown>;

        if (typeof node.$ref === "string") {
            references.push({ ref: node.$ref, kind: context.kind, label: context.label });
        }

        Object.entries(node).forEach(([key, child]) => {
            if (key === "$ref") return;

            if (key === "allOf") {
                walk(child, { kind: "extends", label: context.label });
            } else if (key === "anyOf" || key === "oneOf") {
                walk(child, { kind: "variant", label: context.label });
            } else if (key === "properties" && child !== null && typeof child === "object") {
                Object.entries(child as Record<string, unknown>).forEach(
                    ([propertyName, propertySchema]) => {
                        walk(propertySchema, { kind: "contains", label: propertyName });
                    },
                );
            } else if (key === "items") {
                walk(child, {
                    kind: "contains",
                    label: context.label ? `${context.label}[]` : "[]",
                });
            } else {
                walk(child, context);
            }
        });
    };

    // No structural keyword yet, so no relationship yet. Every `$ref` in the corpus today
    // passes through one before it is reached; a future one that does not gets `kind`
    // undefined and fails L4, which is the point — the classification stays deliberate
    // rather than defaulting to `contains` and quietly mislabelling the edge.
    walk(schema, {});

    return references;
}

interface LoadedSchema {
    sourcePath: string;
    relativePath: string;
    schema: JSONSchema;
}

function loadSchemas(): LoadedSchema[] {
    const loaded: LoadedSchema[] = [];
    walkDirSync(SCHEMAS_DIR, (filePath) => {
        if (!filePath.endsWith(".json")) return;
        loaded.push({
            sourcePath: filePath,
            relativePath: path.relative(REPOSITORY_ROOT, filePath),
            schema: JSON.parse(fs.readFileSync(filePath, "utf-8")) as JSONSchema,
        });
    });
    return loaded.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}

function readPropertiesManifest(): Record<string, any> {
    if (!fs.existsSync(PROPERTIES_MANIFEST_PATH)) return {};
    return (yaml.load(fs.readFileSync(PROPERTIES_MANIFEST_PATH, "utf-8")) ?? {}) as Record<
        string,
        any
    >;
}

// ── Facets ────────────────────────────────────────────────────────────────────

const ENUM_HOLDER = /^(enum_options|enum|enums)$/;
const DIMENSIONALITY = /^(zero|one|two|three)-dimensional$/;
const OPERATIONS_PREFIX = "materials-category-components/operations/";
const VALUE_SHAPES = ["scalar", "non-scalar", "structural", "elemental", "workflow"];
const METHOD_BRANCHES = ["mathematical", "physical"];

interface FacetContext {
    nodes: Map<string, EntityGraphNode>;
    schemaById: Map<string, LoadedSchema>;
    schemasBySourcePath: Map<string, LoadedSchema>;
    /** `extends` targets per source id, sorted, so the upward walk is deterministic. */
    extendsTargets: Map<string, string[]>;
    /** Target of the `categories` property edge, per directory node id. */
    categoriesTarget: Map<string, string>;
    coordinateMemo: Map<string, EntityGraphFacets>;
}

/** Source path segments below `schema/`, so `non-scalar` keeps the dash its `$id` loses. */
function sourceSegments(node: EntityGraphNode): string[] {
    return node.path
        .replace(/^schema\//, "")
        .replace(/\.json$/, "")
        .split("/");
}

function sortedFacets(facets: EntityGraphFacets): EntityGraphFacets {
    return Object.fromEntries(Object.entries(facets).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Which of the five CateCom fields this vocabulary schema narrows, each resolved to its enum.
 *
 * The enum is the coordinate, not the path segment: `fapprx/basisexp.json` narrows `tier2`
 * to `basisExp`, and for methods the first segment (`mathematical`, `physical`) is not a tier
 * at all — so counting path depth gets the ladder wrong.
 */
function ownNarrowings(id: string, context: FacetContext): EntityGraphFacets {
    const loaded = context.schemaById.get(id);
    if (!loaded) return {};

    const properties = (loaded.schema.properties ?? {}) as Record<string, any>;
    const narrowed: EntityGraphFacets = {};

    CATECOM_FIELDS.forEach((field) => {
        const property = properties[field];
        if (!property) return;

        let values: unknown = Array.isArray(property.enum) ? property.enum : undefined;
        if (!values && typeof property.$ref === "string") {
            const [filePart, pointerPart] = property.$ref.split("#");
            const target = context.schemasBySourcePath.get(
                path.resolve(path.dirname(loaded.sourcePath), filePart),
            )?.schema;
            const fragment = resolveJsonPointer(
                target,
                `/${(pointerPart ?? "").replace(/^\//, "")}`,
            );
            values = (fragment as { enum?: unknown } | undefined)?.enum;
        }
        if (Array.isArray(values) && values.length > 0) {
            narrowed[field] = values.map(String).join("|");
        }
    });

    return narrowed;
}

/** Ancestors' narrowings (walking `extends` within the category layer), then this node's; own wins. */
function catecomCoordinate(id: string, context: FacetContext): EntityGraphFacets {
    const memoised = context.coordinateMemo.get(id);
    if (memoised) return memoised;

    context.coordinateMemo.set(id, {});
    const coordinate: EntityGraphFacets = {};
    (context.extendsTargets.get(id) ?? [])
        .filter((parent) => context.nodes.get(parent)?.layer === "category")
        .forEach((parent) => Object.assign(coordinate, catecomCoordinate(parent, context)));
    Object.assign(coordinate, ownNarrowings(id, context));

    context.coordinateMemo.set(id, coordinate);
    return coordinate;
}

/** Last segment of the first operation reached walking `extends` upward. */
function mcodeOperation(
    id: string,
    context: FacetContext,
    seen = new Set<string>(),
): string | undefined {
    if (seen.has(id)) return undefined;
    seen.add(id);

    const parents = context.extendsTargets.get(id) ?? [];
    const direct = parents.find((parent) => parent.startsWith(OPERATIONS_PREFIX));
    if (direct) return direct.split("/").pop();

    return parents.map((parent) => mcodeOperation(parent, context, seen)).find(Boolean);
}

/**
 * Facets for one node, or undefined when no rule covers it.
 *
 * Category nodes carry their scheme's coordinate (CateCom's ladder or M-CODE's axes);
 * directory nodes carry the catalogue they belong to, that catalogue's own axis, and — when
 * the entry declares a `categories` property — the coordinate it is filed at.
 */
export function deriveFacets(
    node: EntityGraphNode,
    context: FacetContext,
): EntityGraphFacets | undefined {
    if (node.layer !== "category" && node.layer !== "directory") return undefined;

    const segments = sourceSegments(node);
    const [, second, third, fourth] = segments;
    const holder = ENUM_HOLDER.test(segments[segments.length - 1]);
    const facets: EntityGraphFacets = {};

    if (node.layer === "category") {
        if (node.domain === "models_category" || node.domain === "methods_category") {
            facets.scheme = "catecom";
            if (node.domain === "methods_category") facets.branch = second;
            if (holder) {
                facets.role = "enum-options";
            } else {
                facets.role = "vocabulary";
                Object.assign(facets, catecomCoordinate(node.id, context));
            }
        } else if (node.domain === "materials_category") {
            facets.scheme = "mcode";
            facets.role = "recipe";
            facets.structuralClass = second.replace(/_structures$/, "").replace(/_/g, "-");
            facets.dimensionality = third;
            const operation = mcodeOperation(node.id, context);
            if (operation) facets.operation = operation;
        } else if (node.domain === "materials_category_components" && second === "entities") {
            facets.scheme = "mcode";
            facets.role = "entity";
            facets.entityRole = third;
            // Dimensionality sits one segment deeper here than under materials_category.
            facets.dimensionality = fourth;
        } else if (node.domain === "materials_category_components" && second === "operations") {
            facets.scheme = "mcode";
            facets.role = holder ? "enum-options" : "operation";
            facets.operationKind = fourth;
        } else {
            return undefined;
        }
        return sortedFacets(facets);
    }

    facets.catalogue = node.domain.replace(/_directory$/, "").replace(/_/g, "-");
    if (holder) {
        facets.role = "enum-options";
        return sortedFacets(facets);
    }
    if (second === "legacy") facets.legacy = "true";
    if (node.domain === "properties_directory" && VALUE_SHAPES.includes(second)) {
        facets.valueShape = second;
    }
    if (node.domain === "software_directory") facets.softwareKind = second;
    if (node.domain === "methods_directory" && METHOD_BRANCHES.includes(second)) {
        facets.branch = second;
    }
    if (node.domain === "context_providers_directory") {
        facets.scope = second === "by_application" ? "by-application" : "generic";
        if (second === "by_application") [facets.application] = third.split("_");
    }

    const coordinate = context.categoriesTarget.get(node.id);
    if (coordinate) {
        const inherited = catecomCoordinate(coordinate, context);
        CATECOM_FIELDS.forEach((field) => {
            if (inherited[field]) facets[field] = inherited[field];
        });
    }

    return sortedFacets(facets);
}

export interface BuildEntityGraphResult {
    graph: EntityGraph;
    lint: EntityGraphLintResult;
}

export function buildEntityGraph(): BuildEntityGraphResult {
    const failures: string[] = [];
    const warnings: string[] = [];

    const loadedSchemas = loadSchemas();
    const schemasBySourcePath = new Map(loadedSchemas.map((item) => [item.sourcePath, item]));

    const nodes = new Map<string, EntityGraphNode>();
    const nodeIdBySourcePath = new Map<string, string>();

    loadedSchemas.forEach(({ sourcePath, relativePath, schema }) => {
        const expectedId = sourcePathToSchemaId(sourcePath);
        const declaredId = typeof schema.$id === "string" ? schema.$id : undefined;

        if (declaredId !== expectedId) {
            failures.push(
                `L2 ${relativePath}: $id is ${JSON.stringify(
                    declaredId,
                )}, expected ${JSON.stringify(expectedId)} (run "npm run set-schema-ids")`,
            );
        }

        const id = declaredId ?? expectedId;
        const classification = classifyLayer(id);
        if (!classification) {
            failures.push(
                `L3 ${relativePath}: no layer rule matches this path — add one to classifyLayer`,
            );
        }

        const relativeToSchemas = path.relative(SCHEMAS_DIR, sourcePath);
        const domain = relativeToSchemas.includes(path.sep)
            ? relativeToSchemas.split(path.sep)[0]
            : "(root)";
        const properties = (schema.properties ?? {}) as Record<string, unknown>;

        nodes.set(id, {
            id,
            path: relativePath,
            publishedPath: schemaIdToPublishedPath(id),
            title: typeof schema.title === "string" ? schema.title : "",
            description: typeof schema.description === "string" ? schema.description : "",
            domain,
            layer: classification?.layer ?? ("entity" as EntityGraphLayer),
            ...(classification?.ownerEntity ? { ownerEntity: classification.ownerEntity } : {}),
            inDegree: 0,
            outDegree: 0,
            propertyCount: Object.keys(properties).length,
            hasExample: fs.existsSync(path.join(EXAMPLES_DIR, relativeToSchemas)),
        });
        nodeIdBySourcePath.set(sourcePath, id);
    });

    const edges: EntityGraphEdge[] = [];
    let sameDocumentRefCount = 0;

    loadedSchemas.forEach(({ sourcePath, relativePath, schema }) => {
        const sourceId = nodeIdBySourcePath.get(sourcePath) as string;

        collectReferences(schema).forEach(({ ref, kind, label }) => {
            const [filePart, pointerPart] = ref.split("#");
            const pointer = pointerPart ? `/${pointerPart.replace(/^\//, "")}` : undefined;

            if (!filePart) {
                // Same-document reference: valid, but not an edge between schemas.
                sameDocumentRefCount += 1;
                if (pointer && resolveJsonPointer(schema, pointer) === undefined) {
                    failures.push(
                        `L5 ${relativePath}: pointer ${pointer} does not exist in itself`,
                    );
                }
                return;
            }

            const targetPath = path.resolve(path.dirname(sourcePath), filePart);
            const targetId = nodeIdBySourcePath.get(targetPath);

            if (!targetId) {
                failures.push(`L1 ${relativePath}: $ref "${ref}" does not resolve to a schema`);
                return;
            }

            if (!kind) {
                failures.push(
                    `L4 ${relativePath}: $ref "${ref}" is not inside allOf, oneOf, anyOf, ` +
                        `properties or items, so its relationship kind is undecided`,
                );
                return;
            }

            if (pointer) {
                const targetSchema = schemasBySourcePath.get(targetPath)?.schema;
                if (resolveJsonPointer(targetSchema, pointer) === undefined) {
                    failures.push(
                        `L5 ${relativePath}: $ref "${ref}" points at ${pointer}, which does not exist in the target`,
                    );
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
        if (source) source.outDegree += 1;
        if (target) target.inDegree += 1;
    });

    // L7 — reference cycles. The README forbids them; keep it true as schemas are added.
    const adjacency = new Map<string, Set<string>>();
    edges.forEach((edge) => {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
        (adjacency.get(edge.source) as Set<string>).add(edge.target);
    });
    const VISITING = 1;
    const VISITED = 2;
    const state = new Map<string, number>();
    const trail: string[] = [];

    const visit = (id: string) => {
        state.set(id, VISITING);
        trail.push(id);

        [...(adjacency.get(id) ?? [])].sort().forEach((neighbour) => {
            if (state.get(neighbour) === VISITING) {
                const cycleStart = trail.indexOf(neighbour);
                failures.push(`L7 cycle: ${[...trail.slice(cycleStart), neighbour].join(" -> ")}`);
            } else if (state.get(neighbour) === undefined) {
                visit(neighbour);
            }
        });

        trail.pop();
        state.set(id, VISITED);
    };

    [...nodes.keys()].sort().forEach((id) => {
        if (state.get(id) === undefined) visit(id);
    });

    // L6 — every manifest entry must point at a schema that exists.
    const propertiesManifest = readPropertiesManifest();
    Object.entries(propertiesManifest).forEach(([name, entry]) => {
        const schemaId = entry?.schemaId;
        if (typeof schemaId !== "string") return;
        const node = nodes.get(schemaId);
        if (!node) {
            failures.push(
                `L6 manifest/properties.yaml: "${name}" references schemaId "${schemaId}", which does not exist`,
            );
            return;
        }
        node.manifest = {
            name,
            ...(entry.isResult ? { isResult: true } : {}),
            ...(entry.isMonitor ? { isMonitor: true } : {}),
            ...(entry.defaults?.units ? { defaultUnits: String(entry.defaults.units) } : {}),
        };
    });

    // L11 — facets are total on the category and directory layers, and well formed.
    // Assigned after the edges exist (the CateCom walk and the `categories` join both need
    // them) and before layout, so node key order stays deterministic.
    const extendsTargets = new Map<string, string[]>();
    const categoriesTarget = new Map<string, string>();
    edges.forEach((edge) => {
        if (edge.kind === "extends") {
            if (!extendsTargets.has(edge.source)) extendsTargets.set(edge.source, []);
            (extendsTargets.get(edge.source) as string[]).push(edge.target);
        }
        if (edge.kind === "contains" && edge.label === "categories") {
            if (
                nodes.get(edge.source)?.layer === "directory" &&
                nodes.get(edge.target)?.layer === "category"
            ) {
                categoriesTarget.set(edge.source, edge.target);
            }
        }
    });
    extendsTargets.forEach((targets) => targets.sort());

    const facetContext: FacetContext = {
        nodes,
        schemaById: new Map(
            loadedSchemas
                .map((item) => [nodeIdBySourcePath.get(item.sourcePath) as string, item] as const)
                .filter(([id]) => Boolean(id)),
        ),
        schemasBySourcePath,
        extendsTargets,
        categoriesTarget,
        coordinateMemo: new Map(),
    };

    [...nodes.keys()].sort().forEach((id) => {
        const node = nodes.get(id) as EntityGraphNode;
        if (node.layer !== "category" && node.layer !== "directory") return;

        const facets = deriveFacets(node, facetContext);
        if (!facets || Object.keys(facets).length === 0) {
            failures.push(
                `L11 ${node.path}: no facet rule covers this ${node.layer} path — add one to deriveFacets`,
            );
            return;
        }
        if (facets.dimensionality && !DIMENSIONALITY.test(facets.dimensionality)) {
            failures.push(
                `L11 ${node.path}: dimensionality "${facets.dimensionality}" is not <zero|one|two|three>-dimensional`,
            );
        }
        node.facets = facets;
    });

    const sortedNodes = computeEntityGraphLayout(
        [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    );
    const sortedEdges = edges.sort(
        (a, b) =>
            a.source.localeCompare(b.source) ||
            a.target.localeCompare(b.target) ||
            a.kind.localeCompare(b.kind) ||
            (a.label ?? "").localeCompare(b.label ?? "") ||
            (a.pointer ?? "").localeCompare(b.pointer ?? ""),
    );

    const isolatedNodes = sortedNodes.filter((node) => !node.inDegree && !node.outDegree);
    if (isolatedNodes.length > ISOLATED_NODE_BASELINE) {
        warnings.push(
            `L8 ${isolatedNodes.length} isolated schemas, up from a baseline of ${ISOLATED_NODE_BASELINE}: ` +
                `${isolatedNodes.map((node) => node.id).join(", ")}`,
        );
    }

    const schemasWithExample = sortedNodes.filter((node) => node.hasExample).length;
    warnings.push(
        `L9 example coverage: ${schemasWithExample}/${sortedNodes.length} schemas have an example ` +
            `(${Math.round((schemasWithExample / sortedNodes.length) * 100)}%)`,
    );

    const edgeCountsByKind: Record<EntityGraphEdgeKind, number> = {
        extends: 0,
        contains: 0,
        variant: 0,
    };
    sortedEdges.forEach((edge) => {
        edgeCountsByKind[edge.kind] += 1;
    });

    const layerCounts: Record<string, number> = {};
    sortedNodes.forEach((node) => {
        layerCounts[node.layer] = (layerCounts[node.layer] ?? 0) + 1;
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
 * L10 — validates the emitted graph against its schema.
 *
 * That schema lives here rather than in `schema/`: it describes a build artifact, not an
 * entity of digital materials science, so it has no business in the corpus this tool
 * measures. Imported rather than read from disk so it resolves identically whether the
 * module runs from source or from the transpiled copy in `dist/`.
 */
export function validateEntityGraph(graph: EntityGraph): string[] {
    const { isValid, errors } = validate(graph as unknown as AnyObject, entityGraphSchema);

    if (isValid) return [];

    return (errors ?? []).map(
        (error) => `L10 graph.json${error.instancePath} ${error.message ?? "is invalid"}`,
    );
}

/** Writes `graph.json` into the given directory, creating it when missing. */
export function writeEntityGraph(graph: EntityGraph, outputDir: string): string {
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "graph.json");
    fs.writeFileSync(outputPath, `${JSON.stringify(graph, null, 4)}\n`, "utf8");
    return outputPath;
}
