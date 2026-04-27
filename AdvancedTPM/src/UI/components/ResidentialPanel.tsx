// React hooks are provided by the environment. Do not import to avoid duplicate type declarations.
import React from 'react';
import { trigger } from 'cs2/api';
import './ResidentialPanel.css';

interface ResidentialData {
  lowTotal: number;
  medTotal: number;
  highTotal: number;
  lowFree: number;
  medFree: number;
  highFree: number;
  lowOccupied: number;
  medOccupied: number;
  highOccupied: number;
  avgHappiness: number;
  unemploymentRate: number;
  homelessHouseholds: number;
  movedInHouseholds: number;
}

interface ResidentialBuilding {
  entityKey: string;
  address: string;
  density: string;
  level: number;
  occupied: number;
  capacity: number;
  theme: string;
  assetPack: string;
  isSignature: boolean;
}

const parseResidentialData = (payload: string): ResidentialData | null => {
  if (!payload) return null;
  try {
    const obj = JSON.parse(payload);
    return {
      lowTotal: Number(obj.lowTotal) || 0,
      medTotal: Number(obj.medTotal) || 0,
      highTotal: Number(obj.highTotal) || 0,
      lowFree: Number(obj.lowFree) || 0,
      medFree: Number(obj.medFree) || 0,
      highFree: Number(obj.highFree) || 0,
      lowOccupied: Number(obj.lowOccupied) || 0,
      medOccupied: Number(obj.medOccupied) || 0,
      highOccupied: Number(obj.highOccupied) || 0,
      avgHappiness: Number(obj.avgHappiness) || 0,
      unemploymentRate: Number(obj.unemploymentRate) || 0,
      homelessHouseholds: Number(obj.homelessHouseholds) || 0,
      movedInHouseholds: Number(obj.movedInHouseholds) || 0,
    };
  } catch {
    return null;
  }
};

// Parse per-building payload: "entityKey|address|density|level|occupied|capacity|theme|assetPack|isSignature;..."
const parseResidentialBuildings = (payload: string): ResidentialBuilding[] => {
  if (!payload) return [];
  return payload.split(';').map((chunk) => {
    const parts = chunk.split('|');
    if (parts.length < 6) return null;
    return {
      entityKey: parts[0] || '',
      address: parts[1] || '',
      density: parts[2] || 'Residential',
      level: Number(parts[3]) || 1,
      occupied: Number(parts[4]) || 0,
      capacity: Number(parts[5]) || 0,
      theme: parts[6] || 'Unknown',
      assetPack: parts[7] || 'Base Game',
      isSignature: parts[8] === '1',
    } as ResidentialBuilding;
  }).filter((x): x is ResidentialBuilding => x !== null);
};

const pct = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

const DENSITY_COLORS: Record<string, string> = {
  Low: '#8bdb46',
  Medium: '#50b8e9',
  High: '#e88c3a',
  Residential: 'rgba(255,255,255,0.6)',
};

type ResBldgSortField = 'address' | 'density' | 'level' | 'occupied' | 'capacity' | 'occupancy' | 'theme' | 'assetPack';
type SortDir = 'asc' | 'desc';

