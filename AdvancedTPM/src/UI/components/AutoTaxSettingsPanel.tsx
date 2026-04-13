import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { trigger } from 'cs2/api';
import { resourceCategories } from '../data/resourceTaxonomy';
import './AutoTaxSettingsPanel.css';

interface ResourceRange { min: number; max: number; }

interface AutoTaxSettingsParsed {
  interval: number;
  minRate: number;
  maxRate: number;
  happinessWeight: number;
  updateSpeed: number;
  excluded: Set<string>;
  perResourceRanges: Map<string, ResourceRange>;
  profitWeight: number;
  opacity: number;
}

interface AutoTaxSettingsPanelProps {
  settingsPayload: string;
  onClose: () => void;
}

const RESOURCE_ICON_BASE = 'Media/Game/Resources/';

const SPEED_LABELS: Record<number, string> = { 1: 'Very Fast', 2: 'Fast', 3: 'Normal', 4: 'Slow', 5: 'Very Slow' };

const parseSettings = (payload: string): AutoTaxSettingsParsed => {
  const defaults: AutoTaxSettingsParsed = {
    interval: 3, minRate: 0, maxRate: 25, happinessWeight: 50, updateSpeed: 2, excluded: new Set(), perResourceRanges: new Map(), profitWeight: 50, opacity: 95,
  };
  if (!payload) return defaults;
  const parts = payload.split('|');
  if (parts.length < 6) return defaults;
  const excluded = new Set<string>();
  if (parts[5]) {
    parts[5].split(',').forEach((k) => { const t = k.trim(); if (t) excluded.add(t); });
  }
  const perResourceRanges = new Map<string, ResourceRange>();
  if (parts.length > 6 && parts[6]) {
    parts[6].split(',').forEach((entry) => {
      const [key, lo, hi] = entry.split(':');
      if (key && lo !== undefined && hi !== undefined) {
        perResourceRanges.set(key.trim(), { min: Number(lo), max: Number(hi) });
      }
    });
  }
  return {
    interval: Math.max(1, Math.min(5, Number(parts[0]) || 3)),
    minRate: isNaN(Number(parts[1])) ? 0 : Number(parts[1]),
    maxRate: Number(parts[2]) || 25,
    happinessWeight: isNaN(Number(parts[3])) ? 50 : Number(parts[3]),
    updateSpeed: Number(parts[4]) || 2,
    excluded,
    perResourceRanges,
    profitWeight: parts.length > 7 ? (isNaN(Number(parts[7])) ? 50 : Number(parts[7])) : 50,
    opacity: parts.length > 8 ? (isNaN(Number(parts[8])) ? 95 : Number(parts[8])) : 95,
  };
};

const serializeSettings = (s: AutoTaxSettingsParsed): string => {
  const rangeParts: string[] = [];
  s.perResourceRanges.forEach((r, key) => {
    rangeParts.push(`${key}:${r.min}:${r.max}`);
  });
  return `${s.interval}|${s.minRate}|${s.maxRate}|${s.happinessWeight}|${s.updateSpeed}|${Array.from(s.excluded).join(',')}|${rangeParts.join(',')}|${s.profitWeight}|${s.opacity}`;
};

// Fire the trigger directly to C# — same pattern as working setResourceTaxRate
const pushSettings = (s: AutoTaxSettingsParsed): void => {
  const payload = serializeSettings(s);
  trigger('taxProduction', 'setAutoTaxSettings', payload);
};

// Get all unique resources from the "all" category (the master list)
const allResources = resourceCategories.find((c) => c.id === 'all')?.resources ?? [];

