import React, { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
// React hooks are provided by the environment. Do not import to avoid duplicate type declarations.
import { trigger } from 'cs2/api';
import { Entity } from 'cs2/utils';
import { resourceCategories } from '../data/resourceTaxonomy';
import ServiceIcon from '../assets/ServiceIcon';
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
  serviceCategory?: string;
  capacity?: number;
  coverage?: number;
  budgetPercent?: number;
  feePercent?: number;
  district?: string;
  theme?: string;
  assetPack?: string;
  companyKind?: string;
  electricityConsumption?: number;
  waterConsumption?: number;
  garbageAccumulation?: number;
  mailAccumulation?: number;
  crimeProbability?: number;
}

const isRawResource = (resourceKey: string): boolean => {
  if (!resourceKey) return false;
  const k = resourceKey.toLowerCase();
  return ['grain', 'vegetables', 'cotton', 'livestock', 'fish', 'wood', 'ore', 'stone', 'coal', 'oil'].includes(k);
};

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
      // The backend SerializeCompanies outputs up to 36 fields:
      // index, version, name, zoneType, resourceKey, profit, tier, workers, maxWorkers, px, py, pz, eff,
      // in1, in2, taxR, bLevel, effDetails, brandName, bldgAddr, happiness, producesGarbage, producesCrime,
      // producesMail, needsElectricity, needsWater, electricityConsumption, waterConsumption, garbageAccumulation,
      // mailAccumulation, crimeProbability, district, theme, assetPack, companyKind, isSignature

      const getVal = (idx: number) => parts[idx] || '';

      const entityPart = getVal(0);
      const name = getVal(1);
      const zoneType = getVal(2);
      const resourceKey = getVal(3);
      const profit = getVal(4);
      const tier = getVal(5);
      const workers = getVal(6);
      const maxWorkers = getVal(7);
      const px = getVal(8);
      const py = getVal(9);
      const pz = getVal(10);
      const eff = getVal(11);
      const in1 = getVal(12);
      const in2 = getVal(13);
      const taxR = getVal(14);
      const bLevel = getVal(15);
      const effDetails = getVal(16);
      const brandName = getVal(17);
      const bldgAddr = getVal(18);
      const happiness = getVal(19);
      const producesGarbage = getVal(20);
      const producesCrime = getVal(21);
      const producesMail = getVal(22);
      const needsElectricity = getVal(23);
      const needsWater = getVal(24);
      const electricityConsumption = getVal(25);
      const waterConsumption = getVal(26);
      const garbageAccumulation = getVal(27);
      const mailAccumulation = getVal(28);
      const crimeProbability = getVal(29);
      const district = getVal(30);
      const theme = getVal(31);
      const assetPack = getVal(32);
      const companyKind = getVal(33);
      const isSignature = getVal(34);

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
        happiness: happiness !== '' ? Number(happiness) : undefined,
        producesGarbage: Number(producesGarbage) === 1,
        producesCrime: Number(producesCrime) === 1,
        producesMail: Number(producesMail) === 1,
        needsElectricity: Number(needsElectricity) === 1,
        needsWater: Number(needsWater) === 1,
        electricityConsumption: Number(electricityConsumption) || 0,
        waterConsumption: Number(waterConsumption) || 0,
        garbageAccumulation: Number(garbageAccumulation) || 0,
        mailAccumulation: Number(mailAccumulation) || 0,
        crimeProbability: Number(crimeProbability) || 0,
        district: district || 'City',
        theme: theme || 'USA',
        assetPack: assetPack || 'Base Game',
        companyKind: companyKind || zoneType || 'Unknown',
        isSignature: Number(isSignature) === 1,
      } as CompanyVm;
    })
    .filter((x): x is CompanyVm => x !== null);
};

