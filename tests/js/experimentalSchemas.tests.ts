import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";

import * as ajv from "../../src/js/utils/ajv";
import { walkDirSync } from "../../src/js/utils/filesystem";

const resolvedSchemasPath = path.resolve("./dist/js/schema");
const resolvedExamplesPath = path.resolve("./dist/js/example");
const sourceSchemasPath = path.resolve("./schema");
const sourceExamplesPath = path.resolve("./example");

/**
 * Inline array values are for examples and small results; anything larger is meant to be
 * referenced from a file. The figure matches the $comment on core/reusable/array_data.json.
 */
const INLINE_ARRAY_VALUES_BUDGET = 65536;

/**
 * The schemas the experimental-data change added. Every one of them must carry a description,
 * because the descriptions become the pydantic docstrings and the map's detail panel, and
 * because a mirror of an existing entity is only legible if it says what it mirrors.
 */
const EXPERIMENTAL_SCHEMA_ROOTS = [
    "sample.json",
    "sample",
    "instrument.json",
    "instrument",
    "measurement.json",
    "measurement",
    "process.json",
    "process",
    "techniques_category",
    "system/activity.json",
    "system/_sample.json",
    "core/abstract/multidimensional_array.json",
    "core/reusable/array_data.json",
    "core/reusable/file_reference.json",
    "core/reusable/environment.json",
    "core/reusable/identifier.json",
    "core/reusable/quantity",
    "core/reference/measurement.json",
    "core/reference/process.json",
];

function readJson(filePath: string) {
    return JSON.parse(fs.readFileSync(filePath).toString());
}

function listSchemaFiles(root: string): string[] {
    const absolute = path.join(sourceSchemasPath, root);
    if (fs.statSync(absolute).isFile()) return [absolute];
    const files: string[] = [];
    walkDirSync(absolute, (filePath) => {
        if (filePath.endsWith(".json")) files.push(filePath);
    });
    return files;
}

/** Finds every `values` array that sits next to a `shape`, i.e. every inline array payload. */
function collectInlineArrayLengths(node: unknown, found: number[] = []): number[] {
    if (Array.isArray(node)) {
        node.forEach((item) => collectInlineArrayLengths(item, found));
    } else if (node && typeof node === "object") {
        const record = node as Record<string, unknown>;
        if (Array.isArray(record.shape) && Array.isArray(record.values)) {
            found.push(record.values.length);
        }
        Object.values(record).forEach((value) => collectInlineArrayLengths(value, found));
    }
    return found;
}

describe("experimental data schemas", () => {
    it("accepts a property holder whose source is a measurement, and still a job-sourced one", () => {
        const holder = readJson(path.join(resolvedSchemasPath, "property/holder.json"));
        const measured = readJson(
            path.resolve("./tests/js/fixtures/json/property_holder_measurement_source.json"),
        );
        const computed = readJson(path.join(resolvedExamplesPath, "property/holder.json"));

        const measuredResult = ajv.validate(measured, holder);
        expect(measuredResult.isValid, JSON.stringify(measuredResult.errors)).to.equal(true);

        const computedResult = ajv.validate(computed, holder);
        expect(computedResult.isValid, JSON.stringify(computedResult.errors)).to.equal(true);
    });

    it("rejects a holder whose measurement source lacks a measurement id", () => {
        const holder = readJson(path.join(resolvedSchemasPath, "property/holder.json"));
        const measured = readJson(
            path.resolve("./tests/js/fixtures/json/property_holder_measurement_source.json"),
        );
        measured.source.info = { channel: "piezoresponsePhase" };

        expect(ajv.validate(measured, holder).isValid).to.equal(false);
    });

    it("validates the measurement example's parameters against the scanning probe block", () => {
        // Nothing narrows measurement.parameters yet (that is the job of catalogue entries in a
        // later phase), so the example's parameters are checked against the block explicitly.
        const parameters = readJson(
            path.join(resolvedSchemasPath, "measurement/parameters/scanning_probe_microscopy.json"),
        );
        const measurement = readJson(path.join(resolvedExamplesPath, "measurement.json"));

        const result = ajv.validate(measurement.parameters, parameters);
        expect(result.isValid, JSON.stringify(result.errors)).to.equal(true);
    });

    it("describes every schema it adds", () => {
        const undocumented = EXPERIMENTAL_SCHEMA_ROOTS.flatMap(listSchemaFiles)
            .filter((filePath) => {
                const schema = readJson(filePath);
                // enum_options bags carry no $schema and no description, as in models_category.
                if (!schema.$schema) return false;
                return typeof schema.description !== "string" || !schema.description.trim();
            })
            .map((filePath) => path.relative(sourceSchemasPath, filePath));

        expect(undocumented, "schemas without a description").to.deep.equal([]);
    });

    it("keeps inline array values in examples within the documented budget", () => {
        const oversized: string[] = [];
        walkDirSync(sourceExamplesPath, (filePath) => {
            if (!filePath.endsWith(".json")) return;
            const lengths = collectInlineArrayLengths(readJson(filePath));
            if (lengths.some((length) => length > INLINE_ARRAY_VALUES_BUDGET)) {
                oversized.push(path.relative(sourceExamplesPath, filePath));
            }
        });

        expect(oversized, "examples with inline arrays over budget").to.deep.equal([]);
    });
});
