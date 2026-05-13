"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable class-methods-use-this */
const fs_1 = __importDefault(require("fs"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const json_schema_merge_allof_1 = __importDefault(require("json-schema-merge-allof"));
const path_1 = __importDefault(require("path"));
const serverUtils_1 = require("./serverUtils");
const settings_1 = require("./settings");
const DEFAULT_CONFIG = {
    schemasDir: settings_1.SCHEMAS_DIR,
    examplesDir: settings_1.EXAMPLES_DIR,
    propertiesManifestDir: settings_1.PROPERTIES_MANIFEST_PATH,
};
class JSONSchemasGenerator {
    constructor(config = DEFAULT_CONFIG) {
        this.schemasDir = config.schemasDir;
        this.examplesDir = config.examplesDir;
        this.propertiesManifestDir = config.propertiesManifestDir;
        this.schemas = (0, serverUtils_1.parseIncludeReferenceStatementsByDir)(this.schemasDir);
        this.wrappedExamples = this.examplesDir
            ? (0, serverUtils_1.parseIncludeReferenceStatementsByDir)(this.examplesDir, true)
            : [];
        this.examples = this.wrappedExamples.map((example) => example.data);
        this.propertiesManifest = this.propertiesManifestDir
            ? js_yaml_1.default.load(fs_1.default.readFileSync(this.propertiesManifestDir, "utf-8"))
            : {};
        this.results = Object.entries(this.propertiesManifest)
            .map((k) => (k[1].isResult ? k[0] : null))
            .filter((x) => x);
    }
    writeResolvedSchemas(subfolder, skipMergeAllOff = false) {
        const schemasFolder = `${subfolder}/schema`;
        fs_1.default.rmSync(schemasFolder, { recursive: true, force: true });
        const mergeAllOfConfig = {
            resolvers: { defaultResolver: json_schema_merge_allof_1.default.options.resolvers.title },
        };
        const schemas = this.schemas.map((schema) => {
            console.log(`Resolving schema: ${schema.$id}`);
            const mergedSchema = skipMergeAllOff ? schema : (0, json_schema_merge_allof_1.default)(schema, mergeAllOfConfig);
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
            fs_1.default.mkdirSync(path_1.default.dirname(fullPath), { recursive: true });
            fs_1.default.writeFileSync(fullPath, JSON.stringify(mergedSchema, null, 4), "utf8");
            return mergedSchema;
        });
        fs_1.default.writeFileSync(`${subfolder}/schemas.json`, `${JSON.stringify(schemas)}`);
    }
    writeResolvedExamples(subfolder) {
        const examplesFolder = `${subfolder}/example`;
        fs_1.default.rmSync(`${examplesFolder}`, { recursive: true, force: true });
        this.wrappedExamples.forEach((e) => {
            const idAsPath = e.path.replace(/-/g, "_");
            const fullPath = `${examplesFolder}/${idAsPath}.json`;
            fs_1.default.mkdirSync(path_1.default.dirname(fullPath), { recursive: true });
            fs_1.default.writeFileSync(fullPath, JSON.stringify(e.data, null, 4), "utf8");
        });
    }
}
exports.default = JSONSchemasGenerator;
