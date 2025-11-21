import { assert, expect } from "chai";
import * as path from "path";

import allSchemas from "../../dist/js/schemas.json";
import JSONSchemasInterface from "../../src/js/esse/JSONSchemasInterfaceServer";
import { JSONSchema } from "../../src/js/esse/utils";
import { testSchemas, expectedPatchResults } from "./fixtures/test-data";

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
        const allSchemasWithFixtures = [...(allSchemas as JSONSchema[]), ...testSchemas];
        JSONSchemasInterface.setSchemas(allSchemasWithFixtures);
    });

    it("can find registered schemas; the schema is merged and clean", async () => {
        const schema = JSONSchemasInterface.getSchemaById("system/in-set");
        assertSystemInSetSchema(schema);
    });

    it("getPatchedSchemaById should return a patched schema", () => {
        const schemaId = "boundary-conditions-test";
        const { patchConfig, expectedDefaults } = expectedPatchResults.boundaryConditionsSchema;

        const patchedSchema = JSONSchemasInterface.getPatchedSchemaById(schemaId, patchConfig);

        // Should successfully patch the fixture schema
        expect(patchedSchema).to.not.be.undefined;
        
        if (patchedSchema) {
            const typeProperty = patchedSchema.properties?.type as any;
            const offsetProperty = patchedSchema.properties?.offset as any;
            const electricFieldProperty = patchedSchema.properties?.electricField as any;
            const targetFermiEnergyProperty = patchedSchema.properties?.targetFermiEnergy as any;
            
            // Check all patched defaults
            expect(typeProperty?.default).to.equal(expectedDefaults.type);
            expect(typeProperty?.enum).to.deep.equal(["pbc", "fixed", "open"]);
            expect(offsetProperty?.default).to.equal(expectedDefaults.offset);
            expect(offsetProperty?.minimum).to.equal(0);
            expect(electricFieldProperty?.default).to.equal(expectedDefaults.electricField);
            expect(targetFermiEnergyProperty?.default).to.equal(expectedDefaults.targetFermiEnergy);
            
            // Check original attributes are preserved
            expect(typeProperty?.type).to.equal("string");
            expect(offsetProperty?.type).to.equal("number");
            expect(electricFieldProperty?.type).to.equal("number");
            expect(targetFermiEnergyProperty?.type).to.equal("number");
        }
    });
});
