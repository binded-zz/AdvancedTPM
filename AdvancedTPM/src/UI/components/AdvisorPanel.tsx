import React, { useMemo, useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import './AdvisorPanel.css';

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

interface AdvisorPanelProps {
  advisorData: string;
  decisionLogData: string;
  learningStatsData: string;
  learningEnabled: boolean;
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

const getResourceLabel = (key: string): string => {
  const clean = (key || '').startsWith('c_') ? (key || '').slice(2) : (key || '');
  return clean
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/convenience\s*food/gi, 'Convenience Food')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (s) => s.toUpperCase());
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
  if (dir > 0) return '\u25B2'; // Up
  if (dir < 0) return '\u25BC'; // Down
  return '\u25CF'; // Neutral
};

const getDirectionColor = (dir: number): string => {
  if (dir > 0) return '#8bdb46';
  if (dir < 0) return '#e05050';
  return 'rgba(255,255,255,0.5)';
};

const RESOURCE_ICON_BASE = 'Media/Game/Resources/';
const ZONE_ICON_BASE = 'Media/Game/Icons/';
const RESOURCE_ICON_MAP: Record<string, string> = {
  grain: 'Grain', vegetables: 'Vegetables', cotton: 'Cotton', livestock: 'Livestock',
  fish: 'Fish', wood: 'Wood', ore: 'Ore', stone: 'Stone', coal: 'Coal', oil: 'Oil',
  food: 'Food', beverages: 'Beverages', conveniencefood: 'ConvenienceFood',
  textiles: 'Textiles', timber: 'Timber', paper: 'Paper', furniture: 'Furniture',
  metals: 'Metals', steel: 'Steel', minerals: 'Minerals', concrete: 'Concrete',
  machinery: 'Machinery', electronics: 'Electronics', vehicles: 'Vehicles',
  petrochemicals: 'Petrochemicals', plastics: 'Plastics', chemicals: 'Chemicals',
  pharmaceuticals: 'Pharmaceuticals', software: 'Software', telecom: 'Telecom',
  financial: 'Financial', media: 'Media', lodging: 'Lodging', meals: 'Meals',
  entertainment: 'Entertainment', recreation: 'Recreation',
  c_food: 'Food', c_beverages: 'Beverages', c_conveniencefood: 'ConvenienceFood',
  c_textiles: 'Textiles', c_timber: 'Timber', c_paper: 'Paper', c_furniture: 'Furniture',
  c_electronics: 'Electronics', c_vehicles: 'Vehicles', c_petrochemicals: 'Petrochemicals',
  c_plastics: 'Plastics', c_chemicals: 'Chemicals', c_pharmaceuticals: 'Pharmaceuticals',
};
const getResourceIconSrc = (key: string): string | null => {
  const lk = key.toLowerCase();
  const name = RESOURCE_ICON_MAP[lk];
  return name ? `${RESOURCE_ICON_BASE}${name}.svg` : null;
};
const getResourceTypeIcon = (key: string): string => {
  const lk = key.toLowerCase();
  if (lk.startsWith('c_')) return `${ZONE_ICON_BASE}ZoneCommercial.svg`;
  const rawResources = ['grain', 'vegetables', 'cotton', 'livestock', 'fish', 'wood', 'ore', 'stone', 'coal', 'oil'];
  if (rawResources.includes(lk)) return `${ZONE_ICON_BASE}ZoneExtractors.svg`;
  return `${ZONE_ICON_BASE}ZoneIndustrial.svg`;
};

const AGGRESSIVENESS_LABELS: Record<number, string> = {
  1: 'Very Conservative',
  2: 'Conservative',
  3: 'Balanced',
  4: 'Aggressive',
  5: 'Very Aggressive',
};

// Move ProfileRow to module scope so its identity is stable across renders.
const ProfileRow: React.FC<{ p: LearningProfile }> = React.memo(({ p }) => {
  const iconSrc = getResourceIconSrc(p.key);
  const typeIcon = getResourceTypeIcon(p.key);
  return (
    <div className="advisor-profile-row">
      <div className="advisor-profile-name">
        {typeIcon && <img src={typeIcon} className="advisor-profile-type-icon" alt="" title={p.key.startsWith('c_') ? 'Commercial' : 'Industrial'} />}
        {iconSrc && <img src={iconSrc} className="advisor-profile-icon" alt="" />}
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
          <span style={{ color: getConfidenceColor(p.confidence), marginRight: '10rem' }}>
            {`${(p.confidence * 100).toFixed(0)}\u00a0%`} conf
          </span>
          <span style={{ color: 'rgba(255,255,255,0.25)', marginRight: '10rem' }}>{"\u00B7"}</span>
          <span style={{ marginRight: '10rem' }}>{p.sampleCount} samples</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', marginRight: '10rem' }}>{"\u00B7"}</span>
          <span style={{ color: getOutcomeColor(p.avgOutcome), marginRight: '10rem' }}>
            avg: {p.avgOutcome > 0 ? '+' : ''}{p.avgOutcome.toFixed(2)}
          </span>
          {p.volatility > 0.15 && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.25)', marginRight: '10rem' }}>{"\u00B7"}</span>
              <span style={{ color: '#f0c040' }}>
                vol: {(p.volatility * 100).toFixed(0)}%
              </span>
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
    a.volatility === b.volatility
  );
});

