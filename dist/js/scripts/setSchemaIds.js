"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const filesystem_1 = require("../utils/filesystem");
/**
 * Helper script.
 * Applies correct $id to all schemas based on the schema path
 */
function setSchemaIds(schemaDir) {
    (0, filesystem_1.walkDirSync)(schemaDir, (filePath) => {
        if (path_1.default.extname(filePath) !== ".json") {
            return;
        }
        const fileContents = fs_1.default.readFileSync(filePath);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $id, ...schema } = JSON.parse(fileContents.toString());
        const schemaId = filePath.replace(schemaDir, "").replace(".json", "").replace(/_/g, "-");
        if ($id !== schemaId) {
            console.log(`Set correct $id: ${filePath}`);
            const newContent = JSON.stringify({ $id: schemaId, ...schema }, null, 4);
            fs_1.default.writeFileSync(filePath, `${newContent}\n`);
        }
    });
}
exports.default = setSchemaIds;
