"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEmptyAndNullProperties = void 0;
exports.getValidator = getValidator;
exports.validate = validate;
exports.validateAndClean = validateAndClean;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const schemaUtils_1 = require("../esse/schemaUtils");
const jsonSchemaToTypescriptKeywords_1 = __importDefault(require("./ajvKeywords/jsonSchemaToTypescriptKeywords"));
const removeEmptyAndNullProperties_1 = require("./removeEmptyAndNullProperties");
function addAdditionalPropertiesToSchema(schema, additionalProperties = false) {
    return (0, schemaUtils_1.mapObjectDeep)(schema, (object) => {
        const schema = object;
        if (typeof object === "object" &&
            (schema === null || schema === void 0 ? void 0 : schema.type) === "object" &&
            (schema === null || schema === void 0 ? void 0 : schema.properties) &&
            !("additionalProperties" in schema)) {
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
const ajvValidator = new ajv_1.default({ ...ajvConfig });
const ajvValidatorAndCleaner = new ajv_1.default({ ...ajvConfig, removeAdditional: true });
const ajvValidatorAndCleanerNoDefaults = new ajv_1.default({
    ...ajvConfig,
    removeAdditional: true,
    useDefaults: false,
});
const ajvValidatorAndCleanerWithCoercingTypes = new ajv_1.default({
    ...ajvConfig,
    removeAdditional: true,
    coerceTypes: true,
});
const ajvValidatorAndCleanerWithCoercingTypesNoDefaults = new ajv_1.default({
    ...ajvConfig,
    removeAdditional: true,
    coerceTypes: true,
    useDefaults: false,
});
const ajvInstances = [
    ajvValidator,
    ajvValidatorAndCleaner,
    ajvValidatorAndCleanerNoDefaults,
    ajvValidatorAndCleanerWithCoercingTypes,
    ajvValidatorAndCleanerWithCoercingTypesNoDefaults,
];
ajvInstances.forEach((instance) => {
    (0, ajv_formats_1.default)(instance);
    (0, jsonSchemaToTypescriptKeywords_1.default)(instance);
});
function getAjvInstance({ clean, coerceTypes, useDefaults }) {
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
function getValidator(jsonSchema, { clean, coerceTypes, useDefaults = true, }) {
    const schemaKey = jsonSchema.$id;
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
function validate(data, jsonSchema) {
    const validator = getValidator(jsonSchema, { clean: false, coerceTypes: false });
    const isValid = validator(data);
    return {
        isValid,
        errors: validator.errors,
    };
}
/**
 * Validates and cleans data against the schema.
 * Drops empty-string and null properties first, then AJV removeAdditional.
 * @param data data to validate (mutated in place).
 * @param jsonSchema schema to validate the data with.
 * @returns whether data is valid.
 */
function validateAndClean(data, jsonSchema, { coerceTypes = false, useDefaults = true } = {}) {
    (0, removeEmptyAndNullProperties_1.removeEmptyAndNullProperties)(data);
    const validator = getValidator(jsonSchema, { clean: true, coerceTypes, useDefaults });
    const isValid = validator(data);
    return {
        isValid,
        errors: validator.errors,
    };
}
var removeEmptyAndNullProperties_2 = require("./removeEmptyAndNullProperties");
Object.defineProperty(exports, "removeEmptyAndNullProperties", { enumerable: true, get: function () { return removeEmptyAndNullProperties_2.removeEmptyAndNullProperties; } });
