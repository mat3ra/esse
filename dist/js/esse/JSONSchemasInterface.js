"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
class JSONSchemasInterface {
    static setSchemas(schema) {
        schema.forEach((schema) => this.addSchema(schema));
    }
    static addSchema(schema) {
        if (schema.$id) {
            this.schemasCache.set(schema.$id, schema);
        }
    }
    static getSchemaById(schemaId) {
        return this.schemasCache.get(schemaId);
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
    static matchSchema(query) {
        const searchFields = Object.keys(query);
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
    static getPatchedSchemaById(schemaId, patchConfig) {
        const baseSchema = this.getSchemaById(schemaId);
        if (!baseSchema) {
            return undefined;
        }
        const patchedSchema = JSON.parse(JSON.stringify(baseSchema));
        (0, utils_1.applyPatchTree)(patchedSchema, patchConfig, []);
        return patchedSchema;
    }
}
exports.default = JSONSchemasInterface;
JSONSchemasInterface.schemasCache = new Map();
