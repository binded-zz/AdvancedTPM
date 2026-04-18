import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { trigger } from 'cs2/api';
import { Entity } from 'cs2/utils';
import './CompanyBrowser.css';

export interface CompanyVm {
  entityIndex: number;
  entityVersion: number;
  name: string;
  zoneType: string;
  resourceKey: string;
  profit: number;
  profitabilityTier: string;
  workers: number;
  maxWorkers: number;
  posX: number;
  posY: number;
  posZ: number;
  efficiency: number;
  inputResource1: string;
  inputResource2: string;
  taxRate: number;
  buildingLevel: number;
  efficiencyDetails: string;
  brandName: string;
  buildingAddress: string;
  happiness?: number;
  producesGarbage?: boolean;
  producesCrime?: boolean;
  producesMail?: boolean;
  needsElectricity?: boolean;
  needsWater?: boolean;
  isSignature?: boolean;
}

export interface CompanyHappinessMap {
  [key: string]: Record<string, number>;
}

// parseCompanies
// Parse a semicolon-separated payload produced by the server containing a compact
// representation of visible companies. Each chunk contains pipe-delimited fields
// matching the serialization performed in `CompanyBrowserSystem.SerializeCompanies`.
export const parseCompanies = (payload: string): CompanyVm[] => {
  if (!payload) return [];
  return payload
    .split(';')
    .map((chunk) => {
      const parts = chunk.split('|');
      if (parts.length < 11) return null;
      // optional trailing flags: happiness, garbage, crime, mail, electricity, water
      // serialization now appends numeric service metrics before the final isSignature flag
      const [entityPart, name, zoneType, resourceKey, profit, tier, workers, maxWorkers, px, py, pz, eff, in1, in2, taxR, bLevel, effDetails, brandName, bldgAddr, happiness, producesGarbage, producesCrime, producesMail, needsElectricity, needsWater, electricityConsumption, waterConsumption, garbageAccumulation, mailAccumulation, crimeProbability, isSignature] = parts;
      const [idx, ver] = (entityPart || '').split(',');
      return {
        entityIndex: Number(idx) || 0,
        entityVersion: Number(ver) || 0,
        name: name || 'Unknown',
        zoneType: zoneType || 'Unknown',
        resourceKey: resourceKey || '',
        profit: Number(profit) || 0,
        profitabilityTier: tier || 'Unknown',
        workers: Number(workers) || 0,
        maxWorkers: Number(maxWorkers) || 0,
        posX: Number(px) || 0,
        posY: Number(py) || 0,
        posZ: Number(pz) || 0,
        efficiency: Number(eff) || 100,
        inputResource1: in1 || '',
        inputResource2: in2 || '',
        taxRate: Number(taxR) || 0,
        buildingLevel: Number(bLevel) || 1,
        efficiencyDetails: effDetails || '',
        brandName: brandName || '',
        buildingAddress: bldgAddr || '',
        happiness: Number(happiness) || undefined,
        // Environmental & services flags
        producesGarbage: Number(producesGarbage) === 1,
        producesCrime: Number(producesCrime) === 1,
        producesMail: Number(producesMail) === 1,
        needsElectricity: Number(needsElectricity) === 1,
        needsWater: Number(needsWater) === 1,
        // numeric service metrics (may be 0 if unavailable)
        electricityConsumption: Number(electricityConsumption) || 0,
        waterConsumption: Number(waterConsumption) || 0,
        garbageAccumulation: Number(garbageAccumulation) || 0,
        mailAccumulation: Number(mailAccumulation) || 0,
        crimeProbability: Number(crimeProbability) || 0,
        isSignature: Number(isSignature) === 1,
      } as CompanyVm;
    })
    .filter((x): x is CompanyVm => x !== null);
};

// Parse a single-company happiness payload produced by CompanyHappinessSystem
export const parseCompanyHappinessPayload = (payload: string): [string, Record<string, number>] | null => {
  // payload shape: "entityIndex,entityVersion|key1:val1,key2:val2"
  if (!payload) return null;
  const parts = payload.split('|');
  if (parts.length < 2) return null;
  const key = parts[0];
  const pairs = parts[1].split(',').map(p => p.trim()).filter(p => p.length > 0);
  const map: Record<string, number> = {};
  pairs.forEach((pair) => {
    const [k, v] = pair.split(':');
    if (!k) return;
    const num = Number(v || 0);
    map[k] = isNaN(num) ? 0 : num;
  });
  return [key, map];
};

type SortField = 'name' | 'zoneType' | 'resourceKey' | 'profit' | 'profitabilityTier' | 'workers';
type SortDir = 'asc' | 'desc';

const ZONE_FILTERS = ['All', 'Industrial', 'Commercial', 'Office'];
const TIER_FILTERS = ['All', 'Profitable', 'GettingBy', 'BreakingEven', 'LosingMoney', 'Bankrupt'];

const TIER_ORDER: Record<string, number> = {
  Bankrupt: 0,
  LosingMoney: 1,
  BreakingEven: 2,
  GettingBy: 3,
  Profitable: 4,
  Unknown: -1,
};

const TIER_LABELS: Record<string, string> = {
  Bankrupt: 'Bankrupt',
  LosingMoney: 'Losing ₵',
  BreakingEven: 'Break Even',
  GettingBy: 'Getting By',
  Profitable: 'Profitable',
  Unknown: '—',
};

