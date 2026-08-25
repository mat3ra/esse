/**
 * Renders the concept documentation in `docs/` to the site.
 *
 * Usage:
 *   ts-node build_docs_pages.ts --output ./site
 */
import { buildDocsPages } from "./src/js/scripts/buildDocsPages";

function getOutputDir(argv: string[]): string {
    const index = argv.indexOf("--output");
    const value = index === -1 ? undefined : argv[index + 1];

    if (!value || value.startsWith("--")) {
        throw new Error("--output <directory> is required");
    }
    return value;
}

const outputDir = getOutputDir(process.argv.slice(2));
const pages = buildDocsPages(outputDir);

console.log(`Rendered ${pages.length} documentation page(s) to ${outputDir}/docs:`);
pages.forEach((page) => console.log(`  ${String(page.order).padStart(2, " ")}. ${page.slug}`));
