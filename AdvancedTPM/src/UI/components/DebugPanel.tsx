import React, { useEffect, useRef, useState } from 'react';
import { getSafeColor } from '../../mods/apiSafe';

interface DebugPanelProps {
  debugEnabled: boolean;
  showTips: boolean;
  lastAction: string;
  onToggleDebug: (enabled: boolean) => void;
  onToggleTips: (enabled: boolean) => void;
  onTogglePanel: () => void;
  debugFileContents?: string;
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

const DebugPanel: React.FC<DebugPanelProps> = ({ debugEnabled, showTips, lastAction, onToggleDebug, onToggleTips, onTogglePanel, debugX = 0, debugY = 110, debugW = 280 }) => {
  const [pos, setPos] = useState<{x:number;y:number}>(() => {
    try {
      const raw = localStorage.getItem('atpm.debug.pos');
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
      }
    } catch {}
    return { x: debugX || 0, y: debugY || 110 };
  });



  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const posRef = useRef(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    if (!isDragging) return;

    const mm = (e: MouseEvent) => {
      if (!drag.current.active) return;
      const nx = Math.max(0, drag.current.ox + (e.clientX - drag.current.sx));
      const ny = Math.max(0, drag.current.oy + (e.clientY - drag.current.sy));
      setPos({ x: nx, y: ny });
    };

    const mu = () => {
      if (!drag.current.active) return;
      drag.current.active = false;
      setIsDragging(false);
      try { localStorage.setItem('atpm.debug.pos', JSON.stringify(posRef.current)); } catch {}
    };

    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);

    return () => {
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
    };
  }, [isDragging]);

  return (
    <div style={{ position: 'absolute', top: pos.y, right: 'auto', left: pos.x, width: debugW || 280, backgroundColor: getSafeColor('rgba(16,20,28,0.98)'), borderWidth: 1, borderStyle: 'solid', borderColor: getSafeColor('rgba(255,255,255,0.2)'), color: getSafeColor('#dce6f2'), borderRadius: 6, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8rem', backgroundColor: getSafeColor('rgba(35,46,64,0.95)'), cursor: 'move' }}
        onMouseDown={(e) => {
          drag.current = { active: true, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
          setIsDragging(true);
        }}
      >
        <strong>TPM Debug</strong>
        <button onClick={onTogglePanel} style={{ backgroundColor: getSafeColor('transparent'), borderWidth: '1rem', borderStyle: 'solid', borderColor: getSafeColor('rgba(255,255,255,0.2)'), color: getSafeColor('#fff'), cursor: 'pointer' }}>X</button>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>Debug logs</span>
          <button
            onClick={() => onToggleDebug(!debugEnabled)}
            style={{ padding: '3rem 10rem', borderRadius: 3, borderWidth: '1rem', borderStyle: 'solid', borderColor: getSafeColor('rgba(255,255,255,0.2)'), cursor: 'pointer', backgroundColor: getSafeColor(debugEnabled ? 'rgba(139,219,70,0.2)' : 'rgba(224,80,80,0.2)'), color: getSafeColor('#fff') }}
          >
            {debugEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>In-window tips</span>
          <button
            onClick={() => onToggleTips(!showTips)}
            style={{ padding: '3rem 10rem', borderRadius: 3, borderWidth: '1rem', borderStyle: 'solid', borderColor: getSafeColor('rgba(255,255,255,0.2)'), cursor: 'pointer', backgroundColor: getSafeColor(showTips ? 'rgba(139,219,70,0.2)' : 'rgba(224,80,80,0.2)'), color: getSafeColor('#fff') }}
          >
            {showTips ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div style={{ fontSize: 12, opacity: 0.8 }}>Last action: {lastAction}</div>
      </div>
    </div>
  );
};

export default DebugPanel;
