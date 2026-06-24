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
  lowPlaced: number;
  medPlaced: number;
  highPlaced: number;
  lowUsa: number;
  medUsa: number;
  highUsa: number;
  lowEu: number;
  medEu: number;
  highEu: number;
  lowPacks: Record<string, number>;
  medPacks: Record<string, number>;
  highPacks: Record<string, number>;
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
  themeIcon?: string;
  assetPack: string;
  assetPackIcon?: string;
  isSignature: boolean;
  cityEffects?: string;
  localEffects?: string;
  attractiveness?: number;
  attractivenessFactors?: string;
  happinessFactors?: string;
  happiness?: number;
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
      lowPlaced: Number(obj.lowPlaced) || 0,
      medPlaced: Number(obj.medPlaced) || 0,
      highPlaced: Number(obj.highPlaced) || 0,
      lowUsa: Number(obj.lowUsa) || 0,
      medUsa: Number(obj.medUsa) || 0,
      highUsa: Number(obj.highUsa) || 0,
      lowEu: Number(obj.lowEu) || 0,
      medEu: Number(obj.medEu) || 0,
      highEu: Number(obj.highEu) || 0,
      lowPacks: obj.lowPacks || {},
      medPacks: obj.medPacks || {},
      highPacks: obj.highPacks || {},
    };
  } catch {
    return null;
  }
};

// Parse JSON array of ResidentialBuildingDTO returned by the C# backend.
const parseResidentialBuildings = (payload: string): ResidentialBuilding[] => {
  if (!payload) return [];
  try {
    const arr = JSON.parse(payload);
    if (!Array.isArray(arr)) return [];
    return arr.map((item: any) => {
      const hFactors = item.happinessFactors || '';
      const idx = hFactors.indexOf('^');
      const happiness = Number(idx === -1 ? hFactors : hFactors.substring(0, idx)) || 50;
      const happinessFactorsStr = idx === -1 ? '' : hFactors.substring(idx + 1);

      return {
        entityKey: item.entityKey || '',
        address: item.address || '',
        district: item.district || 'City',
        density: item.density || 'Residential',
        level: Number(item.level) || 1,
        occupied: Number(item.occupied) || 0,
        capacity: Number(item.capacity) || 0,
        theme: item.theme || 'Unknown',
        assetPack: item.pack || 'Base Game',
        isSignature: item.isSignature === 1,
        assetPackIcon: item.packIcon || '',
        themeIcon: item.themeIcon || '',
        cityEffects: item.cityEffects || '',
        localEffects: item.localEffects || '',
        attractiveness: Number(item.attractiveness) || 0,
        attractivenessFactors: item.attractivenessFactors || '',
        happiness,
        happinessFactors: happinessFactorsStr,
      } as ResidentialBuilding;
    });
  } catch (e) {
    console.error("Error parsing residential buildings payload", e);
    return [];
  }
};

const EFF_FACTOR_LABELS: Record<string, string> = {
  EmployeeHappiness: 'Employee Happiness',
  ElectricitySupply: 'Electricity Supply',
  ElectricityFee: 'Electricity Fee',
  WaterSupply: 'Water Supply',
  DirtyWater: 'Dirty Water',
  SewageHandling: 'Sewage',
  WaterFee: 'Water Fee',
  NoisePollution: 'Noise Pollution',
  GroundPollution: 'Ground Pollution',
  AirPollution: 'Air Pollution',
  TrafficPenalty: 'Traffic Penalty',
  DeathPenalty: 'Death Penalty',
  Healthcare: 'Healthcare',
  Entertainment: 'Entertainment',
  Education: 'Education',
  Mail: 'Mail',
  Welfare: 'Welfare',
  Leisure: 'Leisure',
  Tax: 'Tax',
  Buildings: 'Buildings',
  Consumption: 'Consumption',
  Homelessness: 'Homelessness',
  Telecom: 'Telecom',
  Crime: 'Crime',
  Apartment: 'Apartment',
};

