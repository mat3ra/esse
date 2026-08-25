import { expect } from "chai";
import fs from "fs";
import path from "path";

import { expandFragments, parseFrontMatter } from "../../src/js/scripts/buildDocsPages";
import { type EntityGraph, buildEntityGraph } from "../../src/js/scripts/buildEntityGraph";

const DOCS_DIR = path.resolve(__dirname, "../../docs");
const FRAGMENT_PATTERN = /<!--\s*generated:([^\s]+)\s*-->/g;

function docsSources(): { file: string; source: string }[] {
    return fs
        .readdirSync(DOCS_DIR)
        .filter((file) => file.endsWith(".md"))
        .sort()
        .map((file) => ({ file, source: fs.readFileSync(path.join(DOCS_DIR, file), "utf-8") }));
}

describe("expandFragments", () => {
    let graph: EntityGraph;

    before(() => {
        ({ graph } = buildEntityGraph());
    });

    /**
     * Every fragment name in the docs is expanded at deploy time, and an unknown name
     * throws. Without this the typo surfaces in the Pages job rather than on the PR.
     */
    it("expands every fragment the documentation actually references", () => {
        docsSources().forEach(({ file, source }) => {
            const { body } = parseFrontMatter(source);
            expect(() => expandFragments(body, graph), file).to.not.throw();
        });
    });

    it("leaves no fragment markers behind after expansion", () => {
        docsSources().forEach(({ file, source }) => {
            const { body } = parseFrontMatter(source);
            expect(expandFragments(body, graph).match(FRAGMENT_PATTERN), file).to.equal(null);
        });
    });

    it("rejects an unknown fragment name rather than emitting it verbatim", () => {
        expect(() => expandFragments("<!-- generated:not-a-fragment -->", graph)).to.throw(
            /Unknown generated fragment/,
        );
    });

    /**
     * The categorization page turns on materials using no tiers. If a materials schema
     * ever adopts `core/reusable/categories`, the prose is wrong and this fails first.
     */
    it("reports tiers for models and methods but composition for materials", () => {
        const rendered = expandFragments("<!-- generated:categorization-schemes -->", graph);

        expect(rendered).to.match(/\|\s*`models-category`\s*\|\s*\d+\s*\|\s*\d+ tiered/);
        expect(rendered).to.match(/\|\s*`methods-category`\s*\|\s*\d+\s*\|\s*\d+ tiered/);
        expect(rendered).to.match(
            /\|\s*`materials-category`\s*\|\s*\d+\s*\|\s*none — compositional/,
        );
        expect(rendered).to.contain("method/unit-method");
        expect(rendered).to.contain("model/model-without-method");
    });
});

describe("parseFrontMatter", () => {
    it("requires a title, order, and summary on every documentation page", () => {
        const orders = docsSources().map(({ file, source }) => {
            const { data } = parseFrontMatter(source);
            expect(data.title, `${file} title`).to.be.a("string").and.not.empty;
            expect(data.summary, `${file} summary`).to.be.a("string").and.not.empty;
            expect(Number(data.order), `${file} order`).to.be.a("number").and.not.NaN;
            return Number(data.order);
        });

        // Duplicate orders would make the navigation sequence ambiguous.
        expect(new Set(orders).size, "orders are unique").to.equal(orders.length);
    });
});
