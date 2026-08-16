import type { JSONSchema } from "../esse/utils";
export type EntityGraphEdgeKind = "extends" | "contains" | "variant";
export type EntityGraphLayer = "primitive" | "abstract" | "reusable" | "reference" | "definition" | "in-memory-entity" | "system" | "entity" | "entity-component" | "category" | "directory" | "application-parsing";
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
export declare const ISOLATED_NODE_BASELINE = 35;
/**
 * Maps a schema `$id` to the path of its resolved copy on the published site.
 *
 * The inverse is deliberately absent: dashes in `$id` may come from either an underscore
 * or a literal dash in the source path, so the mapping is not invertible by string rules.
 * Use {@link buildPublishedPathIndex} to go the other way.
 */
export declare function schemaIdToPublishedPath(schemaId: string): string;
/** Builds the published-path to `$id` lookup that inverts {@link schemaIdToPublishedPath}. */
export declare function buildPublishedPathIndex(nodes: EntityGraphNode[]): Record<string, string>;
/** Derives the `$id` a schema at this source path must declare, per `setSchemaIds`. */
export declare function sourcePathToSchemaId(sourcePath: string): string;
/**
 * Assigns a layer to every schema. The classification is total by contract: an
 * unclassifiable path is a lint failure, so a newly added top-level directory forces a
 * deliberate decision here instead of silently landing in a catch-all bucket.
 */
export declare function classifyLayer(schemaId: string): {
    layer: EntityGraphLayer;
    ownerEntity?: string;
} | undefined;
/** Resolves a JSON pointer within a document, returning undefined when it does not exist. */
export declare function resolveJsonPointer(document: unknown, pointer: string): unknown;
interface RawReference {
    ref: string;
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
export declare function collectReferences(schema: JSONSchema): RawReference[];
export interface BuildEntityGraphResult {
    graph: EntityGraph;
    lint: EntityGraphLintResult;
}
export declare function buildEntityGraph(): BuildEntityGraphResult;
/**
 * L10 — validates the emitted graph against its own ESSE schema, so the asset that
 * describes the schemas is itself described by one.
 */
export declare function validateEntityGraph(graph: EntityGraph): string[];
/** Writes `graph.json` into the given directory, creating it when missing. */
export declare function writeEntityGraph(graph: EntityGraph, outputDir: string): string;
export {};
