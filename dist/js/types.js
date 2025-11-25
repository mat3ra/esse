"use strict";
/** Schema dist/js/schema/apse/db/materials_project/2025.9.25/summary.json */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Action = exports.Type = exports.ContextProviderNameEnum = exports.Name = void 0;
var Name;
(function (Name) {
    Name["PlanewaveCutoffDataManager"] = "PlanewaveCutoffDataManager";
    Name["KGridFormDataManager"] = "KGridFormDataManager";
    Name["QGridFormDataManager"] = "QGridFormDataManager";
    Name["IGridFormDataManager"] = "IGridFormDataManager";
    Name["QPathFormDataManager"] = "QPathFormDataManager";
    Name["IPathFormDataManager"] = "IPathFormDataManager";
    Name["KPathFormDataManager"] = "KPathFormDataManager";
    Name["ExplicitKPathFormDataManager"] = "ExplicitKPathFormDataManager";
    Name["ExplicitKPath2PIBAFormDataManager"] = "ExplicitKPath2PIBAFormDataManager";
    Name["HubbardJContextManager"] = "HubbardJContextManager";
    Name["HubbardUContextManager"] = "HubbardUContextManager";
    Name["HubbardVContextManager"] = "HubbardVContextManager";
    Name["HubbardContextManagerLegacy"] = "HubbardContextManagerLegacy";
    Name["NEBFormDataManager"] = "NEBFormDataManager";
    Name["BoundaryConditionsFormDataManager"] = "BoundaryConditionsFormDataManager";
    Name["MLSettingsDataManager"] = "MLSettingsDataManager";
    Name["MLTrainTestSplitDataManager"] = "MLTrainTestSplitDataManager";
    Name["IonDynamicsContextProvider"] = "IonDynamicsContextProvider";
    Name["CollinearMagnetizationDataManager"] = "CollinearMagnetizationDataManager";
    Name["NonCollinearMagnetizationDataManager"] = "NonCollinearMagnetizationDataManager";
    Name["QEPWXInputDataManager"] = "QEPWXInputDataManager";
    Name["QENEBInputDataManager"] = "QENEBInputDataManager";
    Name["VASPInputDataManager"] = "VASPInputDataManager";
    Name["VASPNEBInputDataManager"] = "VASPNEBInputDataManager";
    Name["NWChemInputDataManager"] = "NWChemInputDataManager";
})(Name = exports.Name || (exports.Name = {}));
/**
 * This interface was referenced by `ContextProvidersDirectoryEnum`'s JSON-Schema
 * via the `definition` "ContextProviderNameEnum".
 */
var ContextProviderNameEnum;
(function (ContextProviderNameEnum) {
    ContextProviderNameEnum["PlanewaveCutoffDataManager"] = "PlanewaveCutoffDataManager";
    ContextProviderNameEnum["KGridFormDataManager"] = "KGridFormDataManager";
    ContextProviderNameEnum["QGridFormDataManager"] = "QGridFormDataManager";
    ContextProviderNameEnum["IGridFormDataManager"] = "IGridFormDataManager";
    ContextProviderNameEnum["QPathFormDataManager"] = "QPathFormDataManager";
    ContextProviderNameEnum["IPathFormDataManager"] = "IPathFormDataManager";
    ContextProviderNameEnum["KPathFormDataManager"] = "KPathFormDataManager";
    ContextProviderNameEnum["ExplicitKPathFormDataManager"] = "ExplicitKPathFormDataManager";
    ContextProviderNameEnum["ExplicitKPath2PIBAFormDataManager"] = "ExplicitKPath2PIBAFormDataManager";
    ContextProviderNameEnum["HubbardJContextManager"] = "HubbardJContextManager";
    ContextProviderNameEnum["HubbardUContextManager"] = "HubbardUContextManager";
    ContextProviderNameEnum["HubbardVContextManager"] = "HubbardVContextManager";
    ContextProviderNameEnum["HubbardContextManagerLegacy"] = "HubbardContextManagerLegacy";
    ContextProviderNameEnum["NEBFormDataManager"] = "NEBFormDataManager";
    ContextProviderNameEnum["BoundaryConditionsFormDataManager"] = "BoundaryConditionsFormDataManager";
    ContextProviderNameEnum["MLSettingsDataManager"] = "MLSettingsDataManager";
    ContextProviderNameEnum["MLTrainTestSplitDataManager"] = "MLTrainTestSplitDataManager";
    ContextProviderNameEnum["IonDynamicsContextProvider"] = "IonDynamicsContextProvider";
    ContextProviderNameEnum["CollinearMagnetizationDataManager"] = "CollinearMagnetizationDataManager";
    ContextProviderNameEnum["NonCollinearMagnetizationDataManager"] = "NonCollinearMagnetizationDataManager";
    ContextProviderNameEnum["QEPWXInputDataManager"] = "QEPWXInputDataManager";
    ContextProviderNameEnum["QENEBInputDataManager"] = "QENEBInputDataManager";
    ContextProviderNameEnum["VASPInputDataManager"] = "VASPInputDataManager";
    ContextProviderNameEnum["VASPNEBInputDataManager"] = "VASPNEBInputDataManager";
    ContextProviderNameEnum["NWChemInputDataManager"] = "NWChemInputDataManager";
})(ContextProviderNameEnum = exports.ContextProviderNameEnum || (exports.ContextProviderNameEnum = {}));
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
