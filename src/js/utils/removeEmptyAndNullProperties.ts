// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyObject = Record<string, any>;

/**
 * Recursively removes null properties from an object.
 * Empty strings are preserved (entity schemas use "" as intentional placeholders, e.g. flowchart links).
 * Nested objects are cleaned in place; array elements are walked but not removed.
 * @param obj The object to clean
 * @returns The cleaned object (mutates the original)
 */
export function removeEmptyAndNullProperties(obj: AnyObject): AnyObject {
    if (typeof obj !== "object" || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        obj.forEach((item) => removeEmptyAndNullProperties(item));
        return obj;
    }

    Object.keys(obj).forEach((key) => {
        const value = obj[key];

        if (value === null) {
            delete obj[key];
        } else if (typeof value === "object") {
            removeEmptyAndNullProperties(value);
        }
    });

    return obj;
}
