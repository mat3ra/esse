"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONInclude = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const common_1 = require("../utils/common");
const settings_1 = require("./settings");
class JSONInclude {
    constructor() {
        this.JSON_INCLUDE_CACHE = {};
        /**
         * Extracts file name(path) from the include statement.
         * @param value string to extract the file name from.
         */
        this._getIncludeFileName = (value) => {
            if (typeof value === "string" && value.search(settings_1.INCLUDE_VALUE_REGEX) !== -1) {
                const matched = value.match(settings_1.INCLUDE_VALUE_REGEX);
                return matched && matched[1];
            }
        };
    }
    /**
     * Walks a nested object to resolve include statements.
     * @param obj Object to traverse.
     * @param dirpath directory from which `obj` is obtained. Include statements are relative to `obj` path.
     */
    _walkObjectToInclude(obj, dirpath) {
        if ((0, common_1.isInstanceOf)(obj, "Array")) {
            for (let i = 0; i < obj.length; i++) {
                if ((0, common_1.isInstanceOf)(obj[i], "Object") || (0, common_1.isInstanceOf)(obj[i], "Array")) {
                    this._walkObjectToInclude(obj[i], dirpath);
                }
            }
        }
        else if ((0, common_1.isInstanceOf)(obj, "Object")) {
            if (settings_1.INCLUDE_KEY in obj) {
                const includeName = this._getIncludeFileName(obj[settings_1.INCLUDE_KEY]);
                if (includeName) {
                    delete obj[settings_1.INCLUDE_KEY];
                    if (!(includeName in this.JSON_INCLUDE_CACHE)) {
                        const filePath = path_1.default.join(dirpath, includeName);
                        this.JSON_INCLUDE_CACHE[includeName] =
                            this.parseIncludeStatements(filePath);
                    }
                    Object.keys(this.JSON_INCLUDE_CACHE[includeName]).forEach((attr) => {
                        // @ts-ignore
                        obj[attr] = this.JSON_INCLUDE_CACHE[includeName][attr];
                    });
                }
            }
            Object.keys(obj).forEach((key) => {
                if ((0, common_1.isInstanceOf)(obj[key], "Object") || (0, common_1.isInstanceOf)(obj[key], "Array")) {
                    this._walkObjectToInclude(obj[key], dirpath);
                }
            });
        }
    }
    /**
     * Resolves `include` statements.
     * @param filePath file to parse.
     */
    parseIncludeStatements(filePath) {
        const data = (0, common_1.safeParseJSON)(fs_1.default.readFileSync(filePath, "utf8"));
        console.log("Parsing file: ", filePath);
        if (settings_1.OBJECT_ONLY && !(0, common_1.isInstanceOf)(data, "Object")) {
            throw new Error("The JSON file being included should always be a dict rather than a list");
        }
        this._walkObjectToInclude(data, path_1.default.dirname(filePath));
        return data;
    }
}
exports.JSONInclude = JSONInclude;
