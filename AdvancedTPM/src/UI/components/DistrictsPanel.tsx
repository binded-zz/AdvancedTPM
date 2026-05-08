import React, { useMemo, useState } from 'react';
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
}

type DistrictSortField = 'name' | 'residential' | 'services' | 'businesses' | 'total' | 'policies' | 'residents' | 'workers';

interface PolicyPrefab { entityKey: string; name: string; icon?: string; isCity?: boolean; isDistrict?: boolean; }

interface DistrictRow {
  entityKey: string | null; name: string; residential: number; services: number; businesses: number; total: number;
  activePolicies: string[]; isCity: boolean; cityName: string;
  households: number; householdCap: number; workers: number; maxWorkers: number;
  avgWealth: number; avgIncome: number; avgRent: number; avgHappiness: number;
  residents: number; children: number; teens: number; adults: number; seniors: number;
  eduUneducated: number; eduPoorlyEducated: number; eduEducated: number; eduWellEducated: number; eduHighlyEducated: number;
  localServices: number;
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

const wealthLabel = (w: number) => {
  if (w >= 500000) return 'Wealthy';
  if (w >= 200000) return 'Comfortable';
  if (w >= 50000) return 'Moderate';
  return 'Poor';
};

const DistrictsPanel: React.FC<Props> = ({
  residentialBuildingsData = '', servicesBuildingsData = '', companyBrowserData = '',
  districtBrowserData = '[]', districtPoliciesData = '[]'
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

  const policyPrefabs: PolicyPrefab[] = useMemo(() => { try { return JSON.parse(districtPoliciesData); } catch { return []; } }, [districtPoliciesData]);

  const rows = useMemo(() => {
    const map = new Map<string, DistrictRow>();
    const ensure = (name: string): DistrictRow => {
      const k = name || 'City';
      if (!map.has(k)) map.set(k, { entityKey: null, name: k, residential: 0, services: 0, businesses: 0, total: 0, activePolicies: [], isCity: k === 'City', cityName: k, households: 0, householdCap: 0, workers: 0, maxWorkers: 0, avgWealth: 0, avgIncome: 0, avgRent: 0, avgHappiness: 0, residents: 0, children: 0, teens: 0, adults: 0, seniors: 0, eduUneducated: 0, eduPoorlyEducated: 0, eduEducated: 0, eduWellEducated: 0, eduHighlyEducated: 0, localServices: 0 });
      return map.get(k)!;
    };

    if (residentialBuildingsData) {
      residentialBuildingsData.split(';').forEach(chunk => {
        const p = chunk.split('|'); if (p.length < 10) return;
        const d = ensure(p[2] || 'City'); d.residential++; d.households += Number(p[5]) || 0; d.householdCap += Number(p[6]) || 0;
      });
    }
    if (servicesBuildingsData) { try { const arr = JSON.parse(servicesBuildingsData); if (Array.isArray(arr)) arr.forEach((s: any) => ensure(String(s.district || 'City')).services++); } catch {} }
    parseCompanies(companyBrowserData).forEach(c => { const d = ensure(c.district || 'City'); d.businesses++; d.workers += c.workers; d.maxWorkers += c.maxWorkers; });

    let apiDistricts: any[] = [];
    try { apiDistricts = JSON.parse(districtBrowserData); } catch {}

    apiDistricts.forEach((a: any) => {
      const d = ensure(a.name);
      d.entityKey = a.entityKey; d.activePolicies = a.policies || [];
      if (a.isCity) { d.isCity = true; d.cityName = a.cityName || 'City'; }
      d.avgWealth = a.avgWealth || 0; d.avgIncome = a.avgIncome || 0; d.avgRent = a.avgRent || 0; d.avgHappiness = a.avgHappiness || 0;
      d.workers = a.workers || 0; d.maxWorkers = a.maxWorkers || 0; d.households = a.households || 0; d.householdCap = a.householdCap || 0;
      d.residential = a.res || 0; d.services = a.svc || 0; d.businesses = a.biz || 0;
      d.residents = a.residents || 0;
      d.children = a.children || 0; d.teens = a.teens || 0; d.adults = a.adults || 0; d.seniors = a.seniors || 0;
      d.eduUneducated = a.eduUneducated || 0; d.eduPoorlyEducated = a.eduPoorlyEducated || 0;
      d.eduEducated = a.eduEducated || 0; d.eduWellEducated = a.eduWellEducated || 0; d.eduHighlyEducated = a.eduHighlyEducated || 0;
      d.localServices = a.localServices || 0;
    });

    const out = Array.from(map.values());
    out.forEach(r => { r.total = r.residential + r.services + r.businesses; });
    out.sort((a, b) => {
      if (a.isCity !== b.isCity) return a.isCity ? -1 : 1;
      const vA = sortField === 'policies' ? a.activePolicies.length : (a as any)[sortField];
      const vB = sortField === 'policies' ? b.activePolicies.length : (b as any)[sortField];
      if (vA < vB) return sortDir === 'asc' ? -1 : 1;
      if (vA > vB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return out;
  }, [residentialBuildingsData, servicesBuildingsData, companyBrowserData, districtBrowserData, sortField, sortDir]);

  const handleTogglePolicy = (dk: string, pk: string, active: boolean) => {
    apiSafe.trigger('taxProduction', 'toggleDistrictPolicy', dk, pk, !active);
  };

  const handleRenameSubmit = (ek: string | null) => {
    if (ek && tempName.trim()) apiSafe.renameDistrict(ek, tempName.trim());
    setEditingName(null);
  };

  const SortHdr: React.FC<{ field: DistrictSortField; label: string; className: string }> = ({ field, label, className }) => (
    <div className={`${className} dp-sortable`} onClick={() => handleSort(field)}>
      {label}{sortField === field && <span className="dp-sort-indicator">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>}
    </div>
  );

  const MiniBar: React.FC<{ items: { label: string; value: number; color: string }[] }> = ({ items }) => {
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total === 0) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: '6rem' }}>
        <div style={{ display: 'flex', height: '10rem', borderRadius: '3rem', overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
          {items.map((it, idx) => it.value > 0 ? (
            <div key={idx} style={{ width: `${(it.value / total) * 100}%`, background: it.color, minWidth: '2rem' }} title={`${it.label}: ${fmt(it.value)}`} />
          ) : null)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '4rem' }}>
          {items.map((it, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', marginRight: '10rem', marginBottom: '2rem', fontSize: '10rem', color: 'rgba(255,255,255,0.7)' }}>
              <div style={{ width: '8rem', height: '8rem', borderRadius: '2rem', background: it.color, marginRight: '4rem', flexShrink: 0 }} />
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
      <div className="dp-header">
        <div className="dp-col-exp" />
        <SortHdr field="name" label="District Name ▸" className="dp-col-name" />
        <SortHdr field="residential" label="Res. Bldgs" className="dp-col-count" />
        <SortHdr field="services" label="Svc Bldgs" className="dp-col-count" />
        <SortHdr field="businesses" label="Biz Bldgs" className="dp-col-count" />
        <SortHdr field="residents" label="Residents" className="dp-col-count" />
        <SortHdr field="workers" label="Employees" className="dp-col-count" />
        <SortHdr field="policies" label="Policies" className="dp-col-policies" />
        <div className="dp-col-go">Go</div>
      </div>
      <div className="dp-body">
        {rows.map(r => {
          const hI = happinessInfo(r.avgHappiness);
          const isExp = expandedRow === r.name;
          return (
            <React.Fragment key={r.name}>
              <div className={`dp-row${r.isCity ? ' dp-row-city' : ''}${isExp ? ' dp-row-expanded' : ''}`}
                onClick={() => setExpandedRow(isExp ? null : r.name)}>
                <div className="dp-col-exp"><span className="dp-arrow">{isExp ? '▼' : '▶'}</span></div>
                <div className="dp-col-name">
                  <span style={{ fontWeight: r.entityKey ? '800' : '400', color: r.isCity ? '#50b8e9' : 'inherit' }}>
                    {r.isCity ? `City (${r.cityName})` : r.name}
                  </span>
                </div>
                <div className="dp-col-count">{fmt(r.residential)}</div>
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
                  {r.entityKey && <button className="dp-go-btn" onClick={e => { e.stopPropagation(); focusEntity(r.entityKey!); }}>GO</button>}
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
                        <button className="dp-rename-btn" onClick={() => handleRenameSubmit(r.entityKey)}>✓</button>
                      </div>
                    ) : (
                      <>
                        <span className="dp-expanded-name" style={{ color: r.isCity ? '#50b8e9' : '#fff' }}>
                          {r.isCity ? `City (${r.cityName})` : r.name}
                        </span>
                        {r.entityKey && !r.isCity && (
                          <button className="dp-edit-btn" onClick={() => { setTempName(r.name); setEditingName(r.name); }}>✎ Rename</button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="dp-stats-grid">
                    {/* Happiness */}
                    <div className="dp-stat-card dp-stat-card-tooltip">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Citizen.svg`} className="dp-stat-icon" alt="" style={{ filter: `drop-shadow(0 0 3rem ${hI.color})` }} /></div>
                      <div>
                        <div className="dp-stat-label">{r.isCity ? 'City Happiness' : 'District Happiness'}</div>
                        <div className="dp-happiness-status">
                          <span className="dp-happiness-text" style={{ color: hI.color }}>{hI.label}</span>
                          <span className="dp-happiness-pct">{r.avgHappiness}%</span>
                        </div>
                      </div>
                      <div className="dp-tooltip-content">
                        <div style={{ marginBottom: '6rem', fontWeight: 700, color: hI.color, fontSize: '14rem' }}>{hI.label}</div>
                        <div>The average happiness of citizens in this {r.isCity ? 'city' : 'district'}.</div>
                        <div style={{ marginTop: '6rem', fontSize: '11rem', color: 'rgba(255,255,255,0.6)' }}>
                          Citizen happiness is the combination of citizen health and well-being. Taking care of citizens' basic needs like healthcare increases their health and providing them with education, leisure opportunities, and safety increases their well-being.
                        </div>
                      </div>
                    </div>
                    {/* Households */}
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Household.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Households</div>
                        <div className="dp-stat-value">{fmt(r.households)} / {fmt(r.householdCap)}</div>
                      </div>
                    </div>
                    {/* Residents (Wide Card) */}
                    <div className="dp-stat-card dp-stat-card-wide dp-stat-card-tooltip">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Population.svg`} className="dp-stat-icon" alt="" /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '2rem' }}>
                          <div className="dp-stat-label" style={{ minWidth: 'auto', marginRight: '6rem' }}>Residents</div>
                          <div style={{ fontSize: '13rem', fontWeight: 600, color: '#fff' }}>{fmt(r.residents)}</div>
                        </div>
                        <MiniBar items={[
                          { label: 'Children', value: r.children, color: '#64b5f6' },
                          { label: 'Teens', value: r.teens, color: '#4dd0e1' },
                          { label: 'Adults', value: r.adults, color: '#81c784' },
                          { label: 'Seniors', value: r.seniors, color: '#ffb74d' },
                        ]} />
                      </div>
                      <div className="dp-tooltip-content" style={{ width: '220rem' }}>
                        <div style={{ fontWeight: 700, marginBottom: '6rem', fontSize: '13rem' }}>Age Breakdown</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}><span>Children</span><span>{fmt(r.children)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}><span>Teens</span><span>{fmt(r.teens)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}><span>Adults</span><span>{fmt(r.adults)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Seniors</span><span>{fmt(r.seniors)}</span></div>
                        <div style={{ marginTop: '8rem', fontSize: '10rem', color: 'rgba(255,255,255,0.5)' }}>
                          Citizen age determines their education opportunities and whether or not they can work. Age also affects citizen health. As they grow older, they are more prone to falling ill.
                        </div>
                      </div>
                    </div>
                    {/* Employees */}
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Workers.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Employees</div>
                        <div className="dp-stat-value">{fmt(r.workers)} / {fmt(r.maxWorkers)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dp-stats-grid">
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}CitizenWealth.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Average Wealth</div>
                        <div className="dp-stat-value">{wealthLabel(r.avgWealth)}</div>
                      </div>
                    </div>
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={CUR} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Average Income</div>
                        <div className="dp-stat-value"><img src={CUR} className="dp-currency-icon" alt="" />{fmt(r.avgIncome)} /mo.</div>
                      </div>
                    </div>
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={CUR} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Average Rent</div>
                        <div className="dp-stat-value"><img src={CUR} className="dp-currency-icon" alt="" />{fmt(r.avgRent)} /mo.</div>
                      </div>
                    </div>
                    {/* Education */}
                    <div className="dp-stat-card dp-stat-card-wide dp-stat-card-tooltip">
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
                      <div className="dp-tooltip-content" style={{ width: '260rem' }}>
                        <div style={{ fontWeight: 700, marginBottom: '6rem', fontSize: '13rem' }}>Education Breakdown</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}><span>Uneducated</span><span>{fmt(r.eduUneducated)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}><span>Poorly Educated</span><span>{fmt(r.eduPoorlyEducated)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}><span>Educated</span><span>{fmt(r.eduEducated)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}><span>Well Educated</span><span>{fmt(r.eduWellEducated)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Highly Educated</span><span>{fmt(r.eduHighlyEducated)}</span></div>
                        <div style={{ marginTop: '8rem', fontSize: '10rem', color: 'rgba(255,255,255,0.5)' }}>
                          Education level determines the citizen's job opportunities, wages and their work efficiency. Their average education level also affects how much garbage they produce.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Local Services */}
                  <div className="dp-stats-grid">
                    <div className="dp-stat-card">
                      <div className="dp-stat-icon-wrap"><img src={`${ICON}Services.svg`} className="dp-stat-icon" alt="" /></div>
                      <div>
                        <div className="dp-stat-label">Local Services</div>
                        <div className="dp-stat-value">{fmt(r.localServices)} service buildings</div>
                      </div>
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
    </div>
  );
};

export default DistrictsPanel;
