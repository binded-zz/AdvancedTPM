import { ModRegistrar } from "cs2/modding";
import TaxMod from "mods/TaxMod";
import TaxWindow from "mods/TaxWindow";

// Runtime diagnostic: log when the JS module is loaded and when registration occurs.
try { console.log("AdvancedTPM: JS module loaded"); } catch (e) {}

const register: ModRegistrar = (moduleRegistry) => {
    try { console.log("AdvancedTPM: registering modules"); } catch (e) {}
    moduleRegistry.append('GameTopLeft', TaxMod);
    moduleRegistry.append('Game', TaxWindow);
};

export default register;
