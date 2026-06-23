import React, { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
// React hooks are provided by the environment. Do not import to avoid duplicate type declarations.
import { trigger } from 'cs2/api';
import { camera, selectedInfo } from 'cs2/bindings';
import { Entity } from 'cs2/utils';
import { Scrollable } from 'cs2/ui';
import { getSafeValue, getSafeColor } from '../../mods/apiSafe';
import { startGlobalDrag, stopGlobalDrag } from './dragHelper';
import { resourceCategories } from '../data/resourceTaxonomy';
import ServiceIcon from '../assets/ServiceIcon';
import PackIcon from '../assets/PackIcon';
import './CompanyBrowser.css';
import CustomSelect from './CustomSelect';

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
  producesGarbage: boolean;
  producesCrime: boolean;
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
  themeIcon?: string;
  assetPack?: string;
  assetPackIcon?: string;
  nativePackIcon?: string;
  companyKind?: string;
  electricityConsumption?: number;
  waterConsumption?: number;
  garbageAccumulation?: number;
  mailAccumulation?: number;
  crimeProbability?: number;
  buildingIndex?: number;
  buildingVersion?: number;
  iconUrl?: string;
  storageAmount?: number;
  storageCapacity?: number;
  allowedResources?: string;
  cityEffects?: string;
  localEffects?: string;
  attractiveness?: number;
  attractivenessFactors?: string;
}

const isRawResource = (resourceKey: string): boolean => {
  if (!resourceKey) return false;
  const k = resourceKey.toLowerCase();
  return ['grain', 'vegetables', 'cotton', 'livestock', 'fish', 'wood', 'ore', 'stone', 'coal', 'oil'].includes(k);
};

/** Convert camelCase / PascalCase internal pack names to readable display names.
 *  e.g. "BridgesAndPorts" → "Bridges And Ports", "SanFranciscoSet" → "San Francisco Set"
 *  Names that already contain spaces or & (DLC display names) are returned unchanged.
 */
const formatPackName = (name: string): string => {
  if (!name || name === 'Base Game' || name === 'Custom' || name === 'DLC') return name;
  // If it already has spaces it came from GetDlcName() — return as-is
  if (name.includes(' ')) return name;
  // PascalCase → spaced: insert space before each uppercase letter that follows a lowercase
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
};

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
      const assetPackIcon = getVal(33);
      const companyKind = getVal(34);
      const isSignature = getVal(35);
      const buildingEntityPart = getVal(36);
      const iconUrl = getVal(37);
      const nativePackIcon = getVal(38);
      const themeIcon = getVal(39);
      const storageAmount = getVal(40);
      const storageCapacity = getVal(41);
      const allowedResources = getVal(42);
      const cityEffects = getVal(43);
      const localEffects = getVal(44);
      const attractiveness = getVal(45);
      const attractivenessFactors = getVal(46);

      const [idx, ver] = (entityPart || '').split(',');
      const [bIdx, bVer] = (buildingEntityPart || '').split(',');
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
        themeIcon: themeIcon || '',
        assetPack: formatPackName(assetPack || 'Base Game'),
        assetPackIcon: assetPackIcon || '',
        nativePackIcon: nativePackIcon || '',
        companyKind: companyKind || zoneType || 'Unknown',
        isSignature: Number(isSignature) === 1,
        buildingIndex: Number(bIdx) || 0,
        buildingVersion: Number(bVer) || 0,
        iconUrl: iconUrl || '',
        storageAmount: Number(storageAmount) || 0,
        storageCapacity: Number(storageCapacity) || 0,
        allowedResources: allowedResources || '',
        cityEffects: cityEffects || '',
        localEffects: localEffects || '',
        attractiveness: Number(attractiveness) || 0,
        attractivenessFactors: attractivenessFactors || '',
      } as CompanyVm;
    })
    .filter((x): x is CompanyVm => x !== null);
};

type SortField = 'name' | 'zoneType' | 'resourceKey' | 'profit' | 'profitabilityTier' | 'workers' | 'tax' | 'lv';
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

