import { expect } from "chai";

import { type EntityGraph, buildEntityGraph } from "../../src/js/scripts/buildEntityGraph";
import {
    type ExplorerViewEntry,
    type ExplorerViews,
    buildExplorerViews,
    lintExplorerViews,
} from "../../src/js/scripts/buildExplorerViews";

/**
 * Distinct schemas reachable in each view. Categories is 73 vocabulary schemas + the 17
 * catalogue entries filed under them + 17 M-CODE recipes + 25 component entities + 5
 * operations; Directories is every catalogue entry that is not an enum holder.
 */
const EXPECTED_CATEGORY_SCHEMAS = 137;
const EXPECTED_DIRECTORY_SCHEMAS = 153;

const EXPECTED_CATEGORY_ROOTS = ["Materials · M-CODE", "Methods · CateCom", "Models · CateCom"];
const EXPECTED_DIRECTORY_ROOTS = [
    "Context providers (21)",
    "Methods (23)",
    "Models (14)",
    "Properties (84)",
    "Software (11)",
];

function row(entry: ExplorerViewEntry): string {
    return entry.segments.join(" / ");
}

function schemaRows(entries: ExplorerViewEntry[]): ExplorerViewEntry[] {
    return entries.filter((entry) => entry.path.startsWith("schema/"));
}

function rowsFor(entries: ExplorerViewEntry[], publishedPath: string): string[] {
    return entries.filter((entry) => entry.path === publishedPath).map(row);
}

