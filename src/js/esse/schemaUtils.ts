import type { JSONSchema, JSONSchemaDefinition } from "./utils";

export type MapSchema = (prop: JSONSchemaDefinition) => JSONSchemaDefinition | undefined;

export function mapObjectDeep(object: JSONSchemaDefinition, mapValue: MapSchema): JSONSchema;

export function mapObjectDeep(object: JSONSchemaDefinition[], mapValue: MapSchema): JSONSchema[];

export function mapObjectDeep(
    object: JSONSchemaDefinition | JSONSchemaDefinition[],
    mapValue: MapSchema,
): JSONSchemaDefinition | JSONSchemaDefinition[] {
    if (typeof object !== "object" || object === null) {
        return object;
    }

    if (Array.isArray(object)) {
        return object.map((innerValue) => mapObjectDeep(innerValue, mapValue));
    }

    const mappedObject = mapValue(object) || object;

    const entries = Object.entries(mappedObject).map(([key, value]) => {
        return [key, mapObjectDeep(value, mapValue)];
    });

    return Object.fromEntries(entries);
}
