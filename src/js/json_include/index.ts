import fs from "fs";
import path from "path";

import { isInstanceOf, safeParseJSON } from "../utils/common";
import { INCLUDE_KEY, INCLUDE_VALUE_REGEX, OBJECT_ONLY } from "./settings";

export interface CacheObject {
    [key: string]: CacheObject | CacheObject[];
}

export class JSONInclude {
    JSON_INCLUDE_CACHE: CacheObject = {};

    /**
     * Extracts file name(path) from the include statement.
     * @param value string to extract the file name from.
     */
    _getIncludeFileName = (value: unknown) => {
        if (typeof value === "string" && value.search(INCLUDE_VALUE_REGEX) !== -1) {
            const matched = value.match(INCLUDE_VALUE_REGEX);
            return matched && matched[1];
        }
    };

    /**
     * Walks a nested object to resolve include statements.
     * @param obj Object to traverse.
     * @param dirpath directory from which `obj` is obtained. Include statements are relative to `obj` path.
     */
    _walkObjectToInclude(obj: CacheObject | CacheObject[], dirpath: string) {
        if (isInstanceOf(obj, "Array")) {
            for (let i = 0; i < obj.length; i++) {
                if (isInstanceOf(obj[i], "Object") || isInstanceOf(obj[i], "Array")) {
                    this._walkObjectToInclude(obj[i], dirpath);
                }
            }
        } else if (isInstanceOf(obj, "Object")) {
            if (INCLUDE_KEY in obj) {
                const includeName = this._getIncludeFileName(obj[INCLUDE_KEY]);
                if (includeName) {
                    delete obj[INCLUDE_KEY];
                    if (!(includeName in this.JSON_INCLUDE_CACHE)) {
                        const filePath = path.join(dirpath, includeName);
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
                if (isInstanceOf(obj[key], "Object") || isInstanceOf(obj[key], "Array")) {
                    this._walkObjectToInclude(obj[key], dirpath);
                }
            });
        }
    }

    /**
     * Resolves `include` statements.
     * @param filePath file to parse.
     */
    parseIncludeStatements(filePath: string) {
        const data: CacheObject[] = safeParseJSON(fs.readFileSync(filePath, "utf8"));
        console.log("Parsing file: ", filePath);
        if (OBJECT_ONLY && !isInstanceOf(data, "Object")) {
            throw new Error(
                "The JSON file being included should always be a dict rather than a list",
            );
        }
        this._walkObjectToInclude(data, path.dirname(filePath));
        return data;
    }
}
