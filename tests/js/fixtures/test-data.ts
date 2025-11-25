type JSONSchema = any;

export const originalSchema: JSONSchema = {
    $id: "boundary-conditions-test",
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Boundary Conditions Test Schema",
    type: "object",
    properties: {
        type: {
            type: "string",
            title: "Type",
        },
        offset: {
            type: "number",
            title: "Offset (A)",
        },
        electricField: {
            type: "number",
            title: "Electric Field (eV/A)",
        },
        targetFermiEnergy: {
            type: "number",
            title: "Target Fermi Energy (eV)",
        },
    },
};

export const patchConfig = {
    properties: {
        type: {
            default: "pbc",
            enum: ["pbc", "fixed", "open"],
        },
        offset: {
            default: 0.5,
            minimum: 0,
        },
        electricField: {
            default: 0.001,
        },
        targetFermiEnergy: {
            default: -5.2,
        },
    },
};

export const patchConfigDotNotation = {
    properties: {
        "type.default": "pbc",
        "type.enum": ["pbc", "fixed", "open"],
        "offset.default": 0.5,
        "offset.minimum": 0,
        "electricField.default": 0.001,
        "targetFermiEnergy.default": -5.2,
    },
};

export const expectedPatchedSchema = {
    $id: "boundary-conditions-test",
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Boundary Conditions Test Schema",
    type: "object",
    properties: {
        type: {
            type: "string",
            title: "Type",
            default: "pbc",
            enum: ["pbc", "fixed", "open"],
        },
        offset: {
            type: "number",
            title: "Offset (A)",
            default: 0.5,
            minimum: 0,
        },
        electricField: {
            type: "number",
            title: "Electric Field (eV/A)",
            default: 0.001,
        },
        targetFermiEnergy: {
            type: "number",
            title: "Target Fermi Energy (eV)",
            default: -5.2,
        },
    },
};
