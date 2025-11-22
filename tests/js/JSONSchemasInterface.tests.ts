import { Utils } from "@mat3ra/utils/server";
import { assert, expect } from "chai";
import * as path from "path";

import JSONSchemasInterface from "../../src/js/esse/JSONSchemasInterfaceServer";
import { JSONSchema } from "../../src/js/esse/utils";
import {
    expectedPatchedSchema,
    originalSchema,
    patchConfig,
    patchConfigDotNotation,
} from "./fixtures/test-data";

function assertSystemInSetSchema(schema?: JSONSchema) {
    const inSet = schema?.properties?.inSet as JSONSchema | undefined;
    const inSetItems = inSet?.items as JSONSchema | undefined;

    expect(schema).to.be.an("object");
    assert(schema?.$id, "system/in-set");
    expect(inSetItems?.properties?._id).to.be.an("object");
    expect(inSetItems?.properties?.cls).to.be.an("object");
    expect(inSetItems?.properties?.slug).to.be.an("object");
    expect(inSetItems?.properties?.type).to.be.an("object");
    expect(inSetItems?.properties?.index).to.be.an("object");
}

describe("JSONSchemasInterfaceServer", () => {
    it("can find schemas from esse dist folder; the schema is merged and clean", async () => {
        const schema = JSONSchemasInterface.getSchemaById("system/in-set");
        assertSystemInSetSchema(schema);
    });

    it("can find registered schemas; the schema is merged and clean", async () => {
        JSONSchemasInterface.setSchemaFolder(path.join(__dirname, "./fixtures/json"));

        const schema = JSONSchemasInterface.getSchemaById("system/in-set");
        assertSystemInSetSchema(schema);
    });
});

describe("JSONSchemasInterface", () => {
    beforeEach(() => {
        // Use both real schemas and test fixtures
        const allSchemasWithFixtures = [originalSchema];
        JSONSchemasInterface.setSchemas(allSchemasWithFixtures);
    });

    it("can find registered schemas; the schema is merged and clean", async () => {
        const schema = JSONSchemasInterface.getSchemaById("system/in-set");
        assertSystemInSetSchema(schema);
    });

    it("getPatchedSchemaById should return a patched schema", () => {
        const schemaId = "boundary-conditions-test";

        const patchedSchema = JSONSchemasInterface.getPatchedSchemaById(schemaId, patchConfig);

        // Should successfully patch the fixture schema
        expect(patchedSchema).to.not.be.undefined;

        Utils.assertion.assertDeepAlmostEqual(patchedSchema as JSON, expectedPatchedSchema);
    });

    it("getPatchedSchemaById should return a schema patched with dot notation", () => {
        const schemaId = "boundary-conditions-test";

        const patchedSchema = JSONSchemasInterface.getPatchedSchemaById(
            schemaId,
            patchConfigDotNotation,
        );

        // Should successfully patch the fixture schema
        expect(patchedSchema).to.not.be.undefined;

        Utils.assertion.assertDeepAlmostEqual(patchedSchema as JSON, expectedPatchedSchema);
    });
});
