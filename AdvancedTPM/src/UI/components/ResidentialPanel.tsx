import React, { useMemo } from 'react';
import CompanyBrowser, { parseCompanies } from './CompanyBrowser';
import ErrorBoundary from './ErrorBoundary';

interface Props {
  companyBrowserData: string;
  companyHappinessData?: string;
}

const ResidentialPanel: React.FC<Props> = ({ companyBrowserData, companyHappinessData }) => {
  const companies = React.useMemo(() => {
    const all = parseCompanies(companyBrowserData || '');
    return all.filter((c) => (c.zoneType || '').toLowerCase().includes('residential'));
  }, [companyBrowserData]);

  return (
    <div className="adv-table-section">
      <ErrorBoundary name="ResidentialPanel">
        <CompanyBrowser companies={companies.slice(0, 300)} happinessData={companyHappinessData} isSignatureView={false} showFilters={false} />
      </ErrorBoundary>
    </div>
  );
};

export default ResidentialPanel;
