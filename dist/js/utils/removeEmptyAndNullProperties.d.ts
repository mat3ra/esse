export type AnyObject = Record<string, any>;
/**
 * Recursively removes empty-string and null properties from an object.
 * Nested objects are cleaned in place; array elements are walked but not removed.
 * @param obj The object to clean
 * @returns The cleaned object (mutates the original)
 */
export declare function removeEmptyAndNullProperties(obj: AnyObject): AnyObject;
