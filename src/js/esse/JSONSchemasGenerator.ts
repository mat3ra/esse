/* eslint-disable class-methods-use-this */
import fs from "fs";
import yaml from "js-yaml";
import mergeAllOf from "json-schema-merge-allof";
import path from "path";

import { EXAMPLES_DIR, PROPERTIES_MANIFEST_PATH, SCHEMAS_DIR } from "./settings";
import { JSONSchema, JSONSchemaWithPath, parseIncludeReferenceStatementsByDir } from "./utils";

interface JSONSchemasGeneratorConfig {
    schemasDir: string;
    examplesDir?: string;
    propertiesManifestDir?: string;
}

const DEFAULT_CONFIG = {
    schemasDir: SCHEMAS_DIR,
    examplesDir: EXAMPLES_DIR,
    propertiesManifestDir: PROPERTIES_MANIFEST_PATH,
};

export default class JSONSchemasGenerator implements JSONSchemasGeneratorConfig {
    readonly schemas: JSONSchema[];

    readonly examples?: JSONSchema[];

    readonly wrappedExamples: JSONSchemaWithPath[];

    readonly propertiesManifest: object;

    readonly results: object;

    readonly schemasDir: string;

    readonly examplesDir?: string;

    readonly propertiesManifestDir?: string;

    constructor(config: JSONSchemasGeneratorConfig = DEFAULT_CONFIG) {
        this.schemasDir = config.schemasDir;
        this.examplesDir = config.examplesDir;
        this.propertiesManifestDir = config.propertiesManifestDir;

        this.schemas = parseIncludeReferenceStatementsByDir(this.schemasDir);

        this.wrappedExamples = this.examplesDir
            ? parseIncludeReferenceStatementsByDir(this.examplesDir, true)
            : [];

        this.examples = this.wrappedExamples.map((example) => example.data);

        this.propertiesManifest = this.propertiesManifestDir
            ? (yaml.load(fs.readFileSync(this.propertiesManifestDir, "utf-8")) as object)
            : {};

        this.results = Object.entries(this.propertiesManifest)
            .map((k) => (k[1].isResult ? k[0] : null))
            .filter((x) => x) as object;
    }

    writeResolvedSchemas(subfolder: string, skipMergeAllOff = false) {
        const schemasFolder = `${subfolder}/schema`;
        fs.rmSync(schemasFolder, { recursive: true, force: true });

        const mergeAllOfConfig = {
            resolvers: { defaultResolver: mergeAllOf.options.resolvers.title },
        };

        const schemas = this.schemas.map((schema) => {
            console.log(`Resolving schema: ${schema.$id}`);
            const mergedSchema = skipMergeAllOff ? schema : mergeAllOf(schema, mergeAllOfConfig);
            let idAsPath = mergedSchema.$id;
            if (!idAsPath) {
                throw new Error(`Schema ID is missing:
                ${JSON.stringify(mergedSchema)}`);
            }
            const schemaHasDash = idAsPath.includes("-");
            if (schemaHasDash) {
                // replace dashes with underscores
                idAsPath = idAsPath.replace(/-/g, "_");
            }

            const fullPath = `${schemasFolder}/${idAsPath}.json`;

            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, JSON.stringify(mergedSchema, null, 4), "utf8");

            return mergedSchema;
        });

        fs.writeFileSync(`${subfolder}/schemas.json`, `${JSON.stringify(schemas)}`);
    }

    writeResolvedExamples(subfolder: string) {
        const examplesFolder = `${subfolder}/example`;
        fs.rmSync(`${examplesFolder}`, { recursive: true, force: true });
        this.wrappedExamples.forEach((e) => {
            const idAsPath = e.path.replace(/-/g, "_");
            const fullPath = `${examplesFolder}/${idAsPath}.json`;
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, JSON.stringify(e.data, null, 4), "utf8");
        });
    }
}
