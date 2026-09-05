/**
 * Builds the Explorer's Categories and Directories trees from the entity graph.
 *
 * The Explorer browses by file path, which is the one arrangement that cannot show what the
 * categorization layer is *for*: a CateCom tier ladder is a chain of `allOf`s, and M-CODE's
 * three axes are three different ways through the same 17 recipes. Neither is a directory
 * listing. These views are virtual trees over the same files — same widget, same editor, same
 * tabs — so a coordinate becomes something you can walk.
 *
 * Built here rather than in the browser so the shape is testable and lint-able, and so the
 * client stays a renderer. The output is `views.json`, written beside `graph.json`.
 */
import fs from "fs";
import path from "path";

import type { EntityGraph, EntityGraphNode } from "./buildEntityGraph";

/**
 * One openable file in a view.
 *
 * `segments` is the folder chain with the leaf label last. An array rather than a joined
 * string because leaf labels themselves contain slashes — a catalogue entry filed under a
 * vocabulary node reads `models_directory/gga.json` — and joining would invent folders.
 */
export interface ExplorerViewEntry {
    segments: string[];
    /** Site-relative path of the file to open, e.g. "schema/models_directory/gga.json". */
    path: string;
}

export interface ExplorerViews {
    categories: ExplorerViewEntry[];
    directories: ExplorerViewEntry[];
}

const MODELS_ROOT = "Models · CateCom";
const METHODS_ROOT = "Methods · CateCom";
const MATERIALS_ROOT = "Materials · M-CODE";

/** Display names for the catalogues; the entry count is appended at build time. */
const CATALOGUE_LABELS: Record<string, string> = {
    properties: "Properties",
    models: "Models",
    methods: "Methods",
    software: "Software",
    "context-providers": "Context providers",
};

/** Titles are written for a schema reader; a tree row wants the noun, not the file kind. */
function shortTitle(node: EntityGraphNode): string {
    return node.title
        .replace(/\s+(category|configuration)?\s*schema$/i, "")
        .replace(/\s+category$/i, "")
        .trim();
}

function fileName(node: EntityGraphNode): string {
    return node.path.split("/").pop() as string;
}

function slugOf(node: EntityGraphNode): string {
    return node.id.split("/").pop() as string;
}

/** `pb · physics-based model`. Falls back to the slug when the title adds nothing. */
function vocabularyLabel(node: EntityGraphNode): string {
    const title = shortTitle(node);
    const slug = slugOf(node);
    return title && title.toLowerCase() !== slug.toLowerCase() ? `${slug} · ${title}` : slug;
}

function examplePath(node: EntityGraphNode): string | undefined {
    return node.hasExample ? node.publishedPath.replace(/^schema\//, "example/") : undefined;
}

interface ViewContext {
    byId: Map<string, EntityGraphNode>;
    /** Category-layer `extends` parents, sorted, so the ladder walk is deterministic. */
    ladderParents: Map<string, string[]>;
    /** Directory node id -> the vocabulary node its `categories` property points at. */
    filedUnder: Map<string, string>;
    /** Vocabulary node id -> the directory entries filed under it, sorted. */
    filedEntries: Map<string, string[]>;
}

function buildContext(graph: EntityGraph): ViewContext {
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    const ladderParents = new Map<string, string[]>();
    const filedUnder = new Map<string, string>();
    const filedEntries = new Map<string, string[]>();

    graph.edges.forEach((edge) => {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) return;

        if (edge.kind === "extends" && source.layer === "category" && target.layer === "category") {
            const parents = ladderParents.get(edge.source) ?? [];
            parents.push(edge.target);
            ladderParents.set(edge.source, parents);
        }

        if (
            edge.kind === "contains" &&
            edge.label === "categories" &&
            source.layer === "directory" &&
            target.layer === "category"
        ) {
            filedUnder.set(edge.source, edge.target);
            const entries = filedEntries.get(edge.target) ?? [];
            entries.push(edge.source);
            filedEntries.set(edge.target, entries);
        }
    });

    ladderParents.forEach((parents) => parents.sort());
    filedEntries.forEach((entries) => entries.sort());
    return { byId, ladderParents, filedUnder, filedEntries };
}

