import apiSafe, { getSafeValue } from "./apiSafe";
import React from "react";
import ToolbarButton from "../UI/components/ToolbarButton";
import { advancedVisible$, showTopLeftButton$ } from "./bindings";

const TaxMod: React.FC<{ mount?: string }> = ({ mount }) => {
    const advancedVisible = getSafeValue(apiSafe.useValue<boolean>(advancedVisible$), false);
    const showTopLeft = getSafeValue(apiSafe.useValue<boolean>(showTopLeftButton$), false);

    if (mount === 'GameTopLeft' && !showTopLeft) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <ToolbarButton
                onClick={() => apiSafe.trigger('taxProduction', 'toggleAdvancedWindow')}
                isActive={advancedVisible}
                title="Advanced Tax & Production Manager"
            />
        </div>
    );
};

export default TaxMod;
