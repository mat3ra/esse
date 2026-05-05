"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeParseJSON = exports.isInstanceOf = void 0;
function isInstanceOf(object, type) {
    return Object.prototype.toString.call(object).slice(8, -1) === type;
}
exports.isInstanceOf = isInstanceOf;
/**
 * Makes sure that text representing arrays is parsed into Arrays.
 */
function safeParseJSON(string) {
    const obj = JSON.parse(string);
    return string[0] === "[" ? Object.keys(obj).map((key) => obj[key]) : obj;
}
exports.safeParseJSON = safeParseJSON;
