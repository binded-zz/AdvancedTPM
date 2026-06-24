import React from 'react';
import { getSafeColor } from '../../../mods/apiSafe';
import './common.css';

export interface StatCardProps {
  layout?: 'card' | 'stat'; // 'card' for DistrictsPanel-style card, 'stat' for AdvisorPanel-style stats
  title?: React.ReactNode; // Card title or Stat label
  value?: React.ReactNode; // Stat value
  icon?: React.ReactNode;
  actions?: React.ReactNode; // Move buttons / action buttons for header
  className?: string; // Wrapper class name override
  headerClassName?: string;
  titleClassName?: string;
  contentClassName?: string;
  style?: React.CSSProperties;
  valueStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  children?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  layout = 'card',
  title,
  value,
  icon,
  actions,
  className,
  headerClassName,
  titleClassName,
  contentClassName,
  style,
  valueStyle,
  labelStyle,
  draggable,
  onDragStart,
  onDragOver,
  onMouseEnter,
  onDragEnd,
  children,
}) => {
  if (layout === 'stat') {
    const wrapperClass = className || 'universal-stat-layout';
    const valClass = valueClassName(valueStyle);
    const lblClass = labelClassName(labelStyle);

    return (
      <div className={wrapperClass} style={style}>
        <div className={valClass} style={valueStyle}>
          {value}
        </div>
        <div className={lblClass} style={labelStyle}>
          {title}
        </div>
      </div>
    );
  }

  // Otherwise, layout === 'card'
  const cardClass = className || 'universal-card-layout';
  const headerClass = headerClassName || 'dp-card-header';
  const titleClass = titleClassName || 'dp-card-title';
  const contentClass = contentClassName || 'dp-card-content';

  return (
    <div
      className={cardClass}
      style={style}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onMouseEnter={onMouseEnter}
      onDragEnd={onDragEnd}
    >
      <div className={headerClass}>
        <div className={titleClass}>
          {icon && (
            <span style={{ marginRight: '10rem', display: 'flex', alignItems: 'center' }}>
              {icon}
            </span>
          )}
          {title}
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {actions}
          </div>
        )}
      </div>
      <div className={contentClass}>
        {children}
      </div>
    </div>
  );
};

// Internal class name helpers
function valueClassName(style?: React.CSSProperties): string {
  return 'universal-stat-value';
}

function labelClassName(style?: React.CSSProperties): string {
  return 'universal-stat-label';
}
