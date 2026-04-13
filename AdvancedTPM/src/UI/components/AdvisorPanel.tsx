import React, { useMemo, useState, useRef, useCallback } from 'react';
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
        {activeTab === 'overview' && (
          <div className="advisor-overview">
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
                  {(stats.avgConfidence * 100).toFixed(0)}%
                </div>
                <div className="advisor-stat-label">Avg Confidence</div>
              </div>
              <div className="advisor-stat">
                <div className="advisor-stat-value">{stats.pendingEvents}</div>
                <div className="advisor-stat-label">Pending</div>
              </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="advisor-section">
                <div className="advisor-section-title">Recommendations</div>
                <div className="advisor-rec-list">
                  {recommendations.map((rec) => (
                    <div key={rec.key} className="advisor-rec-row">
                      <span className="advisor-rec-dir" style={{ color: getDirectionColor(rec.direction) }}>
                        {getDirectionSymbol(rec.direction)}
                      </span>
                      <span className="advisor-rec-name">{getResourceLabel(rec.key)}</span>
                      <span className="advisor-rec-rate">{rec.currentRate}%</span>
                      <span className="advisor-rec-conf" style={{ color: getConfidenceColor(rec.confidence) }}>
                        {(rec.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="advisor-rec-reason">{rec.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recommendations.length === 0 && stats.totalSamples > 0 && (
              <div className="advisor-empty">
                Analyzing city responses... Recommendations will appear after enough data is collected.
              </div>
            )}

            {stats.totalSamples === 0 && (
              <div className="advisor-empty">
                {learningEnabled
                  ? 'Learning is active. The advisor will begin collecting data when auto-tax makes adjustments.'
                  : 'Enable adaptive learning to start collecting city response data.'}
              </div>
            )}

            {/* Recent decisions */}
            {decisions.length > 0 && (
              <div className="advisor-section">
                <div className="advisor-section-title">Recent Decisions</div>
                <div className="advisor-decision-list">
                  {decisions.slice(-5).reverse().map((d, i) => (
                    <div key={i} className="advisor-decision-row">
                      <span className="advisor-decision-resource">{getResourceLabel(d.key)}</span>
                      <span className="advisor-decision-change">
                        {d.oldRate}% {'\u2192'} {d.newRate}%
                      </span>
                      <span className="advisor-decision-outcome" style={{ color: getOutcomeColor(d.outcomeScore) }}>
                        {d.outcomeScore > 0 ? '+' : ''}{d.outcomeScore.toFixed(2)}
                      </span>
                      <span className="advisor-decision-summary">{d.summary}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="advisor-profiles">
            {sortedProfiles.length === 0 && (
              <div className="advisor-empty">No learning profiles yet. Data will appear after tax adjustments are observed.</div>
            )}
            <div className="advisor-profile-list">
              {sortedProfiles.map((p) => (
                <div key={p.key} className="advisor-profile-row">
                  <div className="advisor-profile-name">{getResourceLabel(p.key)}</div>
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
                        {(p.confidence * 100).toFixed(0)}% conf
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
              ))}
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div className="advisor-log">
            {decisions.length === 0 && (
              <div className="advisor-empty">No decisions logged yet.</div>
            )}
            <div className="advisor-log-list">
              {[...decisions].reverse().map((d, i) => (
                <div key={i} className="advisor-log-row">
                  <div className="advisor-log-header">
                    <span className="advisor-log-resource">{getResourceLabel(d.key)}</span>
                    <span className="advisor-log-change">{d.oldRate}% {'\u2192'} {d.newRate}%</span>
                    <span className="advisor-log-outcome" style={{ color: getOutcomeColor(d.outcomeScore) }}>
                      {d.outcomeScore > 0 ? '+' : ''}{d.outcomeScore.toFixed(2)}
                    </span>
                    <span className="advisor-log-conf" style={{ color: getConfidenceColor(d.confidence) }}>
                      {(d.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {d.summary && <div className="advisor-log-summary">{d.summary}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvisorPanel;
