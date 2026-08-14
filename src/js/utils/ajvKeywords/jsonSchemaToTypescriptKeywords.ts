import type Ajv from "ajv";

/**
 * Schemas include json-schema-to-typescript hints (`tsType`, `tsEnumNames`, …).
 * Ajv strict mode rejects unknown keywords; register them as no-ops so the same schemas work for
 * runtime validation.
 */
export default function addJsonSchemaToTypescriptKeywords(ajv: Ajv): void {
    const validateNoop = (): boolean => true;

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
