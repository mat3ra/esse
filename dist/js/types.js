"use strict";
/** Schema dist/js/schema/apse/db/materials_project/2025.9.25/summary.json */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Action = exports.Type = void 0;
/**
 * The type of the message to distinguish the direction of the message.
 */
var Type;
(function (Type) {
    Type["fromIframeToHost"] = "from-iframe-to-host";
    Type["fromHostToIframe"] = "from-host-to-iframe";
})(Type = exports.Type || (exports.Type = {}));
/**
 * The action to be performed upon receiving the message.
 */
var Action;
(function (Action) {
    Action["setData"] = "set-data";
    Action["getData"] = "get-data";
    Action["info"] = "info";
})(Action = exports.Action || (exports.Action = {}));
