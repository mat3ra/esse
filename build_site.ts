/**
 * Assembles the published site into a staging directory.
 *
 * This is the deploy job's "Build", "Generate concept documentation" and "Generate Schema
 * Explorer and Entity Map" steps expressed once, so a Netlify deploy preview and GitHub
 * Pages build the same tree from the same code. It assumes `npm run transpile-and-build-assets`
 * has already produced `dist/js`.
 *
 * Usage:
 *   ts-node build_site.ts                 # assemble ./site
 *   ts-node build_site.ts --output ./out  # assemble elsewhere
 */
import fs from "fs";
import path from "path";

import { buildDocsPages } from "./src/js/scripts/buildDocsPages";
import {
    buildEntityGraph,
    validateEntityGraph,
    writeEntityGraph,
} from "./src/js/scripts/buildEntityGraph";

const DIST = path.resolve(__dirname, "dist/js");
const HTML = path.resolve(__dirname, "src/html");

function getOutputDir(argv: string[]): string {
    const index = argv.indexOf("--output");
    const value = index === -1 ? undefined : argv[index + 1];
    if (index !== -1 && (!value || value.startsWith("--"))) {
        throw new Error("--output requires a directory argument");
    }
    return path.resolve(__dirname, value ?? "site");
}

/** Every `.json` under `directory`, as site-relative posix paths, sorted. */
function collectJson(directory: string, base: string): string[] {
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))
        .flatMap((entry) => {
            const full = path.join(directory, entry.name);
            const relative = base ? `${base}/${entry.name}` : entry.name;
            if (entry.isDirectory()) return collectJson(full, relative);
            return entry.name.endsWith(".json") ? [relative] : [];
        });
}

const outputDir = getOutputDir(process.argv.slice(2));

if (!fs.existsSync(DIST)) {
    throw new Error(`${DIST} is missing — run "npm run transpile-and-build-assets" first`);
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

// Resolved schemas and examples, as the explorer consumes them.
fs.cpSync(path.join(DIST, "schema"), path.join(outputDir, "schema"), { recursive: true });
fs.cpSync(path.join(DIST, "example"), path.join(outputDir, "example"), { recursive: true });
fs.copyFileSync(path.join(DIST, "schemas.json"), path.join(outputDir, "schemas.json"));

// The entity graph, which the ontology map and the docs fragments both read.
const { graph, lint } = buildEntityGraph();
const failures = [...lint.failures, ...validateEntityGraph(graph)];
lint.warnings.forEach((warning) => console.warn(`WARNING: ${warning}`));
if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAILURE: ${failure}`));
    throw new Error(`Schema lint failed with ${failures.length} problem(s)`);
}
console.log(`Wrote ${writeEntityGraph(graph, outputDir)}`);

const pages = buildDocsPages(outputDir);
console.log(`Rendered ${pages.length} documentation page(s) to ${outputDir}/docs`);

// Schema explorer and ontology map.
["index.html", "style.css", "app.js"].forEach((file) =>
    fs.copyFileSync(path.join(HTML, file), path.join(outputDir, file)),
);
fs.cpSync(path.join(HTML, "map"), path.join(outputDir, "map"), { recursive: true });

const files = [
    ...collectJson(path.join(outputDir, "schema"), "schema"),
    ...collectJson(path.join(outputDir, "example"), "example"),
];
fs.writeFileSync(path.join(outputDir, "files.json"), JSON.stringify(files, null, 2), "utf8");
console.log(`Generated files.json with ${files.length} entries`);
console.log(`Site assembled at ${outputDir}`);
