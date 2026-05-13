import React from 'react';

const PackIcon: React.FC<{ pack?: string; size?: number; style?: React.CSSProperties }> = ({ pack = 'Base Game', size = 16, style }) => {
  const p = (pack || 'Base Game').toLowerCase();
  const isBase = p === 'base game' || p === '' || p === 'basegame';
  if (isBase) {
    return React.createElement('svg', { width: size, height: size, viewBox: '0 0 20 20', xmlns: 'http://www.w3.org/2000/svg', style, 'aria-label': 'Base Game' },
      React.createElement('rect', { x: 2, y: 2, width: 16, height: 16, rx: 3, fill: '#445566' }),
      React.createElement('circle', { cx: 10, cy: 10, r: 4, fill: '#8BAABB' }),
      React.createElement('circle', { cx: 10, cy: 10, r: 2, fill: '#CCD8E0' })
    );
  }
  let iconColor = '#6A1B9A';
  let iconShape = 'star';

  if (p.includes('beach')) { iconColor = '#00ACC1'; iconShape = 'palm'; }
  else if (p.includes('bridge') || p.includes('port')) { iconColor = '#1565C0'; iconShape = 'bridge'; }
  else if (p.includes('modern') || p.includes('relax')) { iconColor = '#AD1457'; iconShape = 'modern'; }
  else if (p.includes('san francisco')) { iconColor = '#C62828'; iconShape = 'gate'; }

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={style}>
      <rect x="2" y="2" width="16" height="16" rx="3" fill={iconColor} />
      {iconShape === 'palm' && <path d="M10 15V8M10 8C12 6 15 7 15 7M10 8C8 6 5 7 5 7M10 9C11 11 14 10 14 10M10 9C9 11 6 10 6 10" stroke="#fff" fill="none" strokeWidth="1.5" />}
      {iconShape === 'bridge' && <path d="M4 14Q10 8 16 14M4 16H16M7 11V16M13 11V16" stroke="#fff" fill="none" strokeWidth="1.5" />}
      {iconShape === 'modern' && <path d="M6 14V6L10 4L14 6V14H6Z" fill="#fff" opacity="0.8" />}
      {iconShape === 'gate' && <path d="M4 16V6M16 16V6M4 8Q10 6 16 8" stroke="#fff" fill="none" strokeWidth="1.5" />}
      {iconShape === 'star' && <polygon points="10,4 11.5,8.5 16,8.5 12.5,11.5 13.7,16 10,13.5 6.3,16 7.5,11.5 4,8.5 8.5,8.5" fill="#FFD700" />}
    </svg>
  );
};

export default PackIcon;
