import React, { useMemo, useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { Scrollable } from 'cs2/ui';
import { DetailRow, ProgressBar, StatCard } from './common';
import './AdvisorPanel.css';
import { getSafeColor } from '../../mods/apiSafe';

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

/** Parse advisor data: JSON.parse or fallback to legacy format */
const parseAdvisorData = (data: string): { profiles: LearningProfile[]; recommendations: AdvisorRec[] } => {
  const result = { profiles: [] as LearningProfile[], recommendations: [] as AdvisorRec[] };
  if (!data) return result;

  try {
    const raw = JSON.parse(data);
    if (raw && Array.isArray(raw.profiles)) {
      result.profiles = raw.profiles.map((p: any) => ({
        key: p.key || '',
        sensitivity: typeof p.sensitivity === 'number' ? p.sensitivity : 0,
        incomeResponse: typeof p.incomeResponse === 'number' ? p.incomeResponse : 0,
        companyResponse: typeof p.companyResponse === 'number' ? p.companyResponse : 0,
        confidence: typeof p.confidence === 'number' ? p.confidence : 0,
        sampleCount: typeof p.sampleCount === 'number' ? p.sampleCount : 0,
        avgOutcome: typeof p.avgOutcome === 'number' ? p.avgOutcome : 0,
        productionResponse: typeof p.productionResponse === 'number' ? p.productionResponse : 0,
        revenueEfficiency: typeof p.revenueEfficiency === 'number' ? p.revenueEfficiency : 0,
        volatility: typeof p.volatility === 'number' ? p.volatility : 0,
      }));
    }
    if (raw && Array.isArray(raw.recommendations)) {
      result.recommendations = raw.recommendations.map((r: any) => ({
        key: r.key || '',
        direction: typeof r.direction === 'number' ? r.direction : 0,
        currentRate: typeof r.currentRate === 'number' ? r.currentRate : 0,
        confidence: typeof r.confidence === 'number' ? r.confidence : 0,
        reason: r.reason || '',
      }));
    }
    return result;
  } catch (e) {
    const parts = data.split('|');
    if (parts.length < 4) return result;

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
  }
};

/** Parse decision log: JSON.parse or fallback to legacy format */
const parseDecisionLog = (data: string): DecisionEntry[] => {
  if (!data) return [];
  try {
    const raw = JSON.parse(data);
    if (Array.isArray(raw)) {
      return raw.map((d: any) => ({
        key: d.key || '',
        oldRate: typeof d.oldRate === 'number' ? d.oldRate : 0,
        newRate: typeof d.newRate === 'number' ? d.newRate : 0,
        outcomeScore: typeof d.outcomeScore === 'number' ? d.outcomeScore : 0,
        confidence: typeof d.confidence === 'number' ? d.confidence : 0,
        summary: d.summary || '',
      })).filter((d) => d.key);
    }
  } catch (e) {
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
  }
  return [];
};

/** Parse learning stats: JSON.parse or fallback to legacy format */
const parseLearningStats = (data: string): LearningStats => {
  const defaults: LearningStats = { pendingEvents: 0, snapshots: 0, totalSamples: 0, avgConfidence: 0, aggressiveness: 3 };
  if (!data) return defaults;
  try {
    const raw = JSON.parse(data);
    if (raw) {
      return {
        pendingEvents: typeof raw.pendingEvents === 'number' ? raw.pendingEvents : 0,
        snapshots: typeof raw.snapshots === 'number' ? raw.snapshots : 0,
        totalSamples: typeof raw.totalSamples === 'number' ? raw.totalSamples : 0,
        avgConfidence: typeof raw.avgConfidence === 'number' ? raw.avgConfidence : 0,
        aggressiveness: typeof raw.aggressiveness === 'number' ? raw.aggressiveness : 3,
      };
    }
  } catch (e) {
    const parts = data.split('|');
    return {
      pendingEvents: Number(parts[0]) || 0,
      snapshots: Number(parts[1]) || 0,
      totalSamples: Number(parts[2]) || 0,
      avgConfidence: Number(parts[3]) || 0,
      aggressiveness: Number(parts[4]) || 3,
    };
  }
  return defaults;
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
            <ProgressBar
              value={p.sensitivity}
              scale={100}
              className="advisor-profile-bar-track"
              fillClassName="advisor-profile-bar-fill"
              isBidirectional={true}
            />
            <span className="advisor-profile-bar-value">{p.sensitivity.toFixed(2)}</span>
          </div>
          <div className="advisor-profile-bar-group">
            <span className="advisor-profile-bar-label">Income</span>
            <ProgressBar
              value={p.incomeResponse}
              scale={200}
              className="advisor-profile-bar-track"
              fillClassName="advisor-profile-bar-fill"
              isBidirectional={true}
            />
            <span className="advisor-profile-bar-value">{p.incomeResponse.toFixed(2)}</span>
          </div>
        </div>
        <div className="advisor-profile-bars-row">
          <div className="advisor-profile-bar-group">
            <span className="advisor-profile-bar-label">Production</span>
            <ProgressBar
              value={p.productionResponse}
              scale={200}
              className="advisor-profile-bar-track"
              fillClassName="advisor-profile-bar-fill"
              isBidirectional={true}
            />
            <span className="advisor-profile-bar-value">{p.productionResponse.toFixed(2)}</span>
          </div>
          <div className="advisor-profile-bar-group">
            <span className="advisor-profile-bar-label">Rev/Co</span>
            <ProgressBar
              value={p.revenueEfficiency}
              scale={200}
              className="advisor-profile-bar-track"
              fillClassName="advisor-profile-bar-fill"
              isBidirectional={true}
            />
            <span className="advisor-profile-bar-value">{p.revenueEfficiency.toFixed(2)}</span>
          </div>
        </div>
        <div className="advisor-profile-meta">
          <span style={{ color: getSafeColor(getConfidenceColor(p.confidence)), marginRight: '10rem' }}>
            {`${(p.confidence * 100).toFixed(0)}\u00a0%`} conf
          </span>
          <span style={{ color: getSafeColor('rgba(255,255,255,0.25)'), marginRight: '10rem' }}>{"\u00B7"}</span>
          <span style={{ marginRight: '10rem' }}>{p.sampleCount} samples</span>
          <span style={{ color: getSafeColor('rgba(255,255,255,0.25)'), marginRight: '10rem' }}>{"\u00B7"}</span>
          <span style={{ color: getSafeColor(getOutcomeColor(p.avgOutcome)), marginRight: '10rem' }}>
            avg: {p.avgOutcome > 0 ? '+' : ''}{p.avgOutcome.toFixed(2)}
          </span>
          {p.volatility > 0.15 && (
            <>
              <span style={{ color: getSafeColor('rgba(255,255,255,0.25)'), marginRight: '10rem' }}>{"\u00B7"}</span>
              <span style={{ color: getSafeColor('#f0c040') }}>
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
  const [activeTab, setActiveTab] = useState<'overview' | 'profiles'>('overview');
  const [confirmReset, setConfirmReset] = useState(false);



  const { profiles, recommendations } = useMemo(() => parseAdvisorData(advisorData), [advisorData]);
  const decisions = useMemo(() => parseDecisionLog(decisionLogData), [decisionLogData]);
  const stats = useMemo(() => parseLearningStats(learningStatsData), [learningStatsData]);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => b.sampleCount - a.sampleCount),
    [profiles]
  );



  const handleReset = () => {
    if (confirmReset) {
      onResetLearning();
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
    }
  };

  if (!advisorData || !profiles) return null;

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
      </div>

      {/* Content area */}
      <div className="advisor-content">

        {/* ———— OVERVIEW TAB ———— */}
        <div className="advisor-tab-pane" style={{ display: activeTab === 'overview' ? 'flex' : 'none', flexDirection: 'column' }}>
          {/* Stats boxes */}
          <div className="advisor-stats-grid advisor-stats-grid-wide">
            <StatCard layout="stat" className="advisor-stat" title="Observations" value={stats.totalSamples} />
            <StatCard layout="stat" className="advisor-stat" title="Active Profiles" value={profiles.length} />
            <StatCard
              layout="stat"
              className="advisor-stat"
              title="Avg Confidence"
              value={`${(stats.avgConfidence * 100).toFixed(0)}\u00a0%`}
              valueStyle={{ color: getSafeColor(getConfidenceColor(stats.avgConfidence)) }}
            />
            <StatCard layout="stat" className="advisor-stat" title="Pending" value={stats.pendingEvents} />
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
                    <Scrollable vertical={true} className="advisor-overview-scroll" trackVisibility="scrollable">
                      <div className="advisor-rec-list">
                        {recommendations.map((rec) => {
                          const recIcon = getResourceIconSrc(rec.key);
                          return (
                            <div key={rec.key} className="advisor-rec-row">
                              <span className="advisor-rec-dir" style={{ color: getSafeColor(getDirectionColor(rec.direction)) }}>
                                {getDirectionSymbol(rec.direction)}
                              </span>
                              {recIcon && <img src={recIcon} className="advisor-resource-icon" alt="" />}
                              <span className="advisor-rec-name">{getResourceLabel(rec.key)}</span>
                              <span className="advisor-rec-rate">{`${rec.currentRate}\u00a0%`}</span>
                              <span className="advisor-rec-conf" style={{ color: getSafeColor(getConfidenceColor(rec.confidence)) }}>
                                {`${(rec.confidence * 100).toFixed(0)}\u00a0%`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </Scrollable>
                  </>
                )}
              </div>
            </div>

            {/* Right — Recent Decisions */}
            <div className="advisor-overview-col">
              <div className="advisor-section-title">Recent Decisions</div>
              <div className="advisor-col-content-wrap" style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                {decisions.length === 0 ? (
                  <div className="advisor-empty">No decisions logged yet.</div>
                ) : (
                  <>
                    <Scrollable vertical={true} className="advisor-overview-scroll" trackVisibility="scrollable">
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
                              <span className="advisor-decision-outcome" style={{ color: getSafeColor(getOutcomeColor(d.outcomeScore)) }}>
                                {d.outcomeScore > 0 ? '+' : ''}{d.outcomeScore.toFixed(2)}
                              </span>
                              <span className="advisor-decision-conf" style={{ color: getSafeColor(getConfidenceColor(d.confidence)) }}>
                                {`${(d.confidence * 100).toFixed(0)}\u00a0%`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </Scrollable>
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
          <Scrollable vertical={true} className="advisor-tab-scroll" style={{ paddingRight: '18rem' }} trackVisibility="scrollable">
            <div className="advisor-profile-list">
              {sortedProfiles.map((p) => (
                <ProfileRow key={p.key} p={p} />
              ))}
            </div>
          </Scrollable>
        </div>

      </div>
    </div>
  );
};

export default React.memo(AdvisorPanel);
