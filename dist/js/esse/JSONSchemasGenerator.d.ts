import { JSONSchemaWithPath } from "./serverUtils";
import type { JSONSchema } from "./utils";
interface JSONSchemasGeneratorConfig {
    schemasDir: string;
    examplesDir?: string;
    propertiesManifestDir?: string;
}
export default class JSONSchemasGenerator implements JSONSchemasGeneratorConfig {
    readonly schemas: JSONSchema[];
    readonly examples?: JSONSchema[];
    readonly wrappedExamples: JSONSchemaWithPath[];
    readonly propertiesManifest: object;
    readonly results: object;
    readonly schemasDir: string;
    readonly examplesDir?: string;
    readonly propertiesManifestDir?: string;
    constructor(config?: JSONSchemasGeneratorConfig);
    writeResolvedSchemas(subfolder: string, skipMergeAllOff?: boolean): void;
    writeResolvedExamples(subfolder: string): void;
}
export {};
