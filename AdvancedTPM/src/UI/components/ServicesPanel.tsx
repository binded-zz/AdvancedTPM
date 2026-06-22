import React, { useState, useMemo, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { camera, selectedInfo } from 'cs2/bindings';
import { Scrollable } from 'cs2/ui';
import { useLocalization } from 'cs2/l10n';
import { getSafeColor } from '../../mods/apiSafe';
import './ServicesPanel.css';
import CustomSelect from './CustomSelect';
import ServiceIcon from '../assets/ServiceIcon';
import PackIcon from '../assets/PackIcon';

interface ServiceBuildingInfo {
  entityKey: string;
  name: string;
  address: string;
  category: string;
  district: string;
  theme: string;
  themeIcon?: string;
  assetPack: string;
  assetPackIcon?: string;
  iconUrl?: string;
  level: number;
  capacity: number;
  usage: number;
  vehicles: number;
  vehiclesMax: number;
  currentOccupants: number;
  maxOccupants: number;
  currentEmployees: number;
  efficiency: number;
  attractiveness: number;
  workersMax: number;
  electricityConsumption: number;
  waterConsumption: number;
  garbageAccumulation: number;
  mailAccumulation: number;
  mailSending: number;
  mailReceiving: number;
  crimeProbability: number;
  condition: number;
  details: string[];
  isSignature: boolean;
  isLandmark: boolean;
  cityEffects?: string[];
  localEffects?: string[];
  addons?: string[];
}

interface ServiceSummary {
  id: number;
  name: string;
  type: string;
  category: string;
  budget: number;
  fee: number;
  upkeep: number;
  efficiency: number;
  coverage: number;
  capacity: number;
  usage: number;
}

const CATEGORIES = [
  'All', 
  'Electricity', 
  'Water & Sewage', 
  'Healthcare & Deathcare', 
  'Garbage Management', 
  'Education & Research', 
  'Fire & Rescue', 
  'Police & Administration', 
  'Transportation', 
  'Parks & Recreation', 
  'Communications', 
  'Welfare',
  'Other',
];

type SortField = 'name' | 'address' | 'category' | 'assetPack' | 'level' | 'capacity' | 'usage' | 'efficiency';
type SortDir = 'asc' | 'desc';

const parseServiceBuildingsData = (raw: string): ServiceBuildingInfo[] => {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map((s: any) => ({
      entityKey: String(s.entityKey || ''),
      name: String(s.name || ''),
      address: String(s.address || ''),
      category: String(s.category || ''),
      district: String(s.district || 'City'),
      theme: String(s.theme || 'USA'),
      themeIcon: String(s.themeIcon || ''),
      assetPack: String(s.assetPack || 'Base Game'),
      assetPackIcon: String(s.assetPackIcon || ''),
      iconUrl: String(s.iconUrl || ''),
      level: Number(s.level) || 0,
      capacity: Number(s.capacity) || 0,
      usage: Number(s.usage) || 0,
      vehicles: Number(s.vehicles) || 0,
      vehiclesMax: Number(s.vehiclesMax) || 0,
      currentOccupants: Number(s.currentOccupants) || 0,
      maxOccupants: Number(s.maxOccupants) || 0,
      currentEmployees: Number(s.currentEmployees) || 0,
      efficiency: Number(s.efficiency) || 0,
      attractiveness: Number(s.attractiveness) || 0,
      workers: Number(s.workers) || 0,
      workersMax: Number(s.workersMax) || 0,
      electricityConsumption: Number(s.electricityConsumption) || 0,
      waterConsumption: Number(s.waterConsumption) || 0,
      garbageAccumulation: Number(s.garbageAccumulation) || 0,
      mailAccumulation: Number(s.mailAccumulation) || 0,
      mailSending: Number(s.mailSending) || 0,
      mailReceiving: Number(s.mailReceiving) || 0,
      crimeProbability: Number(s.crimeProbability) || 0,
      condition: Number(s.condition) || 0,
      details: Array.isArray(s.details) ? s.details : [],
      addons: Array.isArray(s.addons) ? s.addons : [],
      cityEffects: Array.isArray(s.cityEffects) ? s.cityEffects : [],
      localEffects: Array.isArray(s.localEffects) ? s.localEffects : [],
      isSignature: !!s.isSignature,
      isLandmark: !!s.isLandmark,
    } as ServiceBuildingInfo)) : [];
  } catch (e) {
    return [];
  }
};

const parseServiceSummaries = (raw: string): ServiceSummary[] => {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
};

