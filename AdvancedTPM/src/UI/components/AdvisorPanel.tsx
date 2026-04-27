import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import './AdvisorPanel.css';
import * as ReactDOM from 'react-dom';
import { resourceCategories } from '../data/resourceTaxonomy';

interface LearningProfile {
  key: string;
  sensitivity: number;
  incomeResponse: number;
  companyResponse: number;
  confidence: number;
  sampleCount: number;
  avgOutcome: number;
  productionResponse: number;
  revenueEfficiency: number;
  volatility: number;
}

interface AdvisorRec {
  key: string;
  direction: number;
  currentRate: number;
  confidence: number;
  reason: string;
}

interface DecisionEntry {
  key: string;
  oldRate: number;
  newRate: number;
  outcomeScore: number;
  confidence: number;
  summary: string;
}

interface LearningStats {
  pendingEvents: number;
  snapshots: number;
  totalSamples: number;
  avgConfidence: number;
  aggressiveness: number;
}

interface AutoTaxResourceInfo {
  key: string;
  direction: number;
  score: number;
  balance: number;
  demand: number;
  income: number;
  profit: number;
  happiness: number;
  rateDrag: number;
  companies: number;
  avgProfit: number;
  learned: number;
}

interface AutoTaxMetrics {
  happiness: number;
  adjustCount: number;
  raiseCount: number;
  lowerCount: number;
  holdCount: number;
  resources: AutoTaxResourceInfo[];
}

interface AdvisorPanelProps {
  advisorData: string;
  decisionLogData: string;
  learningStatsData: string;
  autoTaxStatus: string;
  learningEnabled: boolean;
  useGameIcons?: boolean;
  onToggleLearning: (enabled: boolean) => void;
  onResetLearning: () => void;
  onSetAggressiveness: (level: number) => void;
}

/** Parse advisor data: totalSamples|activeProfiles|profileData|recommendationData */
const parseAdvisorData = (data: string): { profiles: LearningProfile[]; recommendations: AdvisorRec[] } => {
  const result = { profiles: [] as LearningProfile[], recommendations: [] as AdvisorRec[] };
  if (!data) return result;

  const parts = data.split('|');
  if (parts.length < 4) return result;

  // Parse profiles (slot 2): key=sens:income:company:confidence:samples:avgOutcome:prodResp:revEff:volatility,...
  if (parts[2]) {
    parts[2].split(',').forEach((entry) => {
      const [key, rest] = entry.split('=');
      if (key && rest) {
        const f = rest.split(':');
        result.profiles.push({
          key,
          sensitivity: Number(f[0]) || 0,
          incomeResponse: Number(f[1]) || 0,
          companyResponse: Number(f[2]) || 0,
          confidence: Number(f[3]) || 0,
          sampleCount: Number(f[4]) || 0,
          avgOutcome: Number(f[5]) || 0,
          productionResponse: Number(f[6]) || 0,
          revenueEfficiency: Number(f[7]) || 0,
          volatility: Number(f[8]) || 0,
        });
      }
    });
  }

  // Parse recommendations (slot 3): key=direction:currentRate:confidence:reason,...
  if (parts[3]) {
    parts[3].split(',').forEach((entry) => {
      const [key, rest] = entry.split('=');
      if (key && rest) {
        const f = rest.split(':');
        result.recommendations.push({
          key,
          direction: Number(f[0]) || 0,
          currentRate: Number(f[1]) || 0,
          confidence: Number(f[2]) || 0,
          reason: f.slice(3).join(':') || '',
        });
      }
    });
  }

  return result;
};

/** Parse decision log: key:oldRate:newRate:outcomeScore:confidence:summary|... */
const parseDecisionLog = (data: string): DecisionEntry[] => {
  if (!data) return [];
  return data.split('|').map((entry) => {
    const f = entry.split(':');
    return {
      key: f[0] || '',
      oldRate: Number(f[1]) || 0,
      newRate: Number(f[2]) || 0,
      outcomeScore: Number(f[3]) || 0,
      confidence: Number(f[4]) || 0,
      summary: f.slice(5).join(':') || '',
    };
  }).filter((d) => d.key);
};

/** Parse learning stats: pending|snapshots|totalSamples|avgConfidence|aggressiveness */
const parseLearningStats = (data: string): LearningStats => {
  const defaults: LearningStats = { pendingEvents: 0, snapshots: 0, totalSamples: 0, avgConfidence: 0, aggressiveness: 3 };
  if (!data) return defaults;
  const parts = data.split('|');
  return {
    pendingEvents: Number(parts[0]) || 0,
    snapshots: Number(parts[1]) || 0,
    totalSamples: Number(parts[2]) || 0,
    avgConfidence: Number(parts[3]) || 0,
    aggressiveness: Number(parts[4]) || 3,
  };
};

const parseAutoTaxStatus = (status: string): AutoTaxMetrics => {
  const base: AutoTaxMetrics = { happiness: 0, adjustCount: 0, raiseCount: 0, lowerCount: 0, holdCount: 0, resources: [] };
  if (!status) return base;
  const parts = status.split('|');
  if (parts.length < 6) return base;
  base.happiness = Number(parts[0]) || 0;
  base.adjustCount = Number(parts[1]) || 0;
  base.raiseCount = Number(parts[2]) || 0;
  base.lowerCount = Number(parts[3]) || 0;
  base.holdCount = Number(parts[4]) || 0;
  const map = new Map<string, AutoTaxResourceInfo>();
  if (parts[5]) {
    parts[5].split(',').forEach((entry) => {
      const [key, rest] = entry.split('=');
      if (!key || !rest) return;
      const f = rest.split(':');
      const info: AutoTaxResourceInfo = {
        key,
        direction: Number(f[0]) || 0,
        score: Number(f[1]) || 0,
        balance: Number(f[2]) || 0,
        demand: Number(f[3]) || 0,
        income: Number(f[4]) || 0,
        profit: Number(f[5]) || 0,
        happiness: Number(f[6]) || 0,
        rateDrag: Number(f[7]) || 0,
        companies: Number(f[8]) || 0,
        avgProfit: Number(f[9]) || 0,
        learned: Number(f[10]) || 0,
      };
      map.set(key, info);
    });
  }
  base.resources = Array.from(map.values());
  return base;
};

