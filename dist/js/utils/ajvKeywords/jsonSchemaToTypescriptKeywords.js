"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = addJsonSchemaToTypescriptKeywords;
/**
 * Schemas include json-schema-to-typescript hints (`tsType`, `tsEnumNames`, …).
 * Ajv strict mode rejects unknown keywords; register them as no-ops so the same schemas work for
 * runtime validation.
 */
function addJsonSchemaToTypescriptKeywords(ajv) {
    const validateNoop = () => true;
    ajv.addKeyword({
        keyword: "tsType",
        validate: validateNoop,
        errors: false,
    });
    ajv.addKeyword({
        keyword: "tsEnumNames",
        validate: validateNoop,
        errors: false,
    });
}
