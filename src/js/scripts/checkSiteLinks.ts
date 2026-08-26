/**
 * Verifies that every internal link in the assembled site resolves.
 *
 * The site is stitched together from four sources — resolved schemas, the concept docs, the
 * explorer and the Entity Map — each of which links into the others. Nothing else checks that
 * those links land anywhere, and a stale href is invisible until someone clicks it.
 *
 * External URLs are not fetched; this is a build step, not a crawler.
 */
import fs from "fs";
import path from "path";

export interface SiteLinkProblem {
    page: string;
    href: string;
    reason: string;
}

const HREF_PATTERN = /(?:href|src)\s*=\s*"([^"]+)"/g;

function listFiles(directory: string, extension: string): string[] {
    if (!fs.existsSync(directory)) return [];

    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listFiles(entryPath, extension);
        return entry.name.endsWith(extension) ? [entryPath] : [];
    });
}

/** True for anything this build step cannot or should not resolve on disk. */
function isExternal(href: string): boolean {
    return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//") || href.startsWith("data:");
}

export function checkSiteLinks(siteDir: string): SiteLinkProblem[] {
    const problems: SiteLinkProblem[] = [];
    const pages = listFiles(siteDir, ".html");

    if (pages.length === 0) {
        return [{ page: siteDir, href: "", reason: "no HTML pages found — was the site built?" }];
    }

    pages.forEach((page) => {
        const html = fs.readFileSync(page, "utf-8");
        const seen = new Set<string>();

        Array.from(html.matchAll(HREF_PATTERN)).forEach((match) => {
            const href = match[1];
            if (seen.has(href)) return;
            seen.add(href);

            if (isExternal(href) || href.startsWith("#") || href.trim() === "") return;

            // Only the path part is checked; in-page fragments and the map's hash routes are
            // resolved by the browser, not the filesystem.
            const [pathPart] = href.split("#");
            if (!pathPart) return;

            const target = path.resolve(path.dirname(page), pathPart);
            const relativePage = path.relative(siteDir, page);

            if (!target.startsWith(path.resolve(siteDir))) {
                problems.push({
                    page: relativePage,
                    href,
                    reason: "escapes the site directory",
                });
                return;
            }

            const resolved =
                fs.existsSync(target) && fs.statSync(target).isDirectory()
                    ? path.join(target, "index.html")
                    : target;

            if (!fs.existsSync(resolved)) {
                problems.push({ page: relativePage, href, reason: "target does not exist" });
            }
        });
    });

    return problems;
}
