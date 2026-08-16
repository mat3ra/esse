"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSiteLinks = checkSiteLinks;
/**
 * Verifies that every internal link in the assembled site resolves.
 *
 * The site is stitched together from four sources — resolved schemas, the concept docs, the
 * explorer and the Entity Map — each of which links into the others. Nothing else checks that
 * those links land anywhere, and a stale href is invisible until someone clicks it.
 *
 * External URLs are not fetched; this is a build step, not a crawler.
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const HREF_PATTERN = /(?:href|src)\s*=\s*"([^"]+)"/g;
function listFiles(directory, extension) {
    if (!fs_1.default.existsSync(directory))
        return [];
    return fs_1.default.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path_1.default.join(directory, entry.name);
        if (entry.isDirectory())
            return listFiles(entryPath, extension);
        return entry.name.endsWith(extension) ? [entryPath] : [];
    });
}
/** True for anything this build step cannot or should not resolve on disk. */
function isExternal(href) {
    return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//") || href.startsWith("data:");
}
function checkSiteLinks(siteDir) {
    const problems = [];
    const pages = listFiles(siteDir, ".html");
    if (pages.length === 0) {
        return [{ page: siteDir, href: "", reason: "no HTML pages found — was the site built?" }];
    }
    pages.forEach((page) => {
        const html = fs_1.default.readFileSync(page, "utf-8");
        const seen = new Set();
        Array.from(html.matchAll(HREF_PATTERN)).forEach((match) => {
            const href = match[1];
            if (seen.has(href))
                return;
            seen.add(href);
            if (isExternal(href) || href.startsWith("#") || href.trim() === "")
                return;
            // Only the path part is checked; in-page fragments and the map's hash routes are
            // resolved by the browser, not the filesystem.
            const [pathPart] = href.split("#");
            if (!pathPart)
                return;
            const target = path_1.default.resolve(path_1.default.dirname(page), pathPart);
            const relativePage = path_1.default.relative(siteDir, page);
            if (!target.startsWith(path_1.default.resolve(siteDir))) {
                problems.push({
                    page: relativePage,
                    href,
                    reason: "escapes the site directory",
                });
                return;
            }
            const resolved = fs_1.default.existsSync(target) && fs_1.default.statSync(target).isDirectory()
                ? path_1.default.join(target, "index.html")
                : target;
            if (!fs_1.default.existsSync(resolved)) {
                problems.push({ page: relativePage, href, reason: "target does not exist" });
            }
        });
    });
    return problems;
}
