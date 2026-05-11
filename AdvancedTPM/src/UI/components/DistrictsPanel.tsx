import React, { useMemo, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { parseCompanies } from './CompanyBrowser';
import apiSafe from '../../mods/apiSafe';
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
  localServices: number;
  assignedServices: number;
  profitability: number;
  dogs: number; upkeep: number; resourceCost: number; feesPaid: number;
  sick: number; students: number; totalCrime: number; homeless: number;
  happinessFactors: number[][];
  
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
}

const ICON = 'Media/Game/Icons/';
const CUR = `${ICON}Economy.svg`;

const fmt = (n: number) => {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const happinessInfo = (h: number) => {
  if (h >= 75) return { label: 'Happy', color: '#8bdb46' };
  if (h >= 50) return { label: 'Content', color: '#b8d946' };
  if (h >= 25) return { label: 'Unhappy', color: '#e0a050' };
  return { label: 'Miserable', color: '#e05050' };
};

const HAPPINESS_FACTORS = [
  "Reliable internet service", "High crime risk", "Air pollution", "Spacious homes", "Reliable electricity", 
  "Reliable healthcare coverage", "Ground pollution", "High noise pollution", "Reliable water supply", 
  "Water pollution", "Reliable sewage backup", "Garbage buildup", "Abundance of entertainment", 
  "Walking distance to school", "Reliable mail service", "Welfare", "Abundance of leisure time", 
  "Fair taxes", "Proximity effects", "Consumption", "Traffic jams", "Recent deaths", "Homelessness", 
  "Electricity fee", "Water fee", "Small homes", "Unemployment", "Poor social security", 
  "Service upgrades", "Wealth"
];

const wealthLabel = (w: number) => {
  if (w >= 10000) return 'Wealthy';
  if (w >= 5000) return 'Comfortable';
  if (w >= 1000) return 'Moderate';
  return 'Poor';
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
  if (cap <= 0) return { text: '0%', color: 'rgba(255,255,255,0.4)' };
  const val = ((cap - enrolled) / cap) * 100;
  return { text: `${val > 0 ? '+' : ''}${val.toFixed(0)}%`, color: val >= 10 ? '#8bdb46' : (val > 0 ? '#b8d946' : '#e57373') };
};

const StatRow = ({ label, val, style }: { label: string; val: string | number; style?: React.CSSProperties }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12rem', fontSize: '13rem', padding: '1rem 0', color: 'rgba(255,255,255,0.85)', ...style }}>
    <span style={{ opacity: 0.7 }}>{label}</span>
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
  const [sortField, setSortField] = useState<DistrictSortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
    if (dk) {
      if (dk !== 'city') {
        const p = dk.split(',');
        const idx = parseInt(p[0]) || 0;
        const ver = parseInt(p[1]) || 0;
        apiSafe.trigger('camera', 'focusEntity', { index: idx, version: ver });
        apiSafe.trigger('selection', 'focusEntity', { index: idx, version: ver });
      }
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
        localServices: 0, assignedServices: 0, profitability: 0, dogs: 0, upkeep: 0, resourceCost: 0, feesPaid: 0, 
        sick: 0, students: 0, totalCrime: 0, homeless: 0, happinessFactors: [],
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
      d.children = a.children || 0; d.teens = a.teens || 0; d.adults = a.adults || 0; d.seniors = a.seniors || 0;
      d.eduUneducated = a.eduUneducated || 0; d.eduPoorlyEducated = a.eduPoorlyEducated || 0;
      d.eduEducated = a.eduEducated || 0; d.eduWellEducated = a.eduWellEducated || 0; d.eduHighlyEducated = a.eduHighlyEducated || 0;
      d.localServices = a.localServices || 0;
      d.assignedServices = a.assignedServices || 0;
      d.profitability = a.profitability || 0;
      d.dogs = a.dogs || 0; d.upkeep = a.upkeep || 0; d.resourceCost = a.resourceCost || 0; d.feesPaid = a.feesPaid || 0;
      d.sick = a.sick || 0; d.students = a.students || 0; d.totalCrime = a.totalCrime || 0; d.homeless = a.homeless || 0;
      d.happinessFactors = a.happinessFactors || [];
      
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
        <div style={{ display: 'flex', height: '12rem', borderRadius: '3rem', overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
          {items.map((it, idx) => it.value > 0 ? (
            <div key={idx} style={{ width: `${(it.value / total) * 100}%`, background: it.color, minWidth: '2rem' }} title={`${it.label}: ${fmt(it.value)}`} />
          ) : null)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '5rem' }}>
          {items.filter(it => it.value > 0).map((it, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', marginRight: '12rem', marginBottom: '3rem', fontSize: '13rem', color: 'rgba(255,255,255,0.7)' }}>
              <div style={{ width: '10rem', height: '10rem', borderRadius: '2rem', background: it.color, marginRight: '5rem', flexShrink: 0 }} />
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
      <div className="tab-buttons">
          <button className={`tab-btn ${activeTab === 'Residential' ? 'active' : ''}`} onClick={() => apiSafe.trigger('taxProduction', 'setActiveTab', 'Residential')}>RESIDENTIAL</button>
          <button className={`tab-btn ${activeTab === 'Services' ? 'active' : ''}`} onClick={() => apiSafe.trigger('taxProduction', 'setActiveTab', 'Services')}>SERVICES</button>
          <button className={`tab-btn ${activeTab === 'Companies' ? 'active' : ''}`} onClick={() => apiSafe.trigger('taxProduction', 'setActiveTab', 'Companies')}>COMPANIES</button>
          <button className={`tab-btn ${activeTab === 'Districts' ? 'active' : ''}`} onClick={() => apiSafe.trigger('taxProduction', 'setActiveTab', 'Districts')}>DISTRICTS</button>
          <button className={`tab-btn debug-toggle ${showDebug ? 'active' : ''}`} onClick={onToggleDebug}>DEBUG</button>
      </div>
      <div className="dp-header">
        <div className="dp-col-exp" />
        <SortHdr field="name" label="District Name" className="dp-col-name" />
        <SortHdr field="residential" label="Res (Pure)" className="dp-col-count" />
        <SortHdr field="mixed" label="Mixed" className="dp-col-count" />
        <SortHdr field="resTotal" label="Res Total" className="dp-col-count" />
        <SortHdr field="services" label="Svc Bldgs" className="dp-col-count" />
        <SortHdr field="businesses" label="Biz Bldgs" className="dp-col-count" />
        <SortHdr field="residents" label="Residents" className="dp-col-count" />
        <SortHdr field="workers" label="Employees" className="dp-col-count" />
        <SortHdr field="policies" label="Policies" className="dp-col-policies" />
        <div className="dp-col-go">Go</div>
      </div>
      <div className="dp-body-wrapper" style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        <div className="dp-body" ref={scrollRef} onScroll={updateScroll} style={{ flex: 1, overflowY: 'scroll', overflowX: 'hidden' }}>
          {rows.map(r => {
          const hI = happinessInfo(r.avgHappiness);
          const isExp = expandedRow === r.name;
          return (
            <React.Fragment key={r.name}>
              <div className={`dp-row${r.isCity ? ' dp-row-city' : ''}${isExp ? ' dp-row-expanded' : ''}`}
                onClick={() => setExpandedRow(isExp ? null : r.name)}>
                <div className="dp-col-exp"><span className="dp-arrow">{isExp ? 'v' : '>'}</span></div>
                <div className="dp-col-name">
                  <span style={{ fontWeight: r.entityKey ? '800' : '400', color: r.isCity ? '#50b8e9' : 'inherit' }}>
                    {r.isCity ? `City (${r.cityName})` : r.name}
                  </span>
                </div>
                <div className="dp-col-count">{fmt(r.residential)}</div>
                <div className="dp-col-count" style={{color:'#ffb74d'}}>{fmt(r.mixed)}</div>
                <div className="dp-col-count" style={{color:'#50b8e9', fontWeight: 800}}>{fmt(r.resTotal)}</div>
                <div className="dp-col-count">{fmt(r.services)}</div>
                <div className="dp-col-count">{fmt(r.businesses)}</div>
                <div className="dp-col-count" style={{color:'#64b5f6'}}>{fmt(r.residents)}</div>
                <div className="dp-col-count" style={{color:'#81c784'}}>{fmt(r.workers)}</div>
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
                  {r.entityKey && <button className="dp-go-btn" onClick={e => { e.stopPropagation(); handleJump(r.entityKey!); }}>GO</button>}
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
                        <span className="dp-expanded-name" style={{ color: r.isCity ? '#50b8e9' : '#fff' }}>
                          {r.isCity ? `City (${r.cityName})` : r.name}
                        </span>
                        {r.entityKey && !r.isCity && (
                          <button className="dp-edit-btn" onClick={() => { setTempName(r.name); setEditingName(r.name); }}>RENAME</button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Row 1: Core Summary (Properties, Level, Size, Pop, Density) */}
                  <div className="dp-stats-grid">
                    <div className="dp-stat-card dp-stat-card-tooltip">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Zoning.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Properties</div>
                        <div className="dp-stat-value">{fmt((r.resProp || 0) + (r.comProp || 0) + (r.indProp || 0) + (r.offProp || 0) + (r.storProp || 0) + (r.mixedProp || 0))}</div>
                      </div>
                      <div className="dp-tooltip-content" style={{ width: 'max-content', minWidth: '180rem' }}>
                        <div style={{ marginBottom: '6rem', fontWeight: 700, color: '#50b8e9', fontSize: '14rem' }}>Property Breakdown</div>
                        <StatRow label="Res (Pure)" val={fmt(r.resProp || 0)} />
                        {(r.mixedProp || 0) > 0 && <StatRow label="Mixed Housing" val={fmt(r.mixedProp || 0)} style={{ paddingLeft: '15rem', opacity: 0.9, fontSize: '13rem' }} />}
                        <StatRow label="Total Res" val={fmt((r.resProp || 0) + (r.mixedProp || 0))} style={{ fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '2rem', paddingTop: '2rem' }} />
                        <div style={{ height: '4rem' }} />
                        <StatRow label="Commercial" val={fmt(r.comProp || 0)} />
                        <StatRow label="Industrial" val={fmt(r.indProp || 0)} />
                        <StatRow label="Office" val={fmt(r.offProp || 0)} />
                        <StatRow label="Storage" val={fmt(r.storProp || 0)} />
                      </div>
                    </div>
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Upkeep.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Avg Level</div>
                        <div className="dp-stat-value">{(r.buildingLevelSamples ? (r.buildingLevelSum! / r.buildingLevelSamples).toFixed(1) : 0)}</div>
                      </div>
                    </div>
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Districts.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Size</div>
                        <div className="dp-stat-value">{r.area ? (r.area / 1000000).toFixed(1) : 0} km²</div>
                      </div>
                    </div>
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Population.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Population</div>
                        <div className="dp-stat-value">{fmt(r.residents)}</div>
                        <div style={{ display: 'flex', gap: '8rem', marginTop: '2rem' }}>
                          {r.dogs > 0 && <div style={{ fontSize: '13rem', color: '#ffb74d' }}>Pets: {fmt(r.dogs)}</div>}
                          {r.homeless > 0 && <div style={{ fontSize: '13rem', color: '#e57373' }}>Homeless: {fmt(r.homeless)}</div>}
                        </div>
                      </div>
                    </div>
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Population.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Density</div>
                        <div className="dp-stat-value">{r.area && r.area > 0 ? fmt(Math.round(r.residents / (r.area / 1000000))) : 0} /km²</div>
                      </div>
                    </div>
                  </div>

                  <div className="dp-stats-grid">
                    <div className="dp-stat-card dp-stat-card-tooltip">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Citizen.svg`} className="dp-stat-icon" alt="" style={{ filter: `drop-shadow(0 0 3rem ${hI.color})` }} /></div>
                      <div>
                        <div className="dp-stat-label">{r.isCity ? 'Authoritative Happiness' : 'District Happiness'}</div>
                        <div className="dp-happiness-status">
                          <span className="dp-happiness-text" style={{ color: hI.color }}>{hI.label}</span>
                          <span className="dp-happiness-pct">{r.avgHappiness}%</span>
                        </div>
                      </div>
                      <div className="dp-tooltip-content">
                        <div style={{ marginBottom: '6rem', fontWeight: 700, color: hI.color, fontSize: '14rem' }}>{hI.label}</div>
                        <div>Aggregated wellbeing from all district residents.</div>
                        <div style={{ marginTop: '6rem', fontSize: '11rem', color: 'rgba(255,255,255,0.6)' }}>
                          This metric reflects the authoritative internal simulation state (Wellbeing component).
                        </div>
                      </div>
                    </div>
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={CUR} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Avg Wealth</div>
                        <div className="dp-stat-value" style={{ color: '#8bdb46' }}>
                          {wealthLabel(r.avgWealth)}
                        </div>
                      </div>
                    </div>
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={CUR} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Avg Income</div>
                        <div className="dp-stat-value"><img src={CUR} className="dp-currency-icon" alt="" />{fmt(r.avgIncome)}</div>
                      </div>
                    </div>
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={CUR} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Avg Rent</div>
                        <div className="dp-stat-value"><img src={CUR} className="dp-currency-icon" alt="" />{fmt(r.avgRent)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dp-stats-grid dp-side-by-side">
                    <div className="dp-stat-card dp-stat-card-wide" style={{ flex: 1, minWidth: '0' }}>
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Population.svg`} className="dp-stat-icon" alt="" /></div>
                      <div style={{ flex: 1 }}>
                        <div className="dp-stat-label">Demographics</div>
                        <MiniBar items={[
                          { label: 'Children', value: r.children, color: '#64b5f6' },
                          { label: 'Teens', value: r.teens, color: '#4dd0e1' },
                          { label: 'Adults', value: r.adults, color: '#81c784' },
                          { label: 'Seniors', value: r.seniors, color: '#ffb74d' },
                        ]} />
                        <div style={{ marginTop: '4rem', fontSize: '11rem', color: 'rgba(255,255,255,0.4)' }}>
                          Sustainability Ratio: {(r.seniors > 0 ? (r.workers / r.seniors).toFixed(1) : '∞')} (Workers/Pensioners)
                        </div>
                      </div>
                    </div>
                    <div className="dp-stat-card dp-stat-card-wide" style={{ flex: 1, minWidth: '0' }}>
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Education.svg`} className="dp-stat-icon" alt="" /></div>
                      <div style={{ flex: 1 }}>
                        <div className="dp-stat-label">Education</div>
                        <MiniBar items={[
                          { label: 'Uneducated', value: r.eduUneducated, color: '#e57373' },
                          { label: 'Poorly Educated', value: r.eduPoorlyEducated, color: '#ffb74d' },
                          { label: 'Educated', value: r.eduEducated, color: '#fff176' },
                          { label: 'Well Educated', value: r.eduWellEducated, color: '#81c784' },
                          { label: 'Highly Educated', value: r.eduHighlyEducated, color: '#64b5f6' },
                        ]} />
                      </div>
                    </div>
                  </div>

                  <div className="dp-stats-grid">
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Household.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Households</div>
                        <div className="dp-stat-value">{fmt(r.households)} / {fmt(r.householdCap)}</div>
                      </div>
                    </div>
                    <div className="dp-stat-card dp-stat-card-tooltip">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Workers.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Employees</div>
                        <div className="dp-stat-value">{fmt(r.workers)} / {fmt(r.maxWorkers)}</div>
                      </div>
                      <div className="dp-tooltip-content" style={{ width: 'auto', minWidth: '220rem' }}>
                        <div style={{ marginBottom: '6rem', fontWeight: 700, color: '#50b8e9', fontSize: '14rem' }}>Employee Demographics</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}><span>Uneducated:</span><span>{fmt(r.workerUneducated || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}><span>Poorly Educated:</span><span>{fmt(r.workerPoorlyEducated || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}><span>Educated:</span><span>{fmt(r.workerEducated || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}><span>Well Educated:</span><span>{fmt(r.workerWellEducated || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6rem' }}><span>Highly Educated:</span><span>{fmt(r.workerHighlyEducated || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ffb74d', fontWeight: 'bold' }}><span>Open Positions:</span><span>{fmt(Math.max(0, (r.maxWorkers || 0) - (r.workers || 0)))}</span></div>
                        <div style={{ marginTop: '8rem', fontSize: '11rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>
                          The maximum number of employees in a building is determined by the building's type, size, and zone density.<br/><br/>
                          Open workplaces get filled whenever there are citizens with matching education.
                        </div>
                      </div>
                    </div>
                    {/* Local Services */}
                    <div className="dp-stat-card dp-stat-card-tooltip">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Services.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Services</div>
                        <div className="dp-stat-value">
                          <span title="Service buildings inside this district">{fmt(r.services)} Local</span> / <span title="Total services available (local + assigned from outside)" style={{color: '#50b8e9'}}>{fmt(r.services + r.localServices)} Total</span>
                        </div>
                      </div>
                      <div className="dp-tooltip-content" style={{ width: 'auto', minWidth: '160rem' }}>
                        <div style={{ marginBottom: '6rem', fontWeight: 700, color: '#50b8e9', fontSize: '14rem' }}>Available Services</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', fontSize: '13rem', color: 'rgba(255,255,255,0.9)' }}>
                          {r.serviceMask ? getServicesFromMask(r.serviceMask).map(s => <div key={s}>{s}</div>) : 'None'}
                        </div>
                      </div>
                    </div>
                    {/* Upkeep */}
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={CUR} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Upkeep</div>
                        <div className="dp-stat-value"><img src={CUR} className="dp-currency-icon" alt="" />{fmt(r.upkeep)}</div>
                      </div>
                    </div>
                    {/* Resource Cost */}
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={CUR} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Resource Cost</div>
                        <div className="dp-stat-value"><img src={CUR} className="dp-currency-icon" alt="" />{fmt(r.resourceCost)}</div>
                      </div>
                    </div>
                    {/* Fees Paid */}
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={CUR} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Fees Paid</div>
                        <div className="dp-stat-value"><img src={CUR} className="dp-currency-icon" alt="" />{fmt(r.feesPaid)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Row 4.5: Health & Land Value */}
                  <div className="dp-stats-grid">
                    {/* Health & Safety */}
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Healthcare.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Health/Safety</div>
                        <div className="dp-stat-value" style={{ color: r.sick > 0 ? '#e57373' : '#81c784' }}>
                          {r.sick > 0 ? `${fmt(r.sick)} Sick` : 'Healthy'}
                        </div>
                        {r.totalCrime > 0 && <div style={{ fontSize: '13rem', color: '#ffb74d', marginTop: '2rem' }}>Crime: {fmt(Math.round(r.totalCrime / 100))}</div>}
                      </div>
                    </div>
                    {/* Land Value */}
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={CUR} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Land Value</div>
                        <div className="dp-stat-value"><img src={CUR} className="dp-currency-icon" alt="" />{r.landValueSamples ? fmt(r.totalLandValue! / r.landValueSamples) : 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Row 5: School Data */}
                  <div className="dp-stats-grid">
                    <div className="dp-stat-card dp-stat-card-wide" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '14rem 18rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', flex: 1 }}>
                      <div className="dp-stat-label" style={{ marginBottom: '10rem', color: '#fff' }}>School Data</div>
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', fontSize: '14rem' }}>
                        <div style={{ display: 'flex', marginBottom: '6rem', color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', width: '100%' }}>
                          <div style={{ width: '120rem', flexShrink: 0 }}>Level</div>
                          <div style={{ width: '90rem', textAlign: 'right', flexShrink: 0 }}>Enrolled</div>
                          <div style={{ width: '90rem', textAlign: 'right', flexShrink: 0 }}>Capacity</div>
                          <div style={{ width: '90rem', textAlign: 'right', flexShrink: 0 }}>Eligible</div>
                          <div style={{ width: '100rem', textAlign: 'right', flexShrink: 0 }}>Availability</div>
                        </div>
                        {[
                          { label: 'Elementary', cap: r.elemCapacity, enr: r.elemEnrolled, elig: r.elemEligible },
                          { label: 'High School', cap: r.hsCapacity, enr: r.hsEnrolled, elig: r.hsEligible },
                          { label: 'College', cap: r.collegeCapacity, enr: r.collegeEnrolled, elig: r.collegeEligible },
                          { label: 'University', cap: r.uniCapacity, enr: r.uniEnrolled, elig: r.uniEligible }
                        ].filter(s => (s.cap || 0) > 0 || (s.enr || 0) > 0 || (s.elig || 0) > 0)
                        .map((s, i) => (
                          <div key={i} style={{ display: 'flex', marginBottom: '4rem', width: '100%' }}>
                            <div style={{ width: '120rem', flexShrink: 0 }}>{s.label}</div>
                            <div style={{ width: '90rem', textAlign: 'right', flexShrink: 0, color: (s.enr || 0) > (s.cap || 0) && (s.cap || 0) > 0 ? '#e57373' : '#fff' }}>{fmt(s.enr || 0)}</div>
                            <div style={{ width: '90rem', textAlign: 'right', flexShrink: 0 }}>{fmt(s.cap || 0)}</div>
                            <div style={{ width: '90rem', textAlign: 'right', flexShrink: 0, color: '#50b8e9' }}>{fmt(s.elig || 0)}</div>
                            <div style={{ width: '100rem', textAlign: 'right', flexShrink: 0, color: calcAvail(s.cap || 0, s.enr || 0).color }}>{calcAvail(s.cap || 0, s.enr || 0).text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Row 6: Happiness Breakdown */}
                  <div className="dp-stats-grid">
                    <div className="dp-stat-card dp-stat-card-wide" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '14rem 18rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', flex: 1 }}>
                      <div className="dp-stat-label" style={{ marginBottom: '10rem', color: '#fff' }}>Happiness Factors</div>
                      {r.happinessFactors && r.happinessFactors.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', width: '100%', fontSize: '14rem' }}>
                          {r.happinessFactors.map(f => ({ factor: f[0], val: f[1] > 0 ? Math.round(f[2] / f[1]) : 0 }))
                            .filter(item => item.val !== 0)
                            .sort((a,b) => Math.abs(b.val) - Math.abs(a.val))
                            .map((item, idx) => {
                              const val = item.val;
                              const isPos = val > 0;
                              const color = isPos ? '#8bdb46' : '#e57373';
                              const label = HAPPINESS_FACTORS[item.factor] || `Factor ${item.factor}`;
                              return (
                                <div key={item.factor} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '3rem 8rem', borderRadius: '4rem', width: '31%', marginRight: idx % 3 !== 2 ? '3%' : '0', marginBottom: '5rem' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>{label}</span>
                                  <span style={{ color, fontWeight: 700 }}>{isPos ? '+' : ''}{val}</span>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '14rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Calculating factors...</div>
                      )}
                    </div>
                  </div>

                  <div className="dp-details">
                    <div className="dp-detail-section">
                      <span className="dp-detail-label">Policies:</span>
                      <div className="dp-inline-policies">
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
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
        </div>
        {/* Custom scrollbar */}
        {showScrollbar && (
          <div className="cb-scrollbar-track" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8rem', background: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
            <div
              className="cb-scrollbar-thumb"
              style={{ position: 'absolute', right: 0, width: '8rem', background: isDragging ? 'rgba(80,184,233,0.8)' : 'rgba(80,184,233,0.5)', borderRadius: '4rem', height: `${thumbHeight}px`, top: `${thumbTop}px`, pointerEvents: 'auto', cursor: 'pointer' }}
              onMouseDown={onThumbMouseDown}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DistrictsPanel;
