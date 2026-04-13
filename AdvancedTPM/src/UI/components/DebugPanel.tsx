import React from 'react';

interface DebugPanelProps {
  debugEnabled: boolean;
  showTips: boolean;
  lastAction: string;
  onToggleDebug: (enabled: boolean) => void;
  onToggleTips: (enabled: boolean) => void;
  onTogglePanel: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ debugEnabled, showTips, lastAction, onToggleDebug, onToggleTips, onTogglePanel }) => {
  return (
    <div style={{ position: 'absolute', top: 110, right: 30, width: 280, background: 'rgba(16,20,28,0.96)', border: '1px solid rgba(255,255,255,0.2)', color: '#dce6f2', padding: 10, borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>TPM Debug</strong>
        <button onClick={onTogglePanel}>✕</button>
      </div>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <input type="checkbox" checked={debugEnabled} onChange={(e) => onToggleDebug(e.target.checked)} /> Enable debug logs
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <input type="checkbox" checked={showTips} onChange={(e) => onToggleTips(e.target.checked)} /> Show in-window tips
      </label>
      <div style={{ fontSize: 12, opacity: 0.8 }}>Last action: {lastAction}</div>
    </div>
  );
};

export default DebugPanel;
