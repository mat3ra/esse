type JSONSchema = any;

export const testSchemas: JSONSchema[] = [
    {
        "$id": "simple-test-schema",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Simple Test Schema",
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "title": "Name"
            },
            "age": {
                "type": "number",
                "title": "Age",
                "minimum": 0
            },
            "email": {
                "type": "string",
                "title": "Email",
                "format": "email"
            },
            "active": {
                "type": "boolean",
                "title": "Active Status"
            }
        },
        "required": ["name"]
    },
    {
        "$id": "boundary-conditions-test",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Boundary Conditions Test Schema",
        "type": "object",
        "properties": {
            "type": {
                "type": "string",
                "title": "Type"
            },
            "offset": {
                "type": "number",
                "title": "Offset (A)"
            },
            "electricField": {
                "type": "number",
                "title": "Electric Field (eV/A)"
            },
            "targetFermiEnergy": {
                "type": "number",
                "title": "Target Fermi Energy (eV)"
            }
        }
    }
];

export const mockFormData = {
    boundaryConditions: {
        type: "pbc",
        offset: 0.5,
        electricField: 0.001,
        targetFermiEnergy: -5.2
    }
};

export const expectedPatchResults = {
    boundaryConditionsSchema: {
        patchConfig: {
            type: { 
                default: mockFormData.boundaryConditions.type, 
                enum: ["pbc", "fixed", "open"] 
            },
            offset: { 
                default: mockFormData.boundaryConditions.offset, 
                minimum: 0 
            },
            electricField: { 
                default: mockFormData.boundaryConditions.electricField 
            },
            targetFermiEnergy: { 
                default: mockFormData.boundaryConditions.targetFermiEnergy 
            }
        },
        expectedDefaults: {
            type: "pbc",
            offset: 0.5,
            electricField: 0.001,
            targetFermiEnergy: -5.2
        }
    }
};
