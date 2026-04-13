import { ModRegistrar } from "cs2/modding";
import TaxMod from "mods/TaxMod";
import TaxWindow from "mods/TaxWindow";

const register: ModRegistrar = (moduleRegistry) => {
    moduleRegistry.append('GameTopLeft', TaxMod);
    moduleRegistry.append('Game', TaxWindow);
};

export default register;
