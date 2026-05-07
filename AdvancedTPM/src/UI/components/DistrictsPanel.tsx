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

type DistrictSortField = 'name' | 'residential' | 'services' | 'businesses' | 'total' | 'packs' | 'themes' | 'policies';

interface PolicyPrefab {
  entityKey: string;
  name: string;
  icon?: string;
}

interface DistrictApiData {
  entityKey: string;
  name: string;
  isCity?: boolean;
  cityName?: string;
  policies: string[];
}

interface DistrictRow {
  entityKey: string | null;
  name: string;
  residential: number;
  services: number;
  businesses: number;
  total: number;
  packs: string[];
  themes: string[];
  activePolicies: string[];
  isCity: boolean;
  cityName: string;
}

const parseResidentialDistricts = (payload: string): Array<{ district: string; theme: string; assetPack: string }> => {
  if (!payload) return [];
  return payload.split(';').map((chunk) => {
    const p = chunk.split('|');
    if (p.length < 10) return null;
    return {
      district: p[2] || 'City',
      theme: p[7] || 'Unknown',
      assetPack: p[8] || 'Base Game',
    };
  }).filter((x): x is { district: string; theme: string; assetPack: string } => x !== null);
};

const parseServiceDistricts = (payload: string): Array<{ district: string; theme: string; assetPack: string }> => {
  if (!payload) return [];
  try {
    const arr = JSON.parse(payload);
    if (!Array.isArray(arr)) return [];
    return arr.map((s: any) => ({
      district: String(s.district || 'City'),
      theme: String(s.theme || 'USA'),
      assetPack: String(s.assetPack || 'Base Game'),
    }));
  } catch {
    return [];
  }
};

