/**
 * Builds the schema reference graph and reports lint findings.
 *
 * Usage:
 *   ts-node build_entity_graph.ts                      # lint only, no asset written
 *   ts-node build_entity_graph.ts --output ./site      # lint and write <output>/graph.json
 */
import {
    buildEntityGraph,
    validateEntityGraph,
    writeEntityGraph,
} from "./src/js/scripts/buildEntityGraph";

function getOutputDir(argv: string[]): string | undefined {
    const index = argv.indexOf("--output");
    if (index === -1) return undefined;

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
        throw new Error("--output requires a directory argument");
    }
    return value;
}

const outputDir = getOutputDir(process.argv.slice(2));
const { graph, lint } = buildEntityGraph();
const failures = [...lint.failures, ...validateEntityGraph(graph)];

const { nodeCount, edgeCount, edgeCountsByKind, sameDocumentRefCount } = graph.meta;
console.log(
    `Entity graph: ${nodeCount} schemas, ${edgeCount} references ` +
        `(${edgeCountsByKind.extends} extends, ${edgeCountsByKind.contains} contains, ` +
        `${edgeCountsByKind.variant} variant) plus ${sameDocumentRefCount} same-document refs.`,
);

lint.warnings.forEach((warning) => console.warn(`WARNING: ${warning}`));

if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAILURE: ${failure}`));
    console.error(`\nSchema lint failed with ${failures.length} problem(s).`);
    process.exit(1);
}

if (outputDir) {
    console.log(`Wrote ${writeEntityGraph(graph, outputDir)}`);
}

console.log("Schema lint passed.");
