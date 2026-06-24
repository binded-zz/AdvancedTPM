import React from 'react';
import { ICONS } from '../data/iconLibrary';

const ServiceIcon: React.FC<{ category?: string; size?: number; style?: React.CSSProperties }> = ({ category = 'Other', size = 18, style }) => {
  const c = (category || 'Other').toLowerCase();

  if (c === 'storage') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: `${size}rem`,
          height: `${size}rem`,
          marginRight: '6rem',
          flexShrink: 0,
          ...style
        }}
      >
        <path
          d="M3 10 L12 4 L21 10 V20 C21 20.5523 20.5523 21 20 21 H4 C3.44772 21 3 20.5523 3 20 V10 Z"
          stroke="#d4a876"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="8"
          y="13"
          width="8"
          height="8"
          rx="1"
          stroke="#d4a876"
          strokeWidth="2"
          fill="none"
        />
        <line x1="9" y1="16" x2="15" y2="16" stroke="#d4a876" strokeWidth="1.5" />
        <line x1="9" y1="19" x2="15" y2="19" stroke="#d4a876" strokeWidth="1.5" />
      </svg>
    );
  }

  const pickIcon = (): string => {
    // Zones
    if (c === 'residential') return ICONS.ZONE_RESIDENTIAL;
    if (c === 'commercial') return ICONS.ZONE_COMMERCIAL;
    if (c === 'industrial') return ICONS.ZONE_INDUSTRIAL;
    if (c === 'office') return ICONS.ZONE_OFFICE;
    if (c === 'extraction' || c === 'rawindustrial') return ICONS.ZONE_EXTRACTORS;

    // Services
    if (c.includes('police') || c.includes('prison')) return ICONS.SERVICE_POLICE;
    if (c.includes('fire') || c.includes('rescue') || c.includes('emerg')) return ICONS.SERVICE_FIRE;
    if (c.includes('health') || c.includes('hospital') || c.includes('clinic') || c.includes('ambulance')) return ICONS.SERVICE_HEALTH;
    if (c.includes('death') || c.includes('cemetery') || c.includes('crematorium')) return ICONS.SERVICE_DEATH;
    if (c.includes('education') || c.includes('school') || c.includes('college') || c.includes('university')) return ICONS.SERVICE_EDUCATION;
    if (c.includes('electric') || c.includes('power')) return ICONS.SERVICE_ELECTRICITY;
    if (c.includes('water') || c.includes('sewage') || c.includes('wastewater')) return ICONS.SERVICE_WATER;
    if (c.includes('garbage') || c.includes('waste') || c.includes('landfill') || c.includes('recycling')) return ICONS.SERVICE_GARBAGE;
    if (c.includes('park') || c.includes('recreation') || c.includes('leisure')) return ICONS.SERVICE_SERVICES;
    if (c.includes('telecom') || c.includes('internet')) return ICONS.SERVICE_TELECOM;
    if (c.includes('post') || c.includes('mail')) return ICONS.SERVICE_POST;
    if (c.includes('bus') || c.includes('tram') || c.includes('metro') || c.includes('subway') || c.includes('transport')) return ICONS.SERVICE_TRANSPORTATION;
    if (c.includes('train') || c.includes('rail')) return ICONS.SERVICE_TRAIN;
    if (c.includes('airport') || c.includes('air')) return ICONS.SERVICE_AIRPORT;
    if (c.includes('harbor') || c.includes('port') || c.includes('ship')) return ICONS.SERVICE_HARBOR;
    if (c.includes('road') || c.includes('highway')) return ICONS.SERVICE_ROADS;
    
    return ICONS.SERVICE_SERVICES;
  };

  return (
    <img
      src={pickIcon()}
      style={{
        width: `${size}rem`,
        height: `${size}rem`,
        marginRight: '6rem',
        flexShrink: 0,
        ...style
      }}
      alt=""
      onError={(e) => {
        const el = e.currentTarget;
        if (!el.dataset.fallback) {
          el.dataset.fallback = '1';
          el.src = ICONS.SERVICE_SERVICES;
        }
      }}
    />
  );
};

export default ServiceIcon;
