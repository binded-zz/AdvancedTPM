import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { camera, selectedInfo } from 'cs2/bindings';
import { Scrollable } from 'cs2/ui';
import { getSafeColor } from '../../mods/apiSafe';
import { startGlobalDrag, stopGlobalDrag } from './dragHelper';
import './ResidentialPanel.css';
import CustomSelect from './CustomSelect';
import PackIcon from '../assets/PackIcon';

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
  district?: string;
  density: string;
  level: number;
  occupied: number;
  capacity: number;
  theme: string;
  assetPack: string;
  assetPackIcon?: string;
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

// Parse per-building payload: "entityKey|address|district|density|level|occupied|capacity|theme|assetPack|isSignature;..."
const parseResidentialBuildings = (payload: string): ResidentialBuilding[] => {
  if (!payload) return [];
  return payload.split(';').map((chunk) => {
    const parts = chunk.split('|');
    if (parts.length < 10) return null;
    return {
      entityKey: parts[0] || '',
      address: parts[1] || '',
      district: parts[2] || 'City',
      density: parts[3] || 'Residential',
      level: Number(parts[4]) || 1,
      occupied: Number(parts[5]) || 0,
      capacity: Number(parts[6]) || 0,
      theme: parts[7] || 'Unknown',
      assetPack: parts[8] || 'Base Game',
      isSignature: parts[9] === '1',
      assetPackIcon: parts[10] || '',
    } as ResidentialBuilding;
  }).filter((x): x is ResidentialBuilding => x !== null);
};

const formatPackName = (name: string): string => {
  if (!name || name === 'Base Game' || name === 'Custom' || name === 'DLC') return name;
  if (name.includes(' ')) return name;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
};

const pct = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

const DENSITY_COLORS: Record<string, string> = {
  Low: '#8bdb46',
  Medium: '#50b8e9',
  High: '#e88c3a',
  Residential: 'rgba(255,255,255,0.6)',
};

const RESIDENTIAL_ICON = 'Media/Game/Icons/ZoneResidential.svg';

const normalizeTheme = (building: ResidentialBuilding): 'USA' | 'EU' => {
  const raw = `${building.theme || ''} ${building.address || ''}`.toLowerCase();
  return raw.includes('eu') || raw.includes('europe') ? 'EU' : 'USA';
};

type ResBldgSortField = 'address' | 'density' | 'level' | 'occupied' | 'capacity' | 'occupancy' | 'theme' | 'assetPack';
type SortDir = 'asc' | 'desc';

const FILTER_STEPS = ['0', '25', '50', '75', '90'];
const OCCUPANCY_STATES = ['All', 'Empty', 'Half Empty', 'Mostly Empty', 'Occupied'];
const FILTER_ICON_SIZE = 24;

const formatThresholdLabel = (prefix: string, value: string) => {
  if (value === '0') return `${prefix}: Any`;
  return `${prefix}: ${value}+`;
};

const getResidentialRowTooltip = (b: ResidentialBuilding, data: ResidentialData) => {
  const occPct = b.capacity > 0 ? pct(b.occupied, b.capacity) : (b.occupied > 0 ? 100 : 0);
  const cityAvgHappiness = data.avgHappiness || 50;
  const occupancyAdj = (b.capacity > 0) ? (occPct - 75) * 0.3 : (b.occupied > 0 ? 5 : -10);
  const levelAdj = (b.level - 3) * 2;
  const estimate = Math.round(Math.max(0, Math.min(100, cityAvgHappiness + occupancyAdj + levelAdj)));
  const lines = [
    `<b>${b.address}</b>`,
    `<br/>Density: ${b.density} • Level: Lv ${b.level}`,
    `District: ${b.district || 'City'}`,
    `Theme: ${normalizeTheme(b)} • Pack: ${b.assetPack || 'Base Game'}`,
    `Occupancy: ${b.occupied}/${b.capacity || 0} (${occPct}%)`,
    `<br/><b>Estimated Happiness: ${estimate}%</b>`,
    `City Avg: ${cityAvgHappiness}%`,
    `<br/>Signature: ${b.isSignature ? 'Yes' : 'No'}`,
    `Entity: ${b.entityKey}`,
    `<br/><i>Click row to expand details</i>`,
  ];
  return lines.join('\n');
};

