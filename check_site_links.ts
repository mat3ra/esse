/**
 * Fails the build when an internal link in the assembled site does not resolve.
 *
 * Usage:
 *   ts-node check_site_links.ts --site ./site
 */
import { checkSiteLinks } from "./src/js/scripts/checkSiteLinks";

function getSiteDir(argv: string[]): string {
    const index = argv.indexOf("--site");
    const value = index === -1 ? undefined : argv[index + 1];

    if (!value || value.startsWith("--")) {
        throw new Error("--site <directory> is required");
    }
    return value;
}

const siteDir = getSiteDir(process.argv.slice(2));
const problems = checkSiteLinks(siteDir);

if (problems.length > 0) {
    problems.forEach(({ page, href, reason }) =>
        console.error(`BROKEN: ${page} -> ${href} (${reason})`),
    );
    console.error(`\n${problems.length} broken internal link(s) in ${siteDir}.`);
    process.exit(1);
}

console.log(`All internal links resolve in ${siteDir}.`);
