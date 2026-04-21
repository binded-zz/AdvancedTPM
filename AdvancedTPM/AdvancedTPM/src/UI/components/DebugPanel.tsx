import React from 'react';
import { trigger } from 'cs2/api';

interface DebugPanelProps {
  debugEnabled: boolean;
  showTips: boolean;
  lastAction: string;
  debugFileContents?: string;
  onToggleDebug: (enabled: boolean) => void;
  onToggleTips: (enabled: boolean) => void;
  onTogglePanel: () => void;
  signaturePrefabs?: string;
  signatureCompanies?: string;
  signatureCacheStatus?: string;
  residentialData?: string;
  servicesData?: string;
  debugX?: number;
  debugY?: number;
  debugW?: number;
  debugH?: number;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ debugEnabled, showTips, lastAction, onToggleDebug, onToggleTips, onTogglePanel, signaturePrefabs, signatureCompanies, signatureCacheStatus }) => {
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 110,
    right: 30,
    width: 320,
    background: 'rgba(6,10,18,0.88)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#ffffff',
    padding: 12,
    borderRadius: 6,
    boxShadow: '0 6px 18px rgba(0,0,0,0.6)',
    fontFamily: 'inherit',
    zIndex: 9999,
  };

  const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 };
  const buttonPrimary: React.CSSProperties = { marginRight: 8, background: '#2563eb', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' };
  const buttonClose: React.CSSProperties = { background: '#374151', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 8, color: '#e6eef8', fontSize: 13 };
  const lastActionStyle: React.CSSProperties = { fontSize: 12, color: '#cfe3ff', opacity: 0.95 };
  const boxStyle: React.CSSProperties = { maxHeight: 80, overflow: 'auto', fontSize: 12, background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 4, marginBottom: 6, border: '1px solid rgba(255,255,255,0.03)' };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <strong style={{ fontSize: 14 }}>TPM Debug</strong>
        <div>
          <button onClick={() => { try { trigger('taxProduction', 'refreshSignatureCache', '1'); } catch {} }} style={buttonPrimary}>Refresh Sig Cache</button>
          <button onClick={onTogglePanel} style={buttonClose}>✕</button>
        </div>
      </div>
      <label style={labelStyle}>
        <input type="checkbox" checked={debugEnabled} onChange={(e) => onToggleDebug(e.target.checked)} /> <span style={{ marginLeft: 8 }}>Enable debug logs</span>
      </label>
      <label style={labelStyle}>
        <input type="checkbox" checked={showTips} onChange={(e) => onToggleTips(e.target.checked)} /> <span style={{ marginLeft: 8 }}>Show in-window tips</span>
      </label>
      <div style={lastActionStyle}>Last action: {lastAction}</div>
      {debugEnabled && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#e8f1ff' }}>Signature Prefabs</div>
          <div style={boxStyle}>{signaturePrefabs || '—'}</div>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#e8f1ff' }}>Signature Companies (keys)</div>
          <div style={boxStyle}>{signatureCompanies || '—'}</div>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#e8f1ff' }}>Signature Cache Status</div>
          <div style={{ ...boxStyle, maxHeight: 40 }}>{signatureCacheStatus || '—'}</div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
