import { expect } from "chai";

import {
    type EntityGraph,
    type EntityGraphLintResult,
    buildEntityGraph,
    buildPublishedPathIndex,
    classifyLayer,
    collectReferences,
    publishedPathToSchemaId,
    resolveJsonPointer,
    schemaIdToPublishedPath,
    validateEntityGraph,
} from "../../src/js/scripts/buildEntityGraph";

/**
 * Baseline counts for the current corpus. When schemas are added or removed these
 * change on purpose: update the numbers in the same commit that changes the schemas,
 * and keep plan/context/2026-08-16-schema-graph-measurements.md in step.
 */
const EXPECTED_NODE_COUNT = 573;
const EXPECTED_EDGE_COUNT = 943;
const EXPECTED_EDGE_COUNTS_BY_KIND = { extends: 380, contains: 385, variant: 178 };
const EXPECTED_SAME_DOCUMENT_REFS = 20;
const EXPECTED_LAYER_COUNTS = {
    abstract: 9,
    "application-parsing": 17,
    category: 152,
    definition: 4,
    directory: 162,
    entity: 13,
    "entity-component": 106,
    "in-memory-entity": 7,
    primitive: 23,
    reference: 11,
    reusable: 31,
    system: 38,
};

describe("buildEntityGraph", () => {
    let graph: EntityGraph;
    let lint: EntityGraphLintResult;

    before(() => {
        ({ graph, lint } = buildEntityGraph());
    });

    it("reports no lint failures for the current schemas", () => {
        expect(lint.failures, lint.failures.join("\n")).to.deep.equal([]);
    });

    it("matches the recorded node and edge baseline", () => {
        expect(graph.meta.nodeCount).to.equal(EXPECTED_NODE_COUNT);
        expect(graph.nodes).to.have.lengthOf(EXPECTED_NODE_COUNT);
        expect(graph.meta.edgeCount).to.equal(EXPECTED_EDGE_COUNT);
        expect(graph.edges).to.have.lengthOf(EXPECTED_EDGE_COUNT);
    });

    it("partitions every edge into exactly one relationship kind", () => {
        expect(graph.meta.edgeCountsByKind).to.deep.equal(EXPECTED_EDGE_COUNTS_BY_KIND);

        const sum = Object.values(EXPECTED_EDGE_COUNTS_BY_KIND).reduce((a, b) => a + b, 0);
        expect(sum).to.equal(EXPECTED_EDGE_COUNT);
    });

    it("counts same-document refs separately from edges", () => {
        expect(graph.meta.sameDocumentRefCount).to.equal(EXPECTED_SAME_DOCUMENT_REFS);
        // Same-document refs must never become edges pointing a schema at itself.
        expect(graph.edges.filter((edge) => edge.source === edge.target)).to.deep.equal([]);
    });

    it("classifies every schema into a layer, with no catch-all bucket", () => {
        expect(graph.meta.layerCounts).to.deep.equal(EXPECTED_LAYER_COUNTS);

        const classified = Object.values(EXPECTED_LAYER_COUNTS).reduce((a, b) => a + b, 0);
        expect(classified).to.equal(EXPECTED_NODE_COUNT);
        graph.nodes.forEach((node) => expect(classifyLayer(node.id), node.id).to.not.be.undefined);
    });

    it("records the expected relationships for known schemas", () => {
        const edgesFrom = (id: string) => graph.edges.filter((edge) => edge.source === id);

        expect(
            edgesFrom("material").some(
                (edge) =>
                    edge.target === "in-memory-entity/named-defaultable" && edge.kind === "extends",
            ),
            "material extends in-memory-entity/named-defaultable",
        ).to.be.true;

        expect(
            edgesFrom("model").some(
                (edge) =>
                    edge.target === "method" && edge.kind === "contains" && edge.label === "method",
            ),
            "model contains method",
        ).to.be.true;

        // The property holder is the corpus' widest union: every property type is a
        // variant of its `data` field, and its `source.info` is a variant of the two
        // reference kinds (exabyte, external), on top of one mixin.
        const holderEdges = edgesFrom("property/holder");
        expect(holderEdges).to.have.lengthOf(51);
        const holderVariants = holderEdges.filter((edge) => edge.kind === "variant");
        expect(holderVariants).to.have.lengthOf(50);
        expect(holderVariants.filter((edge) => edge.label === "data")).to.have.lengthOf(48);
        expect(holderVariants.filter((edge) => edge.label === "info")).to.have.lengthOf(2);
        expect(holderEdges.filter((edge) => edge.kind === "extends")).to.have.lengthOf(1);
        expect(holderEdges.filter((edge) => edge.kind === "contains")).to.have.lengthOf(0);
    });

    it("carries manifest flags onto property nodes", () => {
        const totalEnergy = graph.nodes.find(
            (node) => node.id === "properties-directory/scalar/total-energy",
        );

        expect(totalEnergy?.manifest).to.deep.equal({
            name: "total_energy",
            isResult: true,
            defaultUnits: "eV",
        });
    });

    it("derives published paths that round-trip back to schema ids", () => {
        const index = buildPublishedPathIndex(graph.nodes);

        graph.nodes.forEach((node) => {
            expect(schemaIdToPublishedPath(node.id), node.id).to.equal(node.publishedPath);
            expect(publishedPathToSchemaId(node.publishedPath), node.publishedPath).to.equal(
                node.id,
            );
            expect(index[node.publishedPath], node.publishedPath).to.equal(node.id);
        });

        // The published path round-trips to the id exactly, but NOT to the source path: this
        // directory has a literal dash that the trip through $id turns into an underscore.
        const fileContent = graph.nodes.find(
            (node) => node.id === "properties-directory/non-scalar/file-content",
        );
        expect(fileContent?.path).to.equal(
            "schema/properties_directory/non-scalar/file_content.json",
        );
        expect(fileContent?.publishedPath).to.equal(
            "schema/properties_directory/non_scalar/file_content.json",
        );
    });

    it("keeps degrees consistent with the edge list", () => {
        const inDegree = new Map<string, number>();
        const outDegree = new Map<string, number>();

        graph.edges.forEach((edge) => {
            outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
            inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
        });

        graph.nodes.forEach((node) => {
            expect(node.inDegree, `${node.id} inDegree`).to.equal(inDegree.get(node.id) ?? 0);
            expect(node.outDegree, `${node.id} outDegree`).to.equal(outDegree.get(node.id) ?? 0);
        });
    });

    it("emits deterministically sorted, byte-identical output across runs", () => {
        const { graph: second } = buildEntityGraph();
        expect(JSON.stringify(second)).to.equal(JSON.stringify(graph));

        const ids = graph.nodes.map((node) => node.id);
        expect(ids).to.deep.equal([...ids].sort());
    });

    it("validates against the extractor's own schema", () => {
        const errors = validateEntityGraph(graph);
        expect(errors, errors.join("\n")).to.deep.equal([]);
    });

    it("reports example coverage as a warning", () => {
        expect(graph.meta.schemasWithExample).to.equal(217);
        expect(lint.warnings.some((warning) => warning.startsWith("L9 example coverage"))).to.be
            .true;
    });
});