const getResourceLabel = (key: string): string => {
  // Capitalize and clean up resource key for display
  const clean = key.startsWith('c_') ? key.slice(2) : key;
  return clean.charAt(0).toUpperCase() + clean.slice(1).replace(/food/i, 'Food').replace(/conveniencefood/i, 'Convenience Food');
};

const getConfidenceColor = (conf: number): string => {
  if (conf >= 0.7) return '#8bdb46';
  if (conf >= 0.4) return '#f0c040';
  return 'rgba(255,255,255,0.4)';
};

const getOutcomeColor = (score: number): string => {
  if (score > 0.1) return '#8bdb46';
  if (score < -0.1) return '#e05050';
  return 'rgba(255,255,255,0.6)';
};

const getDirectionSymbol = (dir: number): string => {
  if (dir > 0) return '\u25B2'; // ▲
  if (dir < 0) return '\u25BC'; // ▼
  return '\u25CF'; // ●
};

const getDirectionColor = (dir: number): string => {
  if (dir > 0) return '#8bdb46';
  if (dir < 0) return '#e05050';
  return 'rgba(255,255,255,0.5)';
};

const AGGRESSIVENESS_LABELS: Record<number, string> = {
  1: 'Very Conservative',
  2: 'Conservative',
  3: 'Balanced',
  4: 'Aggressive',
  5: 'Very Aggressive',
};

// Move ProfileRow to module scope so its identity is stable across renders.
// Find icon name for a given resource key using the shared taxonomy.
const findResourceIcon = (key: string): string | null => {
  if (!key) return null;
  const normalized = key.replace(/^c_/, '');
  for (const cat of resourceCategories) {
    for (const r of cat.resources) {
      if (r.key === normalized) return r.icon;
    }
  }
  return null;
};

// Map a stage string to the game's zone icon path. These icons are provided
// by the base game under Media/Game/Icons; use exact names so we don't invent
// fallbacks. This returns a path like 'Media/Game/Icons/ZoneIndustrial.svg'.
const getZoneIconPath = (stage: string | null): string | null => {
  if (!stage) return null;
  const ICON_BASE = 'Media/Game/Icons/';
  const map: Record<string, string> = {
    Industrial: 'ZoneIndustrial',
    Commercial: 'ZoneCommercial',
    Retail: 'ZoneCommercial',
    RawResource: 'ZoneIndustrial',
    Immaterial: 'Economy',
    Office: 'Economy',
  };
  const name = map[stage] || stage.replace(/[^a-zA-Z0-9]/g, '');
  return `${ICON_BASE}${name}.svg`;
};

// Find resource stage (e.g., 'Commercial' or 'Industrial') for a given key.
// Try exact key match first (so commercial keys like `c_food` map to the
// commercial entry), then fall back to the base resource name (remove `c_`).
const findResourceStage = (key: string): string | null => {
  if (!key) return null;
  // First try exact match
  for (const cat of resourceCategories) {
    for (const r of cat.resources) {
      if (r.key === key) return r.stage as string;
    }
  }
  // Fallback: normalized (remove c_ prefix)
  const normalized = key.replace(/^c_/, '');
  for (const cat of resourceCategories) {
    for (const r of cat.resources) {
      if (r.key === normalized) return r.stage as string;
    }
  }
  return null;
};

// Use the game's icon assets for zone/zone-type icons. CompanyBrowser uses
// icons from Media/Game/Icons (e.g. ZoneIndustrial.svg). Reuse the same
// convention here so advisor rows match the resources/company UI.
// Render a small zone-type badge next to the resource icon. The badge is
// pure CSS (no SVGs) and styled via advisor-zone-* classes in CSS so it
// matches the look used elsewhere in the UI.

