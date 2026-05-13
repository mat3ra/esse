import type { JSONSchema, JSONSchemaDefinition } from "./utils";
export type MapSchema = (prop: JSONSchemaDefinition) => JSONSchemaDefinition | undefined;
export declare function mapObjectDeep(object: JSONSchemaDefinition, mapValue: MapSchema): JSONSchema;
export declare function mapObjectDeep(object: JSONSchemaDefinition[], mapValue: MapSchema): JSONSchema[];
