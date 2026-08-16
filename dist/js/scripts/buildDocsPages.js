"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFrontMatter = parseFrontMatter;
exports.expandFragments = expandFragments;
exports.buildDocsPages = buildDocsPages;
/**
 * Renders the concept documentation in `docs/` to static HTML for the site.
 *
 * Deliberately small: `marked` plus the site's own chrome, no static site generator.
 * Ten pages do not justify a toolchain, and the repository's web surface is otherwise
 * build-free.
 *
 * Pages may embed generated fragments (`<!-- generated:name -->`), which are expanded from
 * the entity graph at build time. Prose stays prose in git while the published pages carry
 * live numbers, so the documentation cannot quietly drift from the schemas it describes.
 */
const fs_1 = __importDefault(require("fs"));
const marked_1 = require("marked");
const path_1 = __importDefault(require("path"));
const buildEntityGraph_1 = require("./buildEntityGraph");
const REPOSITORY_ROOT = path_1.default.resolve(__dirname, "../../../");
const DOCS_SOURCE_DIR = path_1.default.join(REPOSITORY_ROOT, "docs");
/** Splits a leading `---` block off the document. Enough for title/order/summary. */
function parseFrontMatter(source) {
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match)
        return { data: {}, body: source };
    const data = {};
    match[1].split(/\r?\n/).forEach((line) => {
        const separator = line.indexOf(":");
        if (separator === -1)
            return;
        data[line.slice(0, separator).trim()] = line
            .slice(separator + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
    });
    return { data, body: source.slice(match[0].length) };
}
// ── Generated fragments ───────────────────────────────────────────────────────
function mapLink(id) {
    return `[\`${id}\`](../map/#/entity/${encodeURIComponent(id)})`;
}
function table(headers, rows) {
    return [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.join(" | ")} |`),
    ].join("\n");
}
function relationshipFragment(graph, id) {
    const node = graph.nodes.find((candidate) => candidate.id === id);
    if (!node)
        throw new Error(`entity-relationships fragment references unknown schema "${id}"`);
    const describe = (kind, direction) => graph.edges
        .filter((edge) => edge.kind === kind && edge[direction === "target" ? "source" : "target"] === id)
        .map((edge) => {
        const other = direction === "target" ? edge.target : edge.source;
        return `${mapLink(other)}${edge.label ? ` \`${edge.label}\`` : ""}`;
    });
    const sections = [];
    const extendsList = describe("extends", "target");
    const containsList = describe("contains", "target");
    const variantList = describe("variant", "target");
    const usedBy = graph.edges
        .filter((edge) => edge.target === id)
        .map((edge) => mapLink(edge.source));
    if (extendsList.length)
        sections.push(`**Extends** — ${extendsList.join(", ")}`);
    if (containsList.length)
        sections.push(`**Contains** — ${containsList.join(", ")}`);
    if (variantList.length > 0) {
        sections.push(variantList.length > 12
            ? `**Variants** — ${variantList.length} schemas, see the map`
            : `**Variants** — ${variantList.join(", ")}`);
    }
    if (usedBy.length) {
        sections.push(usedBy.length > 12
            ? `**Used by** — ${usedBy.length} schemas, see the map`
            : `**Used by** — ${usedBy.join(", ")}`);
    }
    return sections.length ? sections.map((line) => `${line}\n`).join("\n") : "_No references._";
}
function mixinUsageFragment(graph) {
    const mixins = new Map();
    graph.edges
        .filter((edge) => edge.kind === "extends")
        .forEach((edge) => {
        const target = graph.nodes.find((node) => node.id === edge.target);
        if (!target || (target.layer !== "in-memory-entity" && target.layer !== "system"))
            return;
        if (!mixins.has(edge.target))
            mixins.set(edge.target, []);
        mixins.get(edge.target).push(edge.source);
    });
    const rows = [...mixins.entries()]
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
        .slice(0, 15)
        .map(([mixin, users]) => [mapLink(mixin), String(users.length)]);
    return table(["Mixin", "Schemas extending it"], rows);
}
function layerInventoryFragment(graph) {
    const rows = Object.entries(graph.meta.layerCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([layer, count]) => [`\`${layer}\``, String(count)]);
    return table(["Layer", "Schemas"], rows);
}
function hubTableFragment(graph) {
    const rows = [...graph.nodes]
        .sort((a, b) => b.inDegree - a.inDegree || a.id.localeCompare(b.id))
        .slice(0, 10)
        .map((node) => [mapLink(node.id), String(node.inDegree)]);
    return table(["Schema", "Referenced by"], rows);
}
function expandFragments(body, graph) {
    return body.replace(/<!--\s*generated:([^\s]+)\s*-->/g, (_match, name) => {
        const [fragment, argument] = name.split(":");
        switch (fragment) {
            case "corpus-totals":
                return table(["Schemas", "References", "extends", "contains", "variant"], [
                    [
                        String(graph.meta.nodeCount),
                        String(graph.meta.edgeCount),
                        String(graph.meta.edgeCountsByKind.extends),
                        String(graph.meta.edgeCountsByKind.contains),
                        String(graph.meta.edgeCountsByKind.variant),
                    ],
                ]);
            case "layer-inventory":
                return layerInventoryFragment(graph);
            case "hub-table":
                return hubTableFragment(graph);
            case "mixin-usage":
                return mixinUsageFragment(graph);
            case "example-coverage":
                return `${graph.meta.schemasWithExample} of ${graph.meta.nodeCount} schemas (${Math.round((graph.meta.schemasWithExample / graph.meta.nodeCount) * 100)}%) have a mirror example`;
            case "entity-relationships":
                return relationshipFragment(graph, argument);
            default:
                throw new Error(`Unknown generated fragment "${name}"`);
        }
    });
}
// ── Rendering ─────────────────────────────────────────────────────────────────
function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderPage(page, pages, html) {
    const nav = pages
        .map((item) => `<a href="${item.slug}.html"${item.slug === page.slug ? ' class="current"' : ""}>` +
        `${escapeHtml(item.title)}</a>`)
        .join("\n            ");
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(page.title)} — ESSE</title>
    <meta name="description" content="${escapeHtml(page.summary)}">
    <link rel="stylesheet" href="docs.css">