/**
 * The chain of vocabulary schemas from the top of the ladder down to `nodeId`.
 *
 * This is the `allOf` chain, not the directory path: it is how the corpus itself defines the
 * ladder, and it is right where the path is not. `methods_category/mathematical/regression`
 * narrows a lower field than its depth suggests, so reading position off the path — or off
 * which facet fields are present — misplaces it.
 */
function ladderChain(nodeId: string, context: ViewContext): EntityGraphNode[] {
    const chain: EntityGraphNode[] = [];
    const seen = new Set<string>();
    let current: string | undefined = nodeId;

    while (current && !seen.has(current)) {
        seen.add(current);
        const node = context.byId.get(current);
        if (!node) break;
        chain.push(node);
        [current] = context.ladderParents.get(current) ?? [];
    }

    return chain.reverse();
}

function isEnumHolder(node: EntityGraphNode): boolean {
    return node.facets?.role === "enum-options";
}

// ── Categories ────────────────────────────────────────────────────────────────
function categoriesView(graph: EntityGraph, context: ViewContext): ExplorerViewEntry[] {
    const entries: ExplorerViewEntry[] = [];

    const push = (segments: string[], node: EntityGraphNode) => {
        entries.push({ segments: [...segments, fileName(node)], path: node.publishedPath });
        const example = examplePath(node);
        if (example) {
            entries.push({ segments: [...segments, `${fileName(node)} · example`], path: example });
        }
    };

    graph.nodes
        .filter((node) => node.facets?.role === "vocabulary")
        .forEach((node) => {
            const root = node.domain === "models_category" ? MODELS_ROOT : METHODS_ROOT;
            // The branch is the first path segment but not part of the `allOf` chain, so it
            // has to be prepended for a methods coordinate to be complete.
            const branch = node.facets?.branch;
            const folders = [
                root,
                ...(branch ? [branch] : []),
                ...ladderChain(node.id, context).map(vocabularyLabel),
            ];

            push(folders, node);
            (context.filedEntries.get(node.id) ?? []).forEach((entryId) => {
                const entry = context.byId.get(entryId);
                if (!entry) return;
                // Named with its domain: inside `gga · DFT GGA functional` this sits beside
                // the vocabulary schema's own `gga.json`, and the two must not read alike.
                const label = `${entry.domain}/${fileName(entry)}`;
                entries.push({ segments: [...folders, label], path: entry.publishedPath });
                const example = examplePath(entry);
                if (example) {
                    entries.push({
                        segments: [...folders, `${label} · example`],
                        path: example,
                    });
                }
            });
        });

    // M-CODE's axes are orthogonal, so a recipe is filed under each of them rather than
    // once: reaching a slab by dimensionality and by structural class are both legitimate.
    graph.nodes
        .filter((node) => node.facets?.role === "recipe")
        .forEach((node) => {
            const { structuralClass, dimensionality, operation } = node.facets ?? {};
            if (structuralClass && dimensionality) {
                push(
                    [MATERIALS_ROOT, "by structural class", structuralClass, dimensionality],
                    node,
                );
                push([MATERIALS_ROOT, "by dimensionality", dimensionality, structuralClass], node);
            }
            if (operation) push([MATERIALS_ROOT, "by operation", operation], node);
        });

    graph.nodes
        .filter((node) => node.facets?.role === "entity")
        .forEach((node) => {
            const { entityRole, dimensionality } = node.facets ?? {};
            push(
                [
                    MATERIALS_ROOT,
                    "components",
                    "entities",
                    ...(entityRole ? [entityRole] : []),
                    ...(dimensionality ? [dimensionality] : []),
                ],
                node,
            );
        });

    graph.nodes
        .filter((node) => node.facets?.role === "operation")
        .forEach((node) => {
            const { operationKind } = node.facets ?? {};
            push(
                [
                    MATERIALS_ROOT,
                    "components",
                    "operations",
                    ...(operationKind ? [operationKind] : []),
                ],
                node,
            );
        });

    return entries;
}