describe("collectReferences", () => {
    it("classifies a reference by the innermost enclosing keyword", () => {
        const references = collectReferences({
            allOf: [{ $ref: "base.json" }],
            properties: {
                child: { $ref: "child.json" },
                wrapped: { allOf: [{ $ref: "mixin.json" }] },
                list: { items: { $ref: "item.json" } },
            },
            oneOf: [{ $ref: "variant.json" }],
        } as never);

        expect(references).to.deep.include({ ref: "base.json", kind: "extends", label: undefined });
        expect(references).to.deep.include({
            ref: "child.json",
            kind: "contains",
            label: "child",
        });
        expect(references).to.deep.include({
            ref: "mixin.json",
            kind: "extends",
            label: "wrapped",
        });
        expect(references).to.deep.include({
            ref: "item.json",
            kind: "contains",
            label: "list[]",
        });
        expect(references).to.deep.include({
            ref: "variant.json",
            kind: "variant",
            label: undefined,
        });
    });

    it("leaves a reference outside every structural keyword unclassified, for L4 to fail on", () => {
        const references = collectReferences({
            definitions: { loose: { $ref: "material.json" } },
        } as never);

        expect(references).to.deep.equal([
            { ref: "material.json", kind: undefined, label: undefined },
        ]);
    });

    it("keeps the enclosing property label while descending into non-structural keys", () => {
        const references = collectReferences({
            properties: {
                data: { additionalProperties: { $ref: "leaf.json" } },
            },
        } as never);

        expect(references).to.deep.equal([{ ref: "leaf.json", kind: "contains", label: "data" }]);
    });
});

describe("resolveJsonPointer", () => {
    it("resolves nested pointers and reports missing ones", () => {
        const document = { definitions: { "a/b": { value: 1 } }, list: [{ leaf: true }] };

        expect(resolveJsonPointer(document, "/definitions/a~1b/value")).to.equal(1);
        expect(resolveJsonPointer(document, "/list/0/leaf")).to.equal(true);
        expect(resolveJsonPointer(document, "/definitions/missing")).to.be.undefined;
    });
});

describe("classifyLayer", () => {
    it("assigns the documented layer for each kind of path", () => {
        expect(classifyLayer("material")).to.deep.equal({ layer: "entity" });
        expect(classifyLayer("core/primitive/scalar")).to.deep.equal({ layer: "primitive" });
        expect(classifyLayer("core/reference")).to.deep.equal({ layer: "reference" });
        expect(classifyLayer("definitions/units")).to.deep.equal({ layer: "definition" });
        expect(classifyLayer("workflow/unit/base")).to.deep.equal({
            layer: "entity-component",
            ownerEntity: "workflow",
        });
        expect(classifyLayer("methods-category/physical/qm")).to.deep.equal({ layer: "category" });
        expect(classifyLayer("properties-directory/scalar/pressure")).to.deep.equal({
            layer: "directory",
        });
        expect(classifyLayer("apse/file/applications/espresso")).to.deep.equal({
            layer: "application-parsing",
        });
    });

    it("returns undefined for a path no rule covers, so the lint can fail on it", () => {
        expect(classifyLayer("brand-new-top-level/thing")).to.be.undefined;
        expect(classifyLayer("core/unexpected/thing")).to.be.undefined;
    });
});
