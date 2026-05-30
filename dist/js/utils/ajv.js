"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValidator = getValidator;
exports.validate = validate;
exports.validateAndClean = validateAndClean;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const schemaUtils_1 = require("../esse/schemaUtils");
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
(0, ajv_formats_1.default)(ajvValidator);
(0, ajv_formats_1.default)(ajvValidatorAndCleaner);
(0, ajv_formats_1.default)(ajvValidatorAndCleanerNoDefaults);
(0, ajv_formats_1.default)(ajvValidatorAndCleanerWithCoercingTypes);
(0, ajv_formats_1.default)(ajvValidatorAndCleanerWithCoercingTypesNoDefaults);
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
 * Validates and clean a given example against the schema
 * @param example example to validate.
 * @param schema schema to validate the example with.
 * @returns whether example is valid.
 */
function validateAndClean(data, jsonSchema, { coerceTypes = false, useDefaults = true } = {}) {
    const validator = getValidator(jsonSchema, { clean: true, coerceTypes, useDefaults });
    const isValid = validator(data);
    return {
        isValid,
        errors: validator.errors,
    };
}
