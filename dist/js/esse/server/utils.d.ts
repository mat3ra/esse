import type { JSONSchema } from "../utils";
export interface JSONSchemaWithPath {
    data: JSONSchema;
    path: string;
}
/**
 * Resolves `include` and `$ref` statements.
 * @param filePath {String} file to parse.
 */
export declare function parseIncludeReferenceStatements(filePath: string): JSONSchema;
export declare function parseIncludeReferenceStatementsByDir(dirPath: string, wrapInDataAndPath: true): JSONSchemaWithPath[];
export declare function parseIncludeReferenceStatementsByDir(dirPath: string, wrapInDataAndPath?: false): JSONSchema[];