const ProfileRow: React.FC<{ p: LearningProfile; useGameIcons?: boolean }> = React.memo(({ p, useGameIcons }) => {
  const icon = findResourceIcon(p.key);
  const stage = findResourceStage(p.key);
  return (
    <div className="advisor-profile-row">
      <div className="advisor-profile-name">
        {icon && <img src={`Media/Game/Resources/${icon}.svg`} className="advisor-profile-icon" alt="" />}
        {stage && (useGameIcons ? (
          <img src={getZoneIconPath(stage) as string} className="advisor-zone-icon" title={stage} alt="" />
        ) : (
          <span className={`advisor-zone-badge advisor-zone-${(stage || '').toLowerCase()}`} title={stage} />
        ))}
        {getResourceLabel(p.key)}
      </div>
      <div className="advisor-profile-bars">
        <div className="advisor-profile-bars-row">
          <div className="advisor-profile-bar-group">
            <span className="advisor-profile-bar-label">Sensitivity</span>
            <div className="advisor-profile-bar-track">
              <div
                className={`advisor-profile-bar-fill${p.sensitivity >= 0 ? ' advisor-bar-positive' : ' advisor-bar-negative'}`}
                style={{ width: `${Math.min(100, Math.abs(p.sensitivity) * 100)}%`, marginLeft: p.sensitivity < 0 ? 'auto' : undefined }}
              />
            </div>
            <span className="advisor-profile-bar-value">{p.sensitivity.toFixed(2)}</span>
          </div>
          <div className="advisor-profile-bar-group">
            <span className="advisor-profile-bar-label">Income</span>
            <div className="advisor-profile-bar-track">
              <div
                className={`advisor-profile-bar-fill${p.incomeResponse >= 0 ? ' advisor-bar-positive' : ' advisor-bar-negative'}`}
                style={{ width: `${Math.min(100, Math.abs(p.incomeResponse) * 200)}%`, marginLeft: p.incomeResponse < 0 ? 'auto' : undefined }}
              />
            </div>
            <span className="advisor-profile-bar-value">{p.incomeResponse.toFixed(2)}</span>
          </div>
        </div>
        <div className="advisor-profile-bars-row">
          <div className="advisor-profile-bar-group">
            <span className="advisor-profile-bar-label">Production</span>
            <div className="advisor-profile-bar-track">
              <div
                className={`advisor-profile-bar-fill${p.productionResponse >= 0 ? ' advisor-bar-positive' : ' advisor-bar-negative'}`}
                style={{ width: `${Math.min(100, Math.abs(p.productionResponse) * 200)}%`, marginLeft: p.productionResponse < 0 ? 'auto' : undefined }}
              />
            </div>
            <span className="advisor-profile-bar-value">{p.productionResponse.toFixed(2)}</span>
          </div>
          <div className="advisor-profile-bar-group">
            <span className="advisor-profile-bar-label">Rev/Co</span>
            <div className="advisor-profile-bar-track">
              <div
                className={`advisor-profile-bar-fill${p.revenueEfficiency >= 0 ? ' advisor-bar-positive' : ' advisor-bar-negative'}`}
                style={{ width: `${Math.min(100, Math.abs(p.revenueEfficiency) * 200)}%`, marginLeft: p.revenueEfficiency < 0 ? 'auto' : undefined }}
              />
            </div>
            <span className="advisor-profile-bar-value">{p.revenueEfficiency.toFixed(2)}</span>
          </div>
        </div>
        <div className="advisor-profile-meta">
          <span className="advisor-profile-meta-label">conf:</span>
          <span style={{ color: getConfidenceColor(p.confidence) }}>{`${Math.round(p.confidence * 100)}%`}</span>
          <span className="advisor-profile-meta-sep">{'\u00B7'}</span>
          <span className="advisor-profile-meta-samples">{`${p.sampleCount} samples`}</span>
          <span className="advisor-profile-meta-sep">{'\u00B7'}</span>
          <span style={{ color: getOutcomeColor(p.avgOutcome) }}>avg: {p.avgOutcome > 0 ? '+' : ''}{p.avgOutcome.toFixed(2)}</span>
          {p.volatility > 0.15 && (
            <>
              <span className="advisor-profile-meta-sep">{'\u00B7'}</span>
              <span style={{ color: '#f0c040' }}>vol: {(p.volatility * 100).toFixed(0)}%</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  const a = prev.p;
  const b = next.p;
  return (
    a.key === b.key &&
    a.sensitivity === b.sensitivity &&
    a.incomeResponse === b.incomeResponse &&
    a.productionResponse === b.productionResponse &&
    a.revenueEfficiency === b.revenueEfficiency &&
    a.confidence === b.confidence &&
    a.sampleCount === b.sampleCount &&
    a.avgOutcome === b.avgOutcome &&
    a.volatility === b.volatility &&
    prev.useGameIcons === next.useGameIcons
  );
});

const AdvisorPanel: React.FC<AdvisorPanelProps> = ({
  advisorData,
  decisionLogData,
  learningStatsData,
  autoTaxStatus,
  learningEnabled,
  useGameIcons = true,
  onToggleLearning,
  onResetLearning,
  onSetAggressiveness,
}) => {
  // Overlay scrollbar refs for Recent Decisions (left) and Recommendations (right)
  const leftBodyRef = React.useRef<HTMLDivElement | null>(null);
  const leftTrackRef = React.useRef<HTMLDivElement | null>(null);
  const leftThumbRef = React.useRef<HTMLDivElement | null>(null);
  const [leftThumbTop, setLeftThumbTop] = React.useState(0);
  const [leftThumbHeight, setLeftThumbHeight] = React.useState(48);

  const rightBodyRef = React.useRef<HTMLDivElement | null>(null);
  const rightTrackRef = React.useRef<HTMLDivElement | null>(null);
  const rightThumbRef = React.useRef<HTMLDivElement | null>(null);
  const [rightThumbTop, setRightThumbTop] = React.useState(0);
  const [rightThumbHeight, setRightThumbHeight] = React.useState(48);

  const makeUpdater = (bodyRef: React.RefObject<HTMLDivElement>, trackRef: React.RefObject<HTMLDivElement>, setThumbH: (h: number) => void, setThumbT: (t: number) => void) => {
    return () => {
      const body = bodyRef.current;
      const track = trackRef.current;
      if (!body || !track) return;
      try {
        // Use offsetTop relative to the positioned wrapper when possible — more stable for normal flow
        const wrapper = (track.parentElement as HTMLElement) || body.parentElement || body;
        // ensure wrapper is positioned
        // compute body's offsetTop relative to wrapper
        let relTop = 0;
        if (body.offsetTop != null) {
          // Walk up offsets until reaching wrapper
          let el: HTMLElement | null = body;
          relTop = 0;
          while (el && el !== wrapper) {
            relTop += (el as HTMLElement).offsetTop || 0;
            el = (el.parentElement as HTMLElement) || null;
          }
        } else {
          const bodyRect = body.getBoundingClientRect();
          const wrapperRect = wrapper.getBoundingClientRect();
          relTop = bodyRect.top - wrapperRect.top;
        }
      // Clamp into wrapper bounds
        try {
          const wrapperRect = wrapper.getBoundingClientRect();
          relTop = Math.max(0, Math.min(relTop, Math.max(0, wrapperRect.height - body.clientHeight)));
        } catch {}
        // Anchor the overlay track to the main panel viewport (.advisor-content) instead
        // so the scrollbar appears at the far-right of the panel rather than inside
        // a narrower section column which would overlay content.
        try {
          // Anchor the overlay track to the nearest column wrapper (usually the
          // parent `.advisor-section`) so each column has its own track positioned
          // at that column's right edge. The wrapper is already positioned in CSS
          // (see `.advisor-section { position: relative; }`).
          const column = (body.parentElement as HTMLElement) || wrapper || body;
          track.style.position = 'absolute';
          // small distance (8rem) from the column's right edge
          const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
          const gutterPx = Math.round(8 * rootFont);
          track.style.right = `${gutterPx}px`;
          // top should be relative to the column's top
          track.style.top = `${relTop}px`;
          track.style.height = `${body.clientHeight}px`;
          // ensure the track is a child of the column so absolute positioning is anchored correctly
          if (track.parentElement !== column) {
            try { column.appendChild(track); } catch {}
          }
        } catch {
          // Fallback: absolute positioning relative to wrapper
          try { track.style.position = 'absolute'; track.style.top = `${relTop}px`; track.style.height = `${body.clientHeight}px`; } catch {}
        }
      } catch {}
      const visible = body.clientHeight;
      const total = body.scrollHeight || 1;
      if (visible >= total || !Number.isFinite(visible) || !Number.isFinite(total)) {
        try { track.style.display = 'none'; } catch {}
        return;
      }
      try { track.style.display = 'block'; } catch {}
      const ratio = Math.max(0.03, Math.min(1, visible / total));
      const trackHeight = track.clientHeight;
      const thumbH = Math.max(16, Math.round(trackHeight * ratio));
      const scrollTop = body.scrollTop;
      const maxScroll = total - visible;
      const top = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * (trackHeight - thumbH)) : 0;
      setThumbH(thumbH);
      setThumbT(top);
    };
  };

  const updateLeftScrollbar = React.useCallback(makeUpdater(leftBodyRef, leftTrackRef, setLeftThumbHeight, setLeftThumbTop), []);
  const updateRightScrollbar = React.useCallback(makeUpdater(rightBodyRef, rightTrackRef, setRightThumbHeight, setRightThumbTop), []);

  // Profiles and Log overlays
  const profilesBodyRef = React.useRef<HTMLDivElement | null>(null);
  const profilesTrackRef = React.useRef<HTMLDivElement | null>(null);
  const profilesThumbRef = React.useRef<HTMLDivElement | null>(null);
  const [profilesThumbTop, setProfilesThumbTop] = React.useState(0);
  const [profilesThumbHeight, setProfilesThumbHeight] = React.useState(48);

  const logBodyRef = React.useRef<HTMLDivElement | null>(null);
  const logTrackRef = React.useRef<HTMLDivElement | null>(null);
  const logThumbRef = React.useRef<HTMLDivElement | null>(null);
  const [logThumbTop, setLogThumbTop] = React.useState(0);
  const [logThumbHeight, setLogThumbHeight] = React.useState(48);

  const updateProfilesScrollbar = React.useCallback(makeUpdater(profilesBodyRef, profilesTrackRef, setProfilesThumbHeight, setProfilesThumbTop), []);
  const updateLogScrollbar = React.useCallback(makeUpdater(logBodyRef, logTrackRef, setLogThumbHeight, setLogThumbTop), []);

  const metricsBodyRef = React.useRef<HTMLDivElement | null>(null);
  const metricsTrackRef = React.useRef<HTMLDivElement | null>(null);
  const metricsThumbRef = React.useRef<HTMLDivElement | null>(null);
  const [metricsThumbTop, setMetricsThumbTop] = React.useState(0);
  const [metricsThumbHeight, setMetricsThumbHeight] = React.useState(48);
  const updateMetricsScrollbar = React.useCallback(makeUpdater(metricsBodyRef, metricsTrackRef, setMetricsThumbHeight, setMetricsThumbTop), []);

  React.useEffect(() => { const onResize = () => { updateProfilesScrollbar(); updateLogScrollbar(); updateMetricsScrollbar(); }; window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize); }, [updateProfilesScrollbar, updateLogScrollbar, updateMetricsScrollbar]);

  // Hook up drag handlers for profiles and log (invoked after makeDrag is defined)

  React.useEffect(() => {
    const body = profilesBodyRef.current;
    if (body) {
      const mo = new MutationObserver(() => updateProfilesScrollbar());
      mo.observe(body, { childList: true, subtree: true, attributes: true });
      return () => mo.disconnect();
    }
  }, [profilesBodyRef.current, updateProfilesScrollbar]);
  React.useEffect(() => {
    const body = logBodyRef.current;
    if (body) {
      const mo = new MutationObserver(() => updateLogScrollbar());
      mo.observe(body, { childList: true, subtree: true, attributes: true });
      return () => mo.disconnect();
    }
  }, [logBodyRef.current, updateLogScrollbar]);

  React.useEffect(() => {
    const body = metricsBodyRef.current;
    if (body) {
      const mo = new MutationObserver(() => updateMetricsScrollbar());
      mo.observe(body, { childList: true, subtree: true, attributes: true });
      return () => mo.disconnect();
    }
  }, [metricsBodyRef.current, updateMetricsScrollbar]);

  React.useEffect(() => { const onResize = () => { updateLeftScrollbar(); updateRightScrollbar(); }; window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize); }, [updateLeftScrollbar, updateRightScrollbar]);

  // Drag handlers for left and right thumbs
  const makeDrag = (thumbRef: React.RefObject<HTMLDivElement>, trackRef: React.RefObject<HTMLDivElement>, bodyRef: React.RefObject<HTMLDivElement>, thumbTop: number, thumbH: number, setThumbTop: (t: number) => void) => {
    React.useEffect(() => {
      let dragging = false;
      let startY = 0;
      let startTop = 0;
      const thumb = thumbRef.current;
      const track = trackRef.current;
      const body = bodyRef.current;
      if (!thumb || !track || !body) return;
      const onDown = (ev: any) => { try { if (ev.stopPropagation) ev.stopPropagation(); } catch {}; dragging = true; startY = ev.clientY || (ev.touches && ev.touches[0] && ev.touches[0].clientY) || 0; startTop = thumbTop; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); ev.preventDefault(); };
      const onMove = (ev: MouseEvent) => { if (!dragging) return; const dy = ev.clientY - startY; const trackH = track.clientHeight; const maxTop = trackH - thumbH; const newTop = Math.max(0, Math.min(maxTop, startTop + dy)); const total = body.scrollHeight - body.clientHeight; const scrollPos = total > 0 ? Math.round((newTop / (trackH - thumbH)) * total) : 0; body.scrollTop = scrollPos; setThumbTop(newTop); };
      const onUp = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      try { thumb.addEventListener('pointerdown', onDown as any); } catch {};
      try { thumb.addEventListener('mousedown', onDown as any); } catch {};
      return () => { try { thumb.removeEventListener('mousedown', onDown as any); } catch {} };
    }, [thumbTop, thumbH, thumbRef, trackRef, bodyRef, setThumbTop]);
  };

  makeDrag(leftThumbRef, leftTrackRef, leftBodyRef, leftThumbTop, leftThumbHeight, setLeftThumbTop);
  makeDrag(rightThumbRef, rightTrackRef, rightBodyRef, rightThumbTop, rightThumbHeight, setRightThumbTop);

  // Now hook up drag handlers for profiles and log
  makeDrag(profilesThumbRef, profilesTrackRef, profilesBodyRef, profilesThumbTop, profilesThumbHeight, setProfilesThumbTop);
  makeDrag(logThumbRef, logTrackRef, logBodyRef, logThumbTop, logThumbHeight, setLogThumbTop);
  makeDrag(metricsThumbRef, metricsTrackRef, metricsBodyRef, metricsThumbTop, metricsThumbHeight, setMetricsThumbTop);

  React.useEffect(() => {
    const body = leftBodyRef.current;
    if (body) {
      const mo = new MutationObserver(() => updateLeftScrollbar());
      mo.observe(body, { childList: true, subtree: true, attributes: true });
      return () => mo.disconnect();
    }
  }, [leftBodyRef.current, updateLeftScrollbar]);
  React.useEffect(() => {
    const body = rightBodyRef.current;
    if (body) {
      const mo = new MutationObserver(() => updateRightScrollbar());
      mo.observe(body, { childList: true, subtree: true, attributes: true });
      return () => mo.disconnect();
    }
  }, [rightBodyRef.current, updateRightScrollbar]);

  const [activeTab, setActiveTab] = useState<'overview' | 'profiles' | 'log' | 'metrics'>('overview');
  const [confirmReset, setConfirmReset] = useState(false);
  const [showAllProfiles, setShowAllProfiles] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const legendBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const [legendPos, setLegendPos] = React.useState<DOMRect | null>(null);

  // Keep legend positioned near the button when open — update on resize/scroll
  React.useEffect(() => {
    if (!showLegend) return;
    const update = () => {
      try {
        const rect = legendBtnRef.current && legendBtnRef.current.getBoundingClientRect();
        setLegendPos(rect || null);
      } catch { setLegendPos(null); }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [showLegend]);



  const advisorParsed = useMemo(() => parseAdvisorData(advisorData), [advisorData]);
  const profiles = advisorParsed.profiles;
  const recommendations = advisorParsed.recommendations;
  const decisions = useMemo(() => parseDecisionLog(decisionLogData), [decisionLogData]);
  const stats = useMemo(() => parseLearningStats(learningStatsData), [learningStatsData]);
  const autoTaxMetrics = useMemo(() => parseAutoTaxStatus(autoTaxStatus), [autoTaxStatus]);

  // Recompute left/right scrollbars when profiles/decisions/activeTab change
  useEffect(() => {
    updateLeftScrollbar();
    updateRightScrollbar();
  }, [profiles.length, decisions.length, activeTab, updateLeftScrollbar, updateRightScrollbar]);

  // Recompute profiles/log scrollbars when their data or active tab changes
  useEffect(() => {
    if (activeTab === 'profiles') {
      requestAnimationFrame(() => requestAnimationFrame(() => updateProfilesScrollbar()));
    }
    if (activeTab === 'log') {
      requestAnimationFrame(() => requestAnimationFrame(() => updateLogScrollbar()));
    }
    if (activeTab === 'metrics') {
      requestAnimationFrame(() => requestAnimationFrame(() => updateMetricsScrollbar()));
    }
  }, [activeTab, profiles.length, decisions.length, updateProfilesScrollbar, updateLogScrollbar, updateMetricsScrollbar]);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => b.sampleCount - a.sampleCount),
    [profiles]
  );

  // No row limit: render all sorted profiles by default. Keep showAllProfiles state for compatibility.
  const displayedProfiles = useMemo(() => sortedProfiles, [sortedProfiles]);

  const handleReset = () => {
    if (confirmReset) {
      onResetLearning();
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
    }
  };

  // Ensure scroll resets and scrollbar thumb recalculates when switching tabs
  useEffect(() => {
    const el = document.querySelector('.advisor-content') as HTMLElement | null;
    if (!el) return;
    // reset scroll to top on tab change
    el.scrollTop = 0;
    // force reflow then allow scrollbar to update
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // no-op to let layout settle
    }));
  }, [activeTab]);

  // ProfileRow component moved to module scope to ensure stable identity and allow memoization

  const LegendPopup: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
    // use the same styling as the settings info popup for consistent appearance
    <div className="ats-info-popup" role="dialog" aria-label="Advisor legend" style={style}>
      <div className="advisor-legend-title">Legend</div>
      <ul>
        <li><span className="legend-icon legend-up">▲</span> Green up arrow: recommend increase</li>
        <li><span className="legend-icon legend-down">▼</span> Red down arrow: recommend decrease</li>
        <li><span className="legend-icon legend-dot">●</span> Grey dot: neutral / no change</li>
        <li><strong>Change</strong>: shows old% → new% (tax rate change)</li>
        <li><strong>Outcome</strong>: effect on outcome metric (positive is good)</li>
        <li><strong>Confidence</strong>: model confidence (0–100%)</li>
        <li>Example: <em>14% → 13% &nbsp; -0.02 &nbsp; 59%</em> — old rate 14%, new rate 13%, outcome change -0.02, confidence 59%</li>
      </ul>
    </div>
  );

  return (
    <div className="advisor-panel">
      {/* Controls bar */}
      <div className="advisor-controls">
        <button
          className={`advisor-toggle${learningEnabled ? ' advisor-toggle-active' : ''}`}
          onClick={() => onToggleLearning(!learningEnabled)}
        >
          {learningEnabled ? 'Learning: ON' : 'Learning: OFF'}
        </button>
        <div className="advisor-aggressiveness">
          <span className="advisor-aggr-label">Speed:</span>
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              className={`advisor-aggr-btn${stats.aggressiveness === level ? ' advisor-aggr-btn-active' : ''}`}
              onClick={() => onSetAggressiveness(level)}
              title={AGGRESSIVENESS_LABELS[level]}
            >
              {level}
            </button>
          ))}
        </div>
        <button
          className={`advisor-reset${confirmReset ? ' advisor-reset-confirm' : ''}`}
          onClick={handleReset}
        >
          {confirmReset ? 'Confirm Reset' : 'Reset'}
        </button>
        <button ref={legendBtnRef} className="advisor-legend-btn" onClick={() => {
          // toggle and capture button position for portal positioning
          const next = !showLegend;
          setShowLegend(next);
          try {
            const rect = legendBtnRef.current && legendBtnRef.current.getBoundingClientRect();
            setLegendPos(rect || null);
          } catch { setLegendPos(null); }
        }} title="Legend">?</button>
        {showLegend && legendPos && (() => {
          // Prefer appending the popup to the same top-level container as the main window
          // so it participates in the same stacking context used by other tooltips.
          const win = document.querySelector('.adv-window');
          const container = (win && (win.parentElement || document.body)) || document.body;
          return ReactDOM.createPortal(
            <LegendPopup style={{ position: 'fixed', top: legendPos.bottom + 8, left: legendPos.left, zIndex: 10000 }} />,
            container
          );
        })()}
      </div>

      {/* Tab bar */}
      <div className="advisor-tabs">
        <button
          className={`advisor-tab${activeTab === 'overview' ? ' advisor-tab-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`advisor-tab${activeTab === 'profiles' ? ' advisor-tab-active' : ''}`}
          onClick={() => setActiveTab('profiles')}
        >
          Profiles ({profiles.length})
        </button>
        <button
          className={`advisor-tab${activeTab === 'log' ? ' advisor-tab-active' : ''}`}
          onClick={() => setActiveTab('log')}
        >
          Log ({decisions.length})
        </button>
        <button
          className={`advisor-tab${activeTab === 'metrics' ? ' advisor-tab-active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Metrics
        </button>
      </div>

      {/* Content area */}
      {/* Content area */}
      <div className="advisor-content">
          <div className="advisor-overview" style={{ display: activeTab === 'overview' ? undefined : 'none' }}>
            {/* Stats summary */}
            <div className="advisor-stats-grid">
              <div className="advisor-stat">
                <div className="advisor-stat-value">{stats.totalSamples}</div>
                <div className="advisor-stat-label">Observations</div>
        </div>
              <div className="advisor-stat">
                <div className="advisor-stat-value">{profiles.length}</div>
                <div className="advisor-stat-label">Active Profiles</div>
              </div>
              <div className="advisor-stat">
                <div className="advisor-stat-value" style={{ color: getConfidenceColor(stats.avgConfidence) }}>
                  {`${(stats.avgConfidence * 100).toFixed(0)}\u00a0%`}
                </div>
                <div className="advisor-stat-label">Avg Confidence</div>
              </div>
              <div className="advisor-stat">
                <div className="advisor-stat-value">{stats.pendingEvents}</div>
                <div className="advisor-stat-label">Pending</div>
        </div>
            </div>
            {/* Overview explanation removed per user request; info popup available via header info button */}

            {/* Two-column: Recent Decisions (left) and Recommendations (right) */}
            <div className="advisor-overview-two">
              <div className="advisor-overview-left">
                {decisions.length > 0 ? (
                  <div className="advisor-section">
                    <div className="advisor-section-title">Recent Decisions</div>
                    <div className="advisor-decision-headers">
                      <span className="advisor-decision-resource">Resource</span>
                      <span className="advisor-decision-change">Change</span>
                      <span className="advisor-decision-outcome">Outcome</span>
                      <span className="advisor-decision-summary">Summary</span>
                    </div>
                    <div className="advisor-scroll-box" ref={leftBodyRef} onScroll={updateLeftScrollbar}>
                      <div className="advisor-decision-list">
                        {decisions.slice(-50).reverse().map((d, i) => {
                          const icon = findResourceIcon(d.key);
                          return (
                          <div key={i} className="advisor-decision-row">
                              <span className="advisor-decision-resource">
                                {icon && <img src={`Media/Game/Resources/${icon}.svg`} className="advisor-resource-icon" alt="" />}
                                {/* zone badge for decision rows (no SVG) */}
                                {(() => {
                                  const stage = findResourceStage(d.key);
                                  return stage ? (
                                    useGameIcons ? (
                                      <img src={getZoneIconPath(stage) as string} className="advisor-zone-icon" title={stage} alt="" />
                                    ) : (
                                      <span className={`advisor-zone-badge advisor-zone-${(stage || '').toLowerCase()}`} title={stage} />
                                    )
                                  ) : null;
                                })()}
                                {getResourceLabel(d.key)}
                              </span>
                            <span className="advisor-decision-change">{`${d.oldRate}\u00a0%`} {'\u2192'} {`${d.newRate}\u00a0%`}</span>
                            <span className="advisor-decision-outcome" style={{ color: getOutcomeColor(d.outcomeScore) }}>{d.outcomeScore > 0 ? '+' : ''}{d.outcomeScore.toFixed(2)}</span>
                            <span className="advisor-decision-summary">{d.summary}</span>
                          </div>
                        )})}
                      </div>
                    </div>
                    <div ref={leftTrackRef} className="advisor-scrollbar-track" aria-hidden>
                      <div ref={leftThumbRef} className="advisor-scrollbar-thumb" style={{ top: `${leftThumbTop}px`, height: `${leftThumbHeight}px` }} />
                    </div>
                  </div>
                ) : (
                  <div className="advisor-empty">No recent decisions.</div>
                )}
              </div>

              <div className="advisor-overview-right">
                {recommendations.length > 0 ? (
                  <div className="advisor-section">
                    <div className="advisor-section-title">Recommendations</div>
                    <div className="advisor-rec-headers">
                      <span className="advisor-rec-dir">Dir</span>
                      <span className="advisor-rec-name">Resource</span>
                      <span className="advisor-rec-rate">Rate</span>
                      <span className="advisor-rec-conf">Confidence</span>
                      <span className="advisor-rec-reason">Reason</span>
                    </div>
                    <div className="advisor-scroll-box advisor-rec-box" ref={rightBodyRef} onScroll={updateRightScrollbar}>
                      <div className="advisor-rec-list">
                        {recommendations.map((rec) => {
                          const icon = findResourceIcon(rec.key);
                          return (
                          <div key={rec.key} className="advisor-rec-row">
                            <span className="advisor-rec-dir" style={{ color: getDirectionColor(rec.direction) }}>{getDirectionSymbol(rec.direction)}</span>
                            <span className="advisor-rec-name">
                              {icon && <img src={`Media/Game/Resources/${icon}.svg`} className="advisor-resource-icon" alt="" />}
                              {(() => {
                                const stage = findResourceStage(rec.key);
                                return stage ? (
                                  useGameIcons ? (
                                    <img src={getZoneIconPath(stage) as string} className="advisor-zone-icon-small" title={stage} alt="" />
                                  ) : (
                                    <span className={`advisor-zone-badge advisor-zone-${(stage || '').toLowerCase()}`} title={stage} />
                                  )
                                ) : null;
                              })()}
                              {getResourceLabel(rec.key)}
                            </span>
                            <span className="advisor-rec-rate">{`${rec.currentRate}\u00a0%`}</span>
                            <span className="advisor-rec-conf" style={{ color: getConfidenceColor(rec.confidence) }}>{`${(rec.confidence * 100).toFixed(0)}\u00a0%`}</span>
                            <span className="advisor-rec-reason">{rec.reason}</span>
                          </div>
                        )})}
                      </div>
                    </div>
                    <div ref={rightTrackRef} className="advisor-scrollbar-track" aria-hidden>
                      <div ref={rightThumbRef} className="advisor-scrollbar-thumb" style={{ top: `${rightThumbTop}px`, height: `${rightThumbHeight}px` }} />
                    </div>
                  </div>
                ) : (
                  <div className="advisor-empty">No recommendations yet.</div>
                )}
              </div>
            </div>
          </div>

        <div className="advisor-profiles" style={{ display: activeTab === 'profiles' ? undefined : 'none' }}>
            {sortedProfiles.length === 0 && (
              <div className="advisor-empty">No learning profiles yet. Data will appear after tax adjustments are observed.</div>
            )}

            <div className="advisor-scroll-box" ref={profilesBodyRef} onScroll={updateProfilesScrollbar}>
              <div className="advisor-profile-list">
                {displayedProfiles.map((p) => (
                  <ProfileRow key={p.key} p={p} useGameIcons={useGameIcons} />
                ))}
              </div>
            </div>
            <div ref={profilesTrackRef} className="advisor-scrollbar-track" aria-hidden>
              <div ref={profilesThumbRef} className="advisor-scrollbar-thumb" style={{ top: `${profilesThumbTop}px`, height: `${profilesThumbHeight}px` }} />
            </div>
          </div>


        <div className="advisor-log" style={{ display: activeTab === 'log' ? undefined : 'none' }}>
            {decisions.length === 0 && (
              <div className="advisor-empty">No decisions logged yet.</div>
            )}
            <div className="advisor-log-headers">
              <span className="advisor-log-resource">Resource</span>
              <span className="advisor-log-change">Change</span>
              <span className="advisor-log-outcome">Outcome</span>
              <span className="advisor-log-conf">Confidence</span>
            </div>
            <div className="advisor-scroll-box" ref={logBodyRef} onScroll={updateLogScrollbar}>
              <div className="advisor-log-list">
                {[...decisions].reverse().map((d, i) => {
                  const icon = findResourceIcon(d.key);
                  return (
                  <div key={i} className="advisor-log-row">
                    <div className="advisor-log-header">
                      <span className="advisor-log-resource">
                        {icon && <img src={`Media/Game/Resources/${icon}.svg`} className="advisor-resource-icon" alt="" />}
                        {(() => {
                                  const stage = findResourceStage(d.key);
                          return stage ? (
                            useGameIcons ? (
                              <img src={getZoneIconPath(stage) as string} className="advisor-zone-icon" title={stage} alt="" />
                            ) : (
                              <span className={`advisor-zone-badge advisor-zone-${(stage || '').toLowerCase()}`} title={stage} />
                            )
                          ) : null;
                        })()}
                        {getResourceLabel(d.key)}
                      </span>
                      <span className="advisor-log-change">{`${d.oldRate}\u00a0%`} {'\u2192'} {`${d.newRate}\u00a0%`}</span>
                      <span className="advisor-log-outcome" style={{ color: getOutcomeColor(d.outcomeScore) }}>
                        {d.outcomeScore > 0 ? '+' : ''}{d.outcomeScore.toFixed(2)}
                      </span>
                      <span className="advisor-log-conf" style={{ color: getConfidenceColor(d.confidence) }}>
                        {`${(d.confidence * 100).toFixed(0)}\u00a0%`}
                      </span>
                    </div>
                    {d.summary && <div className="advisor-log-summary">{d.summary}</div>}
                  </div>
                )})}
              </div>
            </div>
            <div ref={logTrackRef} className="advisor-scrollbar-track" aria-hidden>
              <div ref={logThumbRef} className="advisor-scrollbar-thumb" style={{ top: `${logThumbTop}px`, height: `${logThumbHeight}px` }} />
            </div>
          </div>

        <div className="advisor-metrics" style={{ display: activeTab === 'metrics' ? undefined : 'none' }}>
          <div className="advisor-scroll-box advisor-metrics-scroll" ref={metricsBodyRef} onScroll={updateMetricsScrollbar}>
            {(() => {
              const list = autoTaxMetrics.resources;
              if (!list || list.length === 0) {
                return <div className="advisor-empty">No auto-tax metrics yet.</div>;
              }
              const avgScore = list.reduce((a: number, b: AutoTaxResourceInfo) => a + b.score, 0) / Math.max(1, list.length);
              const avgProfit = list.reduce((a: number, b: AutoTaxResourceInfo) => a + b.avgProfit, 0) / Math.max(1, list.length);
              const avgHappiness = list.reduce((a: number, b: AutoTaxResourceInfo) => a + b.happiness, 0) / Math.max(1, list.length);
              const topPositive = [...list].sort((a: AutoTaxResourceInfo, b: AutoTaxResourceInfo) => b.score - a.score).slice(0, 4);
              const topNegative = [...list].sort((a: AutoTaxResourceInfo, b: AutoTaxResourceInfo) => a.score - b.score).slice(0, 4);

              return (
                <div>
                  <div className="advisor-metrics-summary">
                    <div className="advisor-metric-card">
                      <div className="advisor-metric-label">City Happiness</div>
                      <div className="advisor-metric-value">{autoTaxMetrics.happiness}%</div>
                    </div>
                    <div className="advisor-metric-card">
                      <div className="advisor-metric-label">Adjustments</div>
                      <div className="advisor-metric-value">{autoTaxMetrics.adjustCount}</div>
                      <div className="advisor-metric-sub">Raise {autoTaxMetrics.raiseCount} · Lower {autoTaxMetrics.lowerCount} · Hold {autoTaxMetrics.holdCount}</div>
                    </div>
                    <div className="advisor-metric-card">
                      <div className="advisor-metric-label">Avg Score</div>
                      <div className="advisor-metric-value">{avgScore.toFixed(2)}</div>
                      <div className="advisor-metric-sub">Avg Profit {avgProfit > 0 ? '+' : ''}{avgProfit.toFixed(0)}%</div>
                    </div>
                    <div className="advisor-metric-card">
                      <div className="advisor-metric-label">Avg Resource Happiness</div>
                      <div className="advisor-metric-value">{avgHappiness.toFixed(0)}%</div>
                    </div>
                  </div>

                  <div className="advisor-metrics-highlights">
                    <div className="advisor-metrics-block">
                      <div className="advisor-section-title">Top Positive</div>
                      {topPositive.map((r: AutoTaxResourceInfo) => (
                        <div key={`pos-${r.key}`} className="advisor-metrics-row">
                          <span>{getResourceLabel(r.key)}</span>
                          <span style={{ color: '#8bdb46' }}>{r.score.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="advisor-metrics-block">
                      <div className="advisor-section-title">Top Negative</div>
                      {topNegative.map((r: AutoTaxResourceInfo) => (
                        <div key={`neg-${r.key}`} className="advisor-metrics-row">
                          <span>{getResourceLabel(r.key)}</span>
                          <span style={{ color: '#e05050' }}>{r.score.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="advisor-metrics-table">
                    <div className="advisor-metrics-header">
                      <span className="advisor-metrics-col">Resource</span>
                      <span className="advisor-metrics-col">Dir</span>
                      <span className="advisor-metrics-col">Score</span>
                      <span className="advisor-metrics-col">Balance</span>
                      <span className="advisor-metrics-col">Demand</span>
                      <span className="advisor-metrics-col">Income</span>
                      <span className="advisor-metrics-col">Profit</span>
                      <span className="advisor-metrics-col">Happy</span>
                      <span className="advisor-metrics-col">Rate Drag</span>
                      <span className="advisor-metrics-col">Companies</span>
                      <span className="advisor-metrics-col">Avg Profit</span>
                      <span className="advisor-metrics-col">Learned</span>
                    </div>
                    {list.map((r: AutoTaxResourceInfo) => (
                      <div key={`row-${r.key}`} className="advisor-metrics-data">
                        <span className="advisor-metrics-col">{getResourceLabel(r.key)}</span>
                        <span className="advisor-metrics-col" style={{ color: getDirectionColor(r.direction) }}>{getDirectionSymbol(r.direction)}</span>
                        <span className="advisor-metrics-col" style={{ color: getOutcomeColor(r.score) }}>{r.score.toFixed(2)}</span>
                        <span className="advisor-metrics-col">{r.balance.toFixed(2)}</span>
                        <span className="advisor-metrics-col">{r.demand.toFixed(2)}</span>
                        <span className="advisor-metrics-col">{r.income.toFixed(2)}</span>
                        <span className="advisor-metrics-col">{r.profit.toFixed(2)}</span>
                        <span className="advisor-metrics-col">{r.happiness.toFixed(0)}%</span>
                        <span className="advisor-metrics-col">{r.rateDrag.toFixed(2)}</span>
                        <span className="advisor-metrics-col">{r.companies}</span>
                        <span className="advisor-metrics-col">{r.avgProfit > 0 ? '+' : ''}{r.avgProfit.toFixed(0)}%</span>
                        <span className="advisor-metrics-col">{r.learned.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <div ref={metricsTrackRef} className="advisor-scrollbar-track" aria-hidden>
            <div ref={metricsThumbRef} className="advisor-scrollbar-thumb" style={{ top: `${metricsThumbTop}px`, height: `${metricsThumbHeight}px` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvisorPanel;
