"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walkDir = walkDir;
exports.walkDirSync = walkDirSync;
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function walkDir(dir, callback) {
    const subDirs = await fs_1.default.promises.readdir(dir);
    for (const subDir of subDirs) {
        const itemPath = path_1.default.join(dir, subDir);
        const stat = await fs_1.default.promises.stat(itemPath);
        if (stat.isDirectory()) {
            await walkDir(itemPath, callback);
        }
        else {
            await callback(itemPath);
        }
    }
}
function walkDirSync(dir, callback) {
    const subDirs = fs_1.default.readdirSync(dir);
    for (const subDir of subDirs) {
        const itemPath = path_1.default.join(dir, subDir);
        const stat = fs_1.default.statSync(itemPath);
        if (stat.isDirectory()) {
            walkDirSync(itemPath, callback);
        }
        else {
            callback(itemPath);
        }
    }
}
