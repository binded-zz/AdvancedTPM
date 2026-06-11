import React, { useMemo, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { parseCompanies } from './CompanyBrowser';
import apiSafe, { getSafeColor } from '../../mods/apiSafe';
import ErrorBoundary from './ErrorBoundary';
import './DistrictsPanel.css';

interface Props {
  residentialBuildingsData?: string;
  servicesBuildingsData?: string;
  companyBrowserData?: string;
  districtBrowserData?: string;
  districtPoliciesData?: string;
  activeTab?: string;
  onToggleDebug?: () => void;
  showDebug?: boolean;
}

type DistrictSortField = 'name' | 'residential' | 'services' | 'businesses' | 'mixed' | 'resTotal' | 'total' | 'policies' | 'residents' | 'workers';

interface PolicyPrefab { entityKey: string; name: string; icon?: string; isCity?: boolean; isDistrict?: boolean; }

interface DistrictRow {
  entityKey: string | null; name: string; residential: number; services: number; businesses: number; mixed: number; resTotal: number; total: number;
  activePolicies: string[]; isCity: boolean; cityName: string;
  households: number; householdCap: number; workers: number; maxWorkers: number;
  avgWealth: number; avgIncome: number; avgRent: number; avgHappiness: number;
  residents: number; children: number; teens: number; adults: number; seniors: number;
  eduUneducated: number; eduPoorlyEducated: number; eduEducated: number; eduWellEducated: number; eduHighlyEducated: number;
  workerUneducated?: number; workerPoorlyEducated?: number; workerEducated?: number; workerWellEducated?: number; workerHighlyEducated?: number;
  workerUneducatedMax?: number; workerPoorlyEducatedMax?: number; workerEducatedMax?: number; workerWellEducatedMax?: number; workerHighlyEducatedMax?: number;
  localServices: number;
  assignedServices: number;
  profitability: number;
  pets: number; upkeep: number; resourceCost: number; feesPaid: number;
  sick: number; students: number; totalCrime: number; homeless: number; tourists: number;

  
  // InfoLoom
  propertyCount?: number;
  resProp?: number;
  comProp?: number;
  indProp?: number;
  offProp?: number;
  storProp?: number;
  mixedProp?: number;
  buildingLevelSum?: number;
  buildingLevelSamples?: number;
  totalLandValue?: number;
  landValueSamples?: number;
  elemCapacity?: number;
  hsCapacity?: number;
  collegeCapacity?: number;
  uniCapacity?: number;
  elemEnrolled?: number;
  hsEnrolled?: number;
  collegeEnrolled?: number;
  uniEnrolled?: number;
  elemEligible?: number;
  hsEligible?: number;
  collegeEligible?: number;
  uniEligible?: number;
  serviceMask?: number;
  area?: number;
  deceased?: number;
  movingAway?: number;
  // Authoritative city-wide stats from CountHouseholdDataSystem
  gameAllCitizens?: number;
  gameTourists?: number;
  gameCommuters?: number;
  gameMovingAway?: number;
  gameEmployees?: number;
}


const cardIcons: Record<string, React.ReactNode> = {
  worker: (
    <svg width="20rem" height="20rem" viewBox="0 0 24 24" fill="none" stroke="#EAEAEA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" fill="none" stroke="#EAEAEA" />
      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" fill="none" stroke="#EAEAEA" />
    </svg>
  ),
  property: (
    <svg width="20rem" height="20rem" viewBox="0 0 24 24" fill="none" stroke="#EAEAEA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M3 21h18" fill="none" stroke="#EAEAEA" />
      <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" fill="none" stroke="#EAEAEA" />
      <path d="M9 9h2v2H9zM9 13h2v2H9zM13 9h2v2h-2zM13 13h2v2h-2z" fill="none" stroke="#EAEAEA" />
    </svg>
  ),
  demographic: (
    <svg width="20rem" height="20rem" viewBox="0 0 24 24" fill="none" stroke="#EAEAEA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="#EAEAEA" />
      <circle cx="9" cy="7" r="4" fill="none" stroke="#EAEAEA" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="#EAEAEA" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="#EAEAEA" />
    </svg>
  ),
  household: (
    <svg width="20rem" height="20rem" viewBox="0 0 24 24" fill="none" stroke="#EAEAEA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="#EAEAEA" />
      <polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="#EAEAEA" />
    </svg>
  ),
  school: (
    <svg width="20rem" height="20rem" viewBox="0 0 24 24" fill="none" stroke="#EAEAEA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" fill="none" stroke="#EAEAEA" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" fill="none" stroke="#EAEAEA" />
    </svg>
  ),
  health: (
    <svg width="20rem" height="20rem" viewBox="0 0 24 24" fill="none" stroke="#EAEAEA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" fill="none" stroke="#EAEAEA" />
    </svg>
  ),
  policies: (
    <svg width="20rem" height="20rem" viewBox="0 0 24 24" fill="none" stroke="#EAEAEA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="#EAEAEA" />
      <polyline points="14 2 14 8 20 8" fill="none" stroke="#EAEAEA" />
      <line x1="16" y1="13" x2="8" y2="13" fill="none" stroke="#EAEAEA" />
      <line x1="16" y1="17" x2="8" y2="17" fill="none" stroke="#EAEAEA" />
      <polyline points="10 9 9 9 8 9" fill="none" stroke="#EAEAEA" />
    </svg>
  )
};

interface DashboardCardConfig {
  id: string;
  visible: boolean;
  order: number;
  title: string;
}

const DEFAULT_LAYOUT: DashboardCardConfig[] = [
  { id: 'worker', visible: true, order: 0, title: 'Education Levels' },
  { id: 'property', visible: true, order: 1, title: 'Properties' },
  { id: 'demographic', visible: true, order: 2, title: 'Demographics' },
  { id: 'household', visible: true, order: 3, title: 'Households' },
  { id: 'school', visible: true, order: 4, title: 'School Data' },
  { id: 'health', visible: true, order: 5, title: 'Health & Value' },
  { id: 'policies', visible: true, order: 7, title: 'Policies' },
];

const ICON = 'Media/Game/Icons/';
const CUR = `${ICON}Economy.svg`;

const fmt = (n: number) => {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const happinessInfo = (h: number) => {
  if (h === undefined || h === null || isNaN(h)) return { label: 'Unknown', color: '#EAEAEA' };
  if (h >= 75) return { label: 'Happy', color: '#8bdb46' };
  if (h >= 50) return { label: 'Content', color: '#b8d946' };
  if (h >= 25) return { label: 'Unhappy', color: '#e0a050' };
  return { label: 'Miserable', color: '#e05050' };
};



const wealthLabel = (w: number) => {
  if (w === undefined || w === null || isNaN(w)) return { label: 'Unknown', color: '#EAEAEA' };
  if (w >= 15000) return { label: 'Wealthy', color: '#8bdb46' };
  if (w >= 5000) return { label: 'Comfortable', color: '#b8d946' };
  if (w >= 1000) return { label: 'Moderate', color: '#fff176' };
  if (w >= 0) return { label: 'Poor', color: '#ffb74d' };
  return { label: 'Wretched', color: '#e57373' };
};

const getServicesFromMask = (mask: number) => {
  const s = [];
  if (mask & (1<<0)) s.push('Hospital / Clinic');
  if (mask & (1<<1)) s.push('School');
  if (mask & (1<<2)) s.push('Police Station');
  if (mask & (1<<3)) s.push('Fire Station');
  if (mask & (1<<4)) s.push('Parks & Recreation');
  if (mask & (1<<5)) s.push('Deathcare');
  if (mask & (1<<6)) s.push('Garbage Facility');
  return s;
};

const calcAvail = (cap: number, enrolled: number) => {
  if (cap === undefined || cap === null || isNaN(cap) || cap <= 0) return { text: '0%', color: 'rgba(255,255,255,0.4)' };
  const val = ((cap - enrolled) / cap) * 100;
  return { text: `${val > 0 ? '+' : ''}${val.toFixed(0)}%`, color: val >= 10 ? '#8bdb46' : (val > 0 ? '#b8d946' : '#e57373') };
};

const StatRow = ({ label, val, style, rawKey, showRaw }: { label: string; val: string | number; style?: React.CSSProperties; rawKey?: string; showRaw?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13rem', padding: '1rem 0', color: getSafeColor('rgba(255,255,255,0.85)'), ...style }}>
    <span style={{ opacity: 0.7, marginRight: '12rem' }}>
      {label}
      {showRaw && rawKey && <span className="dp-raw-key">({rawKey})</span>}
    </span>
    <span style={{ fontWeight: 600 }}>{val}</span>
  </div>
);


export const DistrictsPanel: React.FC<Props> = ({ 
  residentialBuildingsData = '', 
  servicesBuildingsData = '', 
  companyBrowserData = '', 
  districtBrowserData = '[]', 
  districtPoliciesData = '[]',
  activeTab,
  onToggleDebug,
  showDebug = false
}) => {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [lockedTooltip, setLockedTooltip] = useState<string | null>(null);
  const [sortField, setSortField] = useState<DistrictSortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const dragSource = useRef<string | null>(null);

  const handleMove = (id: string, dir: number, swapWithId?: string) => {
    setDashboardLayout(prev => {
      const newList = [...prev];
      const sIdx = newList.findIndex(c => c.id === id);
      
      if (swapWithId) {
        const tIdx = newList.findIndex(c => c.id === swapWithId);
        const tempOrder = newList[sIdx].order;
        newList[sIdx].order = newList[tIdx].order;
        newList[tIdx].order = tempOrder;
        return newList;
      }

      if (dir === -100) {
        // Move to absolute top
        const sorted = [...prev].sort((a,b) => a.order - b.order);
        newList[sIdx].order = sorted[0].order - 1;
        return newList;
      }

      if (dir === 100) {
        // Move to absolute bottom
        const sorted = [...prev].sort((a,b) => a.order - b.order);
        newList[sIdx].order = sorted[sorted.length - 1].order + 1;
        return newList;
      }

      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const curPos = sorted.findIndex(c => c.id === id);
      const targetPos = curPos + dir;
      if (targetPos < 0 || targetPos >= sorted.length) return prev;

      const tIdx = newList.findIndex(c => c.id === sorted[targetPos].id);
      const tempOrder = newList[sIdx].order;
      newList[sIdx].order = newList[tIdx].order;
      newList[tIdx].order = tempOrder;
      return newList;
    });
  };

  // Dashboard State
  const [dashboardLayout, setDashboardLayout] = useState<DashboardCardConfig[]>(() => {
    try {
      const saved = localStorage.getItem('advtpm_district_layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Merge logic: Take defaults, but override with saved state for matching IDs
          return DEFAULT_LAYOUT.map(def => {
            const savedCard = parsed.find(p => p.id === def.id);
            return savedCard ? { ...def, ...savedCard } : def;
          });
        }
      }
    } catch {}
    return DEFAULT_LAYOUT;
  });
  const [showRawData, setShowRawData] = useState(() => localStorage.getItem('advtpm_show_raw') === 'true');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('advtpm_compact') === 'true');
  const [showSettings, setShowSettings] = useState(false);

  React.useEffect(() => { localStorage.setItem('advtpm_district_layout', JSON.stringify(dashboardLayout)); }, [dashboardLayout]);
  React.useEffect(() => { localStorage.setItem('advtpm_show_raw', showRawData.toString()); }, [showRawData]);
  React.useEffect(() => { localStorage.setItem('advtpm_compact', compactMode.toString()); }, [compactMode]);

  React.useEffect(() => {
    const handleGlobalMouseUp = () => { dragSource.current = null; };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);



  const focusEntity = (ek: string) => {
    if (!ek) return;
    const p = ek.split(',');
    apiSafe.trigger('camera', 'focusEntity', { index: parseInt(p[0]) || 0, version: parseInt(p[1]) || 0 });
  };

  const handleSort = (f: DistrictSortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('asc'); }
  };


  const handleJump = (dk: string | null) => {
    if (dk && dk !== 'city') {
      const p = dk.split(',');
      const entity = { index: parseInt(p[0]) || 0, version: parseInt(p[1]) || 0 };
      apiSafe.trigger('camera', 'focusEntity', entity);
      apiSafe.trigger('selectedInfo', 'selectEntity', entity);
    }
  };

  const policyPrefabs: PolicyPrefab[] = useMemo(() => { try { return JSON.parse(districtPoliciesData); } catch { return []; } }, [districtPoliciesData]);

  const rows = useMemo(() => {
    const map = new Map<string, DistrictRow>();
    const ensure = (name: string): DistrictRow => {
      const k = name || 'City';
      if (!map.has(k)) map.set(k, { 
        entityKey: null, name: k, residential: 0, services: 0, businesses: 0, mixed: 0, resTotal: 0, total: 0, 
        activePolicies: [], isCity: k === 'City', cityName: k, households: 0, householdCap: 0, workers: 0, maxWorkers: 0, 
        avgWealth: 0, avgIncome: 0, avgRent: 0, avgHappiness: 0, residents: 0, children: 0, teens: 0, adults: 0, seniors: 0, 
        eduUneducated: 0, eduPoorlyEducated: 0, eduEducated: 0, eduWellEducated: 0, eduHighlyEducated: 0, 
        localServices: 0, assignedServices: 0, profitability: 0, pets: 0, upkeep: 0, resourceCost: 0, feesPaid: 0, 
        sick: 0, students: 0, totalCrime: 0, homeless: 0, tourists: 0,
        elemCapacity: 0, elemEnrolled: 0, hsCapacity: 0, hsEnrolled: 0, collegeCapacity: 0, collegeEnrolled: 0, uniCapacity: 0, uniEnrolled: 0,
        elemEligible: 0, hsEligible: 0, collegeEligible: 0, uniEligible: 0
      });
      return map.get(k)!;
    };

    let apiDistricts: any[] = [];
    try { apiDistricts = JSON.parse(districtBrowserData); } catch {}

    apiDistricts.forEach((a: any) => {
      const d = ensure(a.name);
      d.entityKey = a.entityKey; d.activePolicies = a.policies || [];
      if (a.isCity) { d.isCity = true; d.cityName = a.cityName || 'City'; }
      d.avgWealth = a.avgWealth || 0; d.avgIncome = a.avgIncome || 0; d.avgRent = a.avgRent || 0; d.avgHappiness = a.avgHappiness || 0;
      d.workers = a.workers || 0; d.maxWorkers = a.maxWorkers || 0; d.households = a.households || 0; d.householdCap = a.householdCap || 0;
      d.mixed = a.mixedProp || 0;
      d.residential = a.resProp || 0; 
      d.resTotal = (a.resProp || 0) + (a.mixedProp || 0);
      d.services = a.svc || 0; d.businesses = a.biz || 0;
      d.residents = a.residents || 0;
      d.tourists = a.tourists || 0;
      d.children = a.children || 0; d.teens = a.teens || 0; d.adults = a.adults || 0; d.seniors = a.seniors || 0;
      d.eduUneducated = a.eduUneducated || 0; d.eduPoorlyEducated = a.eduPoorlyEducated || 0;
      d.eduEducated = a.eduEducated || 0; d.eduWellEducated = a.eduWellEducated || 0; d.eduHighlyEducated = a.eduHighlyEducated || 0;
      d.localServices = a.localServices || 0;
      d.assignedServices = a.assignedServices || 0;
      d.profitability = a.profitability || 0;
      d.pets = a.pets || 0; d.upkeep = a.upkeep || 0; d.resourceCost = a.resourceCost || 0; d.feesPaid = a.feesPaid || 0;
      d.sick = a.sick || 0; d.students = a.students || 0; d.totalCrime = a.totalCrime || 0; d.homeless = a.homeless || 0;
      d.deceased = a.deceased || 0; d.movingAway = a.movingAway || 0;
      d.gameAllCitizens = a.gameAllCitizens || 0;
      d.gameTourists = a.gameTourists || 0;
      d.gameCommuters = a.gameCommuters || 0;
      d.gameMovingAway = a.gameMovingAway || 0;
      d.gameEmployees = a.gameEmployees || 0;

      
      d.propertyCount = a.propertyCount || 0;
      d.resProp = a.resProp || 0;
      d.comProp = a.comProp || 0;
      d.indProp = a.indProp || 0;
      d.offProp = a.offProp || 0;
      d.storProp = a.storProp || 0;
      d.mixedProp = a.mixedProp || 0;
      d.buildingLevelSum = a.buildingLevelSum || 0;
      d.buildingLevelSamples = a.buildingLevelSamples || 0;
      d.totalLandValue = a.totalLandValue || 0;
      d.landValueSamples = a.landValueSamples || 0;

      d.workerUneducated = a.workerUneducated || 0;
      d.workerPoorlyEducated = a.workerPoorlyEducated || 0;
      d.workerEducated = a.workerEducated || 0;
      d.workerWellEducated = a.workerWellEducated || 0;
      d.workerHighlyEducated = a.workerHighlyEducated || 0;
      d.workerUneducatedMax = a.workerUneducatedMax || 0;
      d.workerPoorlyEducatedMax = a.workerPoorlyEducatedMax || 0;
      d.workerEducatedMax = a.workerEducatedMax || 0;
      d.workerWellEducatedMax = a.workerWellEducatedMax || 0;
      d.workerHighlyEducatedMax = a.workerHighlyEducatedMax || 0;
      d.elemCapacity = a.elemCapacity || 0;
      d.hsCapacity = a.hsCapacity || 0;
      d.collegeCapacity = a.collegeCapacity || 0;
      d.uniCapacity = a.uniCapacity || 0;
      d.elemEnrolled = a.elemEnrolled || 0;
      d.hsEnrolled = a.hsEnrolled || 0;
      d.collegeEnrolled = a.collegeEnrolled || 0;
      d.uniEnrolled = a.uniEnrolled || 0;
      d.elemEligible = a.elemEligible || 0;
      d.hsEligible = a.hsEligible || 0;
      d.collegeEligible = a.collegeEligible || 0;
      d.uniEligible = a.uniEligible || 0;
      d.serviceMask = a.serviceMask || 0;
      d.area = a.area || 0;
    });

    const out = Array.from(map.values());
    out.forEach(r => { r.total = r.residential + r.services + r.businesses + r.mixed; });
    out.sort((a, b) => {
      if (a.isCity !== b.isCity) return a.isCity ? -1 : 1;
      const vA = sortField === 'policies' ? a.activePolicies.length : (a as any)[sortField];
      const vB = sortField === 'policies' ? b.activePolicies.length : (b as any)[sortField];
      if (vA < vB) return sortDir === 'asc' ? -1 : 1;
      if (vA > vB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return out;
  }, [districtBrowserData, sortField, sortDir]);

  const handleTogglePolicy = (dk: string, pk: string, active: boolean) => {
    apiSafe.trigger('taxProduction', 'toggleDistrictPolicy', dk, pk, !active);
  };

  const handleRenameSubmit = (ek: string | null) => {
    if (ek && tempName.trim()) apiSafe.renameDistrict(ek, tempName.trim());
    setEditingName(null);
  };

  const SortHdr: React.FC<{ field: DistrictSortField; label: string; className: string }> = ({ field, label, className }) => (
    <div className={`${className} dp-sortable`} onClick={() => handleSort(field)}>
      {label}{sortField === field && <span className="dp-sort-indicator">{sortDir === 'asc' ? ' (asc)' : ' (desc)'}</span>}
    </div>
  );

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
  }, [rows, expandedRow, updateScroll]);

  const onThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startTop.current = thumbTop;
    const onMove = (ev: MouseEvent) => {
      if (!scrollRef.current) return;
      if (ev.buttons !== 1) {
        onUp();
        return;
      }
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

  const MiniBar: React.FC<{ items: { label: string; value: number; color: string }[] }> = ({ items }) => {
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total === 0) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: '6rem' }}>
        <div style={{ display: 'flex', height: '12rem', borderRadius: '3rem', overflow: 'hidden', backgroundColor: getSafeColor('rgba(0,0,0,0.3)') }}>
          {items.map((it, idx) => it.value > 0 ? (
            <div key={idx} style={{ width: `${(it.value / total) * 100}%`, backgroundColor: getSafeColor(it.color, 'transparent'), minWidth: '2rem' }} title={`${it.label}: ${fmt(it.value)}`} />
          ) : null)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '5rem' }}>
          {items.filter(it => it.value > 0).map((it, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', marginRight: '12rem', marginBottom: '3rem', fontSize: '13rem', color: getSafeColor('rgba(255,255,255,0.7)') }}>
              <div style={{ width: '10rem', height: '10rem', borderRadius: '2rem', backgroundColor: getSafeColor(it.color, 'transparent'), marginRight: '5rem', flexShrink: 0 }} />
              {it.label}: {fmt(it.value)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (rows.length === 0) return <div className="adv-empty" style={{ padding: '20rem', textAlign: 'center' }}>District data will appear when simulation is running.</div>;

  return (
    <div className="dp-container">
      <div className="tab-buttons" style={{ position: 'relative', height: '40rem', backgroundColor: getSafeColor('transparent'), borderBottomStyle: 'none' }}>
          <button className={`adv-settings-btn ${showSettings ? 'adv-settings-btn-active' : ''}`} 
                  onClick={() => setShowSettings(!showSettings)} 
                  style={{ position: 'absolute', right: '19rem', top: '50%', transform: 'translateY(-50%)', backgroundColor: getSafeColor('rgba(255,255,255,0.05)') }} 
                  title="Layout Settings">
            <svg className="adv-settings-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>
            </svg>
          </button>
            {showSettings && (
              <div className="dp-settings-menu">
                <div className="dp-settings-title">
                  <span>Layout Settings</span>
                  <span style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => setShowSettings(false)}>X</span>
                </div>
                <div className="dp-settings-group">
                  <div className="dp-settings-label">Global Options</div>
                  <div className="dp-settings-item">
                    <span>Compact Mode</span>
                    <div className={`dp-settings-toggle ${compactMode ? 'active' : ''}`} onClick={() => setCompactMode(!compactMode)}>
                      <div className="dp-settings-toggle-dot" />
                    </div>
                  </div>
                  <div className="dp-settings-item">
                    <span>Show Raw Data (Keys)</span>
                    <div className={`dp-settings-toggle ${showRawData ? 'active' : ''}`} onClick={() => setShowRawData(!showRawData)}>
                      <div className="dp-settings-toggle-dot" />
                    </div>
                  </div>
                </div>
                <div className="dp-settings-group">
                  <div className="dp-settings-label">Card Visibility</div>
                  {dashboardLayout.sort((a,b) => a.order - b.order).map(card => (
                    <div key={card.id} className="dp-settings-item">
                      <span>{card.title}</span>
                      <div className={`dp-settings-toggle ${card.visible ? 'active' : ''}`} onClick={() => {
                        setDashboardLayout(prev => prev.map(c => c.id === card.id ? { ...c, visible: !c.visible } : c));
                      }}>
                        <div className="dp-settings-toggle-dot" />
                      </div>
                    </div>
                  ))}
                </div>
                <button className="dp-settings-reset" onClick={() => {
                  setDashboardLayout(DEFAULT_LAYOUT);
                  setCompactMode(false);
                  setShowRawData(false);
                  localStorage.removeItem('advtpm_district_layout');
                }}>RESET TO DEFAULT</button>
              </div>
            )}
          </div>
      <div className="dp-header">
        <div className="dp-col-exp"></div>
        <div className="dp-col-name" onClick={() => handleSort('name')}>District Name {sortField === 'name' && (sortDir === 'asc' ? 'A' : 'V')}</div>
        <div className="dp-col-count" onClick={() => handleSort('residential')}>Res (Pure)</div>
        <div className="dp-col-count" onClick={() => handleSort('mixed')}>Mixed</div>
        <div className="dp-col-count" onClick={() => handleSort('resTotal')}>Res Total</div>
        <div className="dp-col-count" onClick={() => handleSort('services')}>Svc Bldgs</div>
        <div className="dp-col-count" onClick={() => handleSort('businesses')}>Biz Bldgs</div>
        <div className="dp-col-count" onClick={() => handleSort('residents')}>Residents</div>
        <div className="dp-col-count" onClick={() => handleSort('workers')}>Employees</div>
        <div className="dp-col-policies" onClick={() => handleSort('policies')}>Policies</div>
        <div className="dp-col-go">Go</div>
      </div>
      <div className="dp-body-wrapper" style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        <div className="dp-body" ref={scrollRef} onScroll={updateScroll} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {rows.map(r => {
          const hI = happinessInfo(r.avgHappiness);
          const isExp = expandedRow === r.name;
          return (
            <React.Fragment key={r.name}>
              <div className={`dp-row${r.isCity ? ' dp-row-city' : ''}${isExp ? ' dp-row-expanded' : ''}`}
                onClick={() => setExpandedRow(isExp ? null : r.name)}>
                <div className="dp-col-exp"><span className="dp-arrow">{isExp ? 'v' : '>'}</span></div>
                <div className="dp-col-name">
                  <span style={{ fontWeight: r.entityKey ? '800' : '400', color: getSafeColor(r.isCity ? '#50b8e9' : 'inherit') }}>
                    {r.isCity ? `City (${r.cityName})` : r.name}
                  </span>
                </div>
                <div className="dp-col-count">{fmt(r.residential)}</div>
                <div className="dp-col-count" style={{color: getSafeColor('#ffb74d')}}>{fmt(r.mixed)}</div>
                <div className="dp-col-count" style={{color: getSafeColor('#50b8e9'), fontWeight: 800}}>{fmt(r.resTotal)}</div>
                <div className="dp-col-count">{fmt(r.services)}</div>
                <div className="dp-col-count">{fmt(r.businesses)}</div>
                <div className="dp-col-count" style={{color: getSafeColor('#64b5f6')}}>{fmt(r.residents)}</div>
                <div className="dp-col-count" style={{color: getSafeColor('#81c784')}}>{fmt(r.workers)}</div>
                <div className="dp-col-policies">
                  <div className="dp-inline-policies-row">
                    {policyPrefabs.map(pol => {
                      if (r.isCity && !pol.isCity) return null;
                      if (!r.isCity && !pol.isDistrict) return null;
                      const on = r.activePolicies.includes(pol.entityKey);
                      if (!on && !isExp) return null;
                      return (
                        <div key={pol.entityKey} className={`dp-row-policy-icon ${on ? 'active' : ''}`} title={pol.name}
                          onClick={e => { e.stopPropagation(); r.entityKey && handleTogglePolicy(r.entityKey, pol.entityKey, on); }}>
                          {pol.icon ? <img src={pol.icon} className="dp-policy-img-small" alt="" /> : <span className="dp-policy-text-small">{pol.name.substring(0,2)}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="dp-col-go">
                  {r.entityKey && !r.isCity && <button className="dp-go-btn" onClick={e => { e.stopPropagation(); handleJump(r.entityKey!); }}>GO</button>}
                </div>
              </div>

              {isExp && (
                <div className="dp-expanded-row">
                  <div className="dp-expanded-name-row">
                    {editingName === r.name && r.entityKey ? (
                      <div className="dp-rename-wrap">
                        <input className="dp-rename-input" type="text" value={tempName}
                          onChange={e => setTempName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleRenameSubmit(r.entityKey)} autoFocus />
                        <button className="dp-rename-btn" onClick={() => handleRenameSubmit(r.entityKey)}>OK</button>
                      </div>
                    ) : (
                      <>
                        <span className="dp-expanded-name" style={{ color: getSafeColor(r.isCity ? '#50b8e9' : '#fff') }}>
                          {r.isCity ? `City (${r.cityName})` : r.name}
                        </span>
                        {r.entityKey && !r.isCity && (
                          <button className="dp-edit-btn" onClick={() => { setTempName(r.name); setEditingName(r.name); }}>RENAME</button>
                        )}
                      </>
                    )}
                  </div>

                  {/* City-Wide Authoritative Stats (from CountHouseholdDataSystem) */}
                  {r.isCity && (r.gameAllCitizens || 0) > 0 && (
                    <div style={{ margin: '0 0 15rem', padding: '10rem 15rem', backgroundColor: getSafeColor('rgba(80,184,233,0.08)'), borderWidth: 1, borderStyle: 'solid', borderColor: getSafeColor('rgba(80,184,233,0.2)'), borderRadius: '6rem' }}>
                      <div style={{ fontSize: '11rem', color: getSafeColor('#50b8e9'), marginBottom: '8rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>City-Wide Snapshot <span style={{ opacity: 0.5, fontWeight: 400 }}>(Game Authoritative)</span></div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        <StatRow label="All Citizens" val={fmt(r.gameAllCitizens || 0)} showRaw={showRawData} rawKey="gameAllCitizens" style={{ fontSize: '12rem', padding: '2rem 15rem 2rem 0', width: '180rem' }} />
                        <StatRow label="Residents" val={fmt(r.residents)} showRaw={showRawData} rawKey="residents" style={{ fontSize: '12rem', padding: '2rem 15rem 2rem 0', color: getSafeColor('#8bdb46'), width: '180rem' }} />
                        <StatRow label="Employees" val={fmt(r.gameEmployees || 0)} showRaw={showRawData} rawKey="gameEmployees" style={{ fontSize: '12rem', padding: '2rem 15rem 2rem 0', width: '180rem' }} />
                        <StatRow label="Students" val={fmt(r.students || 0)} showRaw={showRawData} rawKey="students" style={{ fontSize: '12rem', padding: '2rem 15rem 2rem 0', width: '180rem' }} />
                        <StatRow label="Moving Away" val={fmt(r.gameMovingAway || 0)} showRaw={showRawData} rawKey="gameMovingAway" style={{ fontSize: '12rem', padding: '2rem 15rem 2rem 0', width: '180rem' }} />
                        <StatRow label="Homeless" val={fmt(r.homeless || 0)} showRaw={showRawData} rawKey="homeless" style={{ fontSize: '12rem', padding: '2rem 15rem 2rem 0', width: '180rem' }} />
                        <StatRow label="Tourists" val={fmt(r.gameTourists || 0)} showRaw={showRawData} rawKey="gameTourists" style={{ fontSize: '12rem', padding: '2rem 15rem 2rem 0', width: '180rem' }} />
                        <StatRow label="Commuters" val={fmt(r.gameCommuters || 0)} showRaw={showRawData} rawKey="gameCommuters" style={{ fontSize: '12rem', padding: '2rem 15rem 2rem 0', width: '180rem' }} />
                      </div>
                    </div>
                  )}

                  {/* District Summary Bar */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '15rem', padding: '10rem 15rem', backgroundColor: getSafeColor('rgba(255,255,255,0.03)'), borderRadius: '8rem', borderWidth: 1, borderStyle: 'solid', borderColor: getSafeColor('rgba(255,255,255,0.06)') }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginRight: '30rem', padding: '6rem 0' }}>
                      <img src={`${ICON}Population.svg`} style={{ width: '28rem', opacity: 0.3, marginRight: '10rem' }} alt="" />
                      <div>
                        <div style={{ fontSize: '9rem', color: getSafeColor('rgba(255,255,255,0.4)'), fontWeight: 'bold', textTransform: 'uppercase' }}>Population</div>
                        <div style={{ fontSize: '16rem', fontWeight: 900 }}>{fmt(r.residents)}</div>
                        {r.pets > 0 && <div style={{ fontSize: '9rem', color: getSafeColor('#ffb74d') }}>Pets: {fmt(r.pets)}</div>}
                      </div>
                    </div>
                     <div style={{ display: 'flex', alignItems: 'center', marginRight: '30rem', padding: '6rem 0' }}>
                       <img src={`${ICON}Workers.svg`} style={{ width: '28rem', opacity: 0.3, marginRight: '10rem' }} alt="" />
                       <div>
                        <div style={{ fontSize: '9rem', color: getSafeColor('rgba(255,255,255,0.4)'), fontWeight: 'bold', textTransform: 'uppercase' }}>Avg Level</div>
                        <div style={{ fontSize: '16rem', fontWeight: 900 }}>{r.buildingLevelSamples ? (r.buildingLevelSum! / r.buildingLevelSamples).toFixed(1) : '0.0'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginRight: '20rem', padding: '6rem 0' }}>
                      <div style={{ fontSize: '9rem', color: getSafeColor('rgba(255,255,255,0.4)'), fontWeight: 'bold', textTransform: 'uppercase', marginRight: '8rem' }}>HAPPY</div>
                      <div style={{ fontSize: '13rem', fontWeight: 800, color: getSafeColor(happinessInfo(r.avgHappiness).color) }}>{happinessInfo(r.avgHappiness).label} {Math.round(r.avgHappiness)}%</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginRight: '20rem', padding: '6rem 0' }}>
                      <div style={{ fontSize: '9rem', color: getSafeColor('rgba(255,255,255,0.4)'), fontWeight: 'bold', textTransform: 'uppercase', marginRight: '8rem' }}>WEALTH</div>
                      <div style={{ fontSize: '13rem', fontWeight: 800, color: getSafeColor(wealthLabel(r.avgWealth).color) }}>{wealthLabel(r.avgWealth).label}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginRight: '20rem', padding: '6rem 0' }}>
                      <div style={{ fontSize: '9rem', color: getSafeColor('rgba(255,255,255,0.4)'), fontWeight: 'bold', textTransform: 'uppercase', marginRight: '8rem' }}>INCOME</div>
                      <div style={{ fontSize: '13rem', fontWeight: 800 }}>{fmt(r.avgIncome)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '6rem 0' }}>
                      <div style={{ fontSize: '9rem', color: getSafeColor('rgba(255,255,255,0.4)'), fontWeight: 'bold', textTransform: 'uppercase', marginRight: '8rem' }}>RENT</div>
                      <div style={{ fontSize: '13rem', fontWeight: 800 }}>{fmt(r.avgRent)}</div>
                    </div>
                  </div>

                  <div className={`dp-dashboard-grid ${compactMode ? 'compact' : ''}`}>
                    {dashboardLayout.sort((a,b) => a.order - b.order).map(card => {
                      if (!card.visible) return null;
                      
                      const renderContent = () => {
                        switch (card.id) {
                          case 'worker':
                            return (
                              <div style={{ padding: '4rem 0' }}>
                                <MiniBar items={[
                                  { label: 'Uneducated', value: r.workerUneducated || 0, color: '#e57373' },
                                  { label: 'Poorly Educated', value: r.workerPoorlyEducated || 0, color: '#ffb74d' },
                                  { label: 'Educated', value: r.workerEducated || 0, color: '#81c784' },
                                  { label: 'Well Educated', value: r.workerWellEducated || 0, color: '#4dd0e1' },
                                  { label: 'Highly Educated', value: r.workerHighlyEducated || 0, color: '#64b5f6' },
                                ]} />
                                <div style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'rgba(255,255,255,0.08)', marginTop: '8rem', paddingTop: '8rem' }}>
                                  <StatRow label="Employees" val={`${fmt(r.workers)} / ${fmt(r.maxWorkers)}`} rawKey="workers" showRaw={showRawData} style={{ fontWeight: 'bold', color: getSafeColor('#50b8e9') }} />
                                </div>
                              </div>
                            );
                          case 'property':
                            return (
                              <>
                                <StatRow label="Res (Pure)" val={fmt(r.resProp || 0)} rawKey="resProp" showRaw={showRawData} />
                                <StatRow label="Mixed Housing" val={fmt(r.mixedProp || 0)} rawKey="mixedProp" showRaw={showRawData} />
                                <StatRow label="Commercial" val={fmt(r.comProp || 0)} rawKey="comProp" showRaw={showRawData} />
                                <StatRow label="Industrial" val={fmt(r.indProp || 0)} rawKey="indProp" showRaw={showRawData} />
                                <StatRow label="Office" val={fmt(r.offProp || 0)} rawKey="offProp" showRaw={showRawData} />
                                <StatRow label="Storage" val={fmt(r.storProp || 0)} rawKey="storProp" showRaw={showRawData} />
                                <div style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'rgba(255,255,255,0.08)', marginTop: '8rem', paddingTop: '8rem' }}>
                                  <StatRow label="Total Properties" val={fmt((r.resProp || 0) + (r.comProp || 0) + (r.indProp || 0) + (r.offProp || 0) + (r.storProp || 0) + (r.mixedProp || 0))} style={{ fontWeight: 'bold', color: getSafeColor('#8bdb46') }} />
                                </div>
                              </>
                            );
                          case 'demographic':
                            return (
                              <>
                                <div style={{ marginBottom: '10rem' }}>
                                  <div className="dp-settings-label" style={{ marginBottom: '4rem' }}>Age Groups</div>
                                  <MiniBar items={[
                                    { label: 'Children', value: r.children || 0, color: '#64b5f6' },
                                    { label: 'Teens', value: r.teens || 0, color: '#4dd0e1' },
                                    { label: 'Adults', value: r.adults || 0, color: '#81c784' },
                                    { label: 'Seniors', value: r.seniors || 0, color: '#ffb74d' },
                                  ]} />
                                </div>
                                <div style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: '8rem' }}>
                                  <StatRow label="Residents" val={fmt(r.residents)} rawKey="residents" showRaw={showRawData} />
                                  <StatRow label="Students" val={fmt(r.students)} rawKey="students" showRaw={showRawData} />
                                  <StatRow label="Tourists" val={fmt(r.tourists)} rawKey="tourists" showRaw={showRawData} />
                                  <StatRow label="Homeless" val={fmt(r.homeless)} rawKey="homeless" showRaw={showRawData} />
                                </div>
                              </>
                            );
                          case 'household':
                            return (
                              <>
                                <StatRow label="Current" val={fmt(r.households)} rawKey="households" showRaw={showRawData} />
                                <StatRow label="Capacity" val={fmt(r.householdCap)} rawKey="householdCap" showRaw={showRawData} />
                                <div style={{ height: '12rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3rem', marginTop: '10rem', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(100, (r.households / (r.householdCap || 1)) * 100)}%`, height: '100%', backgroundColor: getSafeColor('#50b8e9') }} />
                                </div>
                                <div style={{ marginTop: '10rem' }}>
                                  <StatRow label="Avg Wealth" val={wealthLabel(r.avgWealth).label} rawKey="avgWealth" showRaw={showRawData} style={{ color: getSafeColor(wealthLabel(r.avgWealth).color) }} />
                                  <StatRow label="Avg Income" val={fmt(r.avgIncome)} rawKey="avgIncome" showRaw={showRawData} />
                                  <StatRow label="Avg Rent" val={fmt(r.avgRent)} rawKey="avgRent" showRaw={showRawData} />
                                </div>
                              </>
                            );
                          case 'school':
                            return (
                              <div style={{ fontSize: '12rem' }}>
                                <div style={{ display: 'flex', color: getSafeColor('rgba(255,255,255,0.4)'), fontWeight: 'bold', marginBottom: '8rem', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: getSafeColor('rgba(255,255,255,0.1)'), paddingBottom: '4rem' }}>
                                  <div style={{ flex: 2.5 }}>Level</div>
                                  <div style={{ flex: 1, textAlign: 'right' }}>Enrolled</div>
                                  <div style={{ flex: 1, textAlign: 'right' }}>Capacity</div>
                                  <div style={{ flex: 1.2, textAlign: 'right' }}>Availability</div>
                                </div>
                                {[
                                  { label: 'Elementary', cap: r.elemCapacity, enr: r.elemEnrolled },
                                  { label: 'High School', cap: r.hsCapacity, enr: r.hsEnrolled },
                                  { label: 'College', cap: r.collegeCapacity, enr: r.collegeEnrolled },
                                  { label: 'University', cap: r.uniCapacity, enr: r.uniEnrolled }
                                ].map((s, i) => (
                                  <div key={i} style={{ display: 'flex', padding: '6rem 0', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: getSafeColor('rgba(255,255,255,0.03)'), alignItems: 'center' }}>
                                    <div style={{ flex: 2.5, fontWeight: 'bold', color: getSafeColor('rgba(255,255,255,0.8)') }}>{s.label}</div>
                                    <div style={{ flex: 1, textAlign: 'right' }}>{fmt(s.enr || 0)}</div>
                                    <div style={{ flex: 1, textAlign: 'right' }}>{fmt(s.cap || 0)}</div>
                                    <div style={{ flex: 1.2, textAlign: 'right', fontWeight: 'bold', color: getSafeColor(calcAvail(s.cap || 0, s.enr || 0).color) }}>{calcAvail(s.cap || 0, s.enr || 0).text}</div>
                                  </div>
                                ))}
                              </div>
                            );
                          case 'health':
                            return (
                              <>
                                <StatRow label="Health/Safety" val={r.sick > 0 ? `${fmt(r.sick)} Sick` : 'Healthy'} rawKey="sick" showRaw={showRawData} style={{ color: getSafeColor(r.sick > 0 ? '#e57373' : '#81c784') }} />
                                <StatRow label="Crime Risk" val={fmt(Math.round(r.totalCrime / 100))} rawKey="totalCrime" showRaw={showRawData} style={{ color: getSafeColor(r.totalCrime > 1000 ? '#ffb74d' : 'inherit') }} />
                                <StatRow label="Land Value" val={r.landValueSamples ? fmt(r.totalLandValue! / r.landValueSamples) : 0} rawKey="totalLandValue" showRaw={showRawData} />
                                <StatRow label="Avg Level" val={(r.buildingLevelSamples ? (r.buildingLevelSum! / r.buildingLevelSamples).toFixed(1) : 0)} rawKey="buildingLevelSum" showRaw={showRawData} />
                              </>
                            );

                          case 'policies':
                            return (
                              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                {policyPrefabs.map(pol => {
                                  if (r.isCity && !pol.isCity) return null;
                                  if (!r.isCity && !pol.isDistrict) return null;
                                  const on = r.activePolicies.includes(pol.entityKey);
                                  return (
                                    <div key={pol.entityKey} className={`dp-inline-policy-icon ${on ? 'active' : ''}`} title={pol.name}
                                      onClick={e => { e.stopPropagation(); r.entityKey && handleTogglePolicy(r.entityKey, pol.entityKey, on); }}>
                                      {pol.icon ? <img src={pol.icon} className="dp-policy-img" alt="" /> : <span className="dp-policy-text">{pol.name.substring(0, 2).toUpperCase()}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          default: return null;
                        }
                      };

                      return (
                        <ErrorBoundary key={card.id} name={`DistrictDashboard:${card.id}`}>
                          <div className="dp-dashboard-card" draggable
                            onDragStart={() => { dragSource.current = card.id; }}
                            onDragOver={(e) => e.preventDefault()}
                            onMouseEnter={() => {
                              if (!dragSource.current || dragSource.current === card.id) return;
                              setDashboardLayout(prev => {
                                const newList = [...prev];
                                const sIdx = newList.findIndex(c => c.id === dragSource.current);
                                const tIdx = newList.findIndex(c => c.id === card.id);
                                const tempOrder = newList[sIdx].order;
                                newList[sIdx].order = newList[tIdx].order;
                                newList[tIdx].order = tempOrder;
                                return newList;
                              });
                            }}
                            onDragEnd={() => { dragSource.current = null; }}>
                            <div className="dp-card-header">
                              <div className="dp-card-title">
                                <span style={{ marginRight: '10rem', display: 'flex', alignItems: 'center' }}>
                                  {cardIcons[card.id] || (
                                    <svg width="20rem" height="20rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                      <line x1="18" y1="20" x2="18" y2="10"/>
                                      <line x1="12" y1="20" x2="12" y2="4"/>
                                      <line x1="6" y1="20" x2="6" y2="14"/>
                                    </svg>
                                  )}
                                </span>
                                {card.title}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div className="dp-card-move-btn" onClick={() => handleMove(card.id, -1)} title="Move Left/Up">&lt;</div>
                                <div className="dp-card-move-btn" onClick={() => handleMove(card.id, 1)} title="Move Right/Down">&gt;</div>
                                <div className="dp-card-move-btn" style={{ marginLeft: '10rem', fontSize: '8rem', padding: '0 4rem' }} onClick={() => handleMove(card.id, -100)} title="Move to Top">TOP</div>
                                <div className="dp-card-move-btn" style={{ marginLeft: '4rem', fontSize: '8rem', padding: '0 4rem' }} onClick={() => handleMove(card.id, 100)} title="Move to Bottom">BTM</div>
                              </div>
                            </div>
                            <div className="dp-card-content">
                              {renderContent()}
                            </div>
                          </div>
                        </ErrorBoundary>
                      );
                    })}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
        </div>
        {/* Custom scrollbar */}
        {showScrollbar && (
          <div className="cb-scrollbar-track" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8rem', backgroundColor: getSafeColor('rgba(0,0,0,0.3)') }}>
            <div
              className="cb-scrollbar-thumb"
              style={{ position: 'absolute', right: 0, width: '8rem', backgroundColor: getSafeColor(isDragging ? 'rgba(80,184,233,0.8)' : 'rgba(80,184,233,0.5)'), borderRadius: '4rem', height: `${thumbHeight}px`, top: `${thumbTop}px`, cursor: 'pointer' }}
              onMouseDown={onThumbMouseDown}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DistrictsPanel;