// Group resources by stage for the per-resource section
const stageGroups = [
  { stage: 'RawResource', label: 'Raw Materials' },
  { stage: 'Industrial', label: 'Industrial' },
  { stage: 'Immaterial', label: 'Office / Immaterial' },
  { stage: 'Retail', label: 'Entertainment / Services' },
  { stage: 'Commercial', label: 'Commercial Retail' },
];

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  tooltip?: string;
  infoTooltip?: string;
  displayValue?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, unit, tooltip, infoTooltip, displayValue, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef<HTMLSpanElement>(null);

  const calculateValue = useCallback((clientX: number) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + pct * (max - min);
    return Math.round(raw / step) * step;
  }, [min, max, step, value]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(calculateValue(e.clientX));

    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      onChange(calculateValue(ev.clientX));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [calculateValue, onChange]);

  // Close info popup when clicking outside
  useEffect(() => {
    if (!showInfo) return;
    const handleOutside = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setShowInfo(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showInfo]);

  const range = max - min;
  const clamped = Math.max(min, Math.min(max, value));
  const pct = range > 0 ? ((clamped - min) / range) * 100 : 0;

  return (
    <div className="ats-slider-row">
      <span className="ats-slider-label">{label}{infoTooltip && (
        <span ref={infoRef} className="ats-info-icon" onMouseDown={(e) => { e.stopPropagation(); setShowInfo((v) => !v); }}>?
          {showInfo && (
            <div className="ats-info-popup" onMouseDown={(e) => e.stopPropagation()}>
              {infoTooltip.split('\n').map((line, i) => <div key={i} className={line.trim() === '' ? 'ats-info-blank' : ''}>{line || '\u00a0'}</div>)}
            </div>
          )}
        </span>
      )}</span>
      <div className="ats-slider-track-wrapper">
        <div ref={trackRef} className="ats-slider-track" onMouseDown={handleMouseDown}>
          <div className="ats-slider-track-bounds">
            <div className="ats-slider-range-bounds" style={{ width: `${pct}%` }}>
              <div className="ats-slider-range" />
              <div className="ats-slider-thumb-container">
                <div className="ats-slider-thumb" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <span className="ats-slider-value">{displayValue ?? `${value}${unit ? `\u00a0${unit.trimStart()}` : ''}`}</span>
    </div>
  );
};

/* ── Per-resource dual-thumb range slider (same pattern as CompanyBrowser profit slider) ── */
const RangeSliderRow: React.FC<{
  resourceKey: string;
  label: string;
  icon: string;
  globalMin: number;
  globalMax: number;
  rangeMin: number;
  rangeMax: number;
  onChange: (key: string, min: number, max: number) => void;
  onReset: (key: string) => void;
}> = ({ resourceKey, label, icon, globalMin, globalMax, rangeMin, rangeMax, onChange, onReset }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'min' | 'max' | null>(null);
  const BOUND_MIN = -10;
  const BOUND_MAX = 30;

  const valFromX = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(BOUND_MIN + pct * (BOUND_MAX - BOUND_MIN));
  }, []);

  const handleThumbDown = useCallback((thumb: 'min' | 'max') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = thumb;
    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const val = valFromX(ev.clientX);
      if (dragging.current === 'min') {
        onChange(resourceKey, Math.min(val, rangeMax - 1), rangeMax);
      } else {
        onChange(resourceKey, rangeMin, Math.max(val, rangeMin + 1));
      }
    };
    const onUp = () => {
      dragging.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [valFromX, resourceKey, rangeMin, rangeMax, onChange]);

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    const val = valFromX(e.clientX);
    const dMin = Math.abs(val - rangeMin);
    const dMax = Math.abs(val - rangeMax);
    if (dMin <= dMax) {
      onChange(resourceKey, Math.min(val, rangeMax - 1), rangeMax);
    } else {
      onChange(resourceKey, rangeMin, Math.max(val, rangeMin + 1));
    }
  }, [valFromX, resourceKey, rangeMin, rangeMax, onChange]);

  const pctOf = (v: number) => ((v - BOUND_MIN) / (BOUND_MAX - BOUND_MIN)) * 100;
  const isCustom = rangeMin !== globalMin || rangeMax !== globalMax;

  return (
    <div className="ats-range-row">
      <span className="ats-range-value">{rangeMin}%</span>
      <div ref={trackRef} className="ats-range-track-area" onMouseDown={handleTrackClick}>
        <div className="ats-range-track" />
        <div className="ats-range-fill" style={{ left: `${pctOf(rangeMin)}%`, width: `${pctOf(rangeMax) - pctOf(rangeMin)}%` }} />
        <div className="ats-range-thumb" style={{ left: `${pctOf(rangeMin)}%` }} onMouseDown={handleThumbDown('min')} />
        <div className="ats-range-thumb" style={{ left: `${pctOf(rangeMax)}%` }} onMouseDown={handleThumbDown('max')} />
      </div>
      <span className="ats-range-value">{rangeMax}%</span>
      {isCustom && (
        <button className="ats-range-reset" onClick={(e) => { e.stopPropagation(); onReset(resourceKey); }} title="Reset to global range">R</button>
      )}
    </div>
  );
};