const DistrictsPanel: React.FC<Props> = ({ 
  residentialBuildingsData = '', 
  servicesBuildingsData = '', 
  companyBrowserData = '',
  districtBrowserData = '[]',
  districtPoliciesData = '[]'
}) => {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<DistrictSortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const focusEntity = (entityKey: string) => {
    if (!entityKey) return;
    const parts = entityKey.split(',');
    apiSafe.trigger('camera', 'focusEntity', {
      index: parseInt(parts[0]) || 0,
      version: parseInt(parts[1]) || 0
    });
  };

  const handleSort = (field: DistrictSortField) => {
    if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const policyPrefabs: PolicyPrefab[] = useMemo(() => {
    try {
      return JSON.parse(districtPoliciesData);
    } catch {
      return [];
    }
  }, [districtPoliciesData]);

  const apiDistricts: DistrictApiData[] = useMemo(() => {
    try {
      return JSON.parse(districtBrowserData);
    } catch {
      return [];
    }
  }, [districtBrowserData]);

  const rows = useMemo(() => {
    const map = new Map<string, DistrictRow>();

    const ensure = (name: string): DistrictRow => {
      const key = name || 'City';
      if (!map.has(key)) {
        map.set(key, { entityKey: null, name: key, residential: 0, services: 0, businesses: 0, total: 0, packs: [], themes: [], activePolicies: [], isCity: key === 'City', cityName: key });
      }
      return map.get(key)!;
    };

    parseResidentialDistricts(residentialBuildingsData).forEach((r) => {
      const d = ensure(r.district);
      d.residential += 1;
      if (r.assetPack && !d.packs.includes(r.assetPack)) d.packs.push(r.assetPack);
      if (r.theme && !d.themes.includes(r.theme)) d.themes.push(r.theme);
    });

    parseServiceDistricts(servicesBuildingsData).forEach((s) => {
      const d = ensure(s.district);
      d.services += 1;
      if (s.assetPack && !d.packs.includes(s.assetPack)) d.packs.push(s.assetPack);
      if (s.theme && !d.themes.includes(s.theme)) d.themes.push(s.theme);
    });

    parseCompanies(companyBrowserData).forEach((c) => {
      const d = ensure(c.district || 'City');
      d.businesses += 1;
      if (c.assetPack && !d.packs.includes(c.assetPack)) d.packs.push(c.assetPack);
      if (c.theme && !d.themes.includes(c.theme)) d.themes.push(c.theme);
    });

    apiDistricts.forEach((apiData) => {
      const d = ensure(apiData.name);
      d.entityKey = apiData.entityKey;
      d.activePolicies = apiData.policies || [];
      if (apiData.isCity) {
        d.isCity = true;
        d.cityName = apiData.cityName || 'City';
      }
    });

    const out = Array.from(map.values());
    out.forEach((r) => { r.total = r.residential + r.services + r.businesses; r.packs.sort(); r.themes.sort(); });
    
    out.sort((a, b) => {
      // City always first
      if (a.isCity !== b.isCity) return a.isCity ? -1 : 1;
      
      let valA: any;
      let valB: any;
      
      if (sortField === 'policies') {
        valA = a.activePolicies.length;
        valB = b.activePolicies.length;
      } else if (sortField === 'packs') {
        valA = a.packs.length;
        valB = b.packs.length;
      } else if (sortField === 'themes') {
        valA = a.themes.length;
        valB = b.themes.length;
      } else {
        valA = a[sortField as keyof DistrictRow];
        valB = b[sortField as keyof DistrictRow];
      }
      
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return out;
  }, [residentialBuildingsData, servicesBuildingsData, companyBrowserData, apiDistricts, sortField, sortDir]);

  const sortedRows = rows;

  const handleTogglePolicy = (districtKey: string, policyKey: string, active: boolean) => {
    apiSafe.trigger('taxProduction', 'toggleDistrictPolicy', districtKey, policyKey, !active);
  };

  const handleRenameSubmit = (entityKey: string | null) => {
    if (entityKey && tempName.trim() !== '') {
      apiSafe.renameDistrict(entityKey, tempName.trim());
    }
    setEditingName(null);
  };

  const SortHdr: React.FC<{ field: DistrictSortField; label: string; className: string }> = ({ field, label, className }) => (
    <div className={`${className} dp-sortable`} onClick={() => handleSort(field)}>
      {label}
      {sortField === field && (
        <span className="dp-sort-indicator">{sortDir === 'asc' ? ' \u25B2' : ' \u25BC'}</span>
      )}
    </div>
  );

  if (sortedRows.length === 0) {
    return <div className="adv-empty" style={{ padding: '20rem', textAlign: 'center' }}>District data will appear when simulation is running.</div>;
  }

  return (
    <div className="dp-container">
      <div className="dp-header">
        <div className="dp-col-exp" />
        <SortHdr field="name" label="District Name" className="dp-col-name" />
        <SortHdr field="residential" label="Res" className="dp-col-count" />
        <SortHdr field="services" label="Svc" className="dp-col-count" />
        <SortHdr field="businesses" label="Biz" className="dp-col-count" />
        <SortHdr field="total" label="Total" className="dp-col-total" />
        <SortHdr field="packs" label="Packs" className="dp-col-packs" />
        <SortHdr field="themes" label="Themes" className="dp-col-themes" />
        <SortHdr field="policies" label="Policies" className="dp-col-policies" />
        <div className="dp-col-go">Go</div>
      </div>
      <div className="dp-body">
        {sortedRows.map((r) => {
          const isEditing = editingName === r.name;
          return (
            <React.Fragment key={r.name}>
              <div 
                className={`dp-row${r.isCity ? ' dp-row-city' : ''}${expandedRow === r.name ? ' dp-row-expanded' : ''}`}
                onClick={() => setExpandedRow(expandedRow === r.name ? null : r.name)}
              >
                <div className="dp-col-exp">
                   <span className="dp-arrow">{expandedRow === r.name ? '▼' : '▶'}</span>
                </div>
                <div className="dp-col-name" onClick={(e) => e.stopPropagation()}>
                  {isEditing && r.entityKey ? (
                    <div className="dp-rename-wrap">
                      <input 
                        className="dp-rename-input"
                        type="text" 
                        value={tempName} 
                        onChange={(e) => setTempName(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(r.entityKey)}
                        autoFocus
                      />
                      <button className="dp-rename-btn" onClick={() => handleRenameSubmit(r.entityKey)}>✓</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontWeight: r.entityKey ? '800' : '400', color: r.isCity ? '#50b8e9' : 'inherit' }}>
                        {r.isCity ? `City (${r.cityName})` : r.name}
                      </span>
                      {r.entityKey && (
                        <button 
                          className="dp-edit-btn"
                          onClick={(e) => { e.stopPropagation(); setTempName(r.name); setEditingName(r.name); }}
                          title="Rename District"
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="dp-col-count">{r.residential}</div>
                <div className="dp-col-count">{r.services}</div>
                <div className="dp-col-count">{r.businesses}</div>
                <div className="dp-col-total">{r.total}</div>
                <div className="dp-col-packs">
                   {r.packs.length > 0 ? r.packs.join(', ') : 'Base Game'}
                </div>
                <div className="dp-col-themes">
                   {r.themes.length > 0 ? r.themes.join(', ') : 'Default'}
                </div>
                <div className="dp-col-policies">
                  <div className="dp-inline-policies-row">
                    {policyPrefabs.map(policy => {
                      const isActive = r.activePolicies.includes(policy.entityKey);
                      if (!isActive && policyPrefabs.length > 10) return null; // Show only active if many
                      const iconUrl = policy.icon ? (policy.icon.startsWith('coui://') ? policy.icon : policy.icon) : '';
                      return (
                        <div 
                          key={policy.entityKey}
                          className={`dp-row-policy-icon ${isActive ? 'active' : ''}`}
                          title={policy.name}
                          onClick={(e) => { e.stopPropagation(); r.entityKey && handleTogglePolicy(r.entityKey!, policy.entityKey, isActive); }}
                        >
                          {iconUrl ? <img src={iconUrl} className="dp-policy-img-small" alt="" /> : <span className="dp-policy-text-small">{policy.name.substring(0,2)}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="dp-col-go">
                   {r.entityKey && <button className="dp-go-btn" onClick={(e) => { e.stopPropagation(); r.entityKey && focusEntity(r.entityKey); }}>GO</button>}
                </div>
              </div>
              {expandedRow === r.name && (
                <div className="dp-expanded-row">
                  <div className="dp-details">
                    <div className="dp-detail-section">
                      <span className="dp-detail-label">Themes:</span>
                      <span className="dp-detail-value">{r.themes.length > 0 ? r.themes.join(', ') : 'Default'}</span>
                    </div>
                    <div className="dp-detail-section">
                      <span className="dp-detail-label">Active Policies:</span>
                      {r.entityKey ? (
                        <div className="dp-inline-policies">
                          {policyPrefabs.map(policy => {
                            const isActive = r.activePolicies.includes(policy.entityKey);
                            const iconUrl = policy.icon ? (policy.icon.startsWith('coui://') ? policy.icon : policy.icon) : '';
                            return (
                              <div 
                                key={policy.entityKey}
                                className={`dp-inline-policy-icon ${isActive ? 'active' : ''}`}
                                title={policy.name}
                                onClick={(e) => { e.stopPropagation(); r.entityKey && handleTogglePolicy(r.entityKey!, policy.entityKey, isActive); }}
                              >
                                {iconUrl ? (
                                  <img src={iconUrl} alt="" className="dp-policy-img" />
                                ) : (
                                  <span className="dp-policy-text">{policy.name.substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="dp-detail-value" style={{ opacity: 0.5 }}>Policies cannot be set for the entire city here.</span>
                      )}
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
