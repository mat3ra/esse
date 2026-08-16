/**
 * build_schemas uses node API to read all schemas from the FS
 * at build time and writes them out to a single schemas.js file for
 * downstream consumption to avoid FS calls in the browser.
 */
import * as fs from "fs";

import JSONSchemasGenerator from "./src/js/esse/JSONSchemasGenerator";

// JS Modules

const generator = new JSONSchemasGenerator();
const { schemas, wrappedExamples, propertiesManifest, results } = generator;

if (process.env.BUILD_PYTHON_MODULES === "true") {
    // PY Modules
    fs.writeFileSync(
        "./src/py/mat3ra/esse/data/examples.py",
        ["import json", `EXAMPLES = json.loads(r'''${JSON.stringify(wrappedExamples)}''')`].join(
            "\n",
        ),
        "utf8",
    );
    fs.writeFileSync(
        "./src/py/mat3ra/esse/data/schemas.py",
        ["import json", `SCHEMAS = json.loads(r'''${JSON.stringify(schemas)}''')`].join("\n"),
        "utf8",
    );
    fs.writeFileSync(
        "./src/py/mat3ra/esse/data/properties.py",
        [
            "import json",
            `PROPERTIES_MANIFEST = json.loads(r'''${JSON.stringify(propertiesManifest)}''')`,
            `RESULTS = json.loads(r'''${JSON.stringify(results)}''')`,
        ].join("\n"),
        "utf8",
    );
}

if (process.env.BUILD_ASSETS !== "true") {
    process.exit(0);
}

const subfolder = process.env.BUILD_PATH || "./dist/js/";
const skipMergeAllOff = process.env.SKIP_MERGE_ALLOF === "true";

generator.writeResolvedSchemas(subfolder, skipMergeAllOff);
generator.writeResolvedExamples(subfolder);
