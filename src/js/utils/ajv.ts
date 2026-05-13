import Ajv, { SchemaObject } from "ajv";
import { AnyValidateFunction } from "ajv/dist/core";
import addFormats from "ajv-formats";

import { mapObjectDeep } from "../esse/schemaUtils";
import { AnyObject } from "../esse/types";
import type { JSONSchema } from "../esse/utils";

function addAdditionalPropertiesToSchema(schema: JSONSchema, additionalProperties = false) {
    return mapObjectDeep(schema, (object) => {
        const schema = object as JSONSchema;

        if (
            typeof object === "object" &&
            schema?.type === "object" &&
            schema?.properties &&
            !("additionalProperties" in schema)
        ) {
            return {
                ...schema,
                additionalProperties,
                unevaluatedProperties: false,
            };
        }
    });
}

const ajvConfig = {
    strict: false, // TODO: adjust schemas and enable strict mode
    useDefaults: true,
    /**
     * discriminator fixes default values in oneOf
     * @see https://ajv.js.org/guide/modifying-data.html#assigning-defaults
     */
    discriminator: true,
};

const ajvValidator = new Ajv({ ...ajvConfig });
const ajvValidatorAndCleaner = new Ajv({ ...ajvConfig, removeAdditional: true });
const ajvValidatorAndCleanerNoDefaults = new Ajv({
    ...ajvConfig,
    removeAdditional: true,
    useDefaults: false,
});
const ajvValidatorAndCleanerWithCoercingTypes = new Ajv({
    ...ajvConfig,
    removeAdditional: true,
    coerceTypes: true,
});
const ajvValidatorAndCleanerWithCoercingTypesNoDefaults = new Ajv({
    ...ajvConfig,
    removeAdditional: true,
    coerceTypes: true,
    useDefaults: false,
});

addFormats(ajvValidator);
addFormats(ajvValidatorAndCleaner);
addFormats(ajvValidatorAndCleanerNoDefaults);
addFormats(ajvValidatorAndCleanerWithCoercingTypes);
addFormats(ajvValidatorAndCleanerWithCoercingTypesNoDefaults);

interface AjvInstanceOptions {
    clean: boolean;
    coerceTypes: boolean;
    useDefaults: boolean;
}

function getAjvInstance({ clean, coerceTypes, useDefaults }: AjvInstanceOptions) {
    if (clean && coerceTypes) {
        return useDefaults
            ? ajvValidatorAndCleanerWithCoercingTypes
            : ajvValidatorAndCleanerWithCoercingTypesNoDefaults;
    }

    if (clean) {
        return useDefaults ? ajvValidatorAndCleaner : ajvValidatorAndCleanerNoDefaults;
    }

    return ajvValidator;
}

export function getValidator(
    jsonSchema: SchemaObject,
    {
        clean,
        coerceTypes,
        useDefaults = true,
    }: Omit<AjvInstanceOptions, "useDefaults"> & Partial<Pick<AjvInstanceOptions, "useDefaults">>,
): AnyValidateFunction {
    const schemaKey = jsonSchema.$id as string;
    const ajv = getAjvInstance({ clean, coerceTypes, useDefaults });
    let validate = ajv.getSchema(schemaKey);

    if (!validate) {
        // properties that were not defined in schema will be ignored when clean = false
        const patchedSchema = clean ? addAdditionalPropertiesToSchema(jsonSchema) : jsonSchema;
        ajv.addSchema(patchedSchema, schemaKey);
        validate = ajv.getSchema(schemaKey);
    }

    if (!validate) {
        throw new Error("JSONSchemasInterface AJV validator error");
    }

    return validate;
}

/**
 * Validates a given example against the schema.
 * @param example example to validate.
 * @param schema schema to validate the example with.
 * @returns whether example is valid.
 */
export function validate(data: AnyObject, jsonSchema: SchemaObject) {
    const validator = getValidator(jsonSchema, { clean: false, coerceTypes: false });
    const isValid = validator(data);

    return {
        isValid,
        errors: validator.errors,
    };
}

/**
 * Validates and clean a given example against the schema
 * @param example example to validate.
 * @param schema schema to validate the example with.
 * @returns whether example is valid.
 */
export function validateAndClean(
    data: AnyObject,
    jsonSchema: SchemaObject,
    { coerceTypes = false, useDefaults = true } = {},
) {
    const validator = getValidator(jsonSchema, { clean: true, coerceTypes, useDefaults });
    const isValid = validator(data);

    return {
        isValid,
        errors: validator.errors,
    };
}