const ResidentialPanel: React.FC<{ residentialBrowserData?: string; residentialBuildingsData?: string }> = ({
  residentialBrowserData = '',
  residentialBuildingsData = '',
}) => {
  const data = React.useMemo(() => parseResidentialData(residentialBrowserData), [residentialBrowserData]);
  const buildings = React.useMemo(() => parseResidentialBuildings(residentialBuildingsData), [residentialBuildingsData]);

  const [densityFilter, setDensityFilter] = React.useState('All');
  const [themeFilter, setThemeFilter] = React.useState('All');
  const [assetPackFilter, setAssetPackFilter] = React.useState('All');
  const [levelFilter, setLevelFilter] = React.useState('All');
  const [showSignatureOnly, setShowSignatureOnly] = React.useState(false);
  const [minOccupancy, setMinOccupancy] = React.useState(0);
  const [minHappiness, setMinHappiness] = React.useState(0);
  const [sortField, setSortField] = React.useState<ResBldgSortField>('occupied');
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');
  const [searchText, setSearchText] = React.useState('');

  const bodyRef = React.useRef<HTMLDivElement | null>(null);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const thumbRef = React.useRef<HTMLDivElement | null>(null);
  const [thumbTop, setThumbTop] = React.useState(0);
  const [thumbHeight, setThumbHeight] = React.useState(48);

  const updateScrollbar = React.useCallback(() => {
    const body = bodyRef.current;
    const track = trackRef.current;
    if (!body || !track) return;
    const visible = body.clientHeight;
    const total = body.scrollHeight || 1;
    try {
      const bodyRect = body.getBoundingClientRect();
      const wrapper = body.parentElement || body;
      const wrapperRect = wrapper.getBoundingClientRect();
      const relTop = Math.max(0, bodyRect.top - wrapperRect.top);
      track.style.top = `${relTop}px`;
      track.style.height = `${body.clientHeight}px`;
    } catch {}
    if (visible >= total) { try { track.style.display = 'none'; } catch {} return; }
    try { track.style.display = 'block'; } catch {}
    const ratio = Math.max(0.03, Math.min(1, visible / total));
    const trackHeight = track.clientHeight;
    const thumbH = Math.max(16, Math.round(trackHeight * ratio));
    const maxScroll = total - visible;
    const top = maxScroll > 0 ? Math.round((body.scrollTop / maxScroll) * (trackHeight - thumbH)) : 0;
    setThumbHeight(thumbH);
    setThumbTop(top);
  }, []);

  React.useLayoutEffect(() => { updateScrollbar(); }, [buildings.length, densityFilter, themeFilter, assetPackFilter, levelFilter, showSignatureOnly, minOccupancy, minHappiness, searchText, sortField, sortDir, updateScrollbar]);

  React.useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const mo = new MutationObserver(() => updateScrollbar());
    mo.observe(body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [bodyRef.current, updateScrollbar]);

  React.useEffect(() => {
    let dragging = false;
    let startY = 0;
    let startTop = 0;
    const thumb = thumbRef.current;
    const track = trackRef.current;
    const body = bodyRef.current;
    if (!thumb || !track || !body) return;
    const onDown = (ev: any) => {
      try { if (ev.stopPropagation) ev.stopPropagation(); } catch {}
      dragging = true;
      startY = ev.clientY || 0;
      startTop = thumbTop;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      ev.preventDefault();
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragging) return;
      const dy = ev.clientY - startY;
      const maxTop = track.clientHeight - thumbHeight;
      const newTop = Math.max(0, Math.min(maxTop, startTop + dy));
      const maxScroll = body.scrollHeight - body.clientHeight;
      body.scrollTop = maxScroll > 0 ? Math.round((newTop / (track.clientHeight - thumbHeight)) * maxScroll) : 0;
      setThumbTop(newTop);
    };
    const onUp = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); updateScrollbar(); };
    try { thumb.addEventListener('pointerdown', onDown as any); } catch {}
    try { thumb.addEventListener('mousedown', onDown as any); } catch {}
    return () => { try { thumb.removeEventListener('mousedown', onDown as any); } catch {} };
  }, [thumbTop, thumbHeight, updateScrollbar]);

  const handleSort = (field: ResBldgSortField) => {
    if (sortField === field) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSortField(field); setSortDir(field === 'address' ? 'asc' : 'desc'); }
  };
  const sortIndicator = (field: ResBldgSortField) => sortField === field ? (sortDir === 'asc' ? ' ?' : ' ?') : '';

  // CSV Export function
  const exportToCSV = React.useCallback(() => {
    if (!filteredBuildings || filteredBuildings.length === 0) return;

    const headers = ['Address', 'Density', 'Level', 'Theme', 'Asset Pack', 'Occupied', 'Capacity', 'Occupancy %', 'Est. Happiness %', 'Signature'];
    const rows = filteredBuildings.map((b) => {
      const occPct = b.capacity > 0 ? Math.round((b.occupied / b.capacity) * 100) : (b.occupied > 0 ? 100 : 0);
      const base = data?.avgHappiness || 50;
      const occupancyAdj = (b.capacity > 0) ? (occPct - 75) * 0.3 : (b.occupied > 0 ? 5 : -10);
      const levelAdj = (b.level - 3) * 2;
      const happinessEst = Math.round(Math.max(0, Math.min(100, base + occupancyAdj + levelAdj)));

      return [
        `\"${(b.address || '').replace(/\"/g, '\"\"')}\"`,
        b.density || 'Unknown',
        b.level || 1,
        (b.theme || 'Unknown').replace(/\"/g, '\"\"'),
        (b.assetPack || 'Base Game').replace(/\"/g, '\"\"'),
        b.occupied || 0,
        b.capacity || 0,
        occPct,
        happinessEst,
        b.isSignature ? 'Yes' : 'No',
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `residential_buildings_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredBuildings, data]);

  // Extract unique values for filter dropdowns
  const uniqueThemes = React.useMemo(() => {
    if (!buildings || buildings.length === 0) return ['All'];
    const themes = new Set(buildings.map(b => b.theme || 'Unknown').filter(t => t));
    return ['All', ...Array.from(themes).sort()];
  }, [buildings]);

  const uniqueAssetPacks = React.useMemo(() => {
    if (!buildings || buildings.length === 0) return ['All'];
    const packs = new Set(buildings.map(b => b.assetPack || 'Base Game').filter(p => p));
    return ['All', ...Array.from(packs).sort()];
  }, [buildings]);

  const uniqueLevels = React.useMemo(() => {
    if (!buildings || buildings.length === 0) return ['All'];
    const levels = new Set(buildings.map(b => b.level).filter(l => typeof l === 'number'));
    return ['All', ...Array.from(levels).sort((a, b) => a - b)];
  }, [buildings]);

  const filteredBuildings = React.useMemo(() => {
    if (!buildings || !data) return [];
    let list = buildings;
    if (densityFilter !== 'All') list = list.filter((b) => b.density === densityFilter);
    if (themeFilter !== 'All') list = list.filter((b) => (b.theme || 'Unknown') === themeFilter);
    if (assetPackFilter !== 'All') list = list.filter((b) => (b.assetPack || 'Base Game') === assetPackFilter);
    if (levelFilter !== 'All') list = list.filter((b) => b.level === Number(levelFilter));
    if (showSignatureOnly) list = list.filter((b) => b.isSignature === true);

    // Occupancy filter
    if (minOccupancy > 0) {
      list = list.filter((b) => {
        const occPct = b.capacity > 0 ? Math.round((b.occupied / b.capacity) * 100) : (b.occupied > 0 ? 100 : 0);
        return occPct >= minOccupancy;
      });
    }

    // Happiness filter (using estimation algorithm)
    if (minHappiness > 0) {
      list = list.filter((b) => {
        const base = data.avgHappiness || 50;
        const occPct = b.capacity > 0 ? Math.round((b.occupied / b.capacity) * 100) : (b.occupied > 0 ? 100 : 0);
        const occupancyAdj = (b.capacity > 0) ? (occPct - 75) * 0.3 : (b.occupied > 0 ? 5 : -10);
        const levelAdj = (b.level - 3) * 2;
        const estimate = Math.round(Math.max(0, Math.min(100, base + occupancyAdj + levelAdj)));
        return estimate >= minHappiness;
      });
    }

    if (searchText) { const lower = searchText.toLowerCase(); list = list.filter((b) => (b.address || '').toLowerCase().includes(lower)); }
    return [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'address': return dir * a.address.localeCompare(b.address);
        case 'density': return dir * a.density.localeCompare(b.density);
        case 'level': return dir * (a.level - b.level);
        case 'occupied': return dir * (a.occupied - b.occupied);
        case 'capacity': return dir * (a.capacity - b.capacity);
        case 'theme': return dir * (a.theme || 'Unknown').localeCompare(b.theme || 'Unknown');
        case 'assetPack': return dir * (a.assetPack || 'Base Game').localeCompare(b.assetPack || 'Base Game');
        case 'occupancy': {
          const oA = a.capacity > 0 ? a.occupied / a.capacity : 0;
          const oB = b.capacity > 0 ? b.occupied / b.capacity : 0;
          return dir * (oA - oB);
        }
        default: return 0;
      }
    });
  }, [buildings, data, densityFilter, themeFilter, assetPackFilter, levelFilter, showSignatureOnly, minOccupancy, minHappiness, searchText, sortField, sortDir]);

  if (!data) {
    return <div className="res-panel-empty">Residential data will appear when the simulation is running.</div>;
  }

  const totalUnits = data.lowTotal + data.medTotal + data.highTotal;
  const totalOccupied = data.lowOccupied + data.medOccupied + data.highOccupied;
  const totalFree = data.lowFree + data.medFree + data.highFree;

  return (
    <div className="res-panel">
      {/* Summary cards — always visible, outside scroll */}
      <div className="res-panel-summary">
        <div className="res-summary-card">
          <div className="res-summary-label">Total Units</div>
          <div className="res-summary-value">{totalUnits.toLocaleString()}</div>
          <div className="res-summary-sub">Occupied: {totalOccupied.toLocaleString()} ({pct(totalOccupied, totalUnits)}%)</div>
          <div className="res-summary-sub">Free: {totalFree.toLocaleString()} ({pct(totalFree, totalUnits)}%)</div>
        </div>
        <div className="res-summary-card">
          <div className="res-summary-label">City Happiness</div>
          <div className="res-summary-value">{data.avgHappiness.toFixed(0)}%</div>
          <div className="res-summary-sub">Unemployment: {(data.unemploymentRate * 100).toFixed(1)}%</div>
        </div>
        <div className="res-summary-card">
          <div className="res-summary-label">Households</div>
          <div className="res-summary-value">{data.movedInHouseholds.toLocaleString()}</div>
          <div className="res-summary-sub">Homeless: {data.homelessHouseholds.toLocaleString()}</div>
        </div>
      </div>

      {/* Aggregate density breakdown — outside scroll */}
      <div className="res-panel-table">
        <div className="res-table-header">
          <div className="res-col-density">Zone Density</div>
          <div className="res-col-total">Property Size</div>
          <div className="res-col-occupied">Active Households</div>
          <div className="res-col-free">Free</div>
          <div className="res-col-occupancy">Occupancy</div>
        </div>
        { [
          { label: 'Low Density', total: data.lowTotal, occupied: data.lowOccupied, free: data.lowFree },
          { label: 'Medium Density', total: data.medTotal, occupied: data.medOccupied, free: data.medFree },
          { label: 'High Density', total: data.highTotal, occupied: data.highOccupied, free: data.highFree },
        ].map((row) => (
          <div key={row.label} className="res-table-row">
            <div className="res-col-density" style={{ color: DENSITY_COLORS[row.label.split(' ')[0]] }}>{row.label}</div>
            <div className="res-col-total">{row.total.toLocaleString()}</div>
            <div className="res-col-occupied">{row.occupied.toLocaleString()}</div>
            <div className="res-col-free">{row.free.toLocaleString()}</div>
            <div className="res-col-occupancy">{pct(row.occupied, row.total)}%</div>
          </div>
        )) }
      </div>

      {/* Per-building table — only when data is available */}
      {buildings.length > 0 && (
        <div className="res-bldg-section">
          {/* Filters — outside scroll */}
          <div className="res-bldg-filters">
            <div className="res-bldg-density-tabs">
              {['All', 'Low', 'Medium', 'High'].map((d) => (
                <button
                  key={d}
                  className={`res-density-tab${densityFilter === d ? ' res-density-active' : ''}`}
                  onClick={() => setDensityFilter(d)}
                  style={d !== 'All' ? { borderColor: DENSITY_COLORS[d] } : undefined}
                >
                  {d}
                </button>
              ))}
            </div>
            <select className="res-bldg-dropdown" value={themeFilter} onChange={(e: any) => setThemeFilter(e.target.value || 'All')}>
              {uniqueThemes.map((t) => <option key={t} value={t}>{t === 'All' ? 'All Themes' : t}</option>)}
            </select>
            <select className="res-bldg-dropdown" value={assetPackFilter} onChange={(e: any) => setAssetPackFilter(e.target.value || 'All')}>
              {uniqueAssetPacks.map((p) => <option key={p} value={p}>{p === 'All' ? 'All Packs' : p}</option>)}
            </select>
            <select className="res-bldg-dropdown" value={levelFilter} onChange={(e: any) => setLevelFilter(e.target.value || 'All')}>              {uniqueLevels.map((l) => <option key={l} value={l}>{l === 'All' ? 'All Levels' : `Level ${l}`}</option>)}
            </select>
            <label className="res-signature-checkbox">
              <input type="checkbox" checked={showSignatureOnly} onChange={(e: any) => setShowSignatureOnly(e.target.checked || false)} />
              <span>Signature Only</span>
            </label>
            <label className="res-range-filter">
              <span>Min Occupancy: {minOccupancy}%</span>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="5" 
                value={minOccupancy} 
                onChange={(e: any) => setMinOccupancy(Number(e.target.value) || 0)}
                className="res-range-slider"
              />
            </label>
            <label className="res-range-filter">
              <span>Min Happiness: {minHappiness}%</span>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="5" 
                value={minHappiness} 
                onChange={(e: any) => setMinHappiness(Number(e.target.value) || 0)}
                className="res-range-slider"
              />
            </label>
            <input
              className="res-bldg-search"
              placeholder="Search address..."
              value={searchText}
              onInput={(e: any) => setSearchText(e.target.value || '')}
            />
            <button 
              className="res-export-btn" 
              onClick={exportToCSV}
              title="Export filtered buildings to CSV"
            >
              Export CSV
            </button>
            <span className="res-bldg-count">{filteredBuildings.length} buildings</span>
          </div>

          {/* Sticky table header — outside scroll body */}
          <div className="res-bldg-table">
            <div className="res-bldg-header">
              <div className="res-bcol-address res-sortable" onClick={() => handleSort('address')}>Name/Address{sortIndicator('address')}</div>
              <div className="res-bcol-density res-sortable" onClick={() => handleSort('density')}>Zone Density{sortIndicator('density')}</div>
              <div className="res-bcol-level res-sortable" onClick={() => handleSort('level')}>Lv{sortIndicator('level')}</div>
              <div className="res-bcol-theme res-sortable" onClick={() => handleSort('theme')}>Theme{sortIndicator('theme')}</div>
              <div className="res-bcol-assetpack res-sortable" onClick={() => handleSort('assetPack')}>Asset Pack{sortIndicator('assetPack')}</div>
              <div className="res-bcol-occupied res-sortable" onClick={() => handleSort('occupied')}>Active Households{sortIndicator('occupied')}</div>
              <div className="res-bcol-capacity res-sortable" onClick={() => handleSort('capacity')}>Property Size{sortIndicator('capacity')}</div>
              <div className="res-bcol-occupancy res-sortable" onClick={() => handleSort('occupancy')}>Occ%{sortIndicator('occupancy')}</div>
            </div>

            {/* Scrollable body with overlay scrollbar */}
            <div className="res-bldg-scroll-wrap">
              <div ref={bodyRef} className="res-bldg-body" onScroll={updateScrollbar}>
                {filteredBuildings.length === 0 && (
                  <div className="res-panel-empty">No buildings match the filter.</div>
                )}
                {filteredBuildings.map((b, i) => {
                  const occPct = b.capacity > 0 ? pct(b.occupied, b.capacity) : (b.occupied > 0 ? 100 : 0);
                  const occColor = occPct >= 80 ? '#8bdb46' : occPct >= 40 ? '#50b8e9' : '#e88c3a';
                  return (
                    <div key={b.entityKey} className={`res-bldg-row${i % 2 === 0 ? '' : ' res-bldg-row-alt'}`}>
                      <div className="res-bcol-address">
                        {b.isSignature && <span className="res-signature-badge" title="Signature Building">?</span>}
                        {b.address}
                      </div>
                      <div className="res-bcol-density" style={{ color: DENSITY_COLORS[b.density] || 'rgba(255,255,255,0.7)' }}>{b.density}</div>
                      <div className="res-bcol-level">
                        <span className="res-level-badge">Lv {b.level}</span>
                      </div>
                      <div className="res-bcol-theme">{b.theme || 'Unknown'}</div>
                      <div className="res-bcol-assetpack">{b.assetPack || 'Base Game'}</div>
                      <div className="res-bcol-occupied">{b.occupied}</div>
                      <div className="res-bcol-capacity">{b.capacity > 0 ? b.capacity : '\u2014'}</div>
                      <div className="res-bcol-occupancy" style={{ color: occColor }}>{occPct}%</div>
                      <div className="res-bcol-happy" style={{ width: '100rem', textAlign: 'right' }}>
                        {(() => {
                          // per-building happiness estimate: base on city avg, occupancy and level
                          const base = data.avgHappiness || 50;
                          const occupancyAdj = (b.capacity > 0) ? (occPct - 75) * 0.3 : (b.occupied > 0 ? 5 : -10);
                          const levelAdj = (b.level - 3) * 2;
                          let estimate = Math.round(Math.max(0, Math.min(100, base + occupancyAdj + levelAdj)));
                          const color = estimate >= 75 ? '#8bdb46' : estimate >= 50 ? '#50b8e9' : estimate >= 30 ? '#e88c3a' : '#e05050';
                          return (
                            <span style={{ color, fontWeight: 700 }} title={`Estimated happiness: ${estimate}%`}>
                              {`${estimate}%`}
                            </span>
                          );
                        })()}
                      </div>
                      <div style={{ width: '60rem', textAlign: 'right', paddingLeft: '8rem' }}>
                        <button
                          className="res-locate-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              const parts = b.entityKey.split(',');
                              const idx = Number(parts[0]) || 0;
                              const ver = Number(parts[1]) || 0;
                              trigger('camera', 'focusEntity', { index: idx, version: ver });
                            } catch {}
                          }}
                          title="Focus camera on this building"
                        >
                          GO
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div ref={trackRef} className="res-scrollbar-track" aria-hidden>
                <div ref={thumbRef} className="res-scrollbar-thumb" style={{ top: `${thumbTop}px`, height: `${thumbHeight}px` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentialPanel;

