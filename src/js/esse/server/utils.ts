/**
 * Server-side schema parsing utilities.
 *
 * Use this module only in Node/server contexts where the filesystem is available.
 * It walks directories and reads JSON schema files from disk; do not import it in
 * browser bundles.
 */
// @ts-ignore
import deref from "json-schema-deref-sync";
import path from "path";

import { JSONInclude } from "../../json_include";
import { walkDirSync } from "../../utils/filesystem";
import type { JSONSchema } from "../utils";

export interface JSONSchemaWithPath {
    data: JSONSchema;
    path: string;
}

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
    //
    // KNOWN LIMITATION: this only catches a schema's own *direct* self-reference (e.g.
    // workflow.json referencing itself). It does NOT handle a cycle reached transitively
    // through another schema's own $ref (e.g. job.json -> $ref workflow.json -> $ref back to
    // workflow.json) - in that case `deref` collapses the nested self-reference to `{}` (losing
    // its $id) instead of throwing this same "Circular self reference" error, which crashes
    // `JSONSchemasGenerator.writeResolvedSchemas` ("Schema ID is missing"). This is why
    // `workflow.json`'s own `workflows` field is declared as `items: { type: "object" }` rather
    // than a real `$ref` back to itself: consumers (wode's WorkflowSchema, jode's JobEntity,
    // web-app's CoreJobSchema) hand-override the resulting lossy TS type with a properly
    // recursive one, but that only fixes the TypeScript side - AJV validation of nested
    // workflows' own structure is still effectively skipped. Fixing this for real means making
    // this transitive case hit the same fallback as the direct case (probably by tracking
    // visited $ids across the whole dereference walk, not just within a single file's own
    // top-level deref call) - deferred for now.
    if (dereferenced instanceof Error && dereferenced.message === "Circular self reference") {
        dereferenced = parsed;
    }
    // Restore the original $id after dereferencing
    if (originalId) {
        dereferenced.$id = originalId;
    }
    return dereferenced;
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
    const topDir = path.resolve(__dirname, "../../../../");

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
