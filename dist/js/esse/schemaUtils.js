"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapObjectDeep = void 0;
function mapObjectDeep(object, mapValue) {
    if (typeof object !== "object" || object === null) {
        return object;
    }
    if (Array.isArray(object)) {
        return object.map((innerValue) => mapObjectDeep(innerValue, mapValue));
    }
    const mappedObject = mapValue(object) || object;
    const entries = Object.entries(mappedObject).map(([key, value]) => {
        return [key, mapObjectDeep(value, mapValue)];
    });
    return Object.fromEntries(entries);
}
exports.mapObjectDeep = mapObjectDeep;