// ── Directories ───────────────────────────────────────────────────────────────
/** Where a catalogue entry sits below its catalogue root. */
function directoryGroup(node: EntityGraphNode, context: ViewContext): string[] {
    const facets = node.facets ?? {};

    if (facets.legacy === "true") return ["legacy"];

    switch (facets.catalogue) {
        case "properties":
            return facets.valueShape ? [facets.valueShape] : ["uncategorized"];
        case "software":
            return facets.softwareKind ? [facets.softwareKind] : ["uncategorized"];
        case "context-providers":
            return [
                ...(facets.scope ? [facets.scope] : ["uncategorized"]),
                ...(facets.application ? [facets.application] : []),
            ];
        case "models":
        case "methods": {
            // The coordinate, slugs only — a position on the ladder, not a label for one.
            const target = context.filedUnder.get(node.id);
            if (!target) return ["uncategorized"];
            const branch = context.byId.get(target)?.facets?.branch;
            return [...(branch ? [branch] : []), ...ladderChain(target, context).map(slugOf)];
        }
        default:
            return ["uncategorized"];
    }
}

function directoriesView(graph: EntityGraph, context: ViewContext): ExplorerViewEntry[] {
    const directories = graph.nodes.filter(
        (node) => node.layer === "directory" && !isEnumHolder(node),
    );

    const counts = new Map<string, number>();
    directories.forEach((node) => {
        const catalogue = node.facets?.catalogue ?? "other";
        counts.set(catalogue, (counts.get(catalogue) ?? 0) + 1);
    });

    const entries: ExplorerViewEntry[] = [];
    directories.forEach((node) => {
        const catalogue = node.facets?.catalogue ?? "other";
        const label = CATALOGUE_LABELS[catalogue] ?? catalogue;
        const root = `${label} (${counts.get(catalogue) ?? 0})`;
        const folders = [root, ...directoryGroup(node, context)];

        entries.push({ segments: [...folders, fileName(node)], path: node.publishedPath });
        const example = examplePath(node);
        if (example) {
            entries.push({ segments: [...folders, `${fileName(node)} · example`], path: example });
        }
    });

    return entries;
}

/**
 * Makes every leaf label unique within its folder.
 *
 * File names in this corpus are often generic: all 17 M-CODE recipes are `configuration.json`
 * and the recipe name is the folder above them, so grouping by facet lands four indentical
 * rows side by side. Where that happens, as much of the source path is prefixed as it takes
 * to tell them apart — `adatom/configuration.json`, `island/configuration.json`.
 */
function disambiguateLeaves(entries: ExplorerViewEntry[]): ExplorerViewEntry[] {
    const groups = new Map<string, ExplorerViewEntry[]>();
    entries.forEach((entry) => {
        const key = entry.segments.join("\u0000");
        const group = groups.get(key);
        if (group) group.push(entry);
        else groups.set(key, [entry]);
    });

    groups.forEach((group) => {
        if (group.length < 2) return;

        const directoriesOf = (entry: ExplorerViewEntry) => entry.path.split("/").slice(0, -1);
        const deepest = Math.max(...group.map((entry) => directoriesOf(entry).length));

        for (let depth = 1; depth <= deepest; depth += 1) {
            const labelled = group.map((entry) => {
                const leaf = entry.segments[entry.segments.length - 1];
                const prefix = directoriesOf(entry).slice(-depth).join("/");
                return prefix ? `${prefix}/${leaf}` : leaf;
            });

            if (new Set(labelled).size === group.length) {
                group.forEach((entry, index) => {
                    // eslint-disable-next-line no-param-reassign
                    entry.segments = [...entry.segments.slice(0, -1), labelled[index]];
                });
                return;
            }
        }
    });

    return entries;
}

