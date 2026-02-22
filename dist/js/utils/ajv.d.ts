import { SchemaObject } from "ajv";
import { AnyValidateFunction } from "ajv/dist/core";
import { AnyObject } from "../esse/types";
interface AjvInstanceOptions {
    clean: boolean;
    coerceTypes: boolean;
    useDefaults: boolean;
}
export declare function getValidator(jsonSchema: SchemaObject, { clean, coerceTypes, useDefaults }: Omit<AjvInstanceOptions, "useDefaults"> & Partial<Pick<AjvInstanceOptions, "useDefaults">>): AnyValidateFunction;
/**
 * Validates a given example against the schema.
 * @param example example to validate.
 * @param schema schema to validate the example with.
 * @returns whether example is valid.
 */
export declare function validate(data: AnyObject, jsonSchema: SchemaObject): {
    isValid: boolean | Promise<any>;
    errors: import("ajv").ErrorObject<string, Record<string, any>, unknown>[] | null | undefined;
};
/**
 * Validates and clean a given example against the schema
 * @param example example to validate.
 * @param schema schema to validate the example with.
 * @returns whether example is valid.
 */
export declare function validateAndClean(data: AnyObject, jsonSchema: SchemaObject, { coerceTypes, useDefaults }?: {
    coerceTypes?: boolean | undefined;
    useDefaults?: boolean | undefined;
}): {
    isValid: boolean | Promise<any>;
    errors: import("ajv").ErrorObject<string, Record<string, any>, unknown>[] | null | undefined;
};
export {};
