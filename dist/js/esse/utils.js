"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIncludeReferenceStatements = parseIncludeReferenceStatements;
exports.parseIncludeReferenceStatementsByDir = parseIncludeReferenceStatementsByDir;
exports.applyPatchWithDotNotation = applyPatchWithDotNotation;
exports.applyPatchTree = applyPatchTree;
// @ts-ignore
const json_schema_deref_sync_1 = __importDefault(require("json-schema-deref-sync"));
const path_1 = __importDefault(require("path"));
const json_include_1 = require("../json_include");
const filesystem_1 = require("../utils/filesystem");
/**
 * Resolves `include` and `$ref` statements.
 * @param filePath {String} file to parse.
 */
function parseIncludeReferenceStatements(filePath) {
    const jsonResolver = new json_include_1.JSONInclude();
    const parsed = jsonResolver.parseIncludeStatements(filePath);
    const dirPath = path_1.default.dirname(filePath);
    // Store the original $id before dereferencing
    const originalId = parsed.$id;
    let dereferenced = (0, json_schema_deref_sync_1.default)(parsed, { baseFolder: dirPath, removeIds: true });
    // handle circular references and use non-dereferenced source
    if (dereferenced instanceof Error && dereferenced.message === "Circular self reference") {
        dereferenced = parsed;
    }
    // Restore the original $id after dereferencing
    if (originalId) {
        dereferenced.$id = originalId;
    }
    return dereferenced;
}
/**
 * Resolves `include` and `$ref` statements for all the JSON files inside a given directory.
 * @param dirPath directory to parse.
 */
function parseIncludeReferenceStatementsByDir(dirPath, wrapInDataAndPath = false) {
    const schemas = [];
    const schemasWithPath = [];
    const topDir = path_1.default.resolve(__dirname, "../../../");
    (0, filesystem_1.walkDirSync)(dirPath, (filePath) => {
        if (filePath.endsWith(".json")) {
            const config = parseIncludeReferenceStatements(filePath);
            if (wrapInDataAndPath) {
                const _path = path_1.default.join(
                // remove leading slashes and "example" from path
                path_1.default
                    .dirname(filePath)
                    .replace(path_1.default.join(topDir, "example"), "")
                    .replace(/^\/+/, ""), path_1.default.basename(filePath).replace(".json", ""));
                schemasWithPath.push({ data: config, path: _path });
            }
            else {
                schemas.push(config);
            }
        }
    });
    return wrapInDataAndPath ? schemasWithPath : schemas;
}
function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function applyPatchWithDotNotation(target, path, patchValue) {
    const keys = path.split(".");
    let current = target;
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
    }
    else if (existingValue !== undefined) {
        // Overwrite leaf value
        current[finalKey] = patchValue;
    }
    // If existingValue is undefined, we skip;
}
function applyPatchTree(schema, patchNode, pathPrefix) {
    Object.entries(patchNode).forEach(([key, value]) => {
        if (key.includes(".")) {
            // Dot notation relative to current prefix
            const fullPathSegments = [...pathPrefix, ...key.split(".")];
            const fullPath = fullPathSegments.join(".");
            applyPatchWithDotNotation(schema, fullPath, value);
        }
        else if (isPlainObject(value)) {
            // Nested subtree → recurse with extended prefix
            applyPatchTree(schema, value, [...pathPrefix, key]);
        }
        else {
            // Leaf patch (primitive / array) → treat as direct field patch
            const fullPathSegments = [...pathPrefix, key];
            const fullPath = fullPathSegments.join(".");
            applyPatchWithDotNotation(schema, fullPath, value);
        }
    });
}