const TIER_COLORS: Record<string, string> = {
  Bankrupt: '#e05050',
  LosingMoney: '#e88c3a',
  BreakingEven: 'rgba(255,255,255,0.6)',
  GettingBy: '#8bdb46',
  Profitable: '#50b8e9',
  Unknown: 'rgba(255,255,255,0.3)',
};

const RESOURCE_ICON_BASE = 'Media/Game/Resources/';

// Mapping from our lowercase key to CS2's exact SVG filename (without .svg)
const RESOURCE_ICON_MAP: Record<string, string> = {
  grain: 'Grain', vegetables: 'Vegetables', cotton: 'Cotton', livestock: 'Livestock',
  fish: 'Fish', wood: 'Wood', ore: 'Ore', stone: 'Stone', coal: 'Coal', oil: 'Oil',
  food: 'Food', beverages: 'Beverages', conveniencefood: 'ConvenienceFood',
  textiles: 'Textiles', timber: 'Timber', paper: 'Paper', furniture: 'Furniture',
  metals: 'Metals', steel: 'Steel', minerals: 'Minerals', concrete: 'Concrete',
  machinery: 'Machinery', electronics: 'Electronics', vehicles: 'Vehicles',
  petrochemicals: 'Petrochemicals', plastics: 'Plastics', chemicals: 'Chemicals',
  pharmaceuticals: 'Pharmaceuticals', software: 'Software', telecom: 'Telecom',
  financial: 'Financial', media: 'Media', lodging: 'Lodging', meals: 'Meals',
  entertainment: 'Entertainment', recreation: 'Recreation',
};

const resourceIconName = (key: string): string => RESOURCE_ICON_MAP[key] || key;

const resourceLabel = (key: string): string => {
  if (!key) return '\u2014';
  const mapped = RESOURCE_ICON_MAP[key];
  if (mapped) return mapped.replace(/([a-z])([A-Z])/g, '$1 $2');
  return key.replace(/^c_/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase());
};

// Efficiency factor friendly labels (from Game.Buildings.EfficiencyFactor enum)
const EFF_FACTOR_LABELS: Record<string, string> = {
  Destroyed: 'Destroyed',
  Abandoned: 'Abandoned',
  Disabled: 'Disabled',
  Fire: 'On Fire',
  ServiceBudget: 'Service Budget',
  NotEnoughEmployees: 'Not Enough Employees',
  SickEmployees: 'Sick Employees',
  EmployeeHappiness: 'Employee Happiness',
  ElectricitySupply: 'Electricity Supply',
  ElectricityFee: 'Electricity Fee',
  WaterSupply: 'Water Supply',
  DirtyWater: 'Dirty Water',
  SewageHandling: 'Sewage',
  WaterFee: 'Water Fee',
  Garbage: 'Garbage Collection',
  Telecom: 'Telecom Coverage',
  Mail: 'Mail Service',
  MaterialSupply: 'Material Supply',
  WindSpeed: 'Wind Speed',
  WaterDepth: 'Water Depth',
  SunIntensity: 'Sun Intensity',
  NaturalResources: 'Natural Resources',
  CityModifierSoftware: 'City Software Bonus',
  CityModifierElectronics: 'City Electronics Bonus',
  CityModifierIndustrialEfficiency: 'Industrial Efficiency',
  CityModifierOfficeEfficiency: 'Office Efficiency',
  CityModifierHospitalEfficiency: 'Hospital Efficiency',
  SpecializationBonus: 'Specialization Bonus',
  CityModifierFishInput: 'Fish Input Bonus',
  CityModifierFishHub: 'Fish Hub Bonus',
  LackResources: 'Lacking Resources',
};

// Map efficiency factor enum names to CS2 built-in icon paths
const ICON_BASE = 'Media/Game/Icons/';
const RES_BASE = 'Media/Game/Resources/';
const EFF_FACTOR_ICONS: Record<string, string> = {
  Destroyed: `${ICON_BASE}FireSafety.svg`,
  Abandoned: `${ICON_BASE}Household.svg`,
  Disabled: `${ICON_BASE}Roads.svg`,
  Fire: `${ICON_BASE}FireSafety.svg`,
  ServiceBudget: `${ICON_BASE}Money.svg`,
  NotEnoughEmployees: `${ICON_BASE}Citizen.svg`,
  SickEmployees: `${ICON_BASE}Healthcare.svg`,
  EmployeeHappiness: `${ICON_BASE}Citizen.svg`,
  ElectricitySupply: `${ICON_BASE}Electricity.svg`,
  ElectricityFee: `${ICON_BASE}Electricity.svg`,
  WaterSupply: `${ICON_BASE}Water.svg`,
  DirtyWater: `${ICON_BASE}WaterPollution.svg`,
  SewageHandling: `${ICON_BASE}Water.svg`,
  WaterFee: `${ICON_BASE}Water.svg`,
  Garbage: `${ICON_BASE}Garbage.svg`,
  Telecom: `${RES_BASE}Telecom.svg`,
  Mail: `${ICON_BASE}PostService.svg`,
  MaterialSupply: `${ICON_BASE}ZoneIndustrial.svg`,
  WindSpeed: `${ICON_BASE}Electricity.svg`,
  WaterDepth: `${ICON_BASE}Water.svg`,
  SunIntensity: `${ICON_BASE}Electricity.svg`,
  NaturalResources: `${ICON_BASE}Fertility.svg`,
  CityModifierSoftware: `${RES_BASE}Software.svg`,
  CityModifierElectronics: `${RES_BASE}Electronics.svg`,
  CityModifierIndustrialEfficiency: `${ICON_BASE}ZoneIndustrial.svg`,
  CityModifierOfficeEfficiency: `${ICON_BASE}Economy.svg`,
  CityModifierHospitalEfficiency: `${ICON_BASE}Healthcare.svg`,
  SpecializationBonus: `${ICON_BASE}Trophy.svg`,
  CityModifierFishInput: `${RES_BASE}Fish.svg`,
  CityModifierFishHub: `${RES_BASE}Fish.svg`,
  LackResources: `${ICON_BASE}ZoneIndustrial.svg`,
};