const AdvisorPanel: React.FC<AdvisorPanelProps> = ({
  advisorData,
  decisionLogData,
  learningStatsData,
  learningEnabled,
  onToggleLearning,
  onResetLearning,
  onSetAggressiveness,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'profiles' | 'log'>('overview');
  const [confirmReset, setConfirmReset] = useState(false);

  // Overlay scrollbar refs — left col (recommendations), right col (decisions)
  const leftBodyRef = useRef<HTMLDivElement | null>(null);
  const leftTrackRef = useRef<HTMLDivElement | null>(null);
  const leftThumbRef = useRef<HTMLDivElement | null>(null);
  const [leftThumbTop, setLeftThumbTop] = useState(0);
  const [leftThumbHeight, setLeftThumbHeight] = useState(48);

  const rightBodyRef = useRef<HTMLDivElement | null>(null);
  const rightTrackRef = useRef<HTMLDivElement | null>(null);
  const rightThumbRef = useRef<HTMLDivElement | null>(null);
  const [rightThumbTop, setRightThumbTop] = useState(0);
  const [rightThumbHeight, setRightThumbHeight] = useState(48);

  const profilesBodyRef = useRef<HTMLDivElement | null>(null);
  const profilesTrackRef = useRef<HTMLDivElement | null>(null);
  const profilesThumbRef = useRef<HTMLDivElement | null>(null);
  const [profilesThumbTop, setProfilesThumbTop] = useState(0);
  const [profilesThumbHeight, setProfilesThumbHeight] = useState(48);

  const logBodyRef = useRef<HTMLDivElement | null>(null);
  const logTrackRef = useRef<HTMLDivElement | null>(null);
  const logThumbRef = useRef<HTMLDivElement | null>(null);
  const [logThumbTop, setLogThumbTop] = useState(0);
  const [logThumbHeight, setLogThumbHeight] = useState(48);

  const makeUpdate = useCallback((
    bodyRef: React.RefObject<HTMLDivElement>,
    trackRef: React.RefObject<HTMLDivElement>,
    setThumbH: (h: number) => void,
    setThumbT: (t: number) => void,
  ) => () => {
    const body = bodyRef.current;
    const track = trackRef.current;
    if (!body || !track) return;
    const visible = body.clientHeight;
    const total = body.scrollHeight || 1;
    if (visible >= total || !Number.isFinite(visible) || !Number.isFinite(total)) {
      try { track.style.display = 'none'; } catch {}
      return;
    }
    try { track.style.display = 'block'; } catch {}
    const ratio = Math.max(0.03, Math.min(1, visible / total));
    const trackH = track.clientHeight;
    const thumbH = Math.max(16, Math.round(trackH * ratio));
    const maxScroll = total - visible;
    const top = maxScroll > 0 ? Math.round((body.scrollTop / maxScroll) * (trackH - thumbH)) : 0;
    setThumbH(thumbH);
    setThumbT(top);
  }, []);

  const updateLeft = useCallback(makeUpdate(leftBodyRef, leftTrackRef, setLeftThumbHeight, setLeftThumbTop), []);
  const updateRight = useCallback(makeUpdate(rightBodyRef, rightTrackRef, setRightThumbHeight, setRightThumbTop), []);
  const updateProfiles = useCallback(makeUpdate(profilesBodyRef, profilesTrackRef, setProfilesThumbHeight, setProfilesThumbTop), []);
  const updateLog = useCallback(makeUpdate(logBodyRef, logTrackRef, setLogThumbHeight, setLogThumbTop), []);

  const makeDragHandler = (
    thumbRef: React.RefObject<HTMLDivElement>,
    trackRef: React.RefObject<HTMLDivElement>,
    bodyRef: React.RefObject<HTMLDivElement>,
    thumbTopVal: number,
    thumbHeightVal: number,
    setThumbTop: (t: number) => void,
    onUpdate: () => void,
  ) => {
    useEffect(() => {
      let dragging = false;
      let startY = 0;
      let startTop = 0;
      const thumb = thumbRef.current;
      const track = trackRef.current;
      const body = bodyRef.current;
      if (!thumb || !track || !body) return;
      const onDown = (ev: any) => {
        try { ev.stopPropagation?.(); } catch {}
        dragging = true;
        startY = ev.clientY || (ev.touches?.[0]?.clientY) || 0;
        startTop = thumbTopVal;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        ev.preventDefault();
      };
      const onMove = (ev: MouseEvent) => {
        if (!dragging) return;
        const dy = ev.clientY - startY;
        const maxTop = track.clientHeight - thumbHeightVal;
        const newTop = Math.max(0, Math.min(maxTop, startTop + dy));
        const maxScroll = body.scrollHeight - body.clientHeight;
        body.scrollTop = maxScroll > 0 ? Math.round((newTop / Math.max(1, maxTop)) * maxScroll) : 0;
        setThumbTop(newTop);
      };
      const onUp = () => {
        dragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        onUpdate();
      };
      try { thumb.addEventListener('pointerdown', onDown as any); } catch {}
      try { thumb.addEventListener('mousedown', onDown as any); } catch {}
      return () => {
        try { thumb.removeEventListener('pointerdown', onDown as any); } catch {}
        try { thumb.removeEventListener('mousedown', onDown as any); } catch {}
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
    }, [thumbTopVal, thumbHeightVal]);
  };

  makeDragHandler(leftThumbRef, leftTrackRef, leftBodyRef, leftThumbTop, leftThumbHeight, setLeftThumbTop, updateLeft);
  makeDragHandler(rightThumbRef, rightTrackRef, rightBodyRef, rightThumbTop, rightThumbHeight, setRightThumbTop, updateRight);
  makeDragHandler(profilesThumbRef, profilesTrackRef, profilesBodyRef, profilesThumbTop, profilesThumbHeight, setProfilesThumbTop, updateProfiles);
  makeDragHandler(logThumbRef, logTrackRef, logBodyRef, logThumbTop, logThumbHeight, setLogThumbTop, updateLog);

  const { profiles, recommendations } = useMemo(() => parseAdvisorData(advisorData), [advisorData]);
  const decisions = useMemo(() => parseDecisionLog(decisionLogData), [decisionLogData]);
  const stats = useMemo(() => parseLearningStats(learningStatsData), [learningStatsData]);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => b.sampleCount - a.sampleCount),
    [profiles]
  );

  useLayoutEffect(() => {
    if (activeTab === 'overview') { updateLeft(); updateRight(); }
    else if (activeTab === 'profiles') updateProfiles();
    else if (activeTab === 'log') updateLog();
  }, [activeTab, profiles.length, decisions.length, recommendations.length, sortedProfiles.length]);

  useEffect(() => {
    const onResize = () => { updateLeft(); updateRight(); updateProfiles(); updateLog(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateLeft, updateRight, updateProfiles, updateLog]);

  // Limit rendered profiles to avoid heavy renders when there are many (kept for potential future use)
  const handleReset = () => {
    if (confirmReset) {
      onResetLearning();
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
    }
  };

  // ProfileRow component is defined at module scope for stable identity

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
      </div>

      {/* Content area */}
      <div className="advisor-content">

        {/* ———— OVERVIEW TAB ———— */}
        <div className="advisor-tab-pane" style={{ display: activeTab === 'overview' ? 'flex' : 'none', flexDirection: 'column' }}>
          {/* Stats boxes */}
          <div className="advisor-stats-grid advisor-stats-grid-wide">
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

          {/* Two-column layout */}
          <div className="advisor-overview-columns">
            {/* Left — Recommendations */}
            <div className="advisor-overview-col">
              <div className="advisor-section-title">Recommendations</div>
              <div className="advisor-col-content-wrap" style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                {recommendations.length === 0 ? (
                  <div className="advisor-empty">
                    {learningEnabled
                      ? 'Learning is active. Recommendations will appear after enough data is collected.'
                      : 'Enable adaptive learning to start collecting city response data.'}
                  </div>
                ) : (
                  <>
                    <div ref={leftBodyRef} className="advisor-overview-scroll" onScroll={updateLeft}>
                      <div className="advisor-rec-list">
                        {recommendations.map((rec) => {
                          const recIcon = getResourceIconSrc(rec.key);
                          const recTypeIcon = getResourceTypeIcon(rec.key);
                          return (
                            <div key={rec.key} className="advisor-rec-row">
                              <span className="advisor-rec-dir" style={{ color: getDirectionColor(rec.direction) }}>
                                {getDirectionSymbol(rec.direction)}
                              </span>
                              {recIcon && <img src={recIcon} className="advisor-resource-icon" alt="" />}
                              <span className="advisor-rec-name">{getResourceLabel(rec.key)}</span>
                              <span className="advisor-rec-rate">{`${rec.currentRate}\u00a0%`}</span>
                              <span className="advisor-rec-conf" style={{ color: getConfidenceColor(rec.confidence) }}>
                                {`${(rec.confidence * 100).toFixed(0)}\u00a0%`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div ref={leftTrackRef} className="advisor-scrollbar-track" aria-hidden>
                      <div ref={leftThumbRef} className="advisor-scrollbar-thumb" style={{ top: `${leftThumbTop}px`, height: `${leftThumbHeight}px` }} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right — Recent Decisions */}
            <div className="advisor-overview-col">
              <div className="advisor-section-title">Recent Decisions ({decisions.length})</div>
              <div className="advisor-col-content-wrap" style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                {decisions.length === 0 ? (
                  <div className="advisor-empty">No decisions logged yet.</div>
                ) : (
                  <>
                    <div ref={rightBodyRef} className="advisor-overview-scroll" onScroll={updateRight}>
                      <div className="advisor-decision-list">
                        {[...decisions].reverse().map((d, i) => {
                          const decisionIcon = getResourceIconSrc(d.key);
                          return (
                            <div key={i} className="advisor-decision-row">
                              {decisionIcon && <img src={decisionIcon} className="advisor-resource-icon" alt="" />}
                              <span className="advisor-decision-resource">{getResourceLabel(d.key)}</span>
                              <span className="advisor-decision-change">
                                {`${d.oldRate}\u00a0%`} {'→'} {`${d.newRate}\u00a0%`}
                              </span>
                              <span className="advisor-decision-outcome" style={{ color: getOutcomeColor(d.outcomeScore) }}>
                                {d.outcomeScore > 0 ? '+' : ''}{d.outcomeScore.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div ref={rightTrackRef} className="advisor-scrollbar-track" aria-hidden>
                      <div ref={rightThumbRef} className="advisor-scrollbar-thumb" style={{ top: `${rightThumbTop}px`, height: `${rightThumbHeight}px` }} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ———— PROFILES TAB ———— */}
        <div className="advisor-tab-pane" style={{ display: activeTab === 'profiles' ? undefined : 'none', position: 'relative' }}>
          {sortedProfiles.length === 0 && (
            <div className="advisor-empty">No learning profiles yet. Data will appear after tax adjustments are observed.</div>
          )}
          <div ref={profilesBodyRef} className="advisor-tab-scroll" onScroll={updateProfiles} style={{ paddingRight: '18rem' }}>
            <div className="advisor-profile-list">
              {sortedProfiles.map((p) => (
                <ProfileRow key={p.key} p={p} />
              ))}
            </div>
          </div>
          <div ref={profilesTrackRef} className="advisor-scrollbar-track" aria-hidden>
            <div ref={profilesThumbRef} className="advisor-scrollbar-thumb" style={{ top: `${profilesThumbTop}px`, height: `${profilesThumbHeight}px` }} />
          </div>
        </div>

        {/* ———— LOG TAB ———— */}
        <div className="advisor-tab-pane" style={{ display: activeTab === 'log' ? undefined : 'none', position: 'relative' }}>
          {decisions.length === 0 && (
            <div className="advisor-empty">No decisions logged yet.</div>
          )}
          <div ref={logBodyRef} className="advisor-tab-scroll" onScroll={updateLog} style={{ paddingRight: '18rem' }}>
            <div className="advisor-log-list">
              {[...decisions].reverse().map((d, i) => {
                const logTypeIcon = getResourceTypeIcon(d.key);
                const logIcon = getResourceIconSrc(d.key);
                return (
                  <div key={i} className="advisor-log-row">
                    <div className="advisor-log-header">
                      {logIcon && <img src={logIcon} className="advisor-log-icon" alt="" />}
                      <span className="advisor-log-resource">{getResourceLabel(d.key)}</span>
                      <span className="advisor-log-change">{`${d.oldRate}\u00a0%`} {'→'} {`${d.newRate}\u00a0%`}</span>
                      <span className="advisor-log-outcome" style={{ color: getOutcomeColor(d.outcomeScore) }}>
                        {d.outcomeScore > 0 ? '+' : ''}{d.outcomeScore.toFixed(2)}
                      </span>
                      <span className="advisor-log-conf" style={{ color: getConfidenceColor(d.confidence) }}>
                        {`${(d.confidence * 100).toFixed(0)}\u00a0%`}
                      </span>
                    </div>
                    {d.summary && <div className="advisor-log-summary">{d.summary}</div>}
                  </div>
                );
              })}
            </div>
          </div>
          <div ref={logTrackRef} className="advisor-scrollbar-track" aria-hidden>
            <div ref={logThumbRef} className="advisor-scrollbar-thumb" style={{ top: `${logThumbTop}px`, height: `${logThumbHeight}px` }} />
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdvisorPanel;