function compareEntries(a: ExplorerViewEntry, b: ExplorerViewEntry): number {
    const depth = Math.min(a.segments.length, b.segments.length);
    for (let i = 0; i < depth; i += 1) {
        const order = a.segments[i].localeCompare(b.segments[i]);
        if (order !== 0) return order;
    }
    return a.segments.length - b.segments.length || a.path.localeCompare(b.path);
}

export function buildExplorerViews(graph: EntityGraph): ExplorerViews {
    const context = buildContext(graph);
    return {
        categories: disambiguateLeaves(categoriesView(graph, context)).sort(compareEntries),
        directories: disambiguateLeaves(directoriesView(graph, context)).sort(compareEntries),
    };
}

/**
 * L12 — the views stay in step with the corpus.
 *
 * A view that silently drops a schema is worse than no view: it tells the reader the corpus
 * does not contain something it does contain. Every browsable schema must appear, and every
 * row must open a file that exists.
 */
export function lintExplorerViews(graph: EntityGraph, views: ExplorerViews): string[] {
    const failures: string[] = [];

    const files = new Set<string>();
    graph.nodes.forEach((node) => {
        files.add(node.publishedPath);
        const example = examplePath(node);
        if (example) files.add(example);
    });

    const check = (name: string, entries: ExplorerViewEntry[]) => {
        const rows = new Map<string, string>();

        entries.forEach((entry) => {
            if (!files.has(entry.path)) {
                failures.push(`L12 views.json ${name}: "${entry.path}" is not a published file`);
            }
            if (entry.segments.length < 2) {
                failures.push(
                    `L12 views.json ${name}: "${entry.path}" has no folder above its leaf`,
                );
            }

            // Two rows reading the same in the same folder are indistinguishable to a
            // reader, whichever files they point at.
            const row = entry.segments.join(" / ");
            const claimed = rows.get(row);
            if (claimed && claimed !== entry.path) {
                failures.push(
                    `L12 views.json ${name}: "${row}" is used by both ${claimed} and ${entry.path}`,
                );
            }
            rows.set(row, entry.path);
        });
    };

    check("categories", views.categories);
    check("directories", views.directories);

    const countBy = (entries: ExplorerViewEntry[]) => {
        const counts = new Map<string, number>();
        entries.forEach((entry) => counts.set(entry.path, (counts.get(entry.path) ?? 0) + 1));
        return counts;
    };

    const categoryCounts = countBy(views.categories);
    graph.nodes
        .filter((node) => node.facets?.role === "vocabulary")
        .forEach((node) => {
            const seen = categoryCounts.get(node.publishedPath) ?? 0;
            if (seen !== 1) {
                failures.push(
                    `L12 views.json categories: vocabulary schema ${node.id} appears ${seen} ` +
                        `time(s), expected exactly 1`,
                );
            }
        });

    const directoryCounts = countBy(views.directories);
    graph.nodes
        .filter((node) => node.layer === "directory" && !isEnumHolder(node))
        .forEach((node) => {
            const seen = directoryCounts.get(node.publishedPath) ?? 0;
            if (seen !== 1) {
                failures.push(
                    `L12 views.json directories: catalogue entry ${node.id} appears ${seen} ` +
                        `time(s), expected exactly 1`,
                );
            }
        });

    const holders = graph.nodes.filter(isEnumHolder).map((node) => node.publishedPath);
    holders.forEach((held) => {
        if (categoryCounts.has(held) || directoryCounts.has(held)) {
            failures.push(`L12 views.json: enum holder ${held} should not be browsable`);
        }
    });

    return failures;
}

/** Writes `views.json` into the given directory, creating it when missing. */
export function writeExplorerViews(views: ExplorerViews, outputDir: string): string {
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "views.json");
    fs.writeFileSync(outputPath, `${JSON.stringify(views, null, 4)}\n`, "utf8");
    return outputPath;
}