interface EffFactor { name: string; label: string; change: number; cumulative: number; }

const parseEfficiencyDetails = (details: string): EffFactor[] => {
  if (!details) return [];
  return details.split(',').map((part) => {
    const segs = part.split(':');
    const name = segs[0] || '';
    const change = Number(segs[1]) || 0;
    const cumulative = Number(segs[2]) || 0;
    return { name, label: EFF_FACTOR_LABELS[name] || name, change, cumulative };
  }).filter((f) => f.name);
};

const effFactorColor = (change: number): string => {
  if (change > 0) return '#50b8e9'; // bonus
  if (change >= -10) return '#8bdb46'; // minor penalty
  if (change >= -30) return '#e88c3a'; // moderate penalty
  return '#e05050'; // severe penalty
};

interface CompanyBrowserProps {
  companies: CompanyVm[];
  happinessData?: string;
  // When true, component is rendered from the Signature Buildings view and
  // should show the prefab/building name in the address column instead of street address.
  isSignatureView?: boolean;
}

const CompanyBrowser: React.FC<CompanyBrowserProps> = ({ companies, happinessData, isSignatureView }) => {
  const [zoneFilter, setZoneFilter] = useState('All');
  const [tierFilter, setTierFilter] = useState('All');
  const [sortField, setSortField] = useState<SortField>('profit');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchText, setSearchText] = useState('');
  const [profitMin, setProfitMin] = useState(-100);
  const [profitMax, setProfitMax] = useState(100);
  // Building level is displayed per-row; level search removed for now
  const LEVEL_MIN_BOUND = 1;
  const LEVEL_MAX_BOUND = 5;
  const [expandedEntity, setExpandedEntity] = useState<number | null>(null);
  const [happinessMap, setHappinessMap] = useState<CompanyHappinessMap>({});
  const [happinessLoading, setHappinessLoading] = useState<Record<string, boolean>>({});

  // Proactively request lightweight environmental/service metrics for visible companies
  // to avoid blank/placeholder UI when the user expands rows. Request only a limited
  // number to avoid spamming the game (first 20 visible companies).
  useEffect(() => {
    if (!companies || companies.length === 0) return;
    const toRequest = [] as string[];
    for (let i = 0; i < Math.min(20, companies.length); i++) {
      const c = companies[i];
      const key = `${c.entityIndex},${c.entityVersion}`;
      if (!happinessMap[key] && !happinessLoading[key]) {
        toRequest.push(key);
      }
    }
    if (toRequest.length === 0) return;
    toRequest.forEach((k) => {
      setHappinessLoading((prev) => ({ ...prev, [k]: true }));
      try { trigger('taxProduction', 'requestCompanyHappiness', k); } catch { }
    });
  // companies intentionally used rather than filtered/sorted so requests target authoritative entities
  }, [companies]);

  // Merge incoming single-company happiness payloads into local map
  useEffect(() => {
    if (!happinessData) return;
    const parsed = parseCompanyHappinessPayload(happinessData);
    if (!parsed) return;
    const [key, map] = parsed;
    setHappinessMap((prev) => ({ ...prev, [key]: map }));
    setHappinessLoading((prev) => { const np = { ...prev }; delete np[key]; return np; });
  }, [happinessData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo(() => {
    let list = companies;
    if (zoneFilter !== 'All') {
      list = list.filter((c) => c.zoneType === zoneFilter);
    }
    if (tierFilter !== 'All') {
      list = list.filter((c) => c.profitabilityTier === tierFilter);
    }
    if (profitMin > -100 || profitMax < 100) {
      list = list.filter((c) => c.profit >= profitMin && c.profit <= profitMax);
    }
    // (no building level filter active)
    if (searchText) {
      const lower = searchText.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.resourceKey.toLowerCase().includes(lower) ||
          c.zoneType.toLowerCase().includes(lower)
      );
    }
    return list;
  }, [companies, zoneFilter, tierFilter, profitMin, profitMax, searchText]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'zoneType':
          return dir * a.zoneType.localeCompare(b.zoneType);
        case 'resourceKey':
          return dir * a.resourceKey.localeCompare(b.resourceKey);
        case 'profit':
          return dir * (a.profit - b.profit);
        case 'profitabilityTier':
          return dir * ((TIER_ORDER[a.profitabilityTier] ?? -1) - (TIER_ORDER[b.profitabilityTier] ?? -1));
        case 'workers':
          return dir * (a.workers - b.workers);
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const focusEntity = (c: CompanyVm) => {
    const entity: Entity = { index: c.entityIndex, version: c.entityVersion };
    trigger('camera', 'focusEntity', entity);
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  // --- Profit range slider helpers ---
  const PROFIT_MIN_BOUND = -100;
  const PROFIT_MAX_BOUND = 100;
  const profitTrackRef = useRef<HTMLDivElement>(null);
  const draggingThumb = useRef<'min' | 'max' | null>(null);


  const profitFromClientX = useCallback((clientX: number): number => {
    if (!profitTrackRef.current) return 0;
    const rect = profitTrackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(PROFIT_MIN_BOUND + pct * (PROFIT_MAX_BOUND - PROFIT_MIN_BOUND));
  }, []);

  const handleProfitMouseDown = useCallback((thumb: 'min' | 'max') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingThumb.current = thumb;
    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const val = profitFromClientX(ev.clientX);
      if (draggingThumb.current === 'min') {
        setProfitMin((prev) => Math.min(val, profitMax - 1));
      } else {
        setProfitMax((prev) => Math.max(val, profitMin + 1));
      }
    };
    const onUp = () => {
      draggingThumb.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [profitFromClientX, profitMin, profitMax]);

  // (no per-pixel level slider anymore)

  const handleProfitTrackClick = useCallback((e: React.MouseEvent) => {
    const val = profitFromClientX(e.clientX);
    const distMin = Math.abs(val - profitMin);
    const distMax = Math.abs(val - profitMax);
    if (distMin <= distMax) {
      setProfitMin(Math.min(val, profitMax - 1));
    } else {
      setProfitMax(Math.max(val, profitMin + 1));
    }
  }, [profitFromClientX, profitMin, profitMax]);
  const profitPctOf = (v: number) => ((v - PROFIT_MIN_BOUND) / (PROFIT_MAX_BOUND - PROFIT_MIN_BOUND)) * 100;

  const levelPctOf = (v: number) => ((v - LEVEL_MIN_BOUND) / (LEVEL_MAX_BOUND - LEVEL_MIN_BOUND)) * 100;

  // Using native scroll for company list — custom scrollbar removed to avoid conflicts

  // Summary stats
  const totalCount = filtered.length;
  const profitableCount = filtered.filter((c) => c.profitabilityTier === 'Profitable' || c.profitabilityTier === 'GettingBy').length;
  const bankruptCount = filtered.filter((c) => c.profitabilityTier === 'Bankrupt').length;
  const losingCount = filtered.filter((c) => c.profitabilityTier === 'LosingMoney').length;

  return (
    <div className="cb-container">
      {/* Filters */}
      <div className="cb-filters">
        <div className="cb-filter-rows">
          <div className="cb-zone-tabs">
            {ZONE_FILTERS.map((z) => (
              <button
                key={z}
                className={`cb-zone-tab${zoneFilter === z ? ' cb-zone-tab-active' : ''}`}
                onClick={() => setZoneFilter(z)}
              >
                {z}
              </button>
            ))}
          </div>
          <div className="cb-tier-tabs">
            {TIER_FILTERS.map((t) => (
              <button
                key={t}
                className={`cb-tier-tab${tierFilter === t ? ' cb-tier-tab-active' : ''}`}
                onClick={() => setTierFilter(t)}
              >
                {t === 'All' ? 'All Status' : (TIER_LABELS[t] || t)}
              </button>
            ))}
          </div>
        </div>

        <div className="cb-profit-filter">
          <span className="cb-profit-label">Profit %</span>
          <div className="cb-profit-slider-wrap">
            <span className="cb-profit-value">{profitMin}%</span>
            <div ref={profitTrackRef} className="cb-profit-track-area" onMouseDown={handleProfitTrackClick}>
              <div className="cb-profit-track" />
              <div className="cb-profit-range-fill" style={{ left: `${profitPctOf(profitMin)}%`, width: `${profitPctOf(profitMax) - profitPctOf(profitMin)}%` }} />
              <div className="cb-profit-thumb" style={{ left: `${profitPctOf(profitMin)}%` }} onMouseDown={handleProfitMouseDown('min')} />
              <div className="cb-profit-thumb" style={{ left: `${profitPctOf(profitMax)}%` }} onMouseDown={handleProfitMouseDown('max')} />
            </div>
            <span className="cb-profit-value">{profitMax}%</span>
          </div>
          <button className="cb-profit-reset" onClick={() => { setProfitMin(-100); setProfitMax(100); }}>Reset</button>
        </div>

        <div className="cb-search-box">
          <input
            className="cb-search-input"
            type="text"
            value={searchText}
            onInput={(e: any) => setSearchText(e.target.value || '')}
            placeholder="Search..."
          />
        </div>
      </div>

      {/* Summary */}
      <div className="cb-summary">
        <span className="cb-summary-total">{`${totalCount} companies`}</span>
        <span className="cb-summary-profitable" style={{ color: '#50b8e9' }}>{`${profitableCount} healthy`}</span>
        <span className="cb-summary-losing" style={{ color: '#e88c3a' }}>{`${losingCount} losing`}</span>
        <span className="cb-summary-bankrupt" style={{ color: '#e05050' }}>{`${bankruptCount} bankrupt`}</span>
      </div>

      {/* Table header */}
      <div className="cb-table-header">
        <div className="cb-col-name cb-sortable" onClick={() => handleSort('name')}>
          Company{sortIndicator('name')}
        </div>
        <div className="cb-col-address">
          {/* Label changes depending on view */}
          {isSignatureView ? 'Building' : 'Address'}
        </div>
        <div className="cb-col-zone cb-sortable" onClick={() => handleSort('zoneType')}>
          Zone Type{sortIndicator('zoneType')}
        </div>
        <div className="cb-col-resource cb-sortable" onClick={() => handleSort('resourceKey')}>
          Resource{sortIndicator('resourceKey')}
        </div>
        <div className="cb-col-profit cb-sortable" onClick={() => handleSort('profit')}>
          {'Profit\u00a0%' + sortIndicator('profit')}
        </div>
        <div className="cb-col-tax">
          Tax %
        </div>
        <div className="cb-col-happiness">
          Happiness
        </div>
        <div className="cb-col-tier cb-sortable" onClick={() => handleSort('profitabilityTier')}>
          Status{sortIndicator('profitabilityTier')}
        </div>
        <div className="cb-col-level">
          Lv
        </div>
        <div className="cb-col-locate">
          Locate
        </div>
      </div>

      {/* Company rows with custom scrollbar */}
      <div className="cb-table-scroll">
        <div className="cb-table-body">
          {sorted.length === 0 && (
            <div className="cb-empty">No companies found. Companies will appear once the game simulation is running.</div>
          )}
          {sorted.map((c, i) => {
            const isExpanded = expandedEntity === c.entityIndex;
            const rowClickHandler = (e: React.MouseEvent) => {
              // Toggle expansion only
              setExpandedEntity(isExpanded ? null : c.entityIndex);
              // Request detailed happiness factors from server when expanding
              if (!isExpanded) {
                const key = `${c.entityIndex},${c.entityVersion}`;
                setHappinessLoading((prev) => ({ ...prev, [key]: true }));
                trigger('taxProduction', 'requestCompanyHappiness', `${c.entityIndex},${c.entityVersion}`);
              }
            };
            const profitColor = c.profit < 0 ? '#e05050' : c.profit > 0 ? '#8bdb46' : 'rgba(255,255,255,0.5)';
            const tierColor = TIER_COLORS[c.profitabilityTier] || TIER_COLORS.Unknown;
            const workerPct = c.maxWorkers > 0 ? Math.round((c.workers / c.maxWorkers) * 100) : 0;
            const profitDescription = c.profit > 20 ? 'Very profitable — high tax tolerance'
              : c.profit > 5 ? 'Healthy — moderate tax tolerance'
              : c.profit > -5 ? 'Marginal — sensitive to tax changes'
              : c.profit > -20 ? 'Struggling — consider lowering taxes'
              : 'Critical — near bankruptcy, needs tax relief';
            return (
              <div key={c.entityIndex}>
                <div
                  className={`cb-row${i % 2 === 0 ? '' : ' cb-row-alt'}${isExpanded ? ' cb-row-expanded' : ''}`}
                  onClick={rowClickHandler}
                  title={isExpanded ? 'Click to collapse' : 'Click to expand details'}
                >
                  <div className="cb-col-name">
                    <span className="cb-expand-arrow">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                    <span className="cb-company-name">{c.brandName || c.name}</span>
                  </div>
                  <div className="cb-col-address">
                    <span className="cb-address-text">
                      {(() => {
                        // For signature view prefer a human-friendly prefab/building name.
                        // Heuristic: prefer buildingAddress if it looks like a street/address (contains spaces or digits),
                        // otherwise prefer the prefab name `c.name` if it seems human (no underscores),
                        // finally fall back to brandName or a dash.
                        if (isSignatureView) {
                          const addr = c.buildingAddress || '';
                          const prefab = c.name || '';
                          const brand = c.brandName || '';
                          const looksLikeAddress = /\d|\s/.test(addr) && addr.length > 1;
                          const prefabLooksHuman = prefab.length > 0 && !prefab.includes('_') && /[A-Za-z]/.test(prefab);
                          if (looksLikeAddress) return addr;
                          if (prefabLooksHuman) return prefab;
                          if (brand) return brand;
                          return '\u2014';
                        }
                        return c.buildingAddress || '\u2014';
                      })()}
                    </span>
                  </div>
                  <div className="cb-col-zone">
                    <span className={`cb-zone-badge cb-zone-${c.zoneType.toLowerCase()}`}>{c.zoneType}</span>
                  </div>
                  <div className="cb-col-resource">
                    {c.resourceKey && (
                      <img className="cb-resource-icon" src={`${RESOURCE_ICON_BASE}${resourceIconName(c.resourceKey)}.svg`} />
                    )}
                    <span>{resourceLabel(c.resourceKey)}</span>
                  </div>
                  <div className="cb-col-profit">
                    <span style={{ color: profitColor }}>
                      {`${c.profit > 0 ? '+' : ''}${c.profit}\u00a0%`}
                    </span>
                  </div>
                  <div className="cb-col-tax">
                    <span style={{ color: c.taxRate >= 10 ? '#e88c3a' : 'rgba(255,255,255,0.7)' }}>
                      {`${c.taxRate}\u00a0%`}
                    </span>
                  </div>
                  <div className="cb-col-happiness">
                    {(() => {
                      const eff = Math.max(0, c.efficiency || 100);
                      const profitVal = Math.max(-100, Math.min(100, c.profit || 0));
                      const staffPct = c.maxWorkers > 0 ? Math.round((c.workers / c.maxWorkers) * 100) : 0;
                      const tax = c.taxRate || 0;
                      const estimate = (typeof c.happiness === 'number')
                        ? c.happiness
                        : Math.max(0, Math.min(100, Math.round(50 + (eff - 100) * 0.2 + profitVal * 0.25 + (staffPct - 75) * 0.3 - Math.max(0, tax - 10) * 0.5)));
                      const color = estimate >= 75 ? '#8bdb46' : estimate >= 50 ? '#50b8e9' : estimate >= 30 ? '#e88c3a' : '#e05050';
                      return (
                        <span style={{ color, fontWeight: 800 }} title={`Estimated company happiness: ${estimate}`}>
                          {`${estimate}`}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="cb-col-tier">
                    <span style={{ color: tierColor }}>
                      {TIER_LABELS[c.profitabilityTier] || c.profitabilityTier}
                    </span>
                  </div>
                  <div className="cb-col-level">
                    <span className="cb-level-badge">Lv {c.buildingLevel}</span>
                  </div>
                  <div className="cb-col-locate">
                    <button
                      className="cb-locate-btn"
                      onClick={(e) => { e.stopPropagation(); focusEntity(c); }}
                      title="Focus camera on this company"
                    >
                      GO
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="cb-expanded-panel">
                    <div className="cb-detail-grid">
                      <div className="cb-detail-main">
                        {/* Company identity header */}
                        {(isSignatureView ? (c.name || c.brandName || c.buildingAddress) : (c.brandName || c.buildingAddress)) && (
                          <div className="cb-detail-header">
                            {isSignatureView
                              ? (c.name ? <span className="cb-detail-brand">{c.name}</span> : c.brandName ? <span className="cb-detail-brand">{c.brandName}</span> : null)
                              : (c.brandName ? <span className="cb-detail-brand">{c.brandName}</span> : null)}
                            {c.buildingAddress && <span className="cb-detail-address">{c.buildingAddress}</span>}
                          </div>
                        )}
                        {/* Profitability & Status */}
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Profitability</span>
                          <span className="cb-detail-value" style={{ color: profitColor }}>{`${c.profit > 0 ? '+' : ''}${c.profit}%`}</span>
                        </div>
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Status</span>
                          <span className="cb-detail-value" style={{ color: tierColor }}>{TIER_LABELS[c.profitabilityTier] || c.profitabilityTier}</span>
                        </div>
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Assessment</span>
                          <span className="cb-detail-value cb-detail-assessment" style={{ color: profitColor }}>{profitDescription}</span>
                        </div>

                        {/* Zone & Output Resource */}
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Zone</span>
                          <span className="cb-detail-value">{c.zoneType}</span>
                        </div>
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Output</span>
                          <span className="cb-detail-value">
                            {c.resourceKey && <img className="cb-resource-icon" src={`${RESOURCE_ICON_BASE}${resourceIconName(c.resourceKey)}.svg`} />}
                            {resourceLabel(c.resourceKey)}
                          </span>
                        </div>
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Tax Rate</span>
                          <span className="cb-detail-value" style={{ color: c.taxRate >= 10 ? '#e88c3a' : 'rgba(255,255,255,0.8)' }}>
                            {`${c.taxRate}%`}
                          </span>
                        </div>
                        {c.buildingLevel > 0 && (
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">Building Level</span>
                            <span className="cb-detail-value">
                              <span className="cb-building-level">
                                {[1,2,3,4,5].map((lv) => (
                                  <span key={lv} className={`cb-level-pip${lv <= c.buildingLevel ? ' cb-level-pip-filled' : ''}`} />
                                ))}
                              </span>
                              <span style={{ marginLeft: '6rem', color: 'rgba(255,255,255,0.7)' }}>Lv {c.buildingLevel}</span>
                            </span>
                          </div>
                        )}

                        {/* Input Resources */}
                        {(c.inputResource1 || c.inputResource2) && (
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">Inputs</span>
                            <span className="cb-detail-value">
                              {c.inputResource1 && (
                                <span className="cb-detail-input">
                                  <img className="cb-resource-icon" src={`${RESOURCE_ICON_BASE}${resourceIconName(c.inputResource1)}.svg`} />
                                  {resourceLabel(c.inputResource1)}
                                </span>
                              )}
                              {c.inputResource1 && c.inputResource2 && <span className="cb-detail-separator">{'\u00a0+\u00a0'}</span>}
                              {c.inputResource2 && (
                                <span className="cb-detail-input">
                                  <img className="cb-resource-icon" src={`${RESOURCE_ICON_BASE}${resourceIconName(c.inputResource2)}.svg`} />
                                  {resourceLabel(c.inputResource2)}
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {/* Workers */}
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Workers</span>
                          <span className="cb-detail-value">
                            {c.maxWorkers > 0 ? `${c.workers} / ${c.maxWorkers} (${workerPct}%)` : '\u2014'}
                          </span>
                        </div>
                        {c.maxWorkers > 0 && (
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">Staffing</span>
                            <div className="cb-detail-bar-wrap">
                              <div className="cb-detail-bar" style={{ width: `${workerPct}%`, background: workerPct >= 80 ? '#8bdb46' : workerPct >= 50 ? '#e88c3a' : '#e05050' }} />
                            </div>
                          </div>
                        )}

                        {/* Efficiency */}
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Efficiency</span>
                          <span className="cb-detail-value" style={{ color: c.efficiency >= 80 ? '#8bdb46' : c.efficiency >= 50 ? '#e88c3a' : '#e05050' }}>
                            {`${c.efficiency}%`}
                          </span>
                        </div>
                        <div className="cb-detail-row">
                          <span className="cb-detail-label" />
                          <div className="cb-detail-bar-wrap">
                            <div className="cb-detail-bar" style={{ width: `${c.efficiency}%`, background: c.efficiency >= 80 ? '#8bdb46' : c.efficiency >= 50 ? '#e88c3a' : '#e05050' }} />
                          </div>
                        </div>
                      </div>

                      <div className="cb-detail-middle">
                        <div className="cb-detail-divider" />
                        <div className="cb-detail-section-title">Efficiency Factors</div>
                        {(() => {
                          const factors: { label: string; status: string; color: string; level: string; icon?: string; factorName?: string }[] = [];
                          // Staffing factor
                          if (c.maxWorkers > 0) {
                            factors.push(workerPct >= 80
                              ? { label: 'Staffing', status: `${workerPct}% — Well staffed`, color: '#8bdb46', level: 'good', factorName: 'NotEnoughEmployees' }
                              : workerPct >= 50
                              ? { label: 'Staffing', status: `${workerPct}% — Understaffed`, color: '#e88c3a', level: 'warn', factorName: 'NotEnoughEmployees' }
                              : { label: 'Staffing', status: `${workerPct}% — Critical`, color: '#e05050', level: 'bad', factorName: 'NotEnoughEmployees' });
                          }
                          // Profitability factor
                          factors.push(c.profit > 5
                            ? { label: 'Profitability', status: `${c.profit > 0 ? '+' : ''}${c.profit}% — Healthy`, color: '#8bdb46', level: 'good', factorName: 'ServiceBudget' }
                            : c.profit > -5
                            ? { label: 'Profitability', status: `${c.profit > 0 ? '+' : ''}${c.profit}% — Marginal`, color: '#e88c3a', level: 'warn', factorName: 'ServiceBudget' }
                            : { label: 'Profitability', status: `${c.profit}% — Losing`, color: '#e05050', level: 'bad', factorName: 'ServiceBudget' });
                          // Real efficiency factors from game data
                          const effFactors = parseEfficiencyDetails(c.efficiencyDetails);
                          effFactors.forEach((ef) => {
                            const col = effFactorColor(ef.change);
                            const lvl = ef.change > 0 ? 'good' : ef.change >= -10 ? 'good' : ef.change >= -30 ? 'warn' : 'bad';
                            const sign = ef.change > 0 ? '+' : '';
                            factors.push({ label: ef.label, status: `${sign}${ef.change}%  ${ef.cumulative}%`, color: col, level: lvl, factorName: ef.name });
                          });
                          // If no efficiency issues, show all-clear
                          if (effFactors.length === 0 && c.efficiency >= 95) {
                            factors.push({ label: 'All Systems', status: 'Operating normally', color: '#8bdb46', level: 'good', factorName: 'SpecializationBonus' });
                          }
                          return factors.map((f, fi) => {
                            const iconSrc = f.factorName ? EFF_FACTOR_ICONS[f.factorName] : undefined;
                            return (
                              <div key={fi} className="cb-detail-row cb-factor-row">
                                <span className="cb-detail-label">
                                  {iconSrc && <img className="cb-factor-icon" src={iconSrc} />}
                                  {f.label}
                                </span>
                                <span className="cb-detail-value">
                                  <span className={`cb-factor-dot cb-factor-${f.level}`} />
                                  <span style={{ color: f.color }}>{f.status}</span>
                                </span>
                              </div>
                            );
                          });
                        })()}

                        {/* Happiness summary moved here from right column */}
                        <div className="cb-happiness-summary">
                          {(() => {
                            const eff = Math.max(0, c.efficiency || 100);
                            const profit = Math.max(-100, Math.min(100, c.profit || 0));
                            const staffPct = workerPct;
                            const tax = c.taxRate || 0;
                            const estimate = (typeof c.happiness === 'number') ? c.happiness : Math.max(0, Math.min(100, Math.round(50 + (eff - 100) * 0.2 + profit * 0.25 + (staffPct - 75) * 0.3 - Math.max(0, tax - 10) * 0.5)));
                            const color = estimate >= 75 ? '#8bdb46' : estimate >= 50 ? '#50b8e9' : estimate >= 30 ? '#e88c3a' : '#e05050';
                            return (
                              <div>
                                <div className="cb-happiness-score" style={{ color }}>
                                  <div className="cb-happiness-number">{estimate}</div>
                                  <div className="cb-happiness-label">Company Happiness</div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Health & other issues parsed from efficiency details */}
                        <div className="cb-detail-divider" />
                        <div className="cb-detail-section-title">Health & Other Issues</div>
                        {(() => {
                          const effFactors = parseEfficiencyDetails(c.efficiencyDetails);
                          const issues = effFactors.filter((ef) => ef.change < 0 || ['SickEmployees', 'HealthProblem', 'Garbage', 'Fire', 'Destroyed', 'Abandoned'].includes(ef.name));
                          if (issues.length === 0) {
                            return <div className="cb-detail-row"><span className="cb-detail-label" /> <span className="cb-detail-value">None reported</span></div>;
                          }
                          return issues.map((ef, ii) => (
                            <div key={ii} className="cb-detail-row">
                              <span className="cb-detail-label">{ef.label}</span>
                              <span className="cb-detail-value" style={{ color: effFactorColor(ef.change) }}>{`${ef.change > 0 ? '+' : ''}${ef.change}%  (${ef.cumulative}%)`}</span>
                            </div>
                          ));
                        })()}
                      </div>

                      <div className="cb-detail-factors">
                      <div className="cb-detail-divider" />
                      <div className="cb-detail-section-title">Environmental & Services</div>
                      {(() => {
                        const rows = [] as JSX.Element[];
                        const key = `${c.entityIndex},${c.entityVersion}`;
                        const factors = happinessMap[key];

                        // Electricity
                        if (happinessLoading[key] && !factors) {
                          rows.push(
                            <div className="cb-detail-row" key="elec-loading">
                              <span className="cb-detail-label">Electricity</span>
                              <span className="cb-detail-value">Loading...</span>
                            </div>
                          );
                        } else if (factors && typeof factors.electricitySupply === 'number') {
                          rows.push(
                            <div className="cb-detail-row" key="elec">
                              <span className="cb-detail-label">Electricity</span>
                              <span className="cb-detail-value" style={{ color: factors.electricitySupply >= 0 ? '#8bdb46' : '#e05050' }}>{factors.electricitySupply.toFixed(1)}</span>
                            </div>
                          );
                        } else {
                          rows.push(
                            <div className="cb-detail-row" key="elec">
                              <span className="cb-detail-label">Electricity</span>
                              <span className="cb-detail-value">{c.needsElectricity ? 'Required' : '—'}</span>
                            </div>
                          );
                        }

                        // Water
                        if (factors && typeof factors.waterSupply === 'number') {
                          rows.push(
                            <div className="cb-detail-row" key="water">
                              <span className="cb-detail-label">Water</span>
                              <span className="cb-detail-value" style={{ color: factors.waterSupply >= 0 ? '#8bdb46' : '#e05050' }}>{factors.waterSupply.toFixed(1)}</span>
                            </div>
                          );
                        } else {
                          rows.push(
                            <div className="cb-detail-row" key="water">
                              <span className="cb-detail-label">Water</span>
                              <span className="cb-detail-value">{c.needsWater ? 'Required' : '—'}</span>
                            </div>
                          );
                        }

                        // Garbage
                        if (factors && typeof factors.garbage === 'number') {
                          rows.push(
                            <div className="cb-detail-row" key="garbage">
                              <span className="cb-detail-label">Garbage</span>
                              <span className="cb-detail-value" style={{ color: factors.garbage < 0 ? '#e88c3a' : 'rgba(255,255,255,0.7)' }}>{factors.garbage.toFixed(1)}</span>
                            </div>
                          );
                        } else if (factors && typeof factors.garbageAccumulation === 'number') {
                          rows.push(
                            <div className="cb-detail-row" key="garbage-acc">
                              <span className="cb-detail-label">Garbage</span>
                              <span className="cb-detail-value" style={{ color: '#e88c3a' }}>{factors.garbageAccumulation.toFixed(1)}</span>
                            </div>
                          );
                        } else {
                          rows.push(
                            <div className="cb-detail-row" key="garbage">
                              <span className="cb-detail-label">Garbage</span>
                              <span className="cb-detail-value" style={{ color: c.producesGarbage ? '#e88c3a' : 'rgba(255,255,255,0.7)' }}>{c.producesGarbage ? 'Produced' : 'None'}</span>
                            </div>
                          );
                        }

                        // Crime
                        if (factors && typeof factors.crime === 'number') {
                          rows.push(
                            <div className="cb-detail-row" key="crime">
                              <span className="cb-detail-label">Crime</span>
                              <span className="cb-detail-value" style={{ color: factors.crime < 0 ? '#e05050' : 'rgba(255,255,255,0.7)' }}>{factors.crime.toFixed(1)}</span>
                            </div>
                          );
                        } else if (factors && typeof factors.crimeProbability === 'number') {
                          rows.push(
                            <div className="cb-detail-row" key="crime-prob">
                              <span className="cb-detail-label">Crime</span>
                              <span className="cb-detail-value" style={{ color: factors.crimeProbability > 0 ? '#e05050' : 'rgba(255,255,255,0.7)' }}>{factors.crimeProbability.toFixed(1)}</span>
                            </div>
                          );
                        } else {
                          rows.push(
                            <div className="cb-detail-row" key="crime">
                              <span className="cb-detail-label">Crime</span>
                              <span className="cb-detail-value" style={{ color: c.producesCrime ? '#e05050' : 'rgba(255,255,255,0.7)' }}>{c.producesCrime ? 'Present' : 'None'}</span>
                            </div>
                          );
                        }

                        // Mail
                        if (factors && typeof factors.mail === 'number') {
                          rows.push(
                            <div className="cb-detail-row" key="mail">
                              <span className="cb-detail-label">Mail</span>
                              <span className="cb-detail-value">{factors.mail.toFixed(1)}</span>
                            </div>
                          );
                        } else {
                          rows.push(
                            <div className="cb-detail-row" key="mail">
                              <span className="cb-detail-label">Mail</span>
                              <span className="cb-detail-value">{c.producesMail ? 'Sent' : '—'}</span>
                            </div>
                          );
                        }

                        // Additional environmental factors if present
                        if (factors) {
                          const extraKeys = ['telecom', 'airPollution', 'groundPollution', 'noise', 'healthcare', 'education', 'entertainment', 'welfare', 'leisure', 'taxEffects', 'electricityFee', 'waterFee'];
                          extraKeys.forEach((k) => {
                            if (typeof factors[k] === 'number') {
                              rows.push(
                                <div className="cb-detail-row" key={k}>
                                  <span className="cb-detail-label">{k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
                                  <span className="cb-detail-value">{factors[k].toFixed(1)}</span>
                                </div>
                              );
                            }
                          });
                        }

                        return rows;
                      })()}
                        </div>
                      </div>

                    <div className="cb-detail-actions">
                      <button className="cb-detail-go-btn" onClick={(e) => { e.stopPropagation(); focusEntity(c); }}>Go to Building</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CompanyBrowser;
