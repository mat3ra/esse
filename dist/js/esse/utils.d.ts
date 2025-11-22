import { JSONSchema7, JSONSchema7Definition } from "json-schema";
export type JSONSchema = JSONSchema7;
export type JSONSchemaDefinition = JSONSchema7Definition;
/**
 * Resolves `include` and `$ref` statements.
 * @param filePath {String} file to parse.
 */
export declare function parseIncludeReferenceStatements(filePath: string): JSONSchema;
export interface JSONSchemaWithPath {
    data: JSONSchema;
    path: string;
}
export declare function parseIncludeReferenceStatementsByDir(dirPath: string, wrapInDataAndPath: true): JSONSchemaWithPath[];
export declare function parseIncludeReferenceStatementsByDir(dirPath: string, wrapInDataAndPath?: false): JSONSchema[];
export declare function applyPatchWithDotNotation(target: Record<string, unknown>, path: string, patchValue: unknown): void;
export declare function applyPatchTree(schema: Record<string, unknown>, patchNode: Record<string, unknown>, pathPrefix: string[]): void;