const getEfficiencyFactorIcon = (factorName: string): string => {
  if (!factorName) return 'Media/Game/Icons/Notifications.svg';
  const n = factorName.toLowerCase();
  if (n.includes('worker') || n.includes('employee') || n.includes('staff')) return 'Media/Game/Icons/Workers.svg';
  if (n.includes('electric') || n.includes('power')) return 'Media/Game/Icons/Electricity.svg';
  if (n.includes('water') || n.includes('sewage')) return 'Media/Game/Icons/Water.svg';
  if (n.includes('garbage') || n.includes('waste')) return 'Media/Game/Icons/Garbage.svg';
  if (n.includes('mail')) return 'Media/Game/Icons/PostService.svg';
  if (n.includes('crime')) return 'Media/Game/Icons/Police.svg';
  if (n.includes('transport') || n.includes('access') || n.includes('traffic')) return 'Media/Game/Icons/Traffic.svg';
  if (n.includes('road') || n.includes('network')) return 'Media/Game/Icons/Roads.svg';
  if (n.includes('healthcare') || n.includes('hospital') || n.includes('sick')) return 'Media/Game/Icons/Healthcare.svg';
  if (n.includes('education') || n.includes('school') || n.includes('university') || n.includes('college')) return 'Media/Game/Icons/Education.svg';
  if (n.includes('wealth')) return 'Media/Game/Icons/Wealth.svg';
  if (n.includes('park') || n.includes('entertainment') || n.includes('attraction') || n.includes('leisure') || n.includes('apartment') || n.includes('building')) return 'Media/Game/Icons/ParksAndRecreation.svg';
  if (n.includes('welfare') || n.includes('wellbeing')) return 'Media/Game/Icons/Wellbeing.svg';
  if (n.includes('fire')) return 'Media/Game/Icons/FireAndRescue.svg';
  if (n.includes('deathcare') || n.includes('death') || n.includes('cemetery') || n.includes('crematorium')) return 'Media/Game/Icons/Deathcare.svg';
  if (n.includes('police')) return 'Media/Game/Icons/PoliceAndAdministration.svg';
  if (n.includes('telecom') || n.includes('network')) return 'Media/Game/Icons/Communications.svg';
  if (n.includes('pollution')) return 'Media/Game/Icons/Pollution.svg';
  if (n.includes('tax') || n.includes('consumption')) return 'Media/Game/Icons/Economy.svg';
  return 'Media/Game/Icons/Notifications.svg';
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

const normalizeTheme = (building: ResidentialBuilding): string => {
  const t = building.theme;
  if (!t || t === 'Unknown') return 'Unknown';
  return t;
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
  const lines = [
    <span style={{ fontWeight: 800, color: '#50b8e9', display: 'block', marginBottom: '2rem' }}>{b.address}</span>,
    <span style={{ display: 'block', fontSize: '10rem', color: 'rgba(255,255,255,0.7)' }}>Density: {b.density} • Level: Lv {b.level}</span>,
    <span style={{ display: 'block', fontSize: '10rem', color: 'rgba(255,255,255,0.7)' }}>District: {b.district || 'City'}</span>,
    <span style={{ display: 'block', fontSize: '10rem', color: 'rgba(255,255,255,0.7)' }}>Theme: {normalizeTheme(b)} • Pack: {b.assetPack || 'Base Game'}</span>,
    <span style={{ display: 'block', fontSize: '10rem', color: 'rgba(255,255,255,0.7)' }}>Occupancy: {b.occupied} / {b.capacity || 0} ({occPct}%)</span>,
    <span style={{ display: 'block', fontWeight: 700, color: '#ffb74d', marginTop: '4rem' }}>True Happiness: {b.happiness}%</span>,
    <span style={{ display: 'block', fontSize: '10rem', color: 'rgba(255,255,255,0.6)' }}>City Avg: {cityAvgHappiness}%</span>
  ];
  if (b.isSignature) {
    lines.push(<span style={{ display: 'block', fontSize: '10rem', color: '#f0c040', fontWeight: 'bold', marginTop: '2rem' }}>★ Signature Building</span>);
  }
  lines.push(<span style={{ display: 'block', fontSize: '9rem', color: '#50b8e9', fontStyle: 'italic', marginTop: '4rem' }}>Click row to expand details</span>);
  return lines;
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

const ResidentialPanel: React.FC<{
  residentialBrowserData?: string;
  residentialBuildingsData?: string;
  onTooltipShow?: (lines: any[], el?: HTMLElement, alignRight?: boolean, clientX?: number, clientY?: number) => void;
  onTooltipHide?: () => void;
}> = ({
  residentialBrowserData = '',
  residentialBuildingsData = '',
  onTooltipShow,
  onTooltipHide
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

  const assetPackCounts = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    const mergeDict = (dict: Record<string, number>) => {
      if (!dict) return;
      Object.entries(dict).forEach(([pack, val]) => {
        counts.set(pack, (counts.get(pack) || 0) + val);
      });
    };
    mergeDict(data.lowPacks);
    mergeDict(data.medPacks);
    mergeDict(data.highPacks);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [data]);

  const packIconMap = useMemo(() => {
    const map = new Map<string, string>();
    safeBuildings.forEach(b => {
      if (b.assetPack && b.assetPackIcon && !map.has(b.assetPack)) {
        map.set(b.assetPack, b.assetPackIcon);
      }
    });
    return map;
  }, [safeBuildings]);

  const visiblePackColumns = useMemo(() => assetPackCounts.map(([pack]) => pack).filter((pack) => pack !== 'Base Game' && packIconMap.has(pack)), [assetPackCounts, packIconMap]);

  const themeIconMap = useMemo(() => {
    const map = new Map<string, string>();
    safeBuildings.forEach(b => {
      const normalizedTheme = normalizeTheme(b);
      if (b.themeIcon && !map.has(normalizedTheme)) {
        map.set(normalizedTheme, b.themeIcon);
      }
    });
    // Add defaults
    if (!map.has('European')) map.set('European', 'Media/Game/Icons/ThemeEuropean.svg');
    if (!map.has('NorthAmerican')) map.set('NorthAmerican', 'Media/Game/Icons/ThemeNorthAmerican.svg');
    if (!map.has('EU')) map.set('EU', 'Media/Game/Icons/ThemeEuropean.svg');
    if (!map.has('USA')) map.set('USA', 'Media/Game/Icons/ThemeNorthAmerican.svg');
    return map;
  }, [safeBuildings]);

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
    const packs = new Set<string>();
    packs.add('Base Game');
    assetPackCounts.forEach(([pack]) => {
      if (pack) packs.add(pack);
    });
    return ['All', ...Array.from(packs).sort()];
  }, [assetPackCounts]) ?? ['All'];

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

    if (maxHappiness < 100 || minHappiness > 0) {
      list = list.filter((b) => {
        if (b.happiness === undefined || b.happiness < minHappiness || b.happiness > maxHappiness) return false;
        return true;
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

  const densitySummaryRows = useMemo(() => {
    if (!data) return [];
    const makeRow = (
      label: 'Low' | 'Medium' | 'High',
      total: number,
      occupied: number,
      free: number,
      placed: number,
      usa: number,
      eu: number,
      packsObj: Record<string, number>
    ) => {
      const packCounts = new Map<string, number>();
      if (packsObj) {
        Object.entries(packsObj).forEach(([pack, val]) => {
          packCounts.set(pack, val);
        });
      }
      return {
        label: `${label} Density`,
        total,
        occupied,
        free,
        placed,
        usa,
        eu,
        packs: packCounts,
      };
    };
    return [
      makeRow('Low', data.lowTotal, data.lowOccupied, data.lowFree, data.lowPlaced, data.lowUsa, data.lowEu, data.lowPacks),
      makeRow('Medium', data.medTotal, data.medOccupied, data.medFree, data.medPlaced, data.medUsa, data.medEu, data.medPacks),
      makeRow('High', data.highTotal, data.highOccupied, data.highFree, data.highPlaced, data.highUsa, data.highEu, data.highPacks),
    ];
  }, [data]);

  // CSV Export function (must be after filteredBuildings)
  const exportToCSV = useCallback(() => {
    if (safeFilteredBuildings.length === 0) return;

    const headers = ['Address', 'Density', 'Level', 'Theme', 'Asset Pack', 'Occupied', 'Capacity', 'Occupancy %', 'Happiness %', 'Signature'];
    const rows = safeFilteredBuildings.map((b) => {
      const occPct = b.capacity > 0 ? Math.round((b.occupied / b.capacity) * 100) : (b.occupied > 0 ? 100 : 0);

      return [
        `\"${(b.address || '').replace(/\"/g, '\"\"')}\"`,
        b.density || 'Unknown',
        b.level || 1,
        (b.theme || 'Unknown').replace(/\"/g, '\"\"'),
        (b.assetPack || 'Base Game').replace(/\"/g, '\"\"'),
        b.occupied || 0,
        b.capacity || 0,
        occPct,
        b.happiness ?? 50,
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
  }, [safeFilteredBuildings]);

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
            {visiblePackColumns.slice(0, 15).map((pack) => <div key={pack} className="res-col-pack res-col-pack-hdr" title={pack}><PackIcon pack={pack} iconUrl={packIconMap.get(pack)} size={22} /></div>)}
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
              {visiblePackColumns.slice(0, 15).map((pack) => <div key={pack} className="res-col-pack">{(row.packs.get(pack) || 0).toLocaleString()}</div>)}
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
              icon={(v) => v === 'All' ? null : <PackIcon pack={v} iconUrl={themeIconMap.get(v)} size={FILTER_ICON_SIZE} />}
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
              icon={(v) => v === 'All' ? null : <PackIcon pack={v} iconUrl={packIconMap.get(v)} size={FILTER_ICON_SIZE} />}
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
                           {b.isSignature && <span className="res-signature-badge">★</span>}
                           <img className="res-row-icon" src={RESIDENTIAL_ICON} alt="" />
                           {b.address}
                        </div>
                        <div className="res-bcol-density" style={{ color: getSafeColor(DENSITY_COLORS[b.density] || 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0.7)') }}>{b.density}</div>
                        <div className="res-bcol-level">
                           <span className="res-level-badge">Lv {b.level}</span>
                        </div>
                        <div className="res-bcol-theme" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PackIcon pack={normalizeTheme(b)} iconUrl={themeIconMap.get(normalizeTheme(b))} size={16} />
                          <span style={{ marginLeft: '4rem' }}>{normalizeTheme(b)}</span>
                        </div>
                          <div className="res-bcol-assetpack" style={{ display: 'flex', alignItems: 'center' }}>
                            <PackIcon pack={b.assetPack} iconUrl={b.assetPackIcon} size={24} style={{ marginRight: '6rem' }} />
                            {b.assetPack || 'Base Game'}
                          </div>
                        <div className="res-bcol-occupied">{b.occupied}</div>
                        <div className="res-bcol-capacity">{b.capacity > 0 ? b.capacity : '\u2014'}</div>
                        <div className="res-bcol-occupancy" style={{ color: getSafeColor(occColor) }}>{occPct}%</div>
                        <div className="res-bcol-happy">
                          {(() => {
                            const val = b.happiness ?? 50;
                            const color = val >= 75 ? '#8bdb46' : val >= 50 ? '#50b8e9' : val >= 30 ? '#e88c3a' : '#e05050';
                            return <span style={{ color: getSafeColor(color), fontWeight: 700 }} title={`True Happiness: ${val}%`}>{`${val}%`}</span>;
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
                            <div><span className="res-bldg-detail-label">Occupancy</span><span className="res-bldg-detail-value">{`${b.occupied} / ${b.capacity || 0} (${occPct}%)`}</span></div>
                            <div><span className="res-bldg-detail-label">Signature</span><span className="res-bldg-detail-value">{b.isSignature ? 'Yes' : 'No'}</span></div>
                            {b.attractiveness ? <div><span className="res-bldg-detail-label">Attractiveness</span><span className="res-bldg-detail-value" style={{ color: getSafeColor('#3fc9d8') }}>{b.attractiveness}</span></div> : null}
                            {b.attractivenessFactors && b.attractivenessFactors.split('|').map((factor, idx) => {
                              const parts = factor.split(':');
                              if (parts.length !== 2) return null;
                              const capitalizedLabel = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                              const label = capitalizedLabel.replace(/([a-z])([A-Z])/g, '$1 $2');
                              const val = Number(parts[1]);
                              const color = val > 0 ? '#8bdb46' : val < 0 ? '#e05050' : 'rgba(255,255,255,0.7)';
                              return (
                                <div key={`attr_${idx}`} style={{ display: 'flex', alignItems: 'center' }}>
                                  <span className="res-bldg-detail-label" style={{ marginRight: '8rem' }}>{label}</span>
                                  <span className="res-bldg-detail-value" style={{ color: getSafeColor(color), fontWeight: 700, marginLeft: '6rem' }}>{val > 0 ? `+${val}` : val}</span>
                                </div>
                              );
                            })}
                          </div>
                          {b.happinessFactors && (
                            <div className="res-bldg-detail-grid" style={{ marginTop: '10rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10rem' }}>
                              <div style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em', fontSize: '10rem', textTransform: 'uppercase', marginBottom: '4rem', gridColumn: '1 / -1' }}>Happiness Factors</div>
                              {b.happinessFactors && b.happinessFactors.split('^').map((factor, idx) => {
                                const parts = factor.split(':');
                                if (parts.length !== 2) return null;
                                const capitalizedLabel = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                                const label = capitalizedLabel.replace(/([a-z])([A-Z])/g, '$1 $2');
                                const displayLabel = EFF_FACTOR_LABELS[capitalizedLabel] || label;
                                const val = Number(parts[1]);
                                const color = val > 0 ? '#8bdb46' : val < 0 ? '#e05050' : 'rgba(255,255,255,0.7)';
                                return (
                                  <div key={`happ_${idx}`} style={{ display: 'flex', alignItems: 'center', width: 'auto', marginRight: '16rem' }}>
                                    <span className="res-bldg-detail-label" style={{ display: 'inline-flex', alignItems: 'center', marginRight: '8rem' }}>
                                      <img src={getEfficiencyFactorIcon(parts[0])} style={{ width: '18rem', height: '18rem', opacity: 0.7, marginRight: '6rem', flexShrink: 0 }} alt="" />
                                      {displayLabel}
                                    </span>
                                    <span className="res-bldg-detail-value" style={{ color: getSafeColor(color), fontWeight: 700, marginLeft: '6rem' }}>{val > 0 ? `+${val}` : val}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          { (b.cityEffects || b.localEffects) && (
                            <div className="res-bldg-detail-grid" style={{ marginTop: '10rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10rem', display: 'flex', flexDirection: 'column', gap: '4rem' }}>
                              {b.cityEffects && (
                                <>
                                  <div style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em', fontSize: '10rem', textTransform: 'uppercase', marginBottom: '4rem' }}>City Effects</div>
                                  {b.cityEffects.split('^').map((ef, i) => (
                                    <div key={`ce-${i}`} style={{ display: 'flex' }}>
                                      <span style={{ color: '#fff', fontSize: '12rem' }}>{ef}</span>
                                    </div>
                                  ))}
                                </>
                              )}
                              {b.localEffects && (
                                <>
                                  <div style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em', fontSize: '10rem', textTransform: 'uppercase', marginBottom: '4rem', marginTop: b.cityEffects ? '8rem' : '0' }}>Local Effects</div>
                                  {b.localEffects.split('^').map((ef, i) => (
                                    <div key={`le-${i}`} style={{ display: 'flex' }}>
                                      <span style={{ color: '#fff', fontSize: '12rem' }}>{ef}</span>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}

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

