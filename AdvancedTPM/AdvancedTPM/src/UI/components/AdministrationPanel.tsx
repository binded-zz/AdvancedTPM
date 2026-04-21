import React, { useMemo } from 'react';
import CompanyBrowser, { parseCompanies } from './CompanyBrowser';
import ErrorBoundary from './ErrorBoundary';

interface Props {
  companyBrowserData: string;
  companyHappinessData?: string;
}

const AdministrationPanel: React.FC<Props> = ({ companyBrowserData, companyHappinessData }) => {
  const companies = React.useMemo(() => {
    const all = parseCompanies(companyBrowserData || '');
    return all.filter((c) => (c.zoneType || '').toLowerCase().includes('administration') || (c.name || '').toLowerCase().includes('city hall') || (c.name || '').toLowerCase().includes('administration'));
  }, [companyBrowserData]);

  return (
    <div className="adv-table-section">
      {/* Cap companies to avoid heavy rendering when opening administrative services */}
      <ErrorBoundary name="AdministrationPanel">
        <CompanyBrowser companies={companies.slice(0, 300)} happinessData={companyHappinessData} isSignatureView={false} />
      </ErrorBoundary>
    </div>
  );
};

export default AdministrationPanel;