const CycleFilterButton: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  displayValue?: (value: string) => string;
  icon?: (value: string) => React.ReactNode;
}> = ({ label, value, options, onChange, displayValue, icon }) => {
  const safeOptions = Array.isArray(options) && options.length > 0 ? options : ['All'];
  const currentIndex = Math.max(0, safeOptions.indexOf(value));
  const nextValue = () => onChange(safeOptions[(currentIndex + 1) % safeOptions.length]);

  return (
    <button
      type="button"
      className="res-bldg-dropdown"
      onClick={nextValue}
      title={`${label}: ${value}. Click to cycle.`}
      style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
    >
      {icon ? <span style={{ marginRight: '4rem', display: 'flex', alignItems: 'center' }}>{icon(value)}</span> : null}
      {displayValue ? displayValue(value) : `${label}: ${value === 'All' ? `All ${label}s` : value}`}
    </button>
  );
};

const ResidentialPanel: React.FC<{ residentialBrowserData?: string; residentialBuildingsData?: string }> = ({
  residentialBrowserData = '',
  residentialBuildingsData = '',
}) => {
  const data = useMemo(() => parseResidentialData(residentialBrowserData || ''), [residentialBrowserData]);
  const buildings = useMemo(() => parseResidentialBuildings(residentialBuildingsData || ''), [residentialBuildingsData]);
  const safeBuildings = Array.isArray(buildings) ? buildings : [];

  const [densityFilter, setDensityFilter] = useState('All');
  const [themeFilter, setThemeFilter] = useState('All');
  const [assetPackFilter, setAssetPackFilter] = useState('All');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [levelFilter, setLevelFilter] = useState('All');
  const [showSignatureOnly, setShowSignatureOnly] = useState(false);
  const [occupancyStateFilter, setOccupancyStateFilter] = useState('All');
  const [minHappiness, setMinHappiness] = useState(0);
  const [maxHappiness, setMaxHappiness] = useState(100);
  const [sortField, setSortField] = useState<ResBldgSortField>('occupied');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchText, setSearchText] = useState('');
  const [selectedBuildingKey, setSelectedBuildingKey] = useState<string | null>(null);
  const [expandedBuildingKey, setExpandedBuildingKey] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const RES_PAGE_SIZE = 50;
  const happinessTrackRef = useRef<HTMLDivElement | null>(null);
  const happinessDraggingThumb = useRef<'min' | 'max' | null>(null);
  // Reset page and unpause when any filter changes
  useEffect(() => {
    setCurrentPage(0);
    setExpandedBuildingKey(null);
    setIsPaused(false);
  }, [densityFilter, themeFilter, assetPackFilter, districtFilter, levelFilter, showSignatureOnly, occupancyStateFilter, minHappiness, maxHappiness, searchText, sortField, sortDir]);

  const handleSort = (field: ResBldgSortField) => {
    if (sortField === field) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSortField(field); setSortDir(field === 'address' ? 'asc' : 'desc'); }
  };
  const sortIndicator = (field: ResBldgSortField) => sortField === field ? (sortDir === 'asc' ? ' (asc)' : ' (desc)') : '';

  const happinessFromClientX = useCallback((clientX: number): number => {
    if (!happinessTrackRef.current) return 0;
    const rect = happinessTrackRef.current.getBoundingClientRect();
    const pctVal = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(pctVal * 100);
  }, []);

  const handleHappinessMouseDown = useCallback((thumb: 'min' | 'max') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    happinessDraggingThumb.current = thumb;
    startGlobalDrag();
    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const val = happinessFromClientX(ev.clientX);
      if (happinessDraggingThumb.current === 'min') {
        setMinHappiness(Math.min(val, maxHappiness));
      } else {
        setMaxHappiness(Math.max(val, minHappiness));
      }
    };
    const onUp = () => {
      happinessDraggingThumb.current = null;
      stopGlobalDrag();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [happinessFromClientX, minHappiness, maxHappiness]);

  const handleHappinessTrackClick = useCallback((e: React.MouseEvent) => {
    const val = happinessFromClientX(e.clientX);
    const distMin = Math.abs(val - minHappiness);
    const distMax = Math.abs(val - maxHappiness);
    if (distMin <= distMax) setMinHappiness(Math.min(val, maxHappiness));
    else setMaxHappiness(Math.max(val, minHappiness));
  }, [happinessFromClientX, minHappiness, maxHappiness]);

  const happinessPctOf = (v: number) => v;

  // Extract unique values for filter dropdowns
  const uniqueThemes = useMemo(() => {
    if (safeBuildings.length === 0) return ['All'];
    const themes = new Set(safeBuildings.map((b) => normalizeTheme(b)).filter(Boolean));
    return ['All', ...Array.from(themes).sort()];
  }, [safeBuildings]) ?? ['All'];

  const uniqueDistricts = useMemo(() => {
    if (safeBuildings.length === 0) return ['All'];
    const d = new Set(safeBuildings.map((b) => (b.district || 'City')).filter(Boolean));
    return ['All', ...Array.from(d).sort()];
  }, [safeBuildings]) ?? ['All'];

  const uniqueAssetPacks = useMemo(() => {
    if (safeBuildings.length === 0) return ['All'];
    const packs = new Set(safeBuildings.map(b => b.assetPack || 'Base Game').filter(p => p));
    return ['All', ...Array.from(packs).sort()];
  }, [safeBuildings]) ?? ['All'];

  const uniqueLevels = useMemo(() => {
    if (safeBuildings.length === 0) return ['All'];
    const levels = new Set(
      safeBuildings
        .map(b => Number(b.level))
        .filter(l => Number.isFinite(l) && l > 0)
        .map(l => String(Math.round(l)))
    );
    return ['All', ...Array.from(levels).sort((a, b) => Number(a) - Number(b))];
  }, [safeBuildings]) ?? ['All'];

  const filteredBuildings = useMemo(() => {
    if (!safeBuildings.length || !data) return [];
    let list = safeBuildings;
    if (densityFilter !== 'All') list = list.filter((b) => String(b.density || '').trim() === densityFilter.trim());
    if (themeFilter !== 'All') list = list.filter((b) => String(normalizeTheme(b) || '').trim() === themeFilter.trim());
    if (districtFilter !== 'All') list = list.filter((b) => String(b.district || 'City').trim() === districtFilter.trim());
    if (assetPackFilter !== 'All') list = list.filter((b) => String(b.assetPack || 'Base Game').trim() === assetPackFilter.trim());
    if (levelFilter !== 'All') list = list.filter((b) => String(b.level || 0).trim() === levelFilter.trim());
    if (showSignatureOnly) list = list.filter((b) => b.isSignature === true);

    if (occupancyStateFilter !== 'All') {
      list = list.filter((b) => {
        const occPct = b.capacity > 0 ? Math.round((b.occupied / b.capacity) * 100) : (b.occupied > 0 ? 100 : 0);
        switch (occupancyStateFilter) {
          case 'Empty': return (b.occupied || 0) === 0;
          case 'Half Empty': return occPct > 0 && occPct < 50;
          case 'Mostly Empty': return occPct > 0 && occPct < 75;
          case 'Occupied': return occPct > 0;
          default: return true;
        }
      });
    }

    if (minHappiness > 0 || maxHappiness < 100) {
      list = list.filter((b) => {
        const base = data.avgHappiness || 50;
        const occPct = b.capacity > 0 ? Math.round((b.occupied / b.capacity) * 100) : (b.occupied > 0 ? 100 : 0);
        const occupancyAdj = (b.capacity > 0) ? (occPct - 75) * 0.3 : (b.occupied > 0 ? 5 : -10);
        const levelAdj = (b.level - 3) * 2;
        const estimate = Math.round(Math.max(0, Math.min(100, base + occupancyAdj + levelAdj)));
        return estimate >= minHappiness && estimate <= maxHappiness;
      });
    }

    if (searchText) {
      const lower = searchText.toLowerCase();
      list = list.filter((b) =>
        (b.address || '').toLowerCase().includes(lower) ||
        (b.theme || '').toLowerCase().includes(lower) ||
        (b.assetPack || '').toLowerCase().includes(lower) ||
        (b.density || '').toLowerCase().includes(lower)
      );
    }
    return [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'address': return dir * (a.address || '').localeCompare(b.address || '');
        case 'density': return dir * (a.density || '').localeCompare(b.density || '');
        case 'level': return dir * ((a.level || 0) - (b.level || 0));
        case 'occupied': return dir * ((a.occupied || 0) - (b.occupied || 0));
        case 'capacity': return dir * ((a.capacity || 0) - (b.capacity || 0));
        case 'theme': return dir * (a.theme || 'Unknown').localeCompare(b.theme || 'Unknown');
        case 'assetPack': return dir * (a.assetPack || 'Base Game').localeCompare(b.assetPack || 'Base Game');
        case 'occupancy': {
          const oA = (a.capacity || 0) > 0 ? a.occupied / a.capacity : 0;
          const oB = (b.capacity || 0) > 0 ? b.occupied / b.capacity : 0;
          return dir * (oA - oB);
        }
        default: return 0;
      }
    });
  }, [safeBuildings, data, densityFilter, themeFilter, assetPackFilter, levelFilter, showSignatureOnly, occupancyStateFilter, minHappiness, maxHappiness, searchText, sortField, sortDir]);

  const safeFilteredBuildings = Array.isArray(filteredBuildings) ? filteredBuildings : [];


  const themeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    safeBuildings.forEach((b) => {
      const theme = normalizeTheme(b);
      counts.set(theme, (counts.get(theme) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [safeBuildings]);
  const assetPackCounts = useMemo(() => {
    const counts = new Map<string, number>();
    safeBuildings.forEach((b) => {
      const pack = b.assetPack || 'Base Game';
      counts.set(pack, (counts.get(pack) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [safeBuildings]);
  const visiblePackColumns = useMemo(() => assetPackCounts.map(([pack]) => pack).filter((pack) => pack !== 'Base Game'), [assetPackCounts]);
  const densitySummaryRows = useMemo(() => {
    const makeRow = (label: 'Low' | 'Medium' | 'High', total: number, occupied: number, free: number) => {
      const rowBuildings = safeBuildings.filter((b) => b.density === label);
      const packCounts = new Map<string, number>();
      rowBuildings.forEach((b) => packCounts.set(b.assetPack || 'Base Game', (packCounts.get(b.assetPack || 'Base Game') || 0) + 1));
      return {
        label: `${label} Density`,
        total,
        occupied,
        free,
        placed: rowBuildings.length,
        usa: rowBuildings.filter((b) => normalizeTheme(b) === 'USA').length,
        eu: rowBuildings.filter((b) => normalizeTheme(b) === 'EU').length,
        packs: packCounts,
      };
    };
    return [
      makeRow('Low', data?.lowTotal || 0, data?.lowOccupied || 0, data?.lowFree || 0),
      makeRow('Medium', data?.medTotal || 0, data?.medOccupied || 0, data?.medFree || 0),
      makeRow('High', data?.highTotal || 0, data?.highOccupied || 0, data?.highFree || 0),
    ];
  }, [safeBuildings, data]);

  // CSV Export function (must be after filteredBuildings)
  const exportToCSV = useCallback(() => {
    if (safeFilteredBuildings.length === 0) return;

    const headers = ['Address', 'Density', 'Level', 'Theme', 'Asset Pack', 'Occupied', 'Capacity', 'Occupancy %', 'Est. Happiness %', 'Signature'];
    const rows = safeFilteredBuildings.map((b) => {
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
  }, [safeFilteredBuildings, data]);

  if (!data) {
    return <div className="res-panel-empty">Residential data will appear when the simulation is running.</div>;
  }

  const totalUnits = data.lowTotal + data.medTotal + data.highTotal;
  const totalOccupied = data.lowOccupied + data.medOccupied + data.highOccupied;
  const totalFree = data.lowFree + data.medFree + data.highFree;

  return (
    <div className="res-panel">
      {/* Top Section: Global Stats and Density Table side-by-side */}
      <div className="res-top-section">
        <div className="res-global-stats">
          <div className="res-stat-item">
            <span className="res-stat-label">Happiness</span>
            <span className="res-stat-value" style={{ color: getSafeColor(data.avgHappiness >= 70 ? '#8bdb46' : data.avgHappiness >= 40 ? '#50b8e9' : '#e05050') }}>
              {data.avgHappiness}%
            </span>
          </div>
          <div className="res-stat-item">
            <span className="res-stat-label">Unemployment</span>
            <span className="res-stat-value" style={{ color: getSafeColor(data.unemploymentRate > 10 ? '#e05050' : '#8bdb46') }}>
              {data.unemploymentRate}%
            </span>
          </div>
          <div className="res-stat-item">
            <span className="res-stat-label">Homeless</span>
            <span className="res-stat-value" style={{ color: getSafeColor(data.homelessHouseholds > 100 ? '#e05050' : 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0.8)') }}>
              {data.homelessHouseholds.toLocaleString()}
            </span>
          </div>
          <div className="res-stat-item">
            <span className="res-stat-label">Total Households</span>
            <span className="res-stat-value">{totalOccupied.toLocaleString()} / {totalUnits.toLocaleString()}</span>
            <span className="res-stat-label" style={{ fontSize: '10rem' }}>({pct(totalOccupied, totalUnits)}%)</span>
          </div>
        </div>

        {/* Aggregate density breakdown */}
        <div className="res-panel-table">
          <div className="res-table-header">
            <div className="res-col-density">Zone Density</div>
            <div className="res-col-total">Size</div>
            <div className="res-col-occupied">Active</div>
            <div className="res-col-free">Free</div>
            <div className="res-col-placed">Placed</div>
            <div className="res-col-theme">USA</div>
            <div className="res-col-theme">EU</div>
            {visiblePackColumns.slice(0, 3).map((pack) => <div key={pack} className="res-col-pack">{pack}</div>)}
          </div>
          {densitySummaryRows.map((row) => (
            <div key={row.label} className="res-table-row">
              <div className="res-col-density" style={{ color: getSafeColor(DENSITY_COLORS[row.label.split(' ')[0]] || 'transparent') }}>{row.label}</div>
              <div className="res-col-total">{row.total.toLocaleString()}</div>
              <div className="res-col-occupied">{row.occupied.toLocaleString()}</div>
              <div className="res-col-free">{row.free.toLocaleString()}</div>
              <div className="res-col-placed">{row.placed.toLocaleString()}</div>
              <div className="res-col-theme">{row.usa.toLocaleString()}</div>
              <div className="res-col-theme">{row.eu.toLocaleString()}</div>
              {visiblePackColumns.slice(0, 3).map((pack) => <div key={pack} className="res-col-pack">{(row.packs.get(pack) || 0).toLocaleString()}</div>)}
            </div>
          ))}
        </div>
      </div>

      {/* Per-building table — only when data is available */}
      {safeBuildings.length > 0 && (
        <div className="res-bldg-section">
          {/* Filters — outside scroll */}
          <div className="res-bldg-filters">
            <input
              className="res-bldg-search"
              placeholder="Search address, theme, or pack..."
              value={searchText}
              onInput={(e: any) => setSearchText(e.target.value || '')}
            />
            <button className="res-export-btn" onClick={() => {
              setDensityFilter('All');
              setThemeFilter('All');
              setAssetPackFilter('All');
              setLevelFilter('All');
              setShowSignatureOnly(false);
              setOccupancyStateFilter('All');
              setMinHappiness(0);
              setMaxHappiness(100);
              setSearchText('');
            }} title="Reset all residential filters">Clear</button>
            <div className="res-bldg-density-tabs">
              {['All', 'Low', 'Medium', 'High'].map((d) => (
                <button
                  key={d}
                  className={`res-density-tab${densityFilter === d ? ' res-density-active' : ''}`}
                  onClick={() => setDensityFilter(d)}
                  style={d !== 'All' ? { borderColor: getSafeColor(DENSITY_COLORS[d]) } : undefined}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="res-bldg-density-tabs">
              {uniqueLevels.map((lvl) => (
                <button
                  key={lvl}
                  className={`res-density-tab${levelFilter === lvl ? ' res-density-active' : ''}`}
                  onClick={() => setLevelFilter(lvl)}
                >
                  {lvl === 'All' ? 'All Lv' : `Lv ${lvl}`}
                </button>
              ))}
            </div>
            <CustomSelect
              label="Theme"
              value={themeFilter || 'All'}
              options={uniqueThemes || ['All']}
              onChange={setThemeFilter}
              displayValue={(v) => v === 'All' ? 'All Themes' : v}
            />
            <CustomSelect
              label="District"
              value={districtFilter || 'All'}
              options={uniqueDistricts || ['All']}
              onChange={setDistrictFilter}
              displayValue={(v) => v === 'All' ? 'All Districts' : v}
            />
            <CustomSelect
              label="Pack"
              value={assetPackFilter || 'All'}
              options={uniqueAssetPacks || ['All']}
              onChange={setAssetPackFilter}
              displayValue={(v) => v === 'All' ? 'All Packs' : formatPackName(v)}
              icon={(v) => v === 'All' ? null : <PackIcon pack={v} size={FILTER_ICON_SIZE} />}
            />
            <CycleFilterButton
              label="Occ"
              value={occupancyStateFilter}
              options={OCCUPANCY_STATES}
              onChange={setOccupancyStateFilter}
              displayValue={(v) => `Occ: ${v}`}
            />
            <div className="res-range-filter">
              <span>{`Happy: ${minHappiness}–${maxHappiness}`}</span>
              <div className="res-happy-slider-wrap">
                <span className="res-happy-value">{minHappiness}%</span>
                <div ref={happinessTrackRef} className="res-happy-track-area" onMouseDown={handleHappinessTrackClick}>
                  <div className="res-happy-track" />
                  <div className="res-happy-range-fill" style={{ left: `${happinessPctOf(minHappiness)}%`, width: `${happinessPctOf(maxHappiness) - happinessPctOf(minHappiness)}%` }} />
                  <div className="res-happy-thumb" style={{ left: `${happinessPctOf(minHappiness)}%` }} onMouseDown={handleHappinessMouseDown('min')} />
                  <div className="res-happy-thumb" style={{ left: `${happinessPctOf(maxHappiness)}%` }} onMouseDown={handleHappinessMouseDown('max')} />
                </div>
                <span className="res-happy-value">{maxHappiness}%</span>
              </div>
            </div>
            <button
              className={`res-density-tab${showSignatureOnly ? ' res-density-active' : ''}`}
              onClick={() => setShowSignatureOnly((v) => !v)}
              title="Filter to Signature Buildings only"
            >
              ★ Sig Only
            </button>
            <span className="res-bldg-count">{safeFilteredBuildings.length} buildings</span>
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
              <div className="res-bcol-happy">Happy</div>
              <div className="res-bcol-action">Go</div>
            </div>
            {/* Scrollable body with custom scrollbar */}
            <div className="res-bldg-scroll-wrap">
              <Scrollable vertical={true} className="res-bldg-body" trackVisibility="scrollable">
                {safeFilteredBuildings.length === 0 && (
                  <div className="res-panel-empty">No buildings match the filter.</div>
                )}
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(safeFilteredBuildings.length / RES_PAGE_SIZE));
                  const safePage = Math.min(currentPage, totalPages - 1);
                  return safeFilteredBuildings.slice(safePage * RES_PAGE_SIZE, safePage * RES_PAGE_SIZE + RES_PAGE_SIZE);
                })().map((b) => {
                  if (!b) return null;
                  const occPct = (b.capacity || 0) > 0 ? pct(b.occupied, b.capacity) : (b.occupied > 0 ? 100 : 0);
                  const occColor = occPct >= 80 ? '#8bdb46' : occPct >= 40 ? '#50b8e9' : '#e88c3a';
                  const isExpanded = expandedBuildingKey === b.entityKey;
                  return (
                    <React.Fragment key={b.entityKey}>
                      <div className={`res-bldg-row${b.entityKey.charCodeAt(0) % 2 === 0 ? '' : ' res-bldg-row-alt'}${selectedBuildingKey === b.entityKey || isExpanded ? ' res-bldg-row-selected' : ''}`}
                        title={getResidentialRowTooltip(b, data)}
                         onClick={() => {
                           setSelectedBuildingKey(b.entityKey);
                           if (isExpanded) {
                             setExpandedBuildingKey(null);
                             setIsPaused(false);
                           } else {
                             setExpandedBuildingKey(b.entityKey);
                             setIsPaused(true);
                           }
                         }}>
                        <div className="res-bcol-address">
                           <span className="res-expand-arrow">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                           {b.isSignature && <span className="res-signature-badge" title="Signature Building">★</span>}
                           <img className="res-row-icon" src={RESIDENTIAL_ICON} alt="" />
                           {b.address}
                        </div>
                        <div className="res-bcol-density" style={{ color: getSafeColor(DENSITY_COLORS[b.density] || 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0.7)') }}>{b.density}</div>
                        <div className="res-bcol-level">
                           <span className="res-level-badge">Lv {b.level}</span>
                        </div>
                        <div className="res-bcol-theme">{normalizeTheme(b)}</div>
                          <div className="res-bcol-assetpack" style={{ display: 'flex', alignItems: 'center' }}>
                            <PackIcon pack={b.assetPack} iconUrl={b.assetPackIcon} size={24} style={{ marginRight: '6rem' }} />
                            {b.assetPack || 'Base Game'}
                          </div>
                        <div className="res-bcol-occupied">{b.occupied}</div>
                        <div className="res-bcol-capacity">{b.capacity > 0 ? b.capacity : '\u2014'}</div>
                        <div className="res-bcol-occupancy" style={{ color: getSafeColor(occColor) }}>{occPct}%</div>
                        <div className="res-bcol-happy">
                          {(() => {
                            const base = data.avgHappiness || 50;
                            const occupancyAdj = (b.capacity > 0) ? (occPct - 75) * 0.3 : (b.occupied > 0 ? 5 : -10);
                            const levelAdj = (b.level - 3) * 2;
                            const estimate = Math.round(Math.max(0, Math.min(100, base + occupancyAdj + levelAdj)));
                            const color = estimate >= 75 ? '#8bdb46' : estimate >= 50 ? '#50b8e9' : estimate >= 30 ? '#e88c3a' : '#e05050';
                            return <span style={{ color: getSafeColor(color), fontWeight: 700 }} title={`Estimated happiness: ${estimate}%`}>{`${estimate}%`}</span>;
                          })()}
                        </div>
                        <div className="res-bcol-action">
                          <button
                            className="res-locate-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBuildingKey(b.entityKey);
                              try {
                                const parts = b.entityKey.split(',');
                                const idx = Number(parts[0]) || 0;
                                const ver = Number(parts[1]) || 0;
                                const entity = { index: idx, version: ver };
                                camera.focusEntity(entity);
                                selectedInfo.selectEntity(entity);
                              } catch {}
                            }}
                            title="Focus camera on this building"
                          >
                            GO
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="res-bldg-detail-row">
                          <div className="res-entity-id-header">
                            <span className="res-entity-id-label">Entity ID:</span>
                            <span className="res-entity-id-badge">{b.entityKey}</span>
                          </div>
                          <div className="res-bldg-detail-grid">
                            <div><span className="res-bldg-detail-label">Address</span><span className="res-bldg-detail-value">{b.address}</span></div>
                            <div><span className="res-bldg-detail-label">Density</span><span className="res-bldg-detail-value">{b.density}</span></div>
                            <div><span className="res-bldg-detail-label">Theme</span><span className="res-bldg-detail-value">{normalizeTheme(b)}</span></div>
                             <div><span className="res-bldg-detail-label">Pack</span><span className="res-bldg-detail-value" style={{ display: 'flex', alignItems: 'center' }}><PackIcon pack={b.assetPack} iconUrl={b.assetPackIcon} size={20} style={{ marginRight: '6rem' }} />{b.assetPack || 'Base Game'}</span></div>
                            <div><span className="res-bldg-detail-label">Level</span><span className="res-bldg-detail-value">{`Lv ${b.level}`}</span></div>
                            <div><span className="res-bldg-detail-label">Occupancy</span><span className="res-bldg-detail-value">{`${b.occupied}/${b.capacity || 0} (${occPct}%)`}</span></div>
                            <div><span className="res-bldg-detail-label">Signature</span><span className="res-bldg-detail-value">{b.isSignature ? 'Yes' : 'No'}</span></div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
                {safeFilteredBuildings.length > 300 && (
                  <div className="res-truncation-notice" style={{ padding: '10rem', textAlign: 'center', fontSize: '11rem', color: 'rgba(255,255,255,0.4)', borderTop: '1rem solid rgba(255,255,255,0.1)' }}>
                    Showing top 300 of {safeFilteredBuildings.length} buildings. Use search or filters to narrow down.
                  </div>
                )}
              </Scrollable>
              {/* Pagination controls */}
              {safeFilteredBuildings.length > RES_PAGE_SIZE && (() => {
                const totalPages = Math.max(1, Math.ceil(safeFilteredBuildings.length / RES_PAGE_SIZE));
                const safePage = Math.min(currentPage, totalPages - 1);
                return (
                  <div className="panel-pagination">
                    <button
                      className="panel-pagination-btn"
                      onClick={() => { setCurrentPage((p) => Math.max(0, p - 1)); setExpandedBuildingKey(null); setIsPaused(false); }}
                      disabled={safePage === 0}
                    >
                      ◀ Prev
                    </button>
                    <span className="panel-pagination-label">
                      Page{' '}{safePage + 1}{' '}of{' '}{totalPages}{isPaused ? ' ⏸' : ''}
                    </span>
                    <button
                      className="panel-pagination-btn"
                      onClick={() => { setCurrentPage((p) => Math.min(totalPages - 1, p + 1)); setExpandedBuildingKey(null); setIsPaused(false); }}
                      disabled={safePage >= totalPages - 1}
                    >
                      Next ▶
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentialPanel;