const getServiceRowTooltip = (b: ServiceBuildingInfo, labels?: any) => {
  const capLabel = labels?.cap || 'Capacity';
  const useLabel = labels?.use || 'Usage';
  const effLabel = labels?.eff || 'Efficiency';
  return `${b.address || b.name}\nLevel: ${b.level > 0 ? b.level : 'N/A'}\n${capLabel}: ${b.capacity.toFixed(0)}\n${useLabel}: ${b.usage.toFixed(0)}\n${effLabel}: ${b.efficiency.toFixed(0)}%\nTheme/Pack: ${b.theme || 'Base'} / ${b.assetPack || 'Base'}`;
};

const focusEntityKey = (entityKey: string) => {
  try {
    const parts = entityKey.split(',');
    const idx = Number(parts[0]) || 0;
    const ver = Number(parts[1]) || 0;
    const entity = { index: idx, version: ver };
    camera.focusEntity(entity);
    selectedInfo.selectEntity(entity);
  } catch (ex) {}
};

const formatPackName = (name: string): string => {
  if (!name || name === 'Base Game' || name === 'Custom' || name === 'DLC') return name;
  if (name.includes(' ')) return name;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
};

interface CycleFilterButtonProps {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  displayValue?: (val: string) => string;
}

const CycleFilterButton: React.FC<CycleFilterButtonProps> = ({ label, value, options, onChange, displayValue }) => {
  const currentIndex = Math.max(0, options.indexOf(value));
  const nextValue = () => {
    const nextVal = options[(currentIndex + 1) % options.length] || options[0] || value;
    onChange(nextVal);
  };
  return (
    <button className="svc-cycle-btn" onClick={nextValue} title={`${label}: ${value}. Click to cycle.`}>
      {displayValue ? displayValue(value) : `${label}: ${value}`}
    </button>
  );
};

const getStatusIcon = (l: string) => {
  if (l.includes('patient') || l.includes('health')) return 'Media/Game/Icons/TraumaCenter.svg';
  if (l.includes('ambulance')) return 'Media/Game/Icons/Healthcare.svg'; // Or MedicalHelicopters
  if (l.includes('inmate') || l.includes('jail')) return 'Media/Game/Icons/Prison.svg'; // Or Police
  if (l.includes('patrol')) return 'Media/Game/Icons/Police.svg';
  if (l.includes('fire')) return 'Media/Game/Icons/Flame.svg';
  if (l.includes('garbage') || l.includes('truck')) return 'Media/Game/Icons/Garbage.svg';
  if (l.includes('hearse') || l.includes('stored')) return 'Media/Game/Icons/Deathcare.svg';
  if (l.includes('student') || l.includes('school')) return 'Media/Game/Icons/Education.svg';
  if (l.includes('worker')) return 'Media/Game/Icons/Workers.svg';
  if (l.includes('attractiveness') || l.includes('tourism')) return 'Media/Game/Icons/Attractions.svg';
  if (l.includes('maintenance')) return 'Media/Game/Icons/ParkMaintenance.svg';
  return null;
};

// Icon for Efficiency buffer factor types (from Game.Buildings.EfficiencyFactor enum names)
const getEfficiencyFactorIcon = (factorName: string): string => {
  if (!factorName) return 'Media/Game/Icons/StarNotification.svg';
  const n = factorName.toLowerCase();
  if (n.includes('worker') || n.includes('employee') || n.includes('staff')) return 'Media/Game/Icons/Workers.svg';
  if (n.includes('electric') || n.includes('power')) return 'Media/Game/Icons/Electricity.svg';
  if (n.includes('water') || n.includes('sewage')) return 'Media/Game/Icons/Water.svg';
  if (n.includes('garbage') || n.includes('waste')) return 'Media/Game/Icons/Garbage.svg';
  if (n.includes('mail')) return 'Media/Game/Icons/Mail.svg';
  if (n.includes('crime')) return 'Media/Game/Icons/Crime.svg';
  if (n.includes('transport') || n.includes('access')) return 'Media/Game/Icons/Traffic.svg';
  if (n.includes('road') || n.includes('network')) return 'Media/Game/Icons/Roads.svg';
  if (n.includes('healthcare') || n.includes('hospital') || n.includes('sick')) return 'Media/Game/Icons/Healthcare.svg';
  if (n.includes('education') || n.includes('school') || n.includes('university') || n.includes('college')) return 'Media/Game/Icons/Education.svg';
  if (n.includes('wealth')) return 'Media/Game/Icons/Wealth.svg';
  if (n.includes('park') || n.includes('entertainment') || n.includes('attraction') || n.includes('leisure')) return 'Media/Game/Icons/ParksAndRecreation.svg';
  if (n.includes('welfare') || n.includes('wellbeing')) return 'Media/Game/Icons/Welfare.svg';
  if (n.includes('fire')) return 'Media/Game/Icons/FireAndRescue.svg';
  if (n.includes('deathcare') || n.includes('cemetery') || n.includes('crematorium')) return 'Media/Game/Icons/Deathcare.svg';
  if (n.includes('police')) return 'Media/Game/Icons/PoliceAndAdministration.svg';
  if (n.includes('telecom') || n.includes('network')) return 'Media/Game/Icons/Communications.svg';
  if (n.includes('pollution') || n.includes('noise')) return 'Media/Game/Icons/Pollution.svg';
  return 'Media/Game/Icons/StarNotification.svg';
};

