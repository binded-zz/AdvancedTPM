import React, { useState, useMemo, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { trigger } from 'cs2/api';
import { getSafeColor } from '../../mods/apiSafe';
import './ServicesPanel.css';
import ServiceIcon from '../assets/ServiceIcon';
import ThemeIcon from '../assets/ThemeIcon';
import PackIcon from '../assets/PackIcon';

interface ServiceBuildingInfo {
  entityKey: string;
  name: string;
  address: string;
  category: string;
  district: string;
  theme: string;
  assetPack: string;
  level: number;
  capacity: number;
  usage: number;
  efficiency: number;
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
  'Other'
];

type SortField = 'name' | 'address' | 'category' | 'district' | 'theme' | 'assetPack' | 'level' | 'capacity' | 'usage' | 'efficiency';
type SortDir = 'asc' | 'desc';

const parseServiceBuildingsData = (payload: string): ServiceBuildingInfo[] => {
  if (!payload) return [];
  try {
    const arr = JSON.parse(payload);
    if (!Array.isArray(arr)) return [];
    return arr.map((s: any) => ({
      entityKey: String(s.entityKey || ''),
      name: String(s.name || ''),
      address: String(s.address || ''),
      category: String(s.category || ''),
      district: String(s.district || 'City'),
      theme: String(s.theme || 'USA'),
      assetPack: String(s.assetPack || 'Base Game'),
      level: Number(s.level) || 0,
      capacity: Number(s.capacity) || 0,
      usage: Number(s.usage) || 0,
      efficiency: Number(s.efficiency) || 0,
      isSignature: !!s.isSignature,
    } as ServiceBuildingInfo));
  } catch {
    return [];
  }
};

const parseServiceSummaries = (payload: string): ServiceSummary[] => {
  if (!payload) return [];
  try {
    const arr = JSON.parse(payload);
    if (!Array.isArray(arr)) return [];
    return arr as ServiceSummary[];
  } catch {
    return [];
  }
};

const focusEntityKey = (entityKey: string) => {
  try {
    const parts = String(entityKey || '').split(',');
    const entity = {
      index: Number(parts[0]) || 0,
      version: Number(parts[1]) || 0,
    };
    trigger('camera', 'focusEntity', entity);
    trigger('selectedInfo', 'selectEntity', entity);
  } catch {}
};

const getServiceRowTooltip = (b: ServiceBuildingInfo) => {
  const loadPct = b.capacity > 0 ? Math.round((b.usage / b.capacity) * 100) : 0;
  return [
    `<b>${b.address || b.name}</b>`,
    `<br/>Category: ${b.category || 'Unknown'}`,
    `District: ${b.district || 'City'}`,
    `Theme: ${b.theme || 'USA'} • Pack: ${b.assetPack || 'Base Game'}`,
    `Level: ${b.level > 0 ? `Lv ${b.level}` : '-'}`,
    `<br/><b>Capacity: ${b.capacity.toFixed(0)}</b>`,
    `<b>Usage: ${b.usage.toFixed(0)} (${loadPct}%)</b>`,
    `<b>Efficiency: ${b.efficiency.toFixed(0)}%</b>`,
    `<br/>Entity: ${b.entityKey}`,
    `<br/><i>Click row or GO to focus camera</i>`,
  ].join('\n');
};

interface CycleFilterButtonProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  displayValue?: (value: string) => string;
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
   const [districtFilter, setDistrictFilter] = useState('All');
   const [packFilter, setPackFilter] = useState('All');
   const [themeFilter, setThemeFilter] = useState('All');
   const [loadFilter, setLoadFilter] = useState<'All' | 'Empty' | 'Underused' | 'Busy' | 'Full'>('All');
   const [searchText, setSearchText] = useState('');
   const [sortField, setSortField] = useState<SortField>('name');
   const [sortDir, setSortDir] = useState<SortDir>('asc');
   const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

   const categories = useMemo(() => ['All', ...Array.from(new Set(safeBuildings.map((b) => b.category).filter(Boolean))).sort()], [safeBuildings]);
   const districts = useMemo(() => ['All', ...Array.from(new Set(safeBuildings.map((b) => b.district).filter(Boolean))).sort()], [safeBuildings]);
   const packs = useMemo(() => ['All', ...Array.from(new Set(safeBuildings.map((b) => b.assetPack).filter(Boolean))).sort()], [safeBuildings]);
   const themes = useMemo(() => ['All', ...Array.from(new Set(safeBuildings.map((b) => b.theme).filter(Boolean))).sort()], [safeBuildings]);

   const filtered = useMemo(() => {
     let list = safeBuildings;
     if (categoryFilter !== 'All') list = list.filter((b) => b.category === categoryFilter);
     if (districtFilter !== 'All') list = list.filter((b) => b.district === districtFilter);
     if (packFilter !== 'All') list = list.filter((b) => b.assetPack === packFilter);
     if (themeFilter !== 'All') list = list.filter((b) => b.theme === themeFilter);
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
         case 'district': return dir * (a.district || '').localeCompare(b.district || '');
         case 'theme': return dir * (a.theme || '').localeCompare(b.theme || '');
         case 'assetPack': return dir * (a.assetPack || '').localeCompare(b.assetPack || '');
         case 'level': return dir * (a.level - b.level);
         case 'capacity': return dir * (a.capacity - b.capacity);
         case 'usage': return dir * (a.usage - b.usage);
         case 'efficiency': return dir * (a.efficiency - b.efficiency);
         default: return 0;
       }
     });
   }, [safeBuildings, categoryFilter, districtFilter, packFilter, themeFilter, loadFilter, searchText, sortField, sortDir]);

   // using native scrollbar
   const handleSort = (field: SortField) => {
     if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
     else { setSortField(field); setSortDir(field === 'name' || field === 'address' || field === 'category' || field === 'district' || field === 'theme' || field === 'assetPack' ? 'asc' : 'desc'); }
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
           {categories.map((c) => <button key={c} className={`svc-category-tab${categoryFilter === c ? ' svc-category-active' : ''}`} onClick={() => setCategoryFilter(c)}>{c}</button>)}
         </div>
         <div className="svc-controls">
           <input className="svc-search" placeholder="Search service buildings..." value={searchText} onInput={(e: any) => setSearchText(e.target.value || '')} />
           <div className="svc-filter-group">
             <CycleFilterButton label="District" value={districtFilter} options={districts} onChange={setDistrictFilter} displayValue={(v) => v === 'All' ? 'All Districts' : v} />
             <CycleFilterButton label="Theme" value={themeFilter} options={themes} onChange={setThemeFilter} displayValue={(v) => v === 'All' ? 'All Themes' : v} />
             <CycleFilterButton label="Pack" value={packFilter} options={packs} onChange={setPackFilter} displayValue={(v) => v === 'All' ? 'All Packs' : v} />
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
           <div className="svc-col-theme svc-sortable" onClick={() => handleSort('theme')}><ThemeIcon theme="All" size={14} />{sortIndicator('theme')}</div>
           <div className="svc-col-pack svc-sortable" onClick={() => handleSort('assetPack')}><PackIcon pack="All" size={14} />{sortIndicator('assetPack')}</div>
           <div className="svc-col-district svc-sortable" onClick={() => handleSort('district')}>District{sortIndicator('district')}</div>
           <div className="svc-col-level svc-sortable" onClick={() => handleSort('level')}>Lv{sortIndicator('level')}</div>
           <div className="svc-col-cap svc-sortable" onClick={() => handleSort('capacity')}>{serviceLabels.cap}{sortIndicator('capacity')}</div>
           <div className="svc-col-usage svc-sortable" onClick={() => handleSort('usage')}>{serviceLabels.use}{sortIndicator('usage')}</div>
           <div className="svc-col-eff svc-sortable" onClick={() => handleSort('efficiency')}>{serviceLabels.eff}{sortIndicator('efficiency')}</div>
           <div className="svc-col-go">Go</div>
         </div>
         <div className="svc-table-scroll-wrap">
           <div className="svc-table-body">
             {filtered.slice(0, 400).map((b) => (
               <React.Fragment key={b.entityKey}>
                 <div className={`svc-table-row${expandedEntity === b.entityKey ? ' svc-row-expanded' : ''}`} onClick={() => setExpandedEntity(expandedEntity === b.entityKey ? null : b.entityKey)} title={getServiceRowTooltip(b)}>
                   <div className="svc-col-name">
                     <ServiceIcon category={b.category} />
                     <ThemeIcon theme={b.theme} />
                     <PackIcon pack={b.assetPack} />
                     <span>{b.address || b.name}</span>
                   </div>
                   {categoryFilter === 'All' && <div className="svc-col-category">{b.category}</div>}
                   <div className="svc-col-theme"><ThemeIcon theme={b.theme} size={18} /></div>
                   <div className="svc-col-pack"><PackIcon pack={b.assetPack} size={18} /></div>
                   <div className="svc-col-district">{b.district || 'City'}</div>
                   <div className="svc-col-level">{b.level > 0 ? `Lv ${b.level}` : '—'}</div>
                   <div className="svc-col-cap">{b.capacity.toFixed(0)}</div>
                   <div className="svc-col-usage">{b.usage.toFixed(0)}</div>
                   <div className="svc-col-eff" style={{ color: getSafeColor(b.efficiency >= 90 ? '#8bdb46' : b.efficiency >= 50 ? '#50b8e9' : '#e05050') }}>{b.efficiency.toFixed(0)}%</div>
                   <div className="svc-col-go">
                     <button className="svc-go-btn" onClick={(e) => { e.stopPropagation(); focusEntityKey(b.entityKey); }}>GO</button>
                   </div>
                 </div>
                 {expandedEntity === b.entityKey && (
                   <div className="svc-row-details">
                     <div className="svc-detail-group">
                       <span className="svc-detail-label">Service Category</span>
                       <span className="svc-detail-value">{b.category}</span>
                     </div>
                     <div className="svc-detail-group">
                       <span className="svc-detail-label">Building Name</span>
                       <span className="svc-detail-value">{b.name}</span>
                     </div>
                     <div className="svc-detail-group">
                       <span className="svc-detail-label">District</span>
                       <span className="svc-detail-value">{b.district}</span>
                     </div>
                     <div className="svc-detail-group">
                       <span className="svc-detail-label">{serviceLabels.cap}</span>
                       <span className="svc-detail-value">{b.capacity.toFixed(0)}</span>
                     </div>
                     <div className="svc-detail-group">
                       <span className="svc-detail-label">{serviceLabels.use}</span>
                       <span className="svc-detail-value">{b.usage.toFixed(0)} ({b.capacity > 0 ? Math.round(b.usage / b.capacity * 100) : 0}%)</span>
                     </div>
                     <div className="svc-detail-group">
                       <span className="svc-detail-label">Asset Level</span>
                       <span className="svc-detail-value">{b.level > 0 ? `Level ${b.level}` : 'N/A'}</span>
                     </div>
                     <div className="svc-detail-group">
                       <span className="svc-detail-label">Theme / Pack</span>
                       <span className="svc-detail-value">{b.theme} / {b.assetPack}</span>
                     </div>
                   </div>
                 )}
               </React.Fragment>
             ))}
             {filtered.length === 0 && <div className="svc-panel-empty">No buildings match filter.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServicesPanel;
