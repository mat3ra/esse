import { JSONSchema7, JSONSchema7Definition } from "json-schema";
export type JSONSchema = JSONSchema7;
export type JSONSchemaDefinition = JSONSchema7Definition;
export declare function applyPatchWithDotNotation(target: Record<string, unknown>, path: string, patchValue: unknown): void;
export declare function applyPatchTree(schema: Record<string, unknown>, patchNode: Record<string, unknown>, pathPrefix: string[]): void;
