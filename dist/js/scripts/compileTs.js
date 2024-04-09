"use strict";
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const json_schema_to_typescript_1 = require("json-schema-to-typescript");
const schemaUtils_1 = require("../esse/schemaUtils");
const filesystem_1 = require("../utils/filesystem");
/**
 * By definition, the "compile" function will generate 2 schemas based on the following input:
 * {
 *    "title": "schema1",
 *    "type": "object",
 *    "properties": {
 *        "prop": {
 *             "title": "schema2",
 *             "type": "string"
 *        }
 *    }
 * }
 *
 * Result:
 * type schema2 = string;
 *
 * interface schema1 {
 *      prop: schema2
 * }
 *
 * To disable this behavior we need to remove "title" property from the "prop":
 *  {
 *    "title": "schema1",
 *    "type": "object",
 *    "properties": {
 *        "prop": {
 *             "type": "string"
 *        }
 *    }
 * }
 *
 * New result:
 * interface schema1 {
 *      prop: string;
 * }
 * @returns Clean schema
 */
function cleanSchema(schema) {
    let firstRun = true;
    return (0, schemaUtils_1.mapObjectDeep)(schema, (object) => {
        if (
            typeof object === "object" &&
            (object === null || object === void 0 ? void 0 : object.title) &&
            !firstRun
        ) {
            firstRun = false;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { title, $schema, ...restObject } = object;
            return restObject;
        }
        firstRun = false;
    });
}
async function compileTS(schemaPath, savePath) {
    try {
        await fs_1.default.promises.unlink(savePath);
    } catch (err) {
        console.log("File with types not exists");
    }
    await (0, filesystem_1.walkDir)(schemaPath, async (filePath) => {
        const data = await fs_1.default.promises.readFile(filePath, "utf8");
        const schema = cleanSchema(JSON.parse(data));
        console.log(`Compiling Typescript: ${filePath}`);
        // @ts-ignore
        const compiledSchema = await (0, json_schema_to_typescript_1.compile)(
            schema,
            schema.title || "",
            {
                unreachableDefinitions: true,
                additionalProperties: false,
                enableConstEnums: false,
                bannerComment: `/** Schema ${filePath} */`,
            },
        );
        await fs_1.default.promises.appendFile(savePath, `${compiledSchema} \n`, { flag: "a+" });
    });
}
exports.default = compileTS;
