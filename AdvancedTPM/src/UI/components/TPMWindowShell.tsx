import React, { useEffect, useRef, useState } from 'react';

interface TPMWindowShellProps {
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed?: boolean;
  collapsedHeight?: number;
  onSaveRect: (x: number, y: number, width: number, height: number) => void;
  children: React.ReactNode;
}

// Guard against NaN/undefined reaching CoHTML style properties (triggers "invalid value" warnings)
const safeNum = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);

const TPMWindowShell: React.FC<TPMWindowShellProps> = ({ x, y, width, height, collapsed = false, collapsedHeight = 74, onSaveRect, children }) => {
  const [rect, setRect] = useState({ x: safeNum(x, 140), y: safeNum(y, 150), width: safeNum(width, 520), height: safeNum(height, 420) });
  const [activeMode, setActiveMode] = useState<'none' | 'drag' | 'resize'>('none');
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; ox: number; oy: number }>({ active: false, startX: 0, startY: 0, ox: x, oy: y });
  const resizeRef = useRef<{ active: boolean; startX: number; startY: number; ow: number; oh: number }>({ active: false, startX: 0, startY: 0, ow: width, oh: height });

  useEffect(() => {
    setRect({ x: safeNum(x, 140), y: safeNum(y, 150), width: safeNum(width, 520), height: safeNum(height, 420) });
  }, [x, y, width, height]);

  const visibleHeight = safeNum(collapsed ? collapsedHeight : rect.height, 420);

  const onMove = (clientX: number, clientY: number) => {
    if (dragRef.current.active) {
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;
      setRect((r) => ({ ...r, x: Math.max(20, dragRef.current.ox + dx), y: Math.max(20, dragRef.current.oy + dy) }));
    }
    if (resizeRef.current.active) {
      const dx = clientX - resizeRef.current.startX;
      const dy = clientY - resizeRef.current.startY;
      setRect((r) => ({ ...r, width: Math.max(360, resizeRef.current.ow + dx), height: Math.max(240, resizeRef.current.oh + dy) }));
    }
  };

  const stopInteraction = () => {
    if (dragRef.current.active || resizeRef.current.active) {
      onSaveRect(rect.x, rect.y, rect.width, rect.height);
    }
    dragRef.current.active = false;
    resizeRef.current.active = false;
    setActiveMode('none');
  };

  useEffect(() => {
    const onWindowMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onWindowUp = () => stopInteraction();
    document.addEventListener('mousemove', onWindowMove);
    document.addEventListener('mouseup', onWindowUp);
    return () => {
      document.removeEventListener('mousemove', onWindowMove);
      document.removeEventListener('mouseup', onWindowUp);
    };
  }, [rect.x, rect.y, rect.width, rect.height]);

  return (
    <>
    {activeMode !== 'none' && (
      <div
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'auto', zIndex: 100000, cursor: activeMode === 'drag' ? 'move' : 'nwse-resize' }}
        onMouseMove={(e) => onMove(e.clientX, e.clientY)}
        onMouseUp={() => stopInteraction()}
      />
    )}
    <div
      style={{ position: 'absolute', left: safeNum(rect.x, 140), top: safeNum(rect.y, 150), width: safeNum(rect.width, 520), height: visibleHeight, pointerEvents: 'auto', display: 'flex', flexDirection: 'column' }}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('[data-interactive]') || target.closest('.ats-panel'))) {
          return;
        }
        if (e.clientY <= rect.y + 42) {
          dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, ox: rect.x, oy: rect.y };
          setActiveMode('drag');
        }
      }}
    >
      <div
        style={{ height: 24, flexShrink: 0, cursor: 'move', opacity: 1, background: 'linear-gradient(180deg, rgba(80,125,177,0.88) 0%, rgba(47,83,127,0.92) 100%)', borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottom: '1px solid rgba(160,200,240,0.55)', display: 'flex', alignItems: 'center', paddingLeft: 10, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: '#e9f3ff', textShadow: '0 1px 1px rgba(0,0,0,0.45)' }}
        onMouseDown={(e) => {
          dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, ox: rect.x, oy: rect.y };
          setActiveMode('drag');
        }}
      >DRAG WINDOW</div>
      <div style={{ position: 'relative', width: '100%', flex: 1, overflow: 'visible' }}>{children}</div>
      <div
        style={{ position: 'absolute', right: 0, bottom: 0, width: 18, height: 18, cursor: 'nwse-resize', background: 'rgba(255,255,255,0.35)', borderTopLeftRadius: 3 }}
        onMouseDown={(e) => {
          resizeRef.current = { active: true, startX: e.clientX, startY: e.clientY, ow: rect.width, oh: rect.height };
          setActiveMode('resize');
        }}
      />
    </div>
    </>
  );
};

export default TPMWindowShell;
