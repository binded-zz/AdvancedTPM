import { ModRegistrar } from "cs2/modding";
import TaxMod from "mods/TaxMod";
import TaxWindow from "mods/TaxWindow";

const TopLeftButton = () => <TaxMod mount="GameTopLeft" />;

const register: ModRegistrar = (moduleRegistry) => {
    moduleRegistry.append('GameTopLeft', TopLeftButton);
    moduleRegistry.append('Game', TaxWindow);
};

export default register;