const ZONE_BADGE_LABELS: Record<string, string> = {
  RawIndustrial: 'Raw Industrial',
  Industrial: 'Industrial',
  Storage: 'Storage',
  Commercial: 'Commercial',
  Office: 'Office',
};

export const resourceLabel = (key: string): string => {
  if (!key) return '\u2014';
  const mapped = RESOURCE_ICON_MAP[key];
  if (mapped) return mapped.replace(/([a-z])([A-Z])/g, '$1 $2');
  return key.replace(/^c_/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase());
};

export const formatCurrency = (val: number): string => {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val.toString();
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
  NoisePollution: 'Noise Pollution',
  GroundPollution: 'Ground Pollution',
  AirPollution: 'Air Pollution',
  TrafficPenalty: 'Traffic Penalty',
  DeathPenalty: 'Death Penalty',
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
  if (n.includes('park') || n.includes('entertainment') || n.includes('attraction') || n.includes('leisure')) return 'Media/Game/Icons/ParksAndRecreation.svg';
  if (n.includes('welfare') || n.includes('wellbeing')) return 'Media/Game/Icons/Wellbeing.svg';
  if (n.includes('fire')) return 'Media/Game/Icons/FireAndRescue.svg';
  if (n.includes('deathcare') || n.includes('death') || n.includes('cemetery') || n.includes('crematorium')) return 'Media/Game/Icons/Deathcare.svg';
  if (n.includes('police')) return 'Media/Game/Icons/PoliceAndAdministration.svg';
  if (n.includes('telecom') || n.includes('network')) return 'Media/Game/Icons/Communications.svg';
  if (n.includes('pollution')) return 'Media/Game/Icons/Pollution.svg';
  if (n.includes('tax')) return 'Media/Game/Icons/Economy.svg';
  return 'Media/Game/Icons/Notifications.svg';
};

