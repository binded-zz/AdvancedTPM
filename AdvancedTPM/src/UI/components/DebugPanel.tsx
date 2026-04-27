import React, { useRef, useState } from 'react';
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

const DebugPanel: React.FC<DebugPanelProps> = ({
  debugEnabled, showTips, lastAction,
  onToggleDebug, onToggleTips, onTogglePanel,
  signaturePrefabs, signatureCompanies, signatureCacheStatus,
  residentialData, servicesData,
}) => {
  const [pos, setPos] = useState({ x: 30, y: 110 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; ox: number; oy: number }>({ active: false, startX: 0, startY: 0, ox: 30, oy: 110 });

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current.active) return;
      setPos({ x: Math.max(4, dragRef.current.ox + (ev.clientX - dragRef.current.startX)), y: Math.max(4, dragRef.current.oy + (ev.clientY - dragRef.current.startY)) });
    };
    const onUp = () => { dragRef.current.active = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  };

  const panel: React.CSSProperties = {
    position: 'fixed', left: pos.x, top: pos.y, width: 340,
    background: '#060a12', border: '1px solid rgba(255,255,255,0.12)',
    color: '#ffffff', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.7)',
    fontFamily: 'inherit', zIndex: 9999, userSelect: 'none',
  };
  const header: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
    borderBottom: '1px solid rgba(255,255,255,0.08)', cursor: 'move', borderRadius: '6px 6px 0 0',
  };
  const content: React.CSSProperties = { padding: 12 };
  const btnRow: React.CSSProperties = { display: 'flex', marginBottom: 8, flexWrap: 'wrap' };
  const btnRowItem: React.CSSProperties = { marginRight: 8, marginBottom: 6 };
  const btn = (active?: boolean): React.CSSProperties => ({
    flex: 1, padding: '6px 10px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12,
    background: active ? '#2563eb' : 'rgba(255,255,255,0.1)', color: '#fff',
  });
  const btnDanger: React.CSSProperties = { padding: '6px 10px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, background: '#374151', color: '#fff' };
  const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 8 };
  const box: React.CSSProperties = { height: 70, overflowY: 'auto', fontSize: 11, background: 'rgba(255,255,255,0.04)', padding: 6, borderRadius: 4, marginBottom: 6, border: '1px solid rgba(255,255,255,0.06)', wordBreak: 'break-all' };
  const lastActionStyle: React.CSSProperties = { fontSize: 11, color: '#cfe3ff', marginBottom: 8, opacity: 0.9 };

  return (
    <div style={panel}>
      {/* Header — drag handle + close */}
      <div style={header} onMouseDown={onHeaderMouseDown}>
        <strong style={{ fontSize: 13 }}>TPM Debug Panel</strong>
        <button
          style={btnDanger}
          title="Close debug panel (reopen via main window \u2192 Debug button)"
          onClick={(e) => { e.stopPropagation(); onTogglePanel(); }}
          onMouseDown={(e) => e.stopPropagation()}
        >✕ Close</button>
      </div>

      <div style={content}>
        {/* Status */}
        <div style={lastActionStyle}>Last action: {lastAction || '—'}</div>

        {/* Toggle buttons */}
        <div style={btnRow}>
          <button style={btn(debugEnabled)} onClick={() => onToggleDebug(!debugEnabled)} title="Toggle verbose logging to Player.log">
            {debugEnabled ? '🔵 Debug Logs ON' : '⚪ Debug Logs OFF'}
          </button>
          <button style={btn(showTips)} onClick={() => onToggleTips(!showTips)} title="Show/hide inline tips in the main window">
            {showTips ? '💡 Tips ON' : '💡 Tips OFF'}
          </button>
        </div>

        {/* Action buttons */}
        <div style={btnRow}>
          <button style={btn()} onClick={() => { try { trigger('taxProduction', 'refreshSignatureCache', '1'); } catch {} }}>
            🔄 Refresh Sig Cache
          </button>
          <button style={btn()} onClick={() => { try { trigger('taxProduction', 'refreshCompanyBrowserData', '1'); } catch {} }}>
            🔄 Refresh Companies
          </button>
        </div>

        {/* Signature data — only shown when debug logs enabled */}
        {debugEnabled && (
          <>
            <div style={sectionTitle}>Signature Prefabs</div>
            <div style={box}>{signaturePrefabs || '—'}</div>

            <div style={sectionTitle}>Signature Companies (keys)</div>
            <div style={box}>{signatureCompanies || '—'}</div>

            <div style={sectionTitle}>Cache Status</div>
            <div style={{ ...box, height: 36 }}>{signatureCacheStatus || '—'}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default DebugPanel;
