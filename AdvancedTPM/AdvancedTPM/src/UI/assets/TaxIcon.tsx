import React from 'react';

const TaxIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Rounded box background */}
    <rect x="1" y="1" width="30" height="30" rx="5" stroke={color} strokeWidth="1.8" fill="rgba(20,40,70,0.6)" />
    {/* Top accent line */}
    <rect x="4" y="4" width="24" height="2.5" rx="1.25" fill={color} opacity="0.35" />
    {/* ATPM text */}
    <text
      x="16"
      y="21"
      textAnchor="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontWeight="800"
      fontSize="10"
      fill={color}
      letterSpacing="0.5"
    >
      ATPM
    </text>
    {/* Bottom bar chart accent */}
    <rect x="6" y="24" width="4" height="3" rx="0.8" fill={color} opacity="0.4" />
    <rect x="12" y="23" width="4" height="4" rx="0.8" fill={color} opacity="0.55" />
    <rect x="18" y="25" width="4" height="2" rx="0.8" fill={color} opacity="0.3" />
    <rect x="24" y="22" width="4" height="5" rx="0.8" fill={color} opacity="0.45" />
  </svg>
);

export default TaxIcon;
