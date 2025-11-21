import { JSONSchema } from "./utils";
export type JSONSchemasInterfaceQuery = {
    [key in keyof JSONSchema]: {
        $regex: string;
    };
};
export default class JSONSchemasInterface {
    static schemasCache: Map<string, import("json-schema").JSONSchema7>;
    static setSchemas(schema: JSONSchema[]): void;
    static addSchema(schema: JSONSchema): void;
    static getSchemaById(schemaId: string): import("json-schema").JSONSchema7 | undefined;
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
    static matchSchema(query: JSONSchemasInterfaceQuery): import("json-schema").JSONSchema7 | undefined;
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
    static getPatchedSchemaById(schemaId: string, propertyPatches: Record<string, Partial<any>>): JSONSchema | undefined;
}
