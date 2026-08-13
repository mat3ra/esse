import type Ajv from "ajv";
/**
 * Schemas include json-schema-to-typescript hints (`tsType`, `tsEnumNames`, …).
 * Ajv strict mode rejects unknown keywords; register them as no-ops so the same schemas work for
 * runtime validation.
 */
export default function addJsonSchemaToTypescriptKeywords(ajv: Ajv): void;