describe("buildExplorerViews", () => {
    let graph: EntityGraph;
    let views: ExplorerViews;

    before(() => {
        ({ graph } = buildEntityGraph());
        views = buildExplorerViews(graph);
    });

    it("browses every vocabulary schema and every catalogue entry", () => {
        expect(new Set(schemaRows(views.categories).map((entry) => entry.path)).size).to.equal(
            EXPECTED_CATEGORY_SCHEMAS,
        );
        expect(new Set(schemaRows(views.directories).map((entry) => entry.path)).size).to.equal(
            EXPECTED_DIRECTORY_SCHEMAS,
        );
    });

    it("groups each view under the roots the navigation promises", () => {
        const roots = (entries: ExplorerViewEntry[]) =>
            [...new Set(entries.map((entry) => entry.segments[0]))].sort();

        expect(roots(views.categories)).to.deep.equal(EXPECTED_CATEGORY_ROOTS);
        expect(roots(views.directories)).to.deep.equal(EXPECTED_DIRECTORY_ROOTS);
    });

    it("opens only files the site actually publishes", () => {
        const files = new Set<string>();
        graph.nodes.forEach((node) => {
            files.add(node.publishedPath);
            if (node.hasExample) files.add(node.publishedPath.replace(/^schema\//, "example/"));
        });

        [...views.categories, ...views.directories].forEach((entry) => {
            expect(files.has(entry.path), `${row(entry)} -> ${entry.path}`).to.be.true;
        });
    });

    /**
     * Two rows that read the same in the same folder are indistinguishable, whichever files
     * they point at. All 17 M-CODE recipes are named `configuration.json`, so grouping them
     * by facet collides until the recipe name is pulled in from the folder above.
     */
    it("gives every row a label unique within its folder", () => {
        [views.categories, views.directories].forEach((entries) => {
            const rows = entries.map(row);
            expect(new Set(rows).size, `${rows.length} rows`).to.equal(rows.length);
        });

        expect(views.categories.map(row)).to.include(
            "Materials · M-CODE / by operation / merge / island/configuration.json",
        );
    });

    /**
     * The ladder comes from the `allOf` chain, not from the path or from which facet fields
     * are set. `methods_directory/mathematical/regression` narrows a lower field than its
     * depth implies and carries no `tier1`, so either shortcut would misplace it.
     */
    it("places a catalogue entry at the coordinate it is filed under", () => {
        expect(rowsFor(views.categories, "schema/models_directory/gga.json")).to.deep.equal([
            "Models · CateCom / pb · physics-based model / qm · Quantum mechanical / " +
                "dft · Density functional theory / ksdft · Kohn-Sham DFT / " +
                "gga · DFT GGA functional / models_directory/gga.json",
        ]);

        expect(rowsFor(views.directories, "schema/models_directory/gga.json")).to.deep.equal([
            "Models (14) / pb / qm / dft / ksdft / gga / gga.json",
        ]);

        expect(
            rowsFor(views.directories, "schema/methods_directory/mathematical/regression.json"),
        ).to.deep.equal(["Methods (23) / mathematical / regression / regression.json"]);
    });

    it("files an entry with no categories property under uncategorized", () => {
        const uncategorized = schemaRows(views.directories).filter((entry) =>
            entry.segments.includes("uncategorized"),
        );

        expect(uncategorized.map((entry) => entry.path)).to.include(
            "schema/methods_directory/mathematical/regression/data.json",
        );
        // Every one of them genuinely lacks the edge, rather than being dropped by a bug.
        const filed = new Set(
            graph.edges
                .filter((edge) => edge.kind === "contains" && edge.label === "categories")
                .map((edge) => edge.source),
        );
        const byPath = new Map(graph.nodes.map((node) => [node.publishedPath, node]));
        uncategorized.forEach((entry) => {
            const node = byPath.get(entry.path);
            expect(filed.has(node?.id ?? ""), `${entry.path} is filed but shown as uncategorized`)
                .to.be.false;
        });
    });

    /** M-CODE's axes are orthogonal, so a recipe is reachable by each axis it has a value for. */
    it("repeats a recipe once per M-CODE axis it carries", () => {
        const slab = rowsFor(
            views.categories,
            "schema/materials_category/pristine_structures/two_dimensional/slab.json",
        );
        expect(slab).to.have.lengthOf(3);
        expect(slab.some((entry) => entry.includes("by operation / stack"))).to.be.true;

        // `ideal-crystal` names no operation, so it is absent from that axis only.
        const ideal = rowsFor(
            views.categories,
            "schema/materials_category/pristine_structures/three_dimensional/ideal_crystal.json",
        );
        expect(ideal).to.have.lengthOf(2);
        expect(ideal.every((entry) => !entry.includes("by operation"))).to.be.true;
    });

    it("leaves enum holders out of both views", () => {
        const holders = new Set(
            graph.nodes
                .filter((node) => node.facets?.role === "enum-options")
                .map((node) => node.publishedPath),
        );
        expect(holders.size).to.be.greaterThan(0);

        [...views.categories, ...views.directories].forEach((entry) => {
            expect(holders.has(entry.path), `${entry.path} is plumbing, not a browsable schema`).to
                .be.false;
        });
    });

    it("offers the example beside the schema that has one", () => {
        const examples = views.directories.filter((entry) => entry.path.startsWith("example/"));
        expect(examples.length).to.be.greaterThan(0);

        examples.forEach((entry) => {
            const leaf = entry.segments[entry.segments.length - 1];
            expect(leaf.endsWith(" · example"), leaf).to.be.true;

            // The example sits in the same folder as its schema.
            const schemaPath = entry.path.replace(/^example\//, "schema/");
            const folder = entry.segments.slice(0, -1).join(" / ");
            const siblings = views.directories
                .filter((other) => other.path === schemaPath)
                .map((other) => other.segments.slice(0, -1).join(" / "));
            expect(siblings, `${entry.path} has no schema beside it`).to.include(folder);
        });
    });

    it("is deterministic", () => {
        expect(buildExplorerViews(graph)).to.deep.equal(views);
    });

    it("reports no L12 findings for the corpus as it stands", () => {
        expect(lintExplorerViews(graph, views)).to.deep.equal([]);
    });
});

describe("lintExplorerViews", () => {
    let graph: EntityGraph;

    before(() => {
        ({ graph } = buildEntityGraph());
    });

    it("catches a row pointing at a file that is not published", () => {
        const views = buildExplorerViews(graph);
        views.categories.push({
            segments: ["Models · CateCom", "ghost.json"],
            path: "schema/ghost.json",
        });

        expect(lintExplorerViews(graph, views).join("\n")).to.match(/is not a published file/);
    });

    it("catches a vocabulary schema that no longer appears", () => {
        const views = buildExplorerViews(graph);
        const dropped = views.categories.findIndex(
            (entry) => entry.path === "schema/models_category/pb.json",
        );
        views.categories.splice(dropped, 1);

        expect(lintExplorerViews(graph, views).join("\n")).to.match(
            /vocabulary schema models-category\/pb appears 0 time\(s\)/,
        );
    });

    it("catches two rows that read the same in one folder", () => {
        const views = buildExplorerViews(graph);
        const [first, second] = views.directories.filter((entry) =>
            entry.path.startsWith("schema/"),
        );
        second.segments = [...first.segments];

        expect(lintExplorerViews(graph, views).join("\n")).to.match(/is used by both/);
    });
});
