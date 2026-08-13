import { expect } from "chai";

import * as ajv from "../../src/js/utils/ajv";
import { removeEmptyAndNullProperties } from "../../src/js/utils/removeEmptyAndNullProperties";

describe("removeEmptyAndNullProperties", () => {
    it("removes nulls but keeps empty strings (entity placeholders)", () => {
        const data = {
            name: "Si",
            slug: null,
            description: "",
            systemName: null,
            lattice: {
                a: 5.43,
                type: null,
                units: "",
            },
            tags: ["a", null, "b"],
        };

        removeEmptyAndNullProperties(data);

        expect(data).to.deep.equal({
            name: "Si",
            description: "",
            lattice: {
                a: 5.43,
                units: "",
            },
            tags: ["a", null, "b"],
        });
    });
});

describe("validateAndClean", () => {
    const schema = {
        $id: "test/material-input-with-nulls",
        type: "object",
        properties: {
            name: { type: "string" },
            slug: { type: "string" },
            description: { type: "string" },
            lattice: {
                type: "object",
                properties: {
                    a: { type: "number" },
                },
                required: ["a"],
                additionalProperties: false,
            },
        },
        required: ["name", "lattice"],
        additionalProperties: false,
    };

    it("strips null properties before schema validation; keeps empty strings", () => {
        const data = {
            name: "MolView",
            slug: null,
            systemName: null,
            description: "",
            lattice: { a: 15.18 },
            owner: { _id: "should-be-removed-as-additional" },
        };

        const result = ajv.validateAndClean(data, schema);

        expect(result.isValid).to.equal(true);
        expect(data).to.deep.equal({
            name: "MolView",
            description: "",
            lattice: { a: 15.18 },
        });
        expect(Object.prototype.hasOwnProperty.call(data, "slug")).to.equal(false);
    });
});
