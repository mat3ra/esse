import { JSONSchema7, JSONSchema7Definition } from "json-schema";

export type JSONSchema = JSONSchema7;

export type JSONSchemaDefinition = JSONSchema7Definition;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function applyPatchWithDotNotation(
    target: Record<string, unknown>,
    path: string,
    patchValue: unknown,
): void {
    const keys = path.split(".");
    let current: any = target;

    // Navigate to parent of final key
    for (let index = 0; index < keys.length - 1; index += 1) {
        const key = keys[index];
        if (!isPlainObject(current[key])) {
            // Path does not exist or is not an object → skip patch
            return;
        }
        current = current[key];
    }

    const finalKey = keys[keys.length - 1];
    const existingValue = current[finalKey];

    if (isPlainObject(existingValue) && isPlainObject(patchValue)) {
        // Merge object into existing object
        Object.assign(existingValue, patchValue);
    } else if (existingValue !== undefined) {
        // Overwrite leaf value
        current[finalKey] = patchValue;
    }
    // If existingValue is undefined, we skip;
}

export function applyPatchTree(
    schema: Record<string, unknown>,
    patchNode: Record<string, unknown>,
    pathPrefix: string[],
): void {
    Object.entries(patchNode).forEach(([key, value]) => {
        if (key.includes(".")) {
            // Dot notation relative to current prefix
            const fullPathSegments = [...pathPrefix, ...key.split(".")];
            const fullPath = fullPathSegments.join(".");
            applyPatchWithDotNotation(schema, fullPath, value);
        } else if (isPlainObject(value)) {
            // Nested subtree → recurse with extended prefix
            applyPatchTree(schema, value, [...pathPrefix, key]);
        } else {
            // Leaf patch (primitive / array) → treat as direct field patch
            const fullPathSegments = [...pathPrefix, key];
            const fullPath = fullPathSegments.join(".");
            applyPatchWithDotNotation(schema, fullPath, value);
        }
    });
}
