import React from 'react';
import { trigger } from 'cs2/api';

interface DebugPanelProps {
  debugEnabled: boolean;
  showTips: boolean;
  lastAction: string;
  onToggleDebug: (enabled: boolean) => void;
  onToggleTips: (enabled: boolean) => void;
  onTogglePanel: () => void;
  signaturePrefabs?: string;
  signatureCompanies?: string;
  signatureCacheStatus?: string;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ debugEnabled, showTips, lastAction, onToggleDebug, onToggleTips, onTogglePanel, signaturePrefabs, signatureCompanies, signatureCacheStatus }) => {
  return (
    <div style={{ position: 'absolute', top: 110, right: 30, width: 280, background: 'rgba(16,20,28,0.96)', border: '1px solid rgba(255,255,255,0.2)', color: '#dce6f2', padding: 10, borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>TPM Debug</strong>
        <div>
          <button onClick={() => { try { trigger('taxProduction', 'refreshSignatureCache', '1'); } catch {} }} style={{ marginRight: 6 }}>Refresh Sig Cache</button>
          <button onClick={onTogglePanel}>✕</button>
        </div>
      </div>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <input type="checkbox" checked={debugEnabled} onChange={(e) => onToggleDebug(e.target.checked)} /> Enable debug logs
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <input type="checkbox" checked={showTips} onChange={(e) => onToggleTips(e.target.checked)} /> Show in-window tips
      </label>
      <div style={{ fontSize: 12, opacity: 0.8 }}>Last action: {lastAction}</div>
      {debugEnabled && (
        <div style={{ marginTop: 8, fontSize: 11 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Signature Prefabs</div>
          <div style={{ maxHeight: 80, overflow: 'auto', fontSize: 11, background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 4, marginBottom: 6 }}>{signaturePrefabs || '—'}</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Signature Companies (keys)</div>
          <div style={{ maxHeight: 80, overflow: 'auto', fontSize: 11, background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 4, marginBottom: 6 }}>{signatureCompanies || '—'}</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Signature Cache Status</div>
          <div style={{ maxHeight: 40, overflow: 'auto', fontSize: 11, background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 4 }}>{signatureCacheStatus || '—'}</div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
