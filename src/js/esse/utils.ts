import { JSONSchema7, JSONSchema7Definition } from "json-schema";
// @ts-ignore
import deref from "json-schema-deref-sync";
import path from "path";

import { JSONInclude } from "../json_include";
import { walkDirSync } from "../utils/filesystem";

export type JSONSchema = JSONSchema7;

export type JSONSchemaDefinition = JSONSchema7Definition;

/**
 * Resolves `include` and `$ref` statements.
 * @param filePath {String} file to parse.
 */
export function parseIncludeReferenceStatements(filePath: string): JSONSchema {
    const jsonResolver = new JSONInclude();
    const parsed = jsonResolver.parseIncludeStatements(filePath) as JSONSchema;
    const dirPath = path.dirname(filePath);
    // Store the original $id before dereferencing
    const originalId = parsed.$id;
    let dereferenced = deref(parsed, { baseFolder: dirPath, removeIds: true });
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

export interface JSONSchemaWithPath {
    data: JSONSchema;
    path: string;
}

export function parseIncludeReferenceStatementsByDir(
    dirPath: string,
    wrapInDataAndPath: true,
): JSONSchemaWithPath[];

export function parseIncludeReferenceStatementsByDir(
    dirPath: string,
    wrapInDataAndPath?: false,
): JSONSchema[];

/**
 * Resolves `include` and `$ref` statements for all the JSON files inside a given directory.
 * @param dirPath directory to parse.
 */
export function parseIncludeReferenceStatementsByDir(dirPath: string, wrapInDataAndPath = false) {
    const schemas: JSONSchema[] = [];
    const schemasWithPath: JSONSchemaWithPath[] = [];
    const topDir = path.resolve(__dirname, "../../../");

    walkDirSync(dirPath, (filePath) => {
        if (filePath.endsWith(".json")) {
            const config = parseIncludeReferenceStatements(filePath);
            if (wrapInDataAndPath) {
                const _path = path.join(
                    // remove leading slashes and "example" from path
                    path
                        .dirname(filePath)
                        .replace(path.join(topDir, "example"), "")
                        .replace(/^\/+/, ""),
                    path.basename(filePath).replace(".json", ""),
                );
                schemasWithPath.push({ data: config, path: _path });
            } else {
                schemas.push(config);
            }
        }
    });

    return wrapInDataAndPath ? schemasWithPath : schemas;
}
