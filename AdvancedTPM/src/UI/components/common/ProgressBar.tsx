import React from 'react';
import { getSafeColor } from '../../../mods/apiSafe';
import './common.css';

export interface ProgressBarProps {
  value: number; // progress value
  max?: number; // max reference value (default 100)
  scale?: number; // scale multiplier for the value (default 1)
  className?: string; // Track element class name (defaults to universal-progress-bar-track)
  fillClassName?: string; // Fill element class name (defaults to universal-progress-bar-fill)
  style?: React.CSSProperties; // custom track style overrides
  fillStyle?: React.CSSProperties; // custom fill style overrides
  color?: string; // custom fill color
  isBidirectional?: boolean; // enable positive/negative fill alignment and color styling
  positiveClassName?: string; // class when value >= 0 (default advisor-bar-positive)
  negativeClassName?: string; // class when value < 0 (default advisor-bar-negative)
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  scale = 1,
  className,
  fillClassName,
  style,
  fillStyle,
  color,
  isBidirectional = false,
  positiveClassName = 'advisor-bar-positive',
  negativeClassName = 'advisor-bar-negative',
}) => {
  const scaledVal = value * scale;
  const rawPct = (Math.abs(scaledVal) / max) * 100;
  const pct = Math.min(100, isNaN(rawPct) ? 0 : rawPct);
  const isNegative = isBidirectional && scaledVal < 0;

  const trackClass = className || 'universal-progress-bar-track';
  let resolvedFillClass = fillClassName || 'universal-progress-bar-fill';

  if (isBidirectional) {
    resolvedFillClass = `${resolvedFillClass} ${isNegative ? negativeClassName : positiveClassName}`.trim();
  }

  const resolvedFillStyle: React.CSSProperties = {
    width: `${pct}%`,
    marginLeft: isNegative ? 'auto' : undefined,
    backgroundColor: color ? getSafeColor(color) : undefined,
    ...fillStyle,
  };

  return (
    <div className={trackClass} style={style}>
      <div className={resolvedFillClass} style={resolvedFillStyle} />
    </div>
  );
};
