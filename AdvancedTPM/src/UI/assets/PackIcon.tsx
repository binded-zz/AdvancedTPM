import React from 'react';
import { ICONS } from '../data/iconLibrary';

interface PackIconProps {
  pack?: string;
  theme?: string;
  iconUrl?: string; // Comma-separated list of thumbnail URLs
  size?: number;
  style?: React.CSSProperties;
}

const PackIcon: React.FC<PackIconProps> = ({ pack, theme, iconUrl, size = 18, style }) => {
  let finalIconUrl = iconUrl;
  
  // 1. If the path is the broken vanilla base game svg, clear it.
  if (finalIconUrl === 'coui://uil/Colored/BaseGame.svg') {
    finalIconUrl = '';
  }

  // 2. Treat any empty, falsy, or missing pack prop as 'Base Game'
  const effectivePack = pack || 'Base Game';

  // 3. Apply the Paradox Star fallback!
  if (!finalIconUrl && effectivePack === 'Base Game') {
    finalIconUrl = ICONS.PACK_PARADOX_STAR; 
  }

  if (!finalIconUrl) {
    return (
      <div 
        style={{ width: `${size}rem`, height: `${size}rem`, ...style }} 
        title={effectivePack || theme || 'Unknown Pack'}
      />
    );
  }

  const urls = finalIconUrl.split(',').map(url => url.trim()).filter(Boolean);

  if (urls.length === 0) {
    return (
      <div 
        style={{ width: `${size}rem`, height: `${size}rem`, ...style }} 
        title={effectivePack || theme || 'Unknown Pack'}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '2rem', alignItems: 'center', ...style }}>
      {urls.map((url, index) => (
        <img
          key={index}
          src={url}
          style={{ width: `${size}rem`, height: `${size}rem`, objectFit: 'contain' }}
          alt={effectivePack || theme || 'Pack Icon'}
          title={effectivePack || theme || 'Pack Icon'}
        />
      ))}
    </div>
  );
};

export default PackIcon;
