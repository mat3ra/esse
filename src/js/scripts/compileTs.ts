import { SchemaObject } from "ajv";
import fs from "fs";
import { compile } from "json-schema-to-typescript";

import { mapObjectDeep } from "../esse/schemaUtils";
import { JSONSchema } from "../esse/utils";
import { walkDir } from "../utils/filesystem";

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
function cleanSchema(schema: JSONSchema): JSONSchema {
    let firstRun = true;

    return mapObjectDeep(schema, (object) => {
        if (typeof object === "object" && object?.title && !firstRun) {
            firstRun = false;

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { title, $schema, ...restObject } = object as SchemaObject;
            return restObject;
        }

        firstRun = false;
    });
}

export default async function compileTS(schemaPath: string, savePath: string) {
    try {
        await fs.promises.unlink(savePath);
    } catch (err) {
        console.log("File with types not exists");
    }

    await walkDir(schemaPath, async (filePath) => {
        const data = await fs.promises.readFile(filePath, "utf8");
        const schema = cleanSchema(JSON.parse(data));

        console.log(`Compiling Typescript: ${filePath}`);

        // @ts-ignore
        const compiledSchema = await compile(schema, schema.title || "", {
            unreachableDefinitions: true,
            additionalProperties: false,
            enableConstEnums: false,
            bannerComment: `/** Schema ${filePath} */`,
        });

        await fs.promises.appendFile(savePath, `${compiledSchema} \n`, { flag: "a+" });
    });
}
