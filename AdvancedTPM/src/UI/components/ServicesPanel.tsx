import React, { useState, useMemo, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { camera, selectedInfo } from 'cs2/bindings';
import { Scrollable } from 'cs2/ui';
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
  assetPack: string;
  assetPackIcon?: string;
  level: number;
  capacity: number;
  usage: number;
  efficiency: number;
  workers: number;
  workersMax: number;
  detailInfo: string;
  isSignature: boolean;
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
      assetPack: String(s.assetPack || 'Base Game'),
      assetPackIcon: String(s.assetPackIcon || ''),
      level: Number(s.level) || 0,
      capacity: Number(s.capacity) || 0,
      usage: Number(s.usage) || 0,
      efficiency: Number(s.efficiency) || 0,
      workers: Number(s.workers) || 0,
      workersMax: Number(s.workersMax) || 0,
      detailInfo: String(s.detailInfo || ''),
      isSignature: !!s.isSignature,
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

const ServicesPanel: React.FC<{ servicesBuildingsData?: string; servicesBrowserData?: string }> = ({ servicesBuildingsData = '', servicesBrowserData = '' }) => {
   const buildings = useMemo(() => parseServiceBuildingsData(servicesBuildingsData || ''), [servicesBuildingsData]);
   const summaries = useMemo(() => parseServiceSummaries(servicesBrowserData || ''), [servicesBrowserData]);
   const safeBuildings = Array.isArray(buildings) ? buildings : [];
   const [categoryFilter, setCategoryFilter] = useState('All');
   const [packFilter, setPackFilter] = useState('All');
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
   }, [categoryFilter, packFilter, districtFilter, loadFilter, searchText, sortField, sortDir]);

   const categories = useMemo(() => ['All', ...Array.from(new Set(safeBuildings.map((b) => b.category).filter(Boolean))).sort()], [safeBuildings]);
   const packs = useMemo(() => ['All', ...Array.from(new Set(safeBuildings.map((b) => b.assetPack).filter(Boolean))).sort()], [safeBuildings]);
   const uniqueDistricts = useMemo(() => ['All', ...Array.from(new Set(safeBuildings.map((b) => b.district || 'City').filter(Boolean))).sort()], [safeBuildings]);

   const filtered = useMemo(() => {
     let list = safeBuildings;
     if (categoryFilter !== 'All') list = list.filter((b) => b.category === categoryFilter);
     if (packFilter !== 'All') list = list.filter((b) => b.assetPack === packFilter);
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
   }, [safeBuildings, categoryFilter, packFilter, districtFilter, loadFilter, searchText, sortField, sortDir]);

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
                    // Parse detailInfo "Workers:2/4;Students:10/20;Maintenance:80%" into key/value pairs
                    const details: { label: string; value: string }[] = [];
                    if (b.detailInfo) {
                      b.detailInfo.split(';').forEach(seg => {
                        const col = seg.indexOf(':');
                        if (col > 0) details.push({ label: seg.slice(0, col), value: seg.slice(col + 1) });
                      });
                    }
                    return (
                      <div className="svc-row-details">
                        <div className="svc-entity-id-header">
                          <span className="svc-entity-id-label">Entity ID:</span>
                          <span className="svc-entity-id-badge">{b.entityKey}</span>
                        </div>
                        <div className="svc-detail-grid">
                          <div><span className="svc-detail-label">Category</span><span className="svc-detail-value">{b.category}</span></div>
                          <div><span className="svc-detail-label">Building</span><span className="svc-detail-value">{b.name}</span></div>
                          <div><span className="svc-detail-label">District</span><span className="svc-detail-value">{b.district}</span></div>
                          <div><span className="svc-detail-label">Theme / Pack</span><span className="svc-detail-value" style={{ display: 'flex', alignItems: 'center' }}>{b.theme} / <PackIcon pack={b.assetPack} iconUrl={b.assetPackIcon} size={20} style={{ marginLeft: '6rem', marginRight: '4rem' }} />{b.assetPack}</span></div>
                          {b.level > 0 && <div><span className="svc-detail-label">Level</span><span className="svc-detail-value">Lv {b.level}</span></div>}
                          {b.capacity > 0 && <div><span className="svc-detail-label">{serviceLabels.cap}</span><span className="svc-detail-value">{b.capacity.toFixed(0)}</span></div>}
                          {b.usage > 0 && <div><span className="svc-detail-label">{serviceLabels.use}</span><span className="svc-detail-value">{b.usage.toFixed(0)}{b.capacity > 0 ? ` (${Math.round(b.usage / b.capacity * 100)}%)` : ''}</span></div>}
                          <div><span className="svc-detail-label">Efficiency</span><span className="svc-detail-value" style={{ color: getSafeColor(b.efficiency >= 90 ? '#8bdb46' : b.efficiency >= 50 ? '#e88c3a' : '#e05050') }}>{b.efficiency.toFixed(0)}%</span></div>
                          {details.filter(d => d.label !== 'EffFactors').map((d, i) => (
                            <div key={`det-${i}`}><span className="svc-detail-label">{d.label}</span><span className="svc-detail-value">{d.value}</span></div>
                          ))}
                          {details.filter(d => d.label === 'EffFactors').map((d, i) => (
                            <div key={`eff-${i}`} style={{ width: '400rem' }}>
                              <span className="svc-detail-label">Eff. Factors</span>
                              <span className="svc-detail-value">
                                {d.value.split('|').map((f, fi) => {
                                  const pct = parseInt(f, 10);
                                  const col = pct >= 100 ? '#8bdb46' : pct >= 60 ? '#e88c3a' : '#e05050';
                                  return <span key={fi} style={{ color: getSafeColor(col), marginRight: '8rem', fontWeight: 700 }}>{f}</span>;
                                })}
                              </span>
                            </div>
                          ))}
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