</head>
<body>
<div id="titlebar">
    <span class="app-name">ESSE</span>
    <nav id="surfaces">
        <a href="index.html" class="current">Docs</a>
        <a href="../index.html">Explorer</a>
        <a href="../map/index.html">Map</a>
    </nav>
</div>
<div id="workspace">
    <aside id="docs-nav">
        <div class="nav-title">Concepts</div>
        <nav>
            ${nav}
        </nav>
    </aside>
    <main id="docs-content">
        <article>
${html}
    </article>
    </main>
</div>
</body>
</html>
`;
}
const DOCS_STYLESHEET = `/* Concept documentation — shares the explorer's palette. */
:root {
    --bg-editor: #1e1e1e;
    --bg-sidebar: #252526;
    --bg-inactive: #2d2d2d;
    --bg-hover: #2a2d2e;
    --text-primary: #d4d4d4;
    --text-secondary: #abb2bf;
    --text-muted: #858585;
    --border: #3e3e3e;
    --accent: #4ea1ff;
    --code: #9cdcfe;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg-editor);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    line-height: 1.6;
}
#titlebar {
    height: 34px;
    background: #323233;
    border-bottom: 1px solid #111;
    display: flex;
    align-items: center;
    padding: 0 14px;
    gap: 16px;
    font-size: 13px;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 5;
}
#titlebar .app-name { color: var(--text-primary); font-weight: 600; }
#surfaces { display: flex; gap: 14px; }
#surfaces a { color: var(--text-muted); text-decoration: none; }
#surfaces a:hover { color: var(--text-primary); }
#surfaces a.current { color: var(--text-primary); border-bottom: 2px solid var(--accent); }
#workspace { display: flex; flex: 1; align-items: flex-start; }
#docs-nav {
    width: 250px;
    flex-shrink: 0;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    padding: 16px 0;
    position: sticky;
    top: 34px;
    align-self: stretch;
}
.nav-title {
    padding: 0 16px 8px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
}
#docs-nav nav { display: flex; flex-direction: column; }
#docs-nav a {
    padding: 6px 16px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 13px;
    border-left: 2px solid transparent;
}
#docs-nav a:hover { background: var(--bg-hover); color: var(--text-primary); }
#docs-nav a.current {
    background: var(--bg-inactive);
    color: var(--text-primary);
    border-left-color: var(--accent);
}
#docs-content { flex: 1; min-width: 0; padding: 32px 40px 80px; }
article { max-width: 68ch; }
article h1 { font-size: 27px; font-weight: 600; margin-bottom: 18px; text-wrap: balance; }
article h2 {
    font-size: 19px;
    font-weight: 600;
    margin: 30px 0 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
    text-wrap: balance;
}
article h3 { font-size: 15px; font-weight: 600; margin: 20px 0 6px; }
article p, article ul, article ol { margin-bottom: 13px; }
article ul, article ol { padding-left: 22px; }
article li { margin-bottom: 4px; }
article a { color: var(--accent); text-decoration: none; }
article a:hover { text-decoration: underline; }
article code {
    font-family: 'SF Mono', Menlo, Consolas, monospace;
    font-size: 0.87em;
    background: var(--bg-inactive);
    color: var(--code);
    padding: 1px 5px;
    border-radius: 3px;
}
article pre {
    background: var(--bg-sidebar);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 12px 14px;
    overflow-x: auto;
    margin-bottom: 14px;
}
article pre code { background: none; padding: 0; color: var(--text-primary); font-size: 12.5px; }
article blockquote {
    border-left: 3px solid var(--accent);
    padding: 2px 0 2px 14px;
    margin-bottom: 14px;
    color: var(--text-secondary);
}
.table-wrap { overflow-x: auto; margin-bottom: 16px; }
article table { border-collapse: collapse; font-size: 13px; min-width: 100%; }
article th, article td {
    border: 1px solid var(--border);
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
}
article th { background: var(--bg-sidebar); font-weight: 600; }
article td:not(:first-child) { font-variant-numeric: tabular-nums; }
article hr { border: none; border-top: 1px solid var(--border); margin: 26px 0; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 760px) {
    #workspace { flex-direction: column; }
    #docs-nav { width: 100%; position: static; border-right: none; border-bottom: 1px solid var(--border); }
    #docs-content { padding: 20px; }
}
`;
// ── Entry point ───────────────────────────────────────────────────────────────
function buildDocsPages(outputDir) {
    const { graph } = (0, buildEntityGraph_1.buildEntityGraph)();
    const pages = fs_1.default
        .readdirSync(DOCS_SOURCE_DIR)
        .filter((entry) => entry.endsWith(".md"))
        .map((entry) => {
        var _a, _b;
        const source = fs_1.default.readFileSync(path_1.default.join(DOCS_SOURCE_DIR, entry), "utf-8");
        const { data, body } = parseFrontMatter(source);
        if (!data.title)
            throw new Error(`docs/${entry} is missing a "title" in front matter`);
        return {
            slug: entry.replace(/^\d+-/, "").replace(/\.md$/, ""),
            title: data.title,
            order: Number((_a = data.order) !== null && _a !== void 0 ? _a : 999),
            summary: (_b = data.summary) !== null && _b !== void 0 ? _b : "",
            body,
        };
    })
        .sort((a, b) => a.order - b.order);
    // Render everything before writing anything: an unknown fragment or a broken page
    // should fail the build outright, not leave a half-written site behind.
    const rendered = pages.map((page) => {
        const expanded = expandFragments(page.body, graph);
        const html = marked_1.marked.parse(expanded, { async: false })
            // Wide tables scroll inside their own container rather than the page body.
            .replace(/<table>/g, '<div class="table-wrap"><table>')
            .replace(/<\/table>/g, "</table></div>");
        return { page, html: renderPage(page, pages, html) };
    });
    const targetDir = path_1.default.join(outputDir, "docs");
    fs_1.default.mkdirSync(targetDir, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(targetDir, "docs.css"), DOCS_STYLESHEET, "utf8");
    rendered.forEach(({ page, html }) => {
        fs_1.default.writeFileSync(path_1.default.join(targetDir, `${page.slug}.html`), html, "utf8");
    });
    return pages;
}
