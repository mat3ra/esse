"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEmptyAndNullProperties = removeEmptyAndNullProperties;
/**
 * Recursively removes empty-string and null properties from an object.
 * Nested objects are cleaned in place; array elements are walked but not removed.
 * @param obj The object to clean
 * @returns The cleaned object (mutates the original)
 */
function removeEmptyAndNullProperties(obj) {
    if (typeof obj !== "object" || obj === null) {
        return obj;
    }
    if (Array.isArray(obj)) {
        obj.forEach((item) => removeEmptyAndNullProperties(item));
        return obj;
    }
    Object.keys(obj).forEach((key) => {
        const value = obj[key];
        if (value === "" || value === null) {
            delete obj[key];
        }
        else if (typeof value === "object") {
            removeEmptyAndNullProperties(value);
        }
    });
    return obj;
}
