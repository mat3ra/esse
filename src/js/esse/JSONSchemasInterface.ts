import { type JSONSchema, applyPatchTree } from "./utils";

export type JSONSchemasInterfaceQuery = { [key in keyof JSONSchema]: { $regex: string } };

export default class JSONSchemasInterface {
    static schemasCache = new Map<string, JSONSchema>();

    static setSchemas(schema: JSONSchema[]) {
        schema.forEach((schema) => this.addSchema(schema));
    }

    static addSchema(schema: JSONSchema) {
        if (schema.$id) {
            this.schemasCache.set(schema.$id, schema);
        }
    }

    static getSchemaById(schemaId: string) {
        return this.schemasCache.get(schemaId);
    }

    /**
     * Like {@link getSchemaById}, but throws if the schema is not registered.
     */
    static getRequiredSchemaById(schemaId: string): JSONSchema {
        const schema = this.getSchemaById(schemaId);
        if (!schema) {
            throw new Error(`ESSE schema not found: ${schemaId}`);
        }
        return schema;
    }

    /**
     * @example <caption>Search by $id regex</caption>
     * JSONSchemasInterface.matchSchema({
     *   $id: {
     *     $regex: 'software-application'
     *   }
     * })
     *
     * @example <caption>Search by $id and title regex</caption>
     * JSONSchemasInterface.matchSchema({
     *   $id: {
     *     $regex: 'software-application'
     *   },
     *   title: {
     *     $regex: 'application'
     *   }
     * })
     */
    static matchSchema(query: JSONSchemasInterfaceQuery) {
        const searchFields = Object.keys(query) as Array<keyof typeof query>;

        return Array.from(this.schemasCache.values()).find((schema) => {
            return searchFields.every((field) => {
                const queryField = query[field];
                const schemaField = schema[field];

                if (!queryField || typeof schemaField !== "string") {
                    return;
                }

                return new RegExp(queryField.$regex).test(schemaField);
            });
        });
    }

    /**
     * Get a patched copy of a schema without modifying the cached version
     * @param schemaId - The ID of the schema to patch
     * @param propertyPatches - Object with property names as keys and patch objects as values
     * @returns A new schema with patched properties
     *
     * @example
     * JSONSchemasInterface.getPatchedSchema("boundary-conditions-provider", {
     *   type: { default: "pbc" },
     *   offset: { default: 0 }
     * });
     */
    static getPatchedSchemaById(
        schemaId: string,
        patchConfig: Record<string, unknown>,
    ): JSONSchema | undefined {
        const baseSchema = this.getSchemaById(schemaId);
        if (!baseSchema) {
            return undefined;
        }

        const patchedSchema = JSON.parse(JSON.stringify(baseSchema));

        applyPatchTree(
            patchedSchema as Record<string, unknown>,
            patchConfig as Record<string, unknown>,
            [],
        );

        return patchedSchema;
    }
}
