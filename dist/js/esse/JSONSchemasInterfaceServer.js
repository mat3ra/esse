"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readSchemaFolderSync = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const filesystem_1 = require("../utils/filesystem");
const JSONSchemasInterface_1 = __importDefault(require("./JSONSchemasInterface"));
function readSchemaFolderSync(folderPath) {
    const schemas = [];
    (0, filesystem_1.walkDirSync)(folderPath, (filePath) => {
        if (path_1.default.extname(filePath) !== ".json") {
            return;
        }
        const schema = JSON.parse(fs_1.default.readFileSync(filePath).toString());
        schemas.push(schema);
    });
    return schemas;
}
exports.readSchemaFolderSync = readSchemaFolderSync;
class JSONSchemasInterfaceServer extends JSONSchemasInterface_1.default {
    static setSchemaFolder(schemaFolder) {
        if (this.schemaFolder !== schemaFolder) {
            this.schemaFolder = schemaFolder;
            this.readSchemaFolder();
        }
    }
    static readSchemaFolder() {
        const schemas = readSchemaFolderSync(this.schemaFolder);
        schemas.forEach((schema) => {
            if (schema.$id) {
                this.schemasCache.set(schema.$id, schema);
            }
        });
    }
    static getSchemaById(schemaId) {
        if (this.schemasCache.size === 0) {
            this.readSchemaFolder();
        }
        return super.getSchemaById(schemaId);
    }
}
exports.default = JSONSchemasInterfaceServer;
JSONSchemasInterfaceServer.schemaFolder = path_1.default.resolve(__dirname, "./../schema");
