import React from 'react';
import { getSafeColor } from '../../../mods/apiSafe';
import './common.css';

export interface DetailRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  color?: string; // custom value text color
  className?: string; // container class (defaults to universal-detail-row)
  style?: React.CSSProperties; // custom container styling
  labelStyle?: React.CSSProperties; // custom label styling
  valueStyle?: React.CSSProperties; // custom value styling
  labelClassName?: string; // custom label class name
  valueClassName?: string; // custom value class name
  rawKey?: string; // optional debug raw key
  showRaw?: boolean; // optional flag to display the debug raw key
  title?: string; // tooltip/title attribute
  onClick?: (e: React.MouseEvent) => void;
}

export const DetailRow: React.FC<DetailRowProps> = ({
  label,
  value,
  icon,
  color,
  className,
  style,
  labelStyle,
  valueStyle,
  labelClassName,
  valueClassName,
  rawKey,
  showRaw,
  title,
  onClick,
}) => {
  const isCustomClass = className !== undefined && className.length > 0;

  // If a custom class is provided, we don't apply our default universal style object rules
  const containerClass = className || 'universal-detail-row';
  const labelClass = labelClassName || (isCustomClass ? '' : 'universal-detail-row-label');
  const valueClass = valueClassName || (isCustomClass ? '' : 'universal-detail-row-value');

  const resolvedValueStyle: React.CSSProperties = {
    ...(color ? { color: getSafeColor(color) } : {}),
    ...valueStyle,
  };

  return (
    <div
      className={containerClass}
      style={style}
      title={title}
      onClick={onClick}
    >
      <span className={labelClass} style={labelStyle}>
        {icon}
        {label}
        {showRaw && rawKey && <span className="dp-raw-key">({rawKey})</span>}
      </span>
      <span className={valueClass} style={resolvedValueStyle}>
        {value}
      </span>
    </div>
  );
};
