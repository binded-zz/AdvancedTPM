import React from 'react';

const ThemeIcon: React.FC<{ theme?: string; size?: number; style?: React.CSSProperties }> = ({ theme = 'USA', size = 16, style }) => {
  const t = (theme || 'USA').toUpperCase();
  const isEU = t.includes('EU') || t.includes('EUROPE');
  if (isEU) {
    const pts = [0, 72, 144, 216, 288].map(deg => {
      const rad = (deg - 90) * Math.PI / 180;
      const cx = 10 + 5.5 * Math.cos(rad);
      const cy = 10 + 5.5 * Math.sin(rad);
      return <circle key={deg} cx={cx} cy={cy} r={1.1} fill="#FFCC00" />;
    });
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={style} aria-label="EU Theme">
        <circle cx="10" cy="10" r="9" fill="#003399" />
        {pts}
      </svg>
    );
  }
  // USA / North American flag-style icon
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={style} aria-label="USA Theme">
      <rect x="1" y="1" width="18" height="18" rx="2" fill="#BF0A30" />
      <rect x="1" y="4.5" width="18" height="2.2" fill="#fff" />
      <rect x="1" y="8.9" width="18" height="2.2" fill="#fff" />
      <rect x="1" y="13.3" width="18" height="2.2" fill="#fff" />
      <rect x="1" y="1" width="8" height="9" rx="1" fill="#002868" />
    </svg>
  );
};

export default ThemeIcon;
