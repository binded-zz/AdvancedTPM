import React, { useEffect, useRef, useState } from 'react';
import { getSafeColor } from '../../mods/apiSafe';
import { startGlobalDrag, stopGlobalDrag } from './dragHelper';

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

const safeNum = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);

const TPMWindowShell: React.FC<TPMWindowShellProps> = ({ x, y, width, height, collapsed = false, collapsedHeight = 74, onSaveRect, children }) => {
  const [rect, setRect] = useState({ x: safeNum(x, 140), y: safeNum(y, 150), width: safeNum(width, 520), height: safeNum(height, 420) });
  const [activeMode, setActiveMode] = useState<'none' | 'drag' | 'resize-right' | 'resize-left'>('none');
  
  // DOM Ref for 0ms latency dragging
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRectRef = useRef({ ...rect });

  const interactRef = useRef({ mode: 'none', startX: 0, startY: 0, ox: 0, oy: 0, ow: 0, oh: 0 });
  const onSaveRectRef = useRef(onSaveRect);

  useEffect(() => { onSaveRectRef.current = onSaveRect; }, [onSaveRect]);
  
  useEffect(() => {
    const newRect = { x: safeNum(x, 140), y: safeNum(y, 150), width: safeNum(width, 520), height: safeNum(height, 420) };
    setRect(newRect);
    draggingRectRef.current = newRect;
  }, [x, y, width, height]);

  const visibleHeight = safeNum(collapsed ? collapsedHeight : rect.height, 420);

  const onMove = (e: MouseEvent) => {
    const { mode, startX, startY, ox, oy, ow, oh } = interactRef.current;
    if (mode === 'none') return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newX = ox; let newY = oy; let newW = ow; let newH = oh;

    if (mode === 'drag') {
      newX = Math.max(20, ox + dx);
      newY = Math.max(20, oy + dy);
    } else if (mode === 'resize-right') {
      newW = Math.max(360, ow + dx);
      newH = Math.max(240, oh + dy);
    } else if (mode === 'resize-left') {
      const maxDelta = ow - 360;
      const clampedDx = Math.max(-10000, Math.min(maxDelta, dx));
      newX = Math.max(20, ox + clampedDx);
      newW = Math.max(360, ow - clampedDx);
      newH = Math.max(240, oh + dy);
    }

    // UPDATE DOM DIRECTLY - DO NOT CALL setRect HERE
    draggingRectRef.current = { x: newX, y: newY, width: newW, height: newH };

    if (containerRef.current) {
      containerRef.current.style.left = `${newX}px`;
      containerRef.current.style.top = `${newY}px`;
      if (mode.startsWith('resize')) {
        containerRef.current.style.width = `${newW}px`;
        if (!collapsed) containerRef.current.style.height = `${newH}px`;
      }
    }
  };

  const debounceTimerRef = useRef<number | null>(null);

  const stopInteraction = () => {
    if (interactRef.current.mode !== 'none') {
      const finalRect = draggingRectRef.current;
      setRect(finalRect); // Trigger React render ONLY when mouse is released
      
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        onSaveRectRef.current(finalRect.x, finalRect.y, finalRect.width, finalRect.height);
      }, 500);
    }
    interactRef.current.mode = 'none';
    setActiveMode('none');
  };

  useEffect(() => {
    if (activeMode === 'none') {
      stopGlobalDrag();
      return;
    }
    startGlobalDrag();
    const onWindowMove = (e: MouseEvent) => onMove(e);
    const onWindowUp = () => stopInteraction();
    
    document.addEventListener('mousemove', onWindowMove);
    document.addEventListener('mouseup', onWindowUp);
    
    return () => {
      stopGlobalDrag();
      document.removeEventListener('mousemove', onWindowMove);
      document.removeEventListener('mouseup', onWindowUp);
    };
  }, [activeMode]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', left: safeNum(rect.x, 140), top: safeNum(rect.y, 150), width: safeNum(rect.width, 520), height: visibleHeight, display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}
      onMouseDown={(e) => {
        e.stopPropagation();
        const target = e.target as HTMLElement;
        if (target.closest('.tpm-drag-handle') && !target.closest('button') && !target.closest('input')) {
          e.preventDefault();
          interactRef.current = { mode: 'drag', startX: e.clientX, startY: e.clientY, ox: draggingRectRef.current.x, oy: draggingRectRef.current.y, ow: draggingRectRef.current.width, oh: draggingRectRef.current.height };
          setActiveMode('drag');
        }
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="tpm-window-shell" style={{ flexGrow: 1, width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}>
        {children}
      </div>
      <div
        style={{ position: 'absolute', right: 0, bottom: 0, width: 18, height: 18, cursor: 'nwse-resize', backgroundColor: getSafeColor('rgba(255,255,255,0.35)'), borderTopLeftRadius: 3 }}
        onMouseDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          interactRef.current = { mode: 'resize-right', startX: e.clientX, startY: e.clientY, ox: draggingRectRef.current.x, oy: draggingRectRef.current.y, ow: draggingRectRef.current.width, oh: draggingRectRef.current.height };
          setActiveMode('resize-right');
        }}
      />
      <div
        style={{ position: 'absolute', left: 0, bottom: 0, width: 18, height: 18, cursor: 'nesw-resize', backgroundColor: getSafeColor('rgba(255,255,255,0.35)'), borderTopRightRadius: 3 }}
        onMouseDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          interactRef.current = { mode: 'resize-left', startX: e.clientX, startY: e.clientY, ox: draggingRectRef.current.x, oy: draggingRectRef.current.y, ow: draggingRectRef.current.width, oh: draggingRectRef.current.height };
          setActiveMode('resize-left');
        }}
      />
    </div>
  );
};

export default TPMWindowShell;
