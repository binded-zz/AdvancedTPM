import React from 'react';

const districtColor = (name: string): string => {
  if (!name || name === 'City') return '#607D8B';
  let hash = 0;
  for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); hash |= 0; }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 52%)`;
};

const DistrictIcon: React.FC<{ district?: string; size?: number; style?: React.CSSProperties }> = ({ district = 'City', size = 16, style }) => {
  const label = district || 'City';
  const initial = label.charAt(0).toUpperCase();
  const color = districtColor(label);
  return React.createElement('svg', { width: size, height: size, viewBox: '0 0 20 20', xmlns: 'http://www.w3.org/2000/svg', style, 'aria-label': label },
    React.createElement('circle', { cx: 10, cy: 10, r: 9, fill: color }),
    React.createElement('text', { x: 10, y: 14.5, textAnchor: 'middle', fontSize: 11, fontWeight: 'bold', fill: '#fff', fontFamily: 'Arial,sans-serif' }, initial)
  );
};

export default DistrictIcon;
