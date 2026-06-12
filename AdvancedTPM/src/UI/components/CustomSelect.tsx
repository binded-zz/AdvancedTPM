import React, { useState } from 'react';
import './CustomSelect.css';

interface CustomSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  displayValue?: (value: string) => string;
  icon?: (value: string) => React.ReactNode;
  label?: string;
  className?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  displayValue,
  icon,
  label,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const safeOptions = Array.isArray(options) ? options : [];
  const currentDisplay = displayValue
    ? displayValue(value)
    : label
      ? `${label}: ${value === 'All' ? `All ${label}s` : value}`
      : value;

  return (
    <div className={`custom-select-container ${className}`}>
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {icon && icon(value) ? (
            <span style={{ marginRight: '4rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {icon(value)}
            </span>
          ) : null}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentDisplay}
          </span>
        </span>
        <span style={{ fontSize: '8rem', color: 'rgba(255, 255, 255, 0.4)', marginLeft: '8rem', flexShrink: 0 }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Transparent full-screen overlay backdrop for closing the dropdown safely in CoHTML */}
          <div
            className="custom-select-backdrop"
            onClick={() => setIsOpen(false)}
          />
          <div className="custom-select-dropdown">
            {safeOptions.map((opt) => (
              <div
                key={opt}
                className={`custom-select-option${opt === value ? ' custom-select-option-active' : ''}`}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
              >
                {icon && icon(opt) ? (
                  <span style={{ marginRight: '4rem', display: 'inline-flex', flexShrink: 0 }}>
                    {icon(opt)}
                  </span>
                ) : null}
                <span>
                  {displayValue ? displayValue(opt) : label ? (opt === 'All' ? `All ${label}s` : opt) : opt}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CustomSelect;

