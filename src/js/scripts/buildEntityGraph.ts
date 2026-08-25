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
    kind: EntityGraphEdgeKind;
    label?: string;
}

interface WalkContext {
    kind: EntityGraphEdgeKind;
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

    // A `$ref` reached without passing any structural keyword still expresses containment.
    walk(schema, { kind: "contains" });

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
