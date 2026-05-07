import React from 'react';

const ServiceIcon: React.FC<{ category?: string; size?: number; style?: React.CSSProperties }> = ({ category = 'Other', size = 18, style }) => {
  const c = (category || 'Other').toLowerCase();

  const pickIcon = (): string => {
    // Zones
    if (c === 'residential') return 'Media/Game/Icons/ZoneResidential.svg';
    if (c === 'commercial') return 'Media/Game/Icons/ZoneCommercial.svg';
    if (c === 'industrial') return 'Media/Game/Icons/ZoneIndustrial.svg';
    if (c === 'office') return 'Media/Game/Icons/ZoneOffice.svg';
    if (c === 'storage') return 'Media/Game/Icons/ZoneIndustrial.svg'; // Reuse industrial for storage
    if (c === 'extraction' || c === 'rawindustrial') return 'Media/Game/Icons/ZoneExtractors.svg';

    // Services
    if (c.includes('police') || c.includes('prison')) return 'Media/Game/Icons/Police.svg';
    if (c.includes('fire') || c.includes('rescue') || c.includes('emerg')) return 'Media/Game/Icons/FireSafety.svg';
    if (c.includes('health') || c.includes('hospital') || c.includes('clinic') || c.includes('ambulance')) return 'Media/Game/Icons/Healthcare.svg';
    if (c.includes('death') || c.includes('cemetery') || c.includes('crematorium')) return 'Media/Game/Icons/Deathcare.svg';
    if (c.includes('education') || c.includes('school') || c.includes('college') || c.includes('university')) return 'Media/Game/Icons/Education.svg';
    if (c.includes('electric') || c.includes('power')) return 'Media/Game/Icons/Electricity.svg';
    if (c.includes('water') || c.includes('sewage') || c.includes('wastewater')) return 'Media/Game/Icons/Water.svg';
    if (c.includes('garbage') || c.includes('waste') || c.includes('landfill') || c.includes('recycling')) return 'Media/Game/Icons/Garbage.svg';
    if (c.includes('park') || c.includes('recreation') || c.includes('leisure')) return 'Media/Game/Icons/Parks.svg';
    if (c.includes('telecom') || c.includes('internet')) return 'Media/Game/Resources/Telecom.svg';
    if (c.includes('post') || c.includes('mail')) return 'Media/Game/Icons/PostService.svg';
    if (c.includes('bus') || c.includes('tram') || c.includes('metro') || c.includes('subway') || c.includes('transport')) return 'Media/Game/Icons/Transportation.svg';
    if (c.includes('train') || c.includes('rail')) return 'Media/Game/Icons/Train.svg';
    if (c.includes('airport') || c.includes('air')) return 'Media/Game/Icons/Airport.svg';
    if (c.includes('harbor') || c.includes('port') || c.includes('ship')) return 'Media/Game/Icons/Harbor.svg';
    if (c.includes('road') || c.includes('highway')) return 'Media/Game/Icons/Roads.svg';
    
    return 'Media/Game/Icons/Services.svg';
  };

  return (
    <img
      src={pickIcon()}
      width={size}
      height={size}
      style={{ marginRight: 6, flexShrink: 0, ...style }}
      alt=""
      onError={(e) => {
        const el = e.currentTarget;
        if (!el.dataset.fallback) {
          el.dataset.fallback = '1';
          el.src = 'Media/Game/Icons/Services.svg';
        }
      }}
    />
  );
};

export default ServiceIcon;
