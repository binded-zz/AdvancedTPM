import React, { useMemo } from 'react';
// React hooks are provided by the environment. Do not import to avoid duplicate type declarations.
import CompanyBrowser, { parseCompanies } from './CompanyBrowser';
import ErrorBoundary from './ErrorBoundary';

interface Props {
  companyBrowserData: string;
  companyHappinessData?: string;
}

const SERVICE_CATEGORIES = ['All', 'Utilities', 'Emergency', 'Networks', 'Transportation', 'Parks', 'Administration'];

const ServicesPanel: React.FC<Props> = ({ companyBrowserData, companyHappinessData }) => {
  const [categoryFilter, setCategoryFilter] = React.useState('All');
  const [searchText, setSearchText] = React.useState('');
  const [sortField, setSortField] = React.useState<'name'|'capacity'|'coverage'|'budget'|'fee'>('name');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('asc');

  const allCompanies = React.useMemo(() => parseCompanies(companyBrowserData || ''), [companyBrowserData]);

  const filtered = React.useMemo(() => {
    let list = allCompanies;
    if (categoryFilter && categoryFilter !== 'All') {
      list = list.filter((c) => (c.serviceCategory || '').toLowerCase() === categoryFilter.toLowerCase());
    }
    if (searchText) {
      const lower = searchText.toLowerCase();
      list = list.filter((c) => (c.name || '').toLowerCase().includes(lower) || (c.serviceCategory || '').toLowerCase().includes(lower));
    }
    // sort
    const arr = [...list];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case 'name': return dir * (a.name || '').localeCompare(b.name || '');
        case 'capacity': return dir * ((a.capacity || 0) - (b.capacity || 0));
        case 'coverage': return dir * ((a.coverage || 0) - (b.coverage || 0));
        case 'budget': return dir * ((a.budgetPercent || 0) - (b.budgetPercent || 0));
        case 'fee': return dir * ((a.feePercent || 0) - (b.feePercent || 0));
        default: return 0;
      }
    });
    return arr;
  }, [allCompanies, categoryFilter, searchText, sortField, sortDir]);

  return (
    <div className="adv-table-section">
      <div className="svc-filters">
        <div className="svc-category-tabs">
          {SERVICE_CATEGORIES.map((c) => (
            <button key={c} className={`svc-category-tab${categoryFilter === c ? ' svc-category-active' : ''}`} onClick={() => setCategoryFilter(c)}>{c}</button>
          ))}
        </div>
        <div className="svc-controls">
          <input className="svc-search" placeholder="Search services..." value={searchText} onChange={(e) => setSearchText(e.target.value || '')} />
          <select value={sortField} onChange={(e) => setSortField(e.target.value as any)}>
            <option value="name">Name</option>
            <option value="capacity">Capacity</option>
            <option value="coverage">Coverage</option>
            <option value="budget">Budget %</option>
            <option value="fee">Fee %</option>
          </select>
          <button onClick={() => setSortDir((d: 'asc'|'desc') => d === 'asc' ? 'desc' : 'asc')}>{sortDir === 'asc' ? '?' : '?'}</button>
        </div>
      </div>

      {/* Wrap in ErrorBoundary to avoid uncaught render errors crashing the UI */}
      <ErrorBoundary name="ServicesPanel">
        <CompanyBrowser companies={filtered.slice(0, 300)} happinessData={companyHappinessData} isSignatureView={false} showFilters={false} />
      </ErrorBoundary>
    </div>
  );
};

export default ServicesPanel;
