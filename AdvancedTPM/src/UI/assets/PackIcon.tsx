import React from 'react';

interface PackIconProps {
  pack?: string;
  theme?: string;
  iconUrl?: string; // Comma-separated list of thumbnail URLs
  size?: number;
  style?: React.CSSProperties;
}

const PackIcon: React.FC<PackIconProps> = ({ pack, theme, iconUrl, size = 18, style }) => {
  let finalIconUrl = iconUrl;
  
  // If the path is the invalid base game svg, clear it to avoid loading errors
  if (finalIconUrl === 'coui://uil/Colored/BaseGame.svg') {
    finalIconUrl = '';
  }

  // If no iconUrl was provided from the backend, we can fallback dynamically
  if (!finalIconUrl && pack) {
    if (pack === 'Base Game') {
      finalIconUrl = '';
    }
  }

  if (!finalIconUrl) {
    return (
      <div 
        style={{
          width: `${size}rem`,
          height: `${size}rem`,
          ...style
        }} 
        title={pack || theme || 'Unknown Pack'}
      />
    );
  }

  const urls = finalIconUrl.split(',').map(url => url.trim()).filter(Boolean);

  if (urls.length === 0) {
    return (
      <div 
        style={{
          width: `${size}rem`,
          height: `${size}rem`,
          ...style
        }} 
        title={pack || theme || 'Unknown Pack'}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '2rem', alignItems: 'center', ...style }}>
      {urls.map((url, index) => (
        <img
          key={index}
          src={url}
          style={{
            width: `${size}rem`,
            height: `${size}rem`,
            objectFit: 'contain'
          }}
          alt={pack || theme || 'Pack Icon'}
          title={pack || theme || 'Pack Icon'}
        />
      ))}
    </div>
  );
};

export default PackIcon;
