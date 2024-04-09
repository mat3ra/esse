"use strict";
/** Schema dist/js/schema/3pse/db/nist_jarvis/2024.3.13/atoms.json */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Action = exports.Type = void 0;
/**
 * The type of the message to distinguish the direction of the message.
 */
var Type;
(function (Type) {
    Type["fromIframeToHost"] = "from-iframe-to-host";
    Type["fromHostToIframe"] = "from-host-to-iframe";
})((Type = exports.Type || (exports.Type = {})));
/**
 * The action to be performed upon receiving the message.
 */
var Action;
(function (Action) {
    Action["setData"] = "set-data";
    Action["getData"] = "get-data";
    Action["info"] = "info";
})((Action = exports.Action || (exports.Action = {})));
