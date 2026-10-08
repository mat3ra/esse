import { expect } from "chai";

import JSONSchemasInterface from "../../src/js/esse/JSONSchemasInterfaceServer";
import type { JSONSchema } from "../../src/js/esse/utils";

function getQueueNameEnumDefinition() {
    const schema = JSONSchemasInterface.getSchemaById("compute/queue-name-enum");
    const definitions = schema?.definitions as Record<string, JSONSchema> | undefined;
    return definitions?.QueueNameEnum;
}

function getEnumOfProperty(schemaId: string, propertyName: string) {
    const schema = JSONSchemasInterface.getSchemaById(schemaId);
    const properties = schema?.properties as Record<string, JSONSchema> | undefined;
    return properties?.[propertyName]?.enum;
}

/**
 * `queue.name` keeps its own `enum` (for validation) and points at `QueueNameEnum` via `tsType`
 * (for the generated TypeScript enum), so the lists have to be kept identical by hand.
 * `tsEnumNames` gives each queue a readable TypeScript member name (`G4OF` -> `gpu4OrdinaryFast`);
 * `json-schema-to-typescript` only emits a runtime enum when it is present.
 */
describe("QueueNameEnum", () => {
    it("lists the same queue names as `name` in the queue schema", () => {
        const definition = getQueueNameEnumDefinition();

        expect(definition?.enum).to.be.an("array");
        expect(definition?.enum?.length).to.be.greaterThan(0);
        expect(getEnumOfProperty("compute/queue", "name")).to.deep.equal(definition?.enum);
    });

    it("lists the same queue names as `queue` in the job compute schema", () => {
        const definition = getQueueNameEnumDefinition();

        expect(getEnumOfProperty("job/compute", "queue")).to.deep.equal(definition?.enum);
    });

    it("has exactly one unique TypeScript member name per queue name", () => {
        const definition = getQueueNameEnumDefinition();
        const memberNames = (definition as JSONSchema & { tsEnumNames?: string[] })?.tsEnumNames;

        expect(memberNames).to.have.lengthOf(definition?.enum?.length as number);
        expect(new Set(memberNames).size).to.equal(memberNames?.length);
    });
});