const AutoTaxSettingsPanel: React.FC<AutoTaxSettingsPanelProps> = ({ settingsPayload, onClose }) => {
  const parsed = useMemo(() => parseSettings(settingsPayload), [settingsPayload]);
  const [interval, setInterval_] = useState(parsed.interval);
  const [minRate, setMinRate] = useState(parsed.minRate);
  const [maxRate, setMaxRate] = useState(parsed.maxRate);
  const [happinessWeight, setHappinessWeight] = useState(parsed.happinessWeight);
  const [updateSpeed, setUpdateSpeed] = useState(parsed.updateSpeed);
  const [excluded, setExcluded] = useState<Set<string>>(new Set(parsed.excluded));
  const [perResourceRanges, setPerResourceRanges] = useState<Map<string, ResourceRange>>(() => new Map(parsed.perResourceRanges));
  const [profitWeight, setProfitWeight] = useState(parsed.profitWeight);
  const [opacity, setOpacity] = useState(parsed.opacity);

  // Drag state
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, startX: 0, startY: 0, ox: 0, oy: 0 });

  // Custom scrollbar refs
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef = useRef<HTMLDivElement>(null);

  const updateScrollThumb = useCallback(() => {
    const body = scrollBodyRef.current;
    const thumb = scrollThumbRef.current;
    const track = scrollTrackRef.current;
    if (!body || !thumb || !track) return;
    const ratio = body.clientHeight / body.scrollHeight;
    if (ratio >= 1 || !Number.isFinite(ratio)) { track.style.display = 'none'; return; }
    track.style.display = 'block';
    const trackH = track.clientHeight;
    if (trackH <= 0) return;
    const thumbH = Math.max(20, trackH * ratio);
    const denom = body.scrollHeight - body.clientHeight;
    const scrollPct = denom > 0 ? body.scrollTop / denom : 0;
    const thumbTop = Math.max(0, Math.min(trackH - thumbH, scrollPct * (trackH - thumbH)));
    thumb.style.height = `${thumbH}px`;
    thumb.style.top = `${thumbTop}px`;
  }, []);

  useEffect(() => {
    const body = scrollBodyRef.current;
    if (!body) return;
    body.addEventListener('scroll', updateScrollThumb);
    updateScrollThumb();
    return () => body.removeEventListener('scroll', updateScrollThumb);
  }, [updateScrollThumb]);

  // Re-measure scrollbar when collapsed sections change
  useEffect(() => { updateScrollThumb(); });

  const handleScrollTrackMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const body = scrollBodyRef.current;
    const track = scrollTrackRef.current;
    if (!body || !track) return;
    const rect = track.getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;
    body.scrollTop = pct * (body.scrollHeight - body.clientHeight);
  }, []);

  const handleScrollThumbMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const body = scrollBodyRef.current;
    const track = scrollTrackRef.current;
    const thumb = scrollThumbRef.current;
    if (!body || !track || !thumb) return;
    const startY = e.clientY;
    const startTop = parseFloat(thumb.style.top || '0');
    const trackH = track.clientHeight;
    const thumbH = thumb.clientHeight;
    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const delta = ev.clientY - startY;
      const newTop = Math.max(0, Math.min(trackH - thumbH, startTop + delta));
      const pct = newTop / (trackH - thumbH);
      body.scrollTop = pct * (body.scrollHeight - body.clientHeight);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Ref to hold current settings for push — avoids stale closures
  const settingsRef = useRef({ interval, minRate, maxRate, happinessWeight, updateSpeed, excluded, perResourceRanges, profitWeight, opacity });
  useEffect(() => {
    settingsRef.current = { interval, minRate, maxRate, happinessWeight, updateSpeed, excluded, perResourceRanges, profitWeight, opacity };
  });

  // Auto-save: push to C# whenever any setting changes
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    pushSettings({ interval, minRate, maxRate, happinessWeight, updateSpeed, excluded, perResourceRanges, profitWeight, opacity });
  }, [interval, minRate, maxRate, happinessWeight, updateSpeed, excluded, perResourceRanges, profitWeight, opacity]);

  const setResourceRange = useCallback((key: string, lo: number, hi: number) => {
    setPerResourceRanges((prev) => {
      const next = new Map(prev);
      next.set(key, { min: lo, max: hi });
      return next;
    });
  }, []);

  const resetResourceRange = useCallback((key: string) => {
    setPerResourceRanges((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const toggleResource = useCallback((key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAllInStage = useCallback((stage: string) => {
    const stageKeys = allResources.filter((r) => r.stage === stage).map((r) => r.key);
    setExcluded((prev) => {
      const next = new Set(prev);
      const allExcluded = stageKeys.every((k) => next.has(k));
      if (allExcluded) {
        stageKeys.forEach((k) => next.delete(k));
      } else {
        stageKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  }, []);

  // Drag handlers for panel header
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, ox: panelPos.x, oy: panelPos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current.active) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPanelPos({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
    };
    const onUp = () => {
      dragRef.current.active = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelPos]);

  const enabledCount = allResources.length - excluded.size;

  // Collapsed state per stage group
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(() => new Set(stageGroups.map((sg) => sg.stage)));
  const toggleStageCollapse = useCallback((stage: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage); else next.add(stage);
      return next;
    });
  }, []);

  return (
    <div
      ref={panelRef}
      className="ats-panel"
      style={{ transform: `translate(${panelPos.x}px, ${panelPos.y}px)` }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="ats-header" onMouseDown={handleHeaderMouseDown} style={{ cursor: 'move' }}>
        <span className="ats-header-title">Auto-Tax Settings</span>
        <button className="ats-close-btn" onMouseDown={(e) => e.stopPropagation()} onClick={onClose}>X</button>
      </div>

      <div className="ats-body-wrapper">
        <div ref={scrollBodyRef} className="ats-body">
        {/* Global sliders */}
        <div className="ats-section">
          <div className="ats-section-title">Tuning Parameters</div>
          <SliderRow label="Adjustment Speed" value={interval} min={1} max={5} step={1} tooltip="How frequently auto-tax adjusts rates. Very Fast = ~5s, Fast = ~10s, Normal = ~20s, Slow = ~45s, Very Slow = ~90s" displayValue={SPEED_LABELS[interval] || `${interval}`} onChange={setInterval_} />
          <SliderRow label="Minimum Tax Rate" value={minRate} min={-10} max={30} step={1} unit="%" tooltip="The lowest tax rate auto-tax will set for any resource (global default)" onChange={setMinRate} />
          <SliderRow label="Maximum Tax Rate" value={maxRate} min={-10} max={30} step={1} unit="%" tooltip="The highest tax rate auto-tax will set for any resource (global default)" onChange={setMaxRate} />
          <SliderRow label="Happiness Weight" value={happinessWeight} min={0} max={100} step={5} unit="%" tooltip="How much citizen happiness influences tax decisions" infoTooltip={"At 0%: Happiness has no effect on tax decisions.\nAt 50% (default): Moderate influence — low happiness (<50%) applies strong downward pressure to cut taxes; high happiness (>70%) gives mild permission to raise.\nAt 100%: Maximum influence — unhappy citizens force aggressive tax cuts; happy citizens allow raises but don't force them.\n\nHappiness acts as an asymmetric gate: it punishes high taxes when citizens are unhappy, but only mildly rewards when they're happy."} onChange={setHappinessWeight} />
          <SliderRow label="Profit Weight" value={profitWeight} min={0} max={100} step={5} unit="%" tooltip="Balance between macro signals and real company profit data" infoTooltip={"Controls the balance between macro economic signals and real company profitability data.\n\nAt 0%: Tax decisions based entirely on macro signals (production/consumption balance, demand, taxable income).\nAt 50% (default): Equal mix of macro signals and real company profits from ECS data.\nAt 100%: Tax decisions driven entirely by actual company profitability — if companies are profitable, taxes can rise; if losing money, taxes drop.\n\nHigher values make the system more responsive to individual company health."} onChange={setProfitWeight} />
          <SliderRow label="UI Update Speed" value={updateSpeed} min={1} max={3} step={1} tooltip="How often the UI refreshes data. 1 = Slow, 2 = Normal, 3 = Fast" displayValue={updateSpeed === 1 ? 'Slow' : updateSpeed === 2 ? 'Normal' : 'Fast'} onChange={setUpdateSpeed} />
          <SliderRow label="Panel Opacity" value={opacity} min={40} max={100} step={5} unit="%" tooltip="Window background transparency. Lower values make the panel more see-through" onChange={setOpacity} />
        </div>

        {/* Per-resource toggles */}
        <div className="ats-section">
          <div className="ats-section-title">
            Per-Resource Auto-Tax
            <span className="ats-resource-count">{enabledCount} / {allResources.length} enabled</span>
          </div>
          <div className="ats-resource-groups">
            {stageGroups.map((sg) => {
              const resources = allResources.filter((r) => r.stage === sg.stage);
              if (resources.length === 0) return null;
              const allExcluded = resources.every((r) => excluded.has(r.key));
              const someExcluded = resources.some((r) => excluded.has(r.key));
              return (
                <div key={sg.stage} className="ats-resource-group">
                  <div className="ats-group-header">
                    <div className={`ats-checkbox${allExcluded ? '' : someExcluded ? ' ats-checkbox-partial' : ' ats-checkbox-checked'}`} onClick={(e) => { e.stopPropagation(); toggleAllInStage(sg.stage); }} />
                    <span className="ats-group-label" onClick={() => toggleStageCollapse(sg.stage)}>{sg.label}</span>
                    <span className="ats-group-count">{resources.filter((r) => !excluded.has(r.key)).length}/{resources.length}</span>
                    <div className={`ats-collapse-arrow${collapsedStages.has(sg.stage) ? '' : ' ats-collapse-arrow-expanded'}`} onClick={() => toggleStageCollapse(sg.stage)} />
                  </div>
                  {!collapsedStages.has(sg.stage) && (
                    <div className="ats-group-resources">
                      {resources.map((r) => {
                        const isEnabled = !excluded.has(r.key);
                        const rr = perResourceRanges.get(r.key);
                        const effMin = rr ? rr.min : minRate;
                        const effMax = rr ? rr.max : maxRate;
                        return (
                          <div key={r.key} className="ats-resource-item-wrap">
                            <div className="ats-resource-item" onClick={() => toggleResource(r.key)}>
                              <div className={`ats-checkbox${isEnabled ? ' ats-checkbox-checked' : ''}`} />
                              <img className="ats-resource-icon" src={`${RESOURCE_ICON_BASE}${r.icon}.svg`} />
                              <span className="ats-resource-label">{r.label}</span>
                              {rr && <span className="ats-resource-custom-badge">custom</span>}
                            </div>
                            {isEnabled && (
                              <RangeSliderRow
                                resourceKey={r.key}
                                label={r.label}
                                icon={r.icon}
                                globalMin={minRate}
                                globalMax={maxRate}
                                rangeMin={effMin}
                                rangeMax={effMax}
                                onChange={setResourceRange}
                                onReset={resetResourceRange}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>
        <div ref={scrollTrackRef} className="ats-scrollbar-track" onMouseDown={handleScrollTrackMouseDown}>
          <div ref={scrollThumbRef} className="ats-scrollbar-thumb" onMouseDown={handleScrollThumbMouseDown} />
        </div>
      </div>

      <div className="ats-footer">
        <span className="ats-footer-note">Changes save automatically</span>
        <button className="ats-btn ats-btn-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default AutoTaxSettingsPanel;