const parseEfficiencyDetails = (details: string): { name: string; label: string; change: number; cumulative: number }[] => {
  if (!details) return [];
  return details.split(',').map((part) => {
    const segs = part.split(':');
    const name = segs[0] || '';
    const change = Number(segs[1]) || 0;
    const cumulative = Number(segs[2]) || 0;
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
    const label = EFF_FACTOR_LABELS[capitalizedName] || capitalizedName.replace(/([a-z])([A-Z])/g, '$1 $2');
    return { name, label, change, cumulative };
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
  summaryData?: string;
  isSignatureView?: boolean;
}

interface ParsedSummary {
  total: number;
  healthy: number;
  struggling: number;
  bankrupt: number;
  packs: { name: string; icon: string }[];
  themes: string[];
  districts: string[];
  resourceKinds: { zone: string; resourceKey: string; companyKind: string }[];
}

const parseSummary = (summaryStr: string): ParsedSummary => {
  const defaultSummary: ParsedSummary = {
    total: 0,
    healthy: 0,
    struggling: 0,
    bankrupt: 0,
    packs: [],
    themes: [],
    districts: [],
    resourceKinds: [],
  };
  if (!summaryStr) return defaultSummary;

  try {
    const parts = summaryStr.split('|');
    if (parts.length < 5) return defaultSummary;

    const counts = parts[0].split(',');
    const packSection = parts[1];
    const themeSection = parts[2];
    const districtSection = parts[3];
    const rkSection = parts[4];

    const packs = packSection ? packSection.split(';').map(p => {
      const idx = p.indexOf(':');
      if (idx === -1) return { name: p, icon: '' };
      return { name: p.substring(0, idx), icon: p.substring(idx + 1) };
    }).filter(p => !!p.name) : [];

    const themes = themeSection ? themeSection.split(';').filter(Boolean) : [];
    const districts = districtSection ? districtSection.split(';').filter(Boolean) : [];
    
    const resourceKinds = rkSection ? rkSection.split(';').map(item => {
      const sub = item.split(',');
      return { zone: sub[0] || '', resourceKey: sub[1] || '', companyKind: sub[2] || '' };
    }).filter(x => !!x.zone) : [];

    return {
      total: Number(counts[0]) || 0,
      healthy: Number(counts[1]) || 0,
      struggling: Number(counts[2]) || 0,
      bankrupt: Number(counts[3]) || 0,
      packs,
      themes,
      districts,
      resourceKinds,
    };
  } catch (e) {
    console.error("Error parsing company summary", e);
    return defaultSummary;
  }
};

const PAGE_SIZE = 50;

const CompanyBrowser: React.FC<CompanyBrowserProps> = ({ companies = [], summaryData = '', isSignatureView }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [frozenCompanies, setFrozenCompanies] = useState<CompanyVm[]>([]);
  const [frozenSummary, setFrozenSummary] = useState('');

  useEffect(() => {
    if (!isPaused) {
      setFrozenCompanies(Array.isArray(companies) ? companies : []);
    }
  }, [companies, isPaused]);
  useEffect(() => {
    if (!isPaused) {
      setFrozenSummary(summaryData || '');
    }
  }, [summaryData, isPaused]);

  const safeCompanies = frozenCompanies;

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
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const [happinessMap, setHappinessMap] = useState<Record<string, Record<string, number>>>({});
  const [happinessLoading, setHappinessLoading] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const payload = `${zoneFilter}|${resourceFilter}|${tierFilter}|${packFilter}|${themeFilter}|${districtFilter}|${kindFilter}|${profitMin}|${profitMax}|${searchText}|${sortField}|${sortDir}`;
    trigger('taxProduction', 'updateCompanyFilters', payload);
  }, [zoneFilter, resourceFilter, tierFilter, packFilter, themeFilter, districtFilter, kindFilter, profitMin, profitMax, searchText, sortField, sortDir]);

  const themeIconMap = useMemo(() => {
    const map = new Map<string, string>();
    safeCompanies.forEach(c => {
      if (c.theme && c.themeIcon && !map.has(c.theme)) {
        map.set(c.theme, c.themeIcon);
      }
    });
    if (!map.has('European')) map.set('European', 'coui://ui-game/Media/Game/Icons/ThemeEuropean.svg');
    if (!map.has('NorthAmerican')) map.set('NorthAmerican', 'coui://ui-game/Media/Game/Icons/ThemeNorthAmerican.svg');
    if (!map.has('EU')) map.set('EU', 'coui://ui-game/Media/Game/Icons/ThemeEuropean.svg');
    if (!map.has('USA')) map.set('USA', 'coui://ui-game/Media/Game/Icons/ThemeNorthAmerican.svg');
    return map;
  }, [safeCompanies]);

  useEffect(() => {
    try { if (bodyRef.current) bodyRef.current.scrollTop = 0; } catch { }
    setExpandedEntity(null);
    setIsPaused(false);
    setCurrentPage(0);
  }, [zoneFilter, tierFilter, resourceFilter, packFilter, themeFilter, districtFilter, kindFilter, searchText]);

  // Merge incoming single-company happiness payloads into local map
  useEffect(() => {
    const happinessData = getSafeValue((window as any)._uiBindings?.taxProduction?.companyHappinessData, '');
    if (!happinessData || happinessData.length === 0) return;
    const parts = happinessData.split('|');
    if (parts.length < 2) return;
    const key = parts[0];
    const pairs = parts[1].split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
    const map: Record<string, number> = {};
    pairs.forEach((pair: string) => {
      const [k, v] = pair.split(':');
      if (!k) return;
      const num = Number(v || 0);
      map[k] = isNaN(num) ? 0 : num;
    });
    setHappinessMap((prev) => ({ ...prev, [key]: map }));
    setHappinessLoading((prev) => { const np = { ...prev }; delete np[key]; return np; });
  }, [(window as any)._uiBindings?.taxProduction?.companyHappinessData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const summary = useMemo(() => parseSummary(frozenSummary || ''), [frozenSummary]);

  const visibleResourceFilters = useMemo(() => {
    const availableKeys = new Set(
      summary.resourceKinds
        .filter(rk => zoneFilter === 'All' || rk.zone === zoneFilter)
        .map(rk => rk.resourceKey)
        .filter(Boolean)
    );

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
  }, [zoneFilter, summary]);

  const visibleKindFilters = useMemo(() => {
    if (zoneFilter === 'All') return ['All'];
    const kinds = new Set(
      summary.resourceKinds
        .filter(rk => rk.zone === zoneFilter)
        .map(rk => rk.companyKind)
        .filter((k): k is string => !!k)
    );
    const arr = Array.from(kinds).sort();
    if (arr.length <= 1 && arr[0] === zoneFilter) return ['All'];
    return ['All', ...arr];
  }, [zoneFilter, summary]);

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

  const sorted = safeCompanies;

  const focusCompanyEntity = (c: CompanyVm) => {
    const entity: Entity = { index: c.entityIndex, version: c.entityVersion };
    camera.focusEntity(entity);
    selectedInfo.selectEntity(entity);
  };

  const focusBuildingEntity = (c: CompanyVm) => {
    if (c.buildingIndex) {
      const entity: Entity = { index: c.buildingIndex, version: c.buildingVersion || 0 };
      camera.focusEntity(entity);
      selectedInfo.selectEntity(entity);
    }
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

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
    startGlobalDrag();
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
      stopGlobalDrag();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [profitFromClientX, profitMin, profitMax]);

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

  const totalCount = summary.total;
  const healthyCount = summary.healthy;
  const losingCount = summary.struggling;
  const bankruptCount = summary.bankrupt;

  return (
    <div className="cb-container">
      <div className="cb-filters-vertical">
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

        <div className="cb-filter-row cb-filter-row-mixed">
          <CustomSelect
            label="Pack"
            value={packFilter}
            options={['All', ...summary.packs.map(p => p.name).sort()]}
            onChange={setPackFilter}
            displayValue={(v) => v === 'All' ? 'All Packs' : formatPackName(v)}
            icon={(v) => v === 'All' ? null : <PackIcon pack={v} iconUrl={summary.packs.find(p => p.name === v)?.icon} size={24} />}
          />
          <CustomSelect
            label="Theme"
            value={themeFilter}
            options={['All', ...summary.themes.sort()]}
            onChange={setThemeFilter}
            displayValue={(v) => v === 'All' ? 'All Themes' : v}
            icon={(v) => v === 'All' ? null : <PackIcon pack={v} iconUrl={themeIconMap.get(v)} size={24} />}
          />
          <CustomSelect
            label="District"
            value={districtFilter || 'All'}
            options={['All', ...summary.districts.sort()]}
            onChange={setDistrictFilter}
            displayValue={(v) => v === 'All' ? 'All Districts' : v}
          />
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
          <span className="cb-summary-count" style={{ marginLeft: '12rem', fontSize: '11rem', opacity: 0.6 }}>
            {sorted.length} results{isPaused ? ' ⏸' : ''}
          </span>
        </div>
      </div>

      <div className="cb-summary">
        <span className="cb-summary-total" style={{ marginRight: '16rem' }}>{`${totalCount} total`}</span>
        <span className="cb-summary-profitable" style={{ color: getSafeColor('#8bdb46'), marginRight: '16rem' }}>{`${healthyCount} healthy`}</span>
        <span className="cb-summary-losing" style={{ color: getSafeColor('#e88c3a'), marginRight: '16rem' }}>{`${losingCount} struggling`}</span>
        <span className="cb-summary-bankrupt" style={{ color: getSafeColor('#e05050'), marginRight: '16rem' }}>{`${bankruptCount} bankrupt`}</span>
      </div>

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
          <div className="cb-col-pack" title="Asset Pack">
            Pk
          </div>
          <div className="cb-col-profit cb-sortable" onClick={() => handleSort('profit')}>
            {'Profit\u00a0%' + sortIndicator('profit')}
          </div>
          <div className="cb-col-tax">
            <div className="cb-sortable" onClick={() => handleSort('tax')}>Tax %{sortIndicator('tax')}</div>
          </div>
          <div className="cb-col-tier cb-sortable" onClick={() => handleSort('profitabilityTier')}>
            Status{sortIndicator('profitabilityTier')}
          </div>
          <div className="cb-col-level">
            <div className="cb-sortable" onClick={() => handleSort('lv')}>Lv{sortIndicator('lv')}</div>
          </div>
          <div className="cb-col-locate">
            GO
          </div>
        </div>
        <div className="cb-body-wrap" style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Scrollable vertical={true} className="cb-body" trackVisibility="scrollable">
            {sorted.length === 0 && (
              <div className="cb-empty">No companies found. Companies will appear once the game simulation is running.</div>
            )}
            {(() => {
              const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
              const safePage = Math.min(currentPage, totalPages - 1);
              const pageSlice = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
              return pageSlice;
            })().map((c) => {
              if (!c) return null;
              const compKey = `${c.entityIndex || 0},${c.entityVersion || 0}`;
              const isExpanded = expandedEntity === compKey;
              const rowClickHandler = (e: React.MouseEvent) => {
                if (isExpanded) {
                  setExpandedEntity(null);
                  setIsPaused(false);
                } else {
                  setExpandedEntity(compKey);
                  setIsPaused(true);
                  setHappinessLoading((prev) => ({ ...prev, [compKey]: true }));
                  trigger('taxProduction', 'requestCompanyHappiness', compKey);
                }
              };
              const profitColor = (c.profit || 0) < 0 ? '#e05050' : (c.profit || 0) > 0 ? '#8bdb46' : 'rgba(255,255,255,0.5)';
              const tierColor = TIER_COLORS[c.profitabilityTier || ''] || 'transparent';
              const workerPct = (c.maxWorkers || 0) > 0 ? Math.round(((c.workers || 0) / c.maxWorkers) * 100) : 0;
              const profitDescription = (c.profit || 0) > 20 ? 'Very profitable — high tax tolerance'
                : (c.profit || 0) > 5 ? 'Healthy — moderate tax tolerance'
                  : (c.profit || 0) > -5 ? 'Marginal — sensitive to tax changes'
                    : (c.profit || 0) > -20 ? 'Struggling — consider lowering taxes'
                      : 'Critical — near bankruptcy, needs tax relief';
              return (
                <div key={`${c.entityIndex}-${c.entityVersion}`}>
                  <div
                    className={`cb-row${c.entityIndex % 2 === 0 ? '' : ' cb-row-alt'}${isExpanded ? ' cb-row-expanded' : ''}`}
                    onMouseDown={(e: React.MouseEvent) => {
                      const tgt = e.target as HTMLElement;
                      if (tgt && tgt.closest && tgt.closest('.cb-locate-btn')) return;
                      rowClickHandler(e);
                    }}
                    title={isExpanded ? 'Click to collapse' : 'Click to expand details'}
                  >
                    <div className="cb-col-name">
                      <span className="cb-expand-arrow">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                      {c.isSignature && <span className="cb-signature-badge" title="Signature Building">★</span>}
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
                     <div className="cb-col-pack" title={formatPackName(c.assetPack || 'Base Game')}>
                       <PackIcon pack={c.assetPack} theme={c.theme} iconUrl={c.nativePackIcon || c.assetPackIcon} size={24} />
                     </div>
                    <div className="cb-col-profit">
                      <span style={{ color: getSafeColor(profitColor) }}>
                        {`${c.profit > 0 ? '+' : ''}${c.profit}\u00a0%`}
                      </span>
                    </div>
                    <div className="cb-col-tax">
                      <span style={{ color: getSafeColor(c.taxRate >= 10 ? '#e88c3a' : 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0.7)') }}>
                        {`${c.taxRate}\u00a0%`}
                      </span>
                    </div>
                    <div className="cb-col-tier">
                      <span style={{ color: getSafeColor(tierColor) }}>
                        {TIER_LABELS[c.profitabilityTier] || c.profitabilityTier}
                      </span>
                    </div>
                    <div className="cb-col-level">
                      <span className="cb-level-badge">Lv {c.buildingLevel}</span>
                    </div>
                    <div className="cb-col-locate">
                      <div className="cb-locate-btn-group">
                        <button
                          className="cb-locate-btn cb-locate-co"
                          onClick={(e) => { e.stopPropagation(); focusCompanyEntity(c); }}
                          title="Focus camera and inspect Company"
                        >
                          GO
                        </button>
                        {c.buildingIndex && c.buildingIndex > 0 ? (
                          <button
                            className="cb-locate-btn cb-locate-bldg"
                            onClick={(e) => { e.stopPropagation(); focusBuildingEntity(c); }}
                            title="Focus camera and inspect Building"
                          >
                            BLD
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {isExpanded && (() => {
                    const companyHappinessData = getSafeValue(happinessMap[compKey], null);
                    return (
                    <div className="cb-expanded-panel">
                      <div className="cb-detail-grid">
                        <div className="cb-detail-main">
                          <div className="cb-detail-row cb-detail-entity-id-row">
                            <span className="cb-detail-label">Entity ID</span>
                            <span className="cb-detail-value cb-entity-id-badge" title="Company Entity ID">CO {c.entityIndex}:{c.entityVersion}</span>
                            {c.buildingIndex && c.buildingIndex > 0 ? (
                              <span className="cb-detail-value cb-entity-id-badge cb-entity-id-bldg-badge" title="Building Entity ID" style={{ marginLeft: '6rem' }}>
                                BLDG {c.buildingIndex}:{c.buildingVersion}
                              </span>
                            ) : null}
                          </div>
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">Profitability</span>
                            <span className="cb-detail-value" style={{ color: getSafeColor(profitColor) }}>{`${c.profit > 0 ? '+' : ''}${c.profit}%`}</span>
                          </div>
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">Status</span>
                            <span className="cb-detail-value" style={{ color: getSafeColor(tierColor) }}>{TIER_LABELS[c.profitabilityTier] || c.profitabilityTier}</span>
                          </div>
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">Assessment</span>
                            <span className="cb-detail-value cb-detail-assessment" style={{ color: getSafeColor(profitColor) }}>{profitDescription}</span>
                          </div>
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">Zone</span>
                            <span className="cb-detail-value">{c.zoneType}</span>
                          </div>
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">District</span>
                            <span className="cb-detail-value">{c.district || 'City'}</span>
                          </div>
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">Output</span>
                            <span className="cb-detail-value">
                              {c.resourceKey && <img className="cb-resource-icon" src={`${RESOURCE_ICON_BASE}${resourceIconName(c.resourceKey)}.svg`} />}
                              {resourceLabel(c.resourceKey)}
                            </span>
                          </div>
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">Resource Storage</span>
                            <span className="cb-detail-value">{(c.storageCapacity || 0) > 0 ? `${c.storageAmount || 0}/${c.storageCapacity}t` : `${c.storageAmount || 0}t`}</span>
                          </div>
                          {c.allowedResources && c.allowedResources !== 'NoResource' && (
                            <div className="cb-detail-row">
                              <span className="cb-detail-label">Allowed Resources</span>
                              <span className="cb-detail-value">{c.allowedResources}</span>
                            </div>
                          )}
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">Tax Rate</span>
                            <span className="cb-detail-value" style={{ color: getSafeColor(c.taxRate >= 10 ? '#e88c3a' : 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0.8)') }}>
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
                              {c.maxWorkers > 0 ? `${c.workers}/${c.maxWorkers} (${workerPct}%)` : '\u2014'}
                            </span>
                          </div>
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">Efficiency</span>
                            <span className="cb-detail-value" style={{ color: getSafeColor(c.efficiency >= 80 ? '#8bdb46' : c.efficiency >= 50 ? '#e88c3a' : '#e05050') }}>
                              {`${c.efficiency}%`}
                            </span>
                          </div>
                        </div>
                        <div className="cb-detail-middle">
                          <div className="cb-detail-section-title">Consumption (In)</div>
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">
                              <img src="Media/Game/Icons/Electricity.svg" style={{ width: '20rem', height: '20rem', opacity: 0.8, marginRight: '6rem', verticalAlign: 'middle' }} alt="" />
                              Electricity
                            </span>
                            <span className="cb-detail-value">{(c as any).electricityConsumption || '—'}kW</span>
                          </div>
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">
                              <img src="Media/Game/Icons/Water.svg" style={{ width: '20rem', height: '20rem', opacity: 0.8, marginRight: '6rem', verticalAlign: 'middle' }} alt="" />
                              Water
                            </span>
                            <span className="cb-detail-value">{(c as any).waterConsumption || '—'}m³</span>
                          </div>
                          {companyHappinessData && companyHappinessData.mailReceiving > 0 && (
                            <div className="cb-detail-row">
                              <span className="cb-detail-label">
                                <img src="Media/Game/Icons/PostService.svg" style={{ width: '20rem', height: '20rem', opacity: 0.8, marginRight: '6rem', verticalAlign: 'middle' }} alt="" />
                                Mail Receiving
                              </span>
                              <span className="cb-detail-value">{companyHappinessData.mailReceiving}</span>
                            </div>
                          )}
                          
                          <div className="cb-detail-divider" />
                          <div className="cb-detail-section-title">Production (Out)</div>
                          <div className="cb-detail-row">
                            <span className="cb-detail-label">
                              <img src="Media/Game/Icons/Garbage.svg" style={{ width: '20rem', height: '20rem', opacity: 0.8, marginRight: '6rem', verticalAlign: 'middle' }} alt="" />
                              Garbage
                            </span>
                            <span className="cb-detail-value">{(c as any).garbageAccumulation || 0}t</span>
                          </div>
                          {Number((c as any).mailAccumulation) > 0 && (
                            <div className="cb-detail-row">
                              <span className="cb-detail-label">
                                <img src="Media/Game/Icons/PostService.svg" style={{ width: '20rem', height: '20rem', opacity: 0.8, marginRight: '6rem', verticalAlign: 'middle' }} alt="" />
                                Mail Sending
                              </span>
                              <span className="cb-detail-value">{(c as any).mailAccumulation}u</span>
                            </div>
                          )}
                          {Number((c as any).crimeProbability) > 0 && (
                            <div className="cb-detail-row">
                              <span className="cb-detail-label">
                                <img src="Media/Game/Icons/Police.svg" style={{ width: '20rem', height: '20rem', opacity: 0.8, marginRight: '6rem', verticalAlign: 'middle' }} alt="" />
                                Crime Risk
                              </span>
                              <span className="cb-detail-value">{(c as any).crimeProbability}%</span>
                            </div>
                          )}

                          {c.attractiveness ? (
                            <>
                              <div className="cb-detail-divider" />
                              <div className="cb-detail-section-title">Attractiveness</div>
                              <div className="cb-detail-row">
                                <span className="cb-detail-label">Total Attractiveness</span>
                                <span className="cb-detail-value" style={{ color: getSafeColor('#3fc9d8') }}>{c.attractiveness}</span>
                              </div>
                            </>
                          ) : null}

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
                                <span className="cb-detail-label">
                                  <img src={getEfficiencyFactorIcon(f.factorName || '')} style={{ width: '20rem', height: '20rem', opacity: 0.7, marginRight: '6rem', verticalAlign: 'middle' }} alt="" />
                                  {f.label}
                                </span>
                                <span className="cb-detail-value" style={{ color: getSafeColor(f.color, '#EAEAEA') }}>{f.status}</span>
                              </div>
                            ));
                          })()}
                        </div>
                        <div className="cb-detail-factors">
                          <div className="cb-detail-section-title">Local Effects</div>
                          {(() => {
                            if (!companyHappinessData) return <div className="cb-detail-loading-placeholder" style={{ opacity: 0.5, fontSize: '11rem', padding: '4rem 0' }}>Loading factor data...</div>;

                            const cond = companyHappinessData.buildingCondition || 0;
                            const maxCond = companyHappinessData.maxCondition || 0;
                            const wearPct = maxCond > 0 ? Math.min(100, Math.round((cond / maxCond) * 100)) : 100;
                            const wearVal = maxCond > 0 ? `${wearPct}% (${formatCurrency(cond)}/${formatCurrency(maxCond)})` : `${cond} (No Upkeep)`;
                            
                            // explicitly handled keys
                            const excludeKeys = ['buildingCondition', 'maxCondition', 'crimeProbability', 'telecom', 'mailSending', 'mailReceiving', 'electricityConsumption', 'waterConsumption', 'garbageAccumulation', 'mailAccumulation', 'crime', 'garbage', 'mail'];

                            return (
                              <>
                                <div className="cb-detail-row">
                                  <span className="cb-detail-label">Condition/Wear</span>
                                  <span className="cb-detail-value">{wearVal}</span>
                                </div>
                                <div className="cb-detail-row">
                                  <span className="cb-detail-label">Crime</span>
                                  <span className="cb-detail-value">
                                    {(() => {
                                      const val = companyHappinessData.crimeProbability || 0;
                                      if (val <= 0) return 'Safe (0)';
                                      if (val < 100) return `Low (${val.toFixed(0)})`;
                                      if (val < 500) return `Moderate (${val.toFixed(0)})`;
                                      if (val < 1500) return `High (${val.toFixed(0)})`;
                                      return `Dangerous (${val.toFixed(0)})`;
                                    })()}
                                  </span>
                                </div>
                                <div className="cb-detail-row">
                                  <span className="cb-detail-label">Telecom</span>
                                  <span className="cb-detail-value">
                                    {companyHappinessData.telecom !== undefined ? `${companyHappinessData.telecom.toFixed(0)}%` : '—'}
                                  </span>
                                </div>

                                
                                {Object.keys(companyHappinessData).map(k => {
                                  if (excludeKeys.includes(k)) return null;
                                  const val = companyHappinessData[k];
                                  if (val === 0) return null;
                                  const capitalizedLabel = k.charAt(0).toUpperCase() + k.slice(1);
                                  const label = capitalizedLabel.replace(/([a-z])([A-Z])/g, '$1 $2');
                                  const displayLabel = EFF_FACTOR_LABELS[capitalizedLabel] || label;
                                  const color = val > 0 ? '#8bdb46' : val < 0 ? '#e05050' : 'rgba(255,255,255,0.7)';
                                  return (
                                    <div className="cb-detail-row" key={k}>
                                      <span className="cb-detail-label">
                                        <img src={getEfficiencyFactorIcon(k)} style={{ width: '18rem', height: '18rem', opacity: 0.7, marginRight: '6rem', verticalAlign: 'middle' }} alt="" />
                                        {displayLabel}
                                      </span>
                                      <span className="cb-detail-value" style={{ color: getSafeColor(color) }}>{val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}</span>
                                    </div>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </div>
                        { (c.cityEffects || c.localEffects) && (
                          <div className="cb-detail-factors">
                            {c.cityEffects && (
                              <>
                                <div className="cb-detail-section-title">City Effects</div>
                                {c.cityEffects.split('^').map((ef, i) => (
                                  <div key={`ce-${i}`} className="cb-detail-row">
                                    <span className="cb-detail-label" style={{ flex: '1 1 100%' }}>{ef}</span>
                                  </div>
                                ))}
                              </>
                            )}
                            {c.localEffects && (
                              <>
                                <div className="cb-detail-section-title" style={{ marginTop: c.cityEffects ? '10rem' : '0' }}>Local Effects</div>
                                {c.localEffects.split('^').map((ef, i) => (
                                  <div key={`le-${i}`} className="cb-detail-row">
                                    <span className="cb-detail-label" style={{ flex: '1 1 100%' }}>{ef}</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })()}
                </div>
              );
            })}
          </Scrollable>
          {/* Pagination controls */}
          {sorted.length > PAGE_SIZE && (() => {
            const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
            const safePage = Math.min(currentPage, totalPages - 1);
            return (
              <div className="panel-pagination">
                <button
                  className="panel-pagination-btn"
                  onClick={() => { setCurrentPage((p) => Math.max(0, p - 1)); setExpandedEntity(null); setIsPaused(false); }}
                  disabled={safePage === 0}
                >
                  ◀ Prev
                </button>
                <span className="panel-pagination-label">
                  Page{' '}{safePage + 1}{' '}of{' '}{totalPages}{isPaused ? ' ⏸' : ''}
                </span>
                <button
                  className="panel-pagination-btn"
                  onClick={() => { setCurrentPage((p) => Math.min(totalPages - 1, p + 1)); setExpandedEntity(null); setIsPaused(false); }}
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
  );
};

export default CompanyBrowser;