const ServicesPanel: React.FC<{ servicesBuildingsData?: string; servicesBrowserData?: string }> = ({ servicesBuildingsData = '', servicesBrowserData = '' }) => {
   const { translate } = useLocalization();
   const buildings = useMemo(() => parseServiceBuildingsData(servicesBuildingsData || ''), [servicesBuildingsData]);
   const summaries = useMemo(() => parseServiceSummaries(servicesBrowserData || ''), [servicesBrowserData]);
   const safeBuildings = Array.isArray(buildings) ? buildings : [];
   const [categoryFilter, setCategoryFilter] = useState('All');
   const [packFilter, setPackFilter] = useState('All');
   const [themeFilter, setThemeFilter] = useState('All');
   const [districtFilter, setDistrictFilter] = useState('All');
   const [loadFilter, setLoadFilter] = useState<'All' | 'Empty' | 'Underused' | 'Busy' | 'Full'>('All');
   const [searchText, setSearchText] = useState('');
   const [sortField, setSortField] = useState<SortField>('name');
   const [sortDir, setSortDir] = useState<SortDir>('asc');
   const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
   const [isPaused, setIsPaused] = useState(false);
   const [currentPage, setCurrentPage] = useState(0);
   const SVC_PAGE_SIZE = 50;

   // Reset page and unpause when any filter/sort changes
   useEffect(() => {
     setCurrentPage(0);
     setExpandedEntity(null);
     setIsPaused(false);
   }, [categoryFilter, packFilter, themeFilter, districtFilter, loadFilter, searchText, sortField, sortDir]);

   const categories = useMemo(() => ['All', ...Array.from(new Set(safeBuildings.map((b) => b.category).filter(Boolean))).sort()], [safeBuildings]);
   const packs = useMemo(() => ['All', ...Array.from(new Set(safeBuildings.map((b) => b.assetPack).filter(Boolean))).sort()], [safeBuildings]);
   const themes = useMemo(() => ['All', ...Array.from(new Set(safeBuildings.map((b) => b.theme).filter(Boolean))).sort()], [safeBuildings]);
   const uniqueDistricts = useMemo(() => ['All', ...Array.from(new Set(safeBuildings.map((b) => b.district || 'City').filter(Boolean))).sort()], [safeBuildings]);

   const themeIconMap = useMemo(() => {
     const map = new Map<string, string>();
     safeBuildings.forEach(b => {
       if (b.theme && b.themeIcon && !map.has(b.theme)) {
         map.set(b.theme, b.themeIcon);
       }
     });
     // Add defaults
     if (!map.has('European')) map.set('European', 'Media/Game/Icons/ThemeEuropean.svg');
     if (!map.has('NorthAmerican')) map.set('NorthAmerican', 'Media/Game/Icons/ThemeNorthAmerican.svg');
     if (!map.has('EU')) map.set('EU', 'Media/Game/Icons/ThemeEuropean.svg');
     if (!map.has('USA')) map.set('USA', 'Media/Game/Icons/ThemeNorthAmerican.svg');
     return map;
   }, [safeBuildings]);

   const filtered = useMemo(() => {
     let list = safeBuildings;
     if (categoryFilter !== 'All') list = list.filter((b) => b.category === categoryFilter);
     if (packFilter !== 'All') list = list.filter((b) => b.assetPack === packFilter);
     if (themeFilter !== 'All') list = list.filter((b) => b.theme === themeFilter);
     if (districtFilter !== 'All') list = list.filter((b) => (b.district || 'City').trim() === districtFilter.trim());
     if (loadFilter !== 'All') {
       list = list.filter((b) => {
         const load = b.capacity > 0 ? b.usage / b.capacity : 0;
         switch (loadFilter) {
           case 'Empty': return (b.usage || 0) <= 0;
           case 'Underused': return load > 0 && load < 0.5;
           case 'Busy': return load >= 0.5 && load < 0.9;
           case 'Full': return load >= 0.9;
           default: return true;
         }
       });
     }
     if (searchText) {
       const lower = searchText.toLowerCase();
       list = list.filter((b) => (b.name || '').toLowerCase().includes(lower) || (b.address || '').toLowerCase().includes(lower) || (b.category || '').toLowerCase().includes(lower) || (b.assetPack || '').toLowerCase().includes(lower));
     }
     return [...list].sort((a, b) => {
       const dir = sortDir === 'asc' ? 1 : -1;
       switch (sortField) {
         case 'name': return dir * (a.name || '').localeCompare(b.name || '');
         case 'address': return dir * (a.address || '').localeCompare(b.address || '');
         case 'category': return dir * (a.category || '').localeCompare(b.category || '');
         case 'assetPack': return dir * (a.assetPack || '').localeCompare(b.assetPack || '');
         case 'level': return dir * (a.level - b.level);
         case 'capacity': return dir * (a.capacity - b.capacity);
         case 'usage': return dir * (a.usage - b.usage);
         case 'efficiency': return dir * (a.efficiency - b.efficiency);
         default: return 0;
       }
     });
   }, [safeBuildings, categoryFilter, packFilter, themeFilter, districtFilter, loadFilter, searchText, sortField, sortDir]);

   const handleSort = (field: SortField) => {
     if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
     else { setSortField(field); setSortDir(field === 'name' || field === 'address' || field === 'category' || field === 'assetPack' ? 'asc' : 'desc'); }
   };
   const sortIndicator = (field: SortField) => sortField === field ? (sortDir === 'asc' ? ' (asc)' : ' (desc)') : '';

   const serviceLabels = useMemo(() => {
     const k = (categoryFilter || '').toLowerCase();
     if (k.includes('education') || k.includes('school') || k.includes('university')) {
       return { cap: 'Students', use: 'Enrolled', eff: 'Quality' };
     }
     if (k.includes('police') || k.includes('fire') || k.includes('health') || k.includes('hospital') || k.includes('deathcare')) {
       return { cap: 'Capacity', use: 'Active', eff: 'Coverage' };
     }
     if (k.includes('transport')) {
       return { cap: 'Fleet/Cap', use: 'Riders', eff: 'Coverage' };
     }
     if (k.includes('garbage') || k.includes('waste') || k.includes('water') || k.includes('electric')) {
       return { cap: 'Throughput', use: 'Load', eff: 'Util.' };
     }
     return { cap: 'Cap', use: 'Use', eff: 'Eff' };
   }, [categoryFilter]);

   if (safeBuildings.length === 0 && summaries.length === 0) {
     if (servicesBuildingsData && servicesBuildingsData.length > 0) return <div className="svc-panel-empty">No service buildings parsed yet.</div>;
     return <div className="svc-panel-empty">Service building data will appear when the simulation is running.</div>;
   }

   return (
     <div className="svc-panel">
       <div className="svc-filters">
          <div className="svc-category-tabs">
            {categories.map((c) => (
              <button
                key={c}
                className={`svc-category-tab${categoryFilter === c ? ' svc-category-active' : ''}`}
                onClick={() => setCategoryFilter(c)}
              >
                {c !== 'All' && <ServiceIcon category={c} size={16} style={{ marginRight: '6rem' }} />}
                {c}
              </button>
            ))}
          </div>
         <div className="svc-controls">
           <input className="svc-search" placeholder="Search service buildings..." value={searchText} onInput={(e: any) => setSearchText(e.target.value || '')} />
             <div className="svc-filter-group">
                <CustomSelect
                  label="Pack"
                  value={packFilter}
                  options={packs}
                  onChange={setPackFilter}
                  displayValue={(v) => v === 'All' ? 'All Packs' : formatPackName(v)}
                  icon={(v) => v === 'All' ? null : <PackIcon pack={v} iconUrl={safeBuildings.find(b => b.assetPack === v)?.assetPackIcon} size={24} />}
                />
                <CustomSelect
                  label="Theme"
                  value={themeFilter}
                  options={themes}
                  onChange={setThemeFilter}
                  displayValue={(v) => v === 'All' ? 'All Themes' : v}
                  icon={(v) => v === 'All' ? null : <PackIcon pack={v} iconUrl={themeIconMap.get(v)} size={24} />}
                />
                <CustomSelect
                  label="District"
                  value={districtFilter || 'All'}
                  options={uniqueDistricts}
                  onChange={setDistrictFilter}
                  displayValue={(v) => v === 'All' ? 'All Districts' : v}
                />
                <CycleFilterButton label="Load" value={loadFilter} options={['All', 'Empty', 'Underused', 'Busy', 'Full']} onChange={(v) => setLoadFilter(v as any)} displayValue={(v) => v === 'All' ? 'All Load' : v} />
             </div>
         </div>
       </div>

       {summaries.length > 0 && (
          <div className="svc-summary-grid">
            <div className="svc-summary-header">
              <span>Global Service Status</span>
              <span className="svc-summary-count">{summaries.length} services</span>
            </div>
            <div className="svc-summary-items">
              {summaries.filter(s => categoryFilter === 'All' || s.category === categoryFilter).map((s) => {
                const loadPct = s.capacity > 0 ? Math.min(100, Math.round((s.usage / s.capacity) * 100)) : 0;
                return (
                  <div key={s.id} className="svc-summary-card">
                    <div className="svc-summary-card-top">
                      <ServiceIcon category={s.name} size={20} />
                      <div className="svc-summary-name">{s.name}</div>
                      <div className="svc-summary-budget" title="Budget Allocation">{s.budget.toFixed(0)}%</div>
                    </div>
                    <div className="svc-summary-card-body">
                      <div className="svc-summary-stat">
                        <span className="label">Efficiency</span>
                        <span className="value" style={{ color: getSafeColor(s.efficiency >= 90 ? '#8bdb46' : s.efficiency >= 50 ? '#50b8e9' : '#e05050') }}>{s.efficiency.toFixed(0)}%</span>
                      </div>
                      <div className="svc-summary-stat">
                        <span className="label">Usage</span>
                        <span className="value">{loadPct}%</span>
                      </div>
                      <div className="svc-summary-bar-bg">
                        <div className="svc-summary-bar-fill" style={{ width: `${loadPct}%`, backgroundColor: getSafeColor(loadPct > 90 ? '#e05050' : loadPct > 70 ? '#f0ad4e' : '#50b8e9') }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

       <div className="svc-table">
         <div className="svc-table-header">
           <div className="svc-col-name svc-sortable" onClick={() => handleSort('name')}>Building{sortIndicator('name')}</div>
           {categoryFilter === 'All' && <div className="svc-col-category svc-sortable" onClick={() => handleSort('category')}>Category{sortIndicator('category')}</div>}
           <div className="svc-col-pack svc-sortable" onClick={() => handleSort('assetPack')}>Pack{sortIndicator('assetPack')}</div>
           <div className="svc-col-level svc-sortable" onClick={() => handleSort('level')}>Lv{sortIndicator('level')}</div>
           <div className="svc-col-cap svc-sortable" onClick={() => handleSort('capacity')}>{serviceLabels.cap}{sortIndicator('capacity')}</div>
           <div className="svc-col-usage svc-sortable" onClick={() => handleSort('usage')}>{serviceLabels.use}{sortIndicator('usage')}</div>
           <div className="svc-col-eff svc-sortable" onClick={() => handleSort('efficiency')}>{serviceLabels.eff}{sortIndicator('efficiency')}</div>
           <div className="svc-col-go">Go</div>
         </div>
         <div className="svc-table-scroll-wrap">
           <Scrollable vertical={true} className="svc-table-body" trackVisibility="scrollable">
              {(() => {
                const totalPages = Math.max(1, Math.ceil(filtered.length / SVC_PAGE_SIZE));
                const safePage = Math.min(currentPage, totalPages - 1);
                return filtered.slice(safePage * SVC_PAGE_SIZE, safePage * SVC_PAGE_SIZE + SVC_PAGE_SIZE);
              })().map((b) => (
                <React.Fragment key={b.entityKey}>
                  <div className={`svc-table-row${expandedEntity === b.entityKey ? ' svc-row-expanded' : ''}`}
                    onClick={() => {
                      if (expandedEntity === b.entityKey) {
                        setExpandedEntity(null);
                        setIsPaused(false);
                      } else {
                        setExpandedEntity(b.entityKey);
                        setIsPaused(true);
                      }
                    }}
                    title={getServiceRowTooltip(b, serviceLabels)}>
                    <div className="svc-col-name">
                      <span className="svc-expand-arrow">{expandedEntity === b.entityKey ? '\u25BC' : '\u25B6'}</span>
                      {b.isSignature && <span className="svc-signature-badge" title="Signature Building">★</span>}
                      <ServiceIcon category={b.category} size={24} />
                      <span>{b.address || b.name}</span>
                    </div>
                   {categoryFilter === 'All' && <div className="svc-col-category">{b.category}</div>}
                   <div className="svc-col-pack" style={{ display: 'flex', alignItems: 'center' }}><PackIcon pack={b.assetPack} iconUrl={b.assetPackIcon} size={24} /></div>
                   <div className="svc-col-level">{b.level > 0 ? `Lv ${b.level}` : '—'}</div>
                   <div className="svc-col-cap">{b.capacity.toFixed(0)}</div>
                   <div className="svc-col-usage">{b.usage.toFixed(0)}</div>
                   <div className="svc-col-eff" style={{ color: getSafeColor(b.efficiency >= 90 ? '#8bdb46' : b.efficiency >= 50 ? '#50b8e9' : '#e05050') }}>{b.efficiency.toFixed(0)}%</div>
                   <div className="svc-col-go">
                     <button className="svc-go-btn" onClick={(e) => { e.stopPropagation(); focusEntityKey(b.entityKey); }}>GO</button>
                   </div>
                 </div>
                 {expandedEntity === b.entityKey && (() => {
                    return (
                      <div className="svc-expanded-panel">
                        <div className="svc-detail-grid">
                          {/* Main Details */}
                          <div className="svc-detail-main">
                            <div className="svc-detail-row svc-detail-entity-id-row">
                              <span className="svc-detail-label">Entity ID</span>
                              <span className="svc-entity-id-badge">{b.entityKey}</span>
                            </div>
                            <div className="svc-detail-row"><span className="svc-detail-label">Category</span><span className="svc-detail-value">{b.category}</span></div>
                            <div className="svc-detail-row"><span className="svc-detail-label">Building</span><span className="svc-detail-value">{b.name}</span></div>
                            <div className="svc-detail-row"><span className="svc-detail-label">District</span><span className="svc-detail-value">{b.district}</span></div>
                            <div className="svc-detail-row"><span className="svc-detail-label">Theme / Pack</span><span className="svc-detail-value">{b.theme} / <PackIcon pack={b.assetPack} iconUrl={b.assetPackIcon} size={20} style={{ marginLeft: '6rem', marginRight: '4rem' }} />{b.assetPack}</span></div>
                            {b.level > 0 && <div className="svc-detail-row"><span className="svc-detail-label">Level</span><span className="svc-detail-value">Lv {b.level}</span></div>}
                            {b.capacity > 0 && <div className="svc-detail-row"><span className="svc-detail-label">{serviceLabels.cap}</span><span className="svc-detail-value">{b.capacity.toFixed(0)}</span></div>}
                            {b.usage > 0 && <div className="svc-detail-row"><span className="svc-detail-label">{serviceLabels.use}</span><span className="svc-detail-value">{b.usage.toFixed(0)}{b.capacity > 0 ? ` (${Math.round(b.usage / b.capacity * 100)}%)` : ''}</span></div>}
                            {b.maxOccupants > 0 && (
                              <div className="svc-detail-row">
                                <span className="svc-detail-label">
                                  <img src={
                                    b.category.includes('Education') ? 'Media/Game/Icons/Education.svg' :
                                    b.category.includes('Healthcare') ? 'Media/Game/Icons/TraumaCenter.svg' :
                                    b.category.includes('Police') ? 'Media/Game/Icons/Prison.svg' :
                                    'Media/Game/Icons/Citizens.svg'
                                  } style={{ width: '16px', height: '16px', filter: 'brightness(0.9)' }} alt="" />
                                  Occupancy
                                </span>
                                <span className="svc-detail-value">
                                  {`${b.currentOccupants.toFixed(0)} / ${b.maxOccupants.toFixed(0)}`} {b.maxOccupants > 0 ? `(${Math.round((b.currentOccupants / b.maxOccupants) * 100)}%)` : ''}
                                </span>
                              </div>
                            )}
                            {b.vehiclesMax > 0 && (
                              <div className="svc-detail-row">
                                <span className="svc-detail-label">
                                  <img src={
                                    b.category.includes('Healthcare') ? 'Media/Game/Icons/Healthcare.svg' :
                                    b.category.includes('Police') ? 'Media/Game/Icons/Police.svg' :
                                    b.category.includes('Fire') ? 'Media/Game/Icons/Flame.svg' :
                                    b.category.includes('Garbage') ? 'Media/Game/Icons/Garbage.svg' :
                                    b.category.includes('Deathcare') ? 'Media/Game/Icons/Deathcare.svg' :
                                    'Media/Game/Icons/TransportBus.svg'
                                  } style={{ width: '16px', height: '16px', filter: 'brightness(0.9)' }} alt="" />
                                  Active Vehicles
                                </span>
                                <span className="svc-detail-value">
                                  {`${b.vehicles.toFixed(0)} / ${b.vehiclesMax.toFixed(0)}`} {b.vehiclesMax > 0 ? `(${Math.round((b.vehicles / b.vehiclesMax) * 100)}%)` : ''}
                                </span>
                              </div>
                            )}
                            <div className="svc-detail-row">
                              <span className="svc-detail-label">
                                <img src="Media/Game/Icons/Workers.svg" style={{ width: '16px', height: '16px', filter: 'brightness(0.9)' }} alt="" />
                                Employees
                              </span>
                              <span className="svc-detail-value">
                                {`${b.currentEmployees.toFixed(0)} / ${b.workersMax.toFixed(0)}`} {b.workersMax > 0 ? `(${Math.round((b.currentEmployees / b.workersMax) * 100)}%)` : ''}
                              </span>
                            </div>
                          </div>

                          {/* Utilities (In / Out) */}
                          <div className="svc-detail-middle">
                            <div className="svc-detail-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '8px' }}>
                              <span className="svc-detail-label" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>Utilities</span>
                            </div>
                            <div className="svc-detail-row">
                              <span className="svc-detail-label">
                                <img src="Media/Game/Icons/Electricity.svg" style={{ width: '16px', height: '16px' }} alt="" /> {translate('Properties.ELECTRICITY', 'Electricity')}
                              </span>
                              <span className="svc-detail-value">
                                {b.electricityConsumption > 0 ? `${b.electricityConsumption.toFixed(0)} kW` : b.electricityConsumption < 0 ? `+${Math.abs(b.electricityConsumption).toFixed(0)} kW` : '0'}
                              </span>
                            </div>
                            <div className="svc-detail-row">
                              <span className="svc-detail-label">
                                <img src="Media/Game/Icons/Water.svg" style={{ width: '16px', height: '16px' }} alt="" /> {translate('Properties.WATER', 'Water')}
                              </span>
                              <span className="svc-detail-value">{b.waterConsumption > 0 ? `${b.waterConsumption.toFixed(0)} m³` : '0'}</span>
                            </div>
                            <div className="svc-detail-row">
                              <span className="svc-detail-label">
                                <img src="Media/Game/Icons/Garbage.svg" style={{ width: '16px', height: '16px' }} alt="" /> {translate('Properties.GARBAGE', 'Garbage')}
                              </span>
                              <span className="svc-detail-value">{b.garbageAccumulation > 0 ? `${b.garbageAccumulation.toFixed(0)} t` : '0'}</span>
                            </div>

                            
                            {b.details.length > 0 && (
                               <div style={{ marginTop: '8rem', paddingTop: '8rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                 <div style={{ fontSize: '10rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6rem', letterSpacing: '0.06em' }}>Efficiency Factors</div>
                                 {b.details.map((d, i) => {
                                   const colonIdx = d.indexOf(':');
                                   const rawLabel = colonIdx >= 0 ? d.substring(0, colonIdx).trim() : d;
                                   const capitalizedLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
                                   const label = capitalizedLabel.replace(/([a-z])([A-Z])/g, '$1 $2');
                                   const value = colonIdx >= 0 ? d.substring(colonIdx + 1).trim() : '';
                                   const pct = parseFloat(value);
                                   const iconUrl = getEfficiencyFactorIcon(rawLabel);
                                   const effColor = !isNaN(pct) ? getSafeColor(pct >= 100 ? '#8bdb46' : pct >= 75 ? '#50b8e9' : pct >= 50 ? '#f0ad4e' : '#e05050') : 'rgba(255,255,255,0.75)';
                                   return (
                                     <div key={`det-${i}`} className="svc-detail-row" style={{ marginBottom: '3rem' }}>
                                       <span className="svc-detail-label">
                                         <img src={iconUrl} style={{ width: '14px', height: '14px', opacity: 0.7 }} alt="" />
                                         {label}
                                       </span>
                                       <span className="svc-detail-value" style={{ color: effColor }}>{value}</span>
                                     </div>
                                   );
                                 })}
                               </div>
                             )}
                          </div>

                          {/* Building Factors / Addons */}
                          <div className="svc-detail-factors">
                            <div className="svc-detail-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '8px' }}>
                              <span className="svc-detail-label" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>Building Factors</span>
                            </div>
                            <div className="svc-detail-row">
                              <span className="svc-detail-label">Efficiency</span>
                              <span className="svc-detail-value" style={{ color: getSafeColor(b.efficiency >= 90 ? '#8bdb46' : b.efficiency >= 50 ? '#e88c3a' : '#e05050') }}>{b.efficiency.toFixed(0)}%</span>
                            </div>
                            <div className="svc-detail-row">
                              <span className="svc-detail-label">Condition</span>
                              <span className="svc-detail-value">{b.condition > 0 ? `${b.condition.toFixed(0)}%` : 'Perfect'}</span>
                            </div>
                            <div className="svc-detail-row">
                              <span className="svc-detail-label">Crime</span>
                              <span className="svc-detail-value">
                                {(() => {
                                  const val = b.crimeProbability || 0;
                                  if (val <= 0) return 'Safe (0)';
                                  if (val < 100) return `Low (${val.toFixed(0)})`;
                                  if (val < 500) return `Moderate (${val.toFixed(0)})`;
                                  if (val < 1500) return `High (${val.toFixed(0)})`;
                                  return `Dangerous (${val.toFixed(0)})`;
                                })()}
                              </span>
                            </div>
                            <div className="svc-detail-row"><span className="svc-detail-label">Mail Sending</span><span className="svc-detail-value">{b.mailSending || 0}</span></div>
                            <div className="svc-detail-row"><span className="svc-detail-label">Mail Receiving</span><span className="svc-detail-value">{b.mailReceiving || 0}</span></div>
                            {b.attractiveness > 0 && (
                              <div className="svc-detail-row">
                                <span className="svc-detail-label">
                                  <img src="Media/Game/Icons/Attractions.svg" style={{ width: '16px', height: '16px', filter: 'brightness(0.9)' }} alt="" />
                                  Attractiveness
                                </span>
                                <span className="svc-detail-value" style={{ color: getSafeColor('#3fc9d8') }}>{b.attractiveness}</span>
                              </div>
                            )}

                            {b.addons && b.addons.length > 0 && (
                              <div style={{ marginTop: '8rem', paddingTop: '8rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <span className="svc-detail-label">Installed Add-ons:</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6rem', marginTop: '6rem' }}>
                                  {b.addons.map((addon, idx) => (
                                    <span key={`addon-${idx}`} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                                      {addon}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          { (b.cityEffects?.length || 0) > 0 || (b.localEffects?.length || 0) > 0 ? (
                            <div className="svc-detail-factors">
                              {b.cityEffects && b.cityEffects.length > 0 && (
                                <>
                                  <div className="svc-detail-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '8px' }}>
                                    <span className="svc-detail-label" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>City Effects</span>
                                  </div>
                                  {b.cityEffects.map((ef, i) => (
                                    <div key={`ce-${i}`} className="svc-detail-row">
                                      <span className="svc-detail-label" style={{ flex: '1 1 100%' }}>
                                        <img src={getEfficiencyFactorIcon(ef)} style={{ width: '14px', height: '14px', opacity: 0.7, marginRight: '6px', verticalAlign: 'middle' }} alt="" />
                                        {ef}
                                      </span>
                                    </div>
                                  ))}
                                </>
                              )}
                              {b.localEffects && b.localEffects.length > 0 && (
                                <>
                                  <div className="svc-detail-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '8px', marginTop: b.cityEffects?.length ? '10rem' : '0' }}>
                                    <span className="svc-detail-label" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>Local Effects</span>
                                  </div>
                                  {b.localEffects.map((ef, i) => (
                                    <div key={`le-${i}`} className="svc-detail-row">
                                      <span className="svc-detail-label" style={{ flex: '1 1 100%' }}>
                                        <img src={getEfficiencyFactorIcon(ef)} style={{ width: '14px', height: '14px', opacity: 0.7, marginRight: '6px', verticalAlign: 'middle' }} alt="" />
                                        {ef}
                                      </span>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
               </React.Fragment>
             ))}
             {filtered.length === 0 && <div className="svc-panel-empty">No buildings match filter.</div>}
            </Scrollable>
            {/* Pagination controls */}
            {filtered.length > SVC_PAGE_SIZE && (() => {
              const totalPages = Math.max(1, Math.ceil(filtered.length / SVC_PAGE_SIZE));
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

export default ServicesPanel;