const CycleFilterButton: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => {
  const safeOptions = options.length > 0 ? options : ['All'];
  const currentIndex = Math.max(0, safeOptions.indexOf(value));
  const nextValue = () => onChange(safeOptions[(currentIndex + 1) % safeOptions.length]);

  const isResource = label === 'Resource';

  return (
    <button
      type="button"
      className="cb-cycle-btn"
      onClick={nextValue}
      title={`${label}: ${value}. Click to cycle.`}
      style={{ display: 'flex', alignItems: 'center' }}
    >
      {isResource && value !== 'All' ? (
        <img src={resourceIconSrc(value)} alt="" style={{ width: '14rem', height: '14rem', marginRight: '4rem' }} />
      ) : null}
      <span style={{ fontSize: '11rem' }}>
        {value === 'All' ? `All ${label}s` : (isResource ? resourceLabel(value) : value)}
      </span>
    </button>
  );
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

type SortField = 'name' | 'zoneType' | 'resourceKey' | 'profit' | 'profitabilityTier' | 'workers' | 'tax' | 'happiness' | 'lv';
type SortDir = 'asc' | 'desc';

const ZONE_FILTERS = ['All', 'RawIndustrial', 'Industrial', 'Storage', 'Commercial', 'Office'];
const ZONE_LABELS: Record<string, string> = {
  All: 'All',
  RawIndustrial: 'Raw Industrial',
  Industrial: 'Industrial',
  Storage: 'Storage',
  Commercial: 'Commercial',
  Office: 'Office',
};
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
const RESOURCE_STAGE_MAP: Record<string, string> = resourceCategories.reduce((acc, cat) => {
  cat.resources.forEach((r: { key: string; stage: string }) => { acc[r.key] = r.stage; });
  return acc;
}, {} as Record<string, string>);

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

export const resourceIconName = (key: string): string => {
  if (RESOURCE_ICON_MAP[key]) return RESOURCE_ICON_MAP[key];
  // Commercial goods use c_ prefix but same icon as base resource
  if (key && key.startsWith('c_') && RESOURCE_ICON_MAP[key.slice(2)]) return RESOURCE_ICON_MAP[key.slice(2)];
  return key;
};
export const resourceIconSrc = (key: string): string =>
  key === 'All' ? 'Media/Game/Icons/Economy.svg' : `${RESOURCE_ICON_BASE}${resourceIconName(key)}.svg`;

const ZONE_BADGE_LABELS: Record<string, string> = {
  RawIndustrial: 'RAW IND',
  Industrial: 'INDUST',
  Storage: 'STORAGE',
  Commercial: 'COMMERC',
  Office: 'OFFICE',
};

const serviceIcon = (c: string): string | null => {
  if (c.includes('garbage') || c.includes('waste') || c.includes('landfill') || c.includes('recycling')) return 'Media/Game/Icons/Garbage.svg';
  if (c.includes('park') || c.includes('recreation') || c.includes('leisure')) return 'Media/Game/Icons/ParkAndRecreation.svg';
  if (c.includes('telecom') || c.includes('internet')) return 'Media/Game/Resources/Telecom.svg';
  return null;
};

const resourceStageForZone = (zone: string): string | null => {
  switch (zone) {
    case 'RawIndustrial': return 'RawResource';
    case 'Industrial': return 'Industrial';
    case 'Commercial': return 'Commercial';
    case 'Office': return 'Immaterial';
    default: return null;
  }
};

export const resourceLabel = (key: string): string => {
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
  // Optional toggle used by some parent panels to hide/show additional filters
  showFilters?: boolean;
}

const CompanyBrowser: React.FC<CompanyBrowserProps> = ({ companies = [], happinessData = '', isSignatureView }) => {
  const safeCompanies = Array.isArray(companies) ? companies : [];
  const [zoneFilter, setZoneFilter] = useState('All');
  const [tierFilter, setTierFilter] = useState('All');
  const [resourceFilter, setResourceFilter] = useState('All');
  const [packFilter, setPackFilter] = useState('All');
  const [themeFilter, setThemeFilter] = useState('All');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [kindFilter, setKindFilter] = useState('All');
  const [sortField, setSortField] = useState<SortField>('profit');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchText, setSearchText] = useState('');
  const [profitMin, setProfitMin] = useState(-100);
  const [profitMax, setProfitMax] = useState(100);
  // Building level is displayed per-row; level search removed for now
  const LEVEL_MIN_BOUND = 1;
  const LEVEL_MAX_BOUND = 5;
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const [happinessMap, setHappinessMap] = useState<CompanyHappinessMap>({});
  const [happinessLoading, setHappinessLoading] = useState<Record<string, boolean>>({});
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Scroll to top and clear expansion when filters or sort changes so users see results
  useEffect(() => {
    try { if (bodyRef.current) bodyRef.current.scrollTop = 0; } catch { }
    setExpandedEntity(null);
  }, [zoneFilter, tierFilter, resourceFilter, packFilter, themeFilter, districtFilter, kindFilter, searchText]);

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

  const uniqueResources = useMemo(
    () => ['All', ...Array.from(new Set(safeCompanies.map((c) => c.resourceKey).filter((k): k is string => !!k))).sort()],
    [safeCompanies]
  );

  const visibleResourceFilters = useMemo(() => {
    // Collect all resources currently present in the filtered view
    const availableKeys = new Set(
      safeCompanies
        .filter(c => zoneFilter === 'All' || c.zoneType === zoneFilter)
        .map(c => c.resourceKey)
        .filter(Boolean)
    );

    // Group them by their icon name
    const groups: Record<string, { icon: string, label: string, keys: string[] }> = {};
    availableKeys.forEach(key => {
      const icon = resourceIconName(key);
      const label = resourceLabel(key);
      if (!groups[icon]) {
        groups[icon] = { icon, label, keys: [] };
      }
      groups[icon].keys.push(key);
    });

    return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label));
  }, [zoneFilter, safeCompanies]);

  const visibleKindFilters = useMemo(() => {
    if (zoneFilter === 'All') return ['All'];
    const kinds = new Set(
      safeCompanies
        .filter(c => c.zoneType === zoneFilter)
        .map(c => c.companyKind)
        .filter((k): k is string => !!k)
    );
    const arr = Array.from(kinds).sort();
    if (arr.length <= 1 && arr[0] === zoneFilter) return ['All'];
    return ['All', ...arr];
  }, [zoneFilter, safeCompanies]);

  useEffect(() => {
    if (visibleResourceFilters.length === 0) {
      if (resourceFilter !== 'All') setResourceFilter('All');
      return;
    }
    if (resourceFilter !== 'All' && !visibleResourceFilters.some(g => g.icon === resourceFilter)) {
      setResourceFilter('All');
    }
    if (!visibleKindFilters.includes(kindFilter)) {
      setKindFilter('All');
    }
  }, [visibleResourceFilters, resourceFilter, visibleKindFilters, kindFilter]);

  const filtered = useMemo(() => {
    let list = safeCompanies;
    if (packFilter !== 'All') {
      list = list.filter((c) => String(c.assetPack || 'Base Game').trim() === packFilter.trim());
    }
    if (zoneFilter !== 'All') {
      list = list.filter((c) => String(c.zoneType || '').trim() === zoneFilter.trim());
    }
    if (themeFilter !== 'All') {
      list = list.filter((c) => String(c.theme || 'USA').trim() === themeFilter.trim());
    }
    if (districtFilter !== 'All') {
      list = list.filter((c) => String(c.district || 'City').trim() === districtFilter.trim());
    }
    if (kindFilter !== 'All') {
      list = list.filter((c) => String(c.companyKind || '').trim() === kindFilter.trim());
    }
    if (resourceFilter !== 'All') {
      list = list.filter((c) => resourceIconName(c.resourceKey || '') === resourceFilter);
    }
    if (tierFilter !== 'All') {
      list = list.filter((c) => String(c.profitabilityTier || '').trim() === tierFilter.trim());
    }
    if (profitMin > -100 || profitMax < 100) {
      list = list.filter((c) => c.profit >= profitMin && c.profit <= profitMax);
    }
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
  }, [companies, zoneFilter, resourceFilter, tierFilter, packFilter, themeFilter, districtFilter, kindFilter, profitMin, profitMax, searchText]);

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
        case 'tax':
          return dir * ((a.taxRate || 0) - (b.taxRate || 0));
        case 'happiness': {
          const compute = (c: CompanyVm) => {
            const eff = Math.max(0, c.efficiency || 100);
            const profitVal = Math.max(-100, Math.min(100, c.profit || 0));
            const staffPct = c.maxWorkers > 0 ? Math.round((c.workers / c.maxWorkers) * 100) : 0;
            const tax = c.taxRate || 0;
            return typeof c.happiness === 'number'
              ? c.happiness
              : Math.max(0, Math.min(100, Math.round(50 + (eff - 100) * 0.2 + profitVal * 0.25 + (staffPct - 75) * 0.3 - Math.max(0, tax - 10) * 0.5)));
          };
          return dir * (compute(a) - compute(b));
        }
        case 'lv':
          return dir * ((a.buildingLevel || 0) - (b.buildingLevel || 0));
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
  const healthyCount = filtered.filter((c) => c.profitabilityTier === 'Profitable' || c.profitabilityTier === 'GettingBy').length;
  const losingCount = filtered.filter((c) => c.profitabilityTier === 'LosingMoney' || c.profitabilityTier === 'BreakingEven').length;
  const bankruptCount = filtered.filter((c) => c.profitabilityTier === 'Bankrupt').length;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startTop = useRef(0);

  const updateScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight <= clientHeight) {
      setShowScrollbar(false);
      return;
    }
    setShowScrollbar(true);
    const ratio = clientHeight / scrollHeight;
    setThumbHeight(Math.max(20, clientHeight * ratio));
    setThumbTop((scrollTop / scrollHeight) * clientHeight);
  }, []);

  useLayoutEffect(() => {
    updateScroll();
    const el = scrollRef.current;
    if (el) {
      const obs = new ResizeObserver(updateScroll);
      obs.observe(el);
      return () => obs.disconnect();
    }
  }, [sorted, updateScroll]);

  const onScroll = () => updateScroll();

  const onThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startTop.current = thumbTop;
    const onMove = (ev: MouseEvent) => {
      if (!scrollRef.current) return;
      const delta = ev.clientY - startY.current;
      const { scrollHeight, clientHeight } = scrollRef.current;
      const newTop = Math.max(0, Math.min(clientHeight - thumbHeight, startTop.current + delta));
      scrollRef.current.scrollTop = (newTop / clientHeight) * scrollHeight;
    };
    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="cb-container">
      {/* Filters */}
      <div className="cb-filters-vertical">
        {/* Row 1: Zone selection and Status pills */}
        <div className="cb-filter-row">
          <div className="cb-zone-tabs">
            {ZONE_FILTERS.map((z) => (
              <button
                key={z}
                className={`cb-zone-tab${zoneFilter === z ? ' cb-zone-tab-active' : ''}`}
                onClick={() => setZoneFilter(z)}
                title={ZONE_LABELS[z] || z}
              >
                {z === 'All' ? <ServiceIcon category="Other" size={26} /> : <ServiceIcon category={z} size={26} />}
              </button>
            ))}
          </div>
          <div className="cb-tier-tabs" style={{ marginLeft: '12rem' }}>
            {TIER_FILTERS.map((t) => (
              <button
                key={t}
                className={`cb-tier-tab${tierFilter === t ? ' cb-tier-tab-active' : ''}`}
                onClick={() => setTierFilter(t)}
              >
                {t === 'All' ? 'ALL' : (TIER_LABELS[t] || t)}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Secondary Filters (Pack, Theme, District, Profit, Resource) */}
        <div className="cb-filter-row cb-filter-row-mixed">
          <CycleFilterButton label="Pack" value={packFilter} options={['All', ...Array.from(new Set(safeCompanies.map(c => c.assetPack || 'Base Game'))).sort()]} onChange={setPackFilter} />
          <CycleFilterButton label="Theme" value={themeFilter} options={['All', 'USA', 'EU']} onChange={setThemeFilter} />
          <CycleFilterButton label="District" value={districtFilter} options={['All', ...Array.from(new Set(safeCompanies.map(c => c.district || 'City'))).sort()]} onChange={setDistrictFilter} />
          <div className="cb-resource-row-wrap" style={{ flex: '1 1 100%', marginTop: '4rem' }}>
            <div className="cb-dynamic-filter-row">
              <button
                className={`cb-filter-pill${resourceFilter === 'All' ? ' cb-filter-pill-active' : ''}`}
                onClick={() => setResourceFilter('All')}
                title="All Resources"
              >
                All
              </button>
              {visibleResourceFilters.map((group) => (
                <button
                  key={group.icon}
                  className={`cb-filter-pill${resourceFilter === group.icon ? ' cb-filter-pill-active' : ''}`}
                  onClick={() => setResourceFilter(resourceFilter === group.icon ? 'All' : group.icon)}
                  title={group.label}
                  style={{ padding: '2rem 4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <img src={`${RESOURCE_ICON_BASE}${group.icon}.svg`} className="cb-resource-tab-icon" style={{ width: '26rem', height: '26rem', margin: '2rem' }} />
                </button>
              ))}
            </div>
          </div>

          <div className="cb-profit-filter" style={{ marginLeft: '8rem' }}>
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
          <span className="cb-summary-count" style={{ marginLeft: '12rem', fontSize: '11rem', opacity: 0.6 }}>{sorted.length} results</span>
        </div>
      </div>

      {/* Summary */}
      <div className="cb-summary">
        <span className="cb-summary-total" style={{ marginRight: '16rem' }}>{`${totalCount} total`}</span>
        <span className="cb-summary-profitable" style={{ color: '#8bdb46', marginRight: '16rem' }}>{`${healthyCount} healthy`}</span>
        <span className="cb-summary-losing" style={{ color: '#e88c3a', marginRight: '16rem' }}>{`${losingCount} struggling`}</span>
        <span className="cb-summary-bankrupt" style={{ color: '#e05050', marginRight: '16rem' }}>{`${bankruptCount} bankrupt`}</span>
      </div>

      {/* Company rows with custom scrollbar */}
      <div className="cb-table-scroll">
        <div className="cb-table-header">
          <div className="cb-col-name cb-sortable" onClick={() => handleSort('name')}>
            Company{sortIndicator('name')}
          </div>
          <div className="cb-col-address">
            {isSignatureView ? 'Building' : 'Zone Density'}
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
            <div className="cb-sortable" onClick={() => handleSort('tax')}>Tax %{sortIndicator('tax')}</div>
          </div>
          <div className="cb-col-happiness">
            <div className="cb-sortable" onClick={() => handleSort('happiness')}>Happiness{sortIndicator('happiness')}</div>
          </div>
          <div className="cb-col-tier cb-sortable" onClick={() => handleSort('profitabilityTier')}>
            Status{sortIndicator('profitabilityTier')}
          </div>
          <div className="cb-col-level">
            <div className="cb-sortable" onClick={() => handleSort('lv')}>Lv{sortIndicator('lv')}</div>
          </div>
          <div className="cb-col-locate">
            Locate
          </div>
        </div>
        <div ref={scrollRef} className="cb-body" onScroll={onScroll}>
          {showScrollbar && (
            <div className="cb-scrollbar-track">
              <div
                className="cb-scrollbar-thumb"
                style={{ height: `${thumbHeight}rem`, top: `${thumbTop}rem` }}
                onMouseDown={onThumbMouseDown}
              />
            </div>
          )}
          {sorted.length === 0 && (
            <div className="cb-empty">No companies found. Companies will appear once the game simulation is running.</div>
          )}
          {sorted.slice(0, 400).map((c, i) => {
            const compKey = `${c.entityIndex},${c.entityVersion}`;
            const isExpanded = expandedEntity === compKey;
            const rowClickHandler = (e: React.MouseEvent) => {
              setExpandedEntity(isExpanded ? null : compKey);
              if (!isExpanded) {
                setHappinessLoading((prev) => ({ ...prev, [compKey]: true }));
                trigger('taxProduction', 'requestCompanyHappiness', compKey);
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
              <div key={`${c.entityIndex}-${c.entityVersion}`}>
                <div
                  className={`cb-row${i % 2 === 0 ? '' : ' cb-row-alt'}${isExpanded ? ' cb-row-expanded' : ''}`}
                  onMouseDown={(e: React.MouseEvent) => {
                    if (e.button !== 0) return;
                    const tgt = e.target as HTMLElement;
                    if (tgt && tgt.closest && tgt.closest('.cb-locate-btn')) return;
                    rowClickHandler(e);
                  }}
                  title={isExpanded ? 'Click to collapse' : 'Click to expand details'}
                >
                  <div className="cb-col-name">
                    <span className="cb-expand-arrow">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                    <span className="cb-company-name">{c.brandName || c.name}</span>
                  </div>
                  <div className="cb-col-address">
                    <span className="cb-address-text">
                      {isSignatureView
                        ? (c.buildingAddress && /\d|\s/.test(c.buildingAddress)) ? c.buildingAddress : (c.brandName || c.name || '-')
                        : (c.buildingAddress || '-')}
                    </span>
                  </div>
                  <div className="cb-col-zone">
                    <span className={`cb-zone-badge cb-zone-${c.zoneType.toLowerCase()}`} title={c.zoneType}>{ZONE_BADGE_LABELS[c.zoneType] || c.zoneType}</span>
                  </div>
                  <div className="cb-col-resource">
                    {c.resourceKey && (
                      <img className="cb-resource-icon" src={`${RESOURCE_ICON_BASE}${resourceIconName(c.resourceKey)}.svg`} />
                    )}
                    <span className={isRawResource(c.resourceKey) ? 'cb-resource-raw' : ''}>{resourceLabel(c.resourceKey)}</span>
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
                                {[1, 2, 3, 4, 5].map((lv) => (
                                  <span key={lv} className={`cb-level-pip${lv <= c.buildingLevel ? ' cb-level-pip-filled' : ''}`} />
                                ))}
                              </span>
                            </span>
                          </div>
                        )}
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Workers</span>
                          <span className="cb-detail-value">
                            {c.maxWorkers > 0 ? `${c.workers} / ${c.maxWorkers} (${workerPct}%)` : '\u2014'}
                          </span>
                        </div>
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Efficiency</span>
                          <span className="cb-detail-value" style={{ color: c.efficiency >= 80 ? '#8bdb46' : c.efficiency >= 50 ? '#e88c3a' : '#e05050' }}>
                            {`${c.efficiency}%`}
                          </span>
                        </div>
                      </div>
                      <div className="cb-detail-middle">
                        <div className="cb-detail-section-title">Consumption</div>
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Electricity</span>
                          <span className="cb-detail-value">{(c as any).electricityConsumption || '—'} kW</span>
                        </div>
                        <div className="cb-detail-row">
                          <span className="cb-detail-label">Water</span>
                          <span className="cb-detail-value">{(c as any).waterConsumption || '—'} m3</span>
                        </div>
                        <div className="cb-detail-divider" />
                        <div className="cb-detail-section-title">Efficiency Factors</div>
                        {(() => {
                          const factors: { label: string; status: string; color: string; level: string; icon?: string; factorName?: string }[] = [];
                          const effFactors = parseEfficiencyDetails(c.efficiencyDetails);
                          effFactors.forEach((ef) => {
                            const col = effFactorColor(ef.change);
                            const lvl = ef.change > 0 ? 'good' : ef.change >= -10 ? 'good' : ef.change >= -30 ? 'warn' : 'bad';
                            const sign = ef.change > 0 ? '+' : '';
                            factors.push({ label: ef.label, status: `${sign}${ef.change}%`, color: col, level: lvl, factorName: ef.name });
                          });
                          return factors.map((f, fi) => (
                            <div key={fi} className="cb-detail-row">
                              <span className="cb-detail-label">{f.label}</span>
                              <span className="cb-detail-value" style={{ color: f.color }}>{f.status}</span>
                            </div>
                          ));
                        })()}
                      </div>
                      <div className="cb-detail-factors">
                        <div className="cb-detail-section-title">Public Services</div>
                        <div className="cb-detail-row"><span className="cb-detail-label">Crime</span><span className="cb-detail-value">{(happinessMap[compKey]?.crimeProbability || 0).toFixed(2)}</span></div>
                        <div className="cb-detail-row"><span className="cb-detail-label">Healthcare</span><span className="cb-detail-value">{(happinessMap[compKey]?.healthcare || 0).toFixed(2)}</span></div>
                      </div>
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
