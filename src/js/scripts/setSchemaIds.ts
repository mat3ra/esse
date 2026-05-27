import fs from "fs";
import path from "path";

import { walkDirSync } from "../utils/filesystem";

/**
 * Helper script.
 * Applies correct $id to all schemas based on the schema path
 */

export default function setSchemaIds(schemaDir: string) {
    walkDirSync(schemaDir, (filePath) => {
        if (path.extname(filePath) !== ".json") {
            return;
        }

        const fileContents = fs.readFileSync(filePath);
        console.log(filePath);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $id, ...schema } = JSON.parse(fileContents.toString());
        const schemaId = filePath.replace(schemaDir, "").replace(".json", "").replace(/_/g, "-");
        if ($id !== schemaId) {
            console.log(`Set correct $id: ${filePath}`);
            const newContent = JSON.stringify({ $id: schemaId, ...schema }, null, 4);

            fs.writeFileSync(filePath, `${newContent}\n`);
        }
    });
}
