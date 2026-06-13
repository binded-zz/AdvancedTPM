import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { trigger } from 'cs2/api';
import { camera, selectedInfo } from 'cs2/bindings';
import { Scrollable } from 'cs2/ui';
// Removed invalid imports from 'cs2/bindings'.
import { resourceCategories, ResourceCategory } from '../data/resourceTaxonomy';
import AutoTaxSettingsPanel from './AutoTaxSettingsPanel';
import CompanyBrowser, { parseCompanies, resourceIconSrc, resourceIconName, resourceLabel } from './CompanyBrowser';
import AdvisorPanel from './AdvisorPanel';
import ResidentialPanel from './ResidentialPanel';
import ServicesPanel from './ServicesPanel';
import DistrictsPanel from './DistrictsPanel';
import ServiceIcon from '../assets/ServiceIcon';
import PackIcon from '../assets/PackIcon';
import { ModDebugPanel } from './ModDebugPanel';
import { getSafeColor } from '../../mods/apiSafe';
import { startGlobalDrag, stopGlobalDrag } from './dragHelper';
import './AdvancedTPMWindow.css';
import CustomSelect from './CustomSelect';

interface TaxResourceKey {
  resource: number;
  area: number;
}

interface ResourceRowVm {
  key: string;
  label: string;
  stage: string;
  resourceIndex?: number;
  production: number;
  consumption: number;
  taxRate: number;
  surplus: number;
  deficit: number;
  taxIncome: number;
  incomeSource?: string;
  isService?: boolean;
  companyCount?: number;
  maxWorkers?: number;
  currentWorkers?: number;
  demand?: number;
}

const formatPackName = (name: string): string => {
  if (!name || name === 'Base Game' || name === 'Custom' || name === 'DLC') return name;
  if (name.includes(' ')) return name;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
};

interface AdvancedTPMWindowProps {
  selectedCategory: string;
  rows: ResourceRowVm[];
  showTips: boolean;
  autoTaxEnabled: boolean;
  autoTaxStatus: string;
  autoTaxSettings: string;
  companyBrowserData: string;
  companyBrowserSummary?: string;
  companySummaries?: string;
  companyDetail?: string;
  companyPerf?: string;
  overviewTwoColumn?: boolean;
  companyHappinessData: string;
  signaturePrefabs?: string;
  signatureCompaniesJson?: string;
  signatureCacheStatus?: string;
  signatureInfo?: string;
  onRefreshSignatureCache?: () => void;
  onRefreshCompanyBrowserData?: () => void;
  advisorData: string;
  decisionLogData: string;
  learningStatsData: string;
  learningEnabled: boolean;
  residentialBrowserData?: string;
  residentialBuildingsData?: string;
  residentialSignatureBuildingsData?: string;
  administrationBrowserData?: string;
  servicesBrowserData?: string;
  servicesBuildingsData?: string;
districtBrowserData?: string;
districtPoliciesData?: string;
  onAutoTaxToggle: (enabled: boolean) => void;
  onToggleLearning: (enabled: boolean) => void;
  onResourceTaxRateChange: (key: string, rate: number) => void;
  onCategoryChange: (category: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
  onToggleDebugPanel?: () => void;
  showModDebug?: boolean;
  onToggleModDebug?: () => void;
  onClose: () => void;
}

/** Parse auto-tax status string: happiness|adjustCount|raiseCount|lowerCount|holdCount|resourceDirections */
interface AutoTaxParsed {
  happiness: number;
  adjustCount: number;
  raiseCount: number;
  lowerCount: number;
  holdCount: number;
  directions: Map<string, AutoTaxResourceInfo>;
}

interface AutoTaxResourceInfo {
  direction: number;
  score: number;
  balance: number;
  demand: number;
  income: number;
  profit: number;
  happiness: number;
  rateDrag: number;
  companies: number;
  avgProfit: number;
  learned: number;
}

const parseAutoTaxStatus = (status: string): AutoTaxParsed | null => {
  if (!status) return null;
  const parts = status.split('|');
  if (parts.length < 6) return null;
  const directions = new Map<string, AutoTaxResourceInfo>();
  if (parts[5]) {
    parts[5].split(',').forEach((entry) => {
      const [key, rest] = entry.split('=');
      if (key && rest) {
        const fields = rest.split(':');
        directions.set(key, {
          direction: Number(fields[0]) || 0,
          score: Number(fields[1]) || 0,
          balance: Number(fields[2]) || 0,
          demand: Number(fields[3]) || 0,
          income: Number(fields[4]) || 0,
          profit: Number(fields[5]) || 0,
          happiness: Number(fields[6]) || 0,
          rateDrag: Number(fields[7]) || 0,
          companies: Number(fields[8]) || 0,
          avgProfit: Number(fields[9]) || 0,
          learned: Number(fields[10]) || 0,
        });
      }
    });
  }
  return {
    happiness: Number(parts[0]) || 0,
    adjustCount: Number(parts[1]) || 0,
    raiseCount: Number(parts[2]) || 0,
    lowerCount: Number(parts[3]) || 0,
    holdCount: Number(parts[4]) || 0,
    directions,
  };
};

const formatCurrency = (value: number): string => {
  const rounded = Math.round(value);
  return `${rounded < 0 ? '-' : ''}${Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

/** Format weight in game-style units: kg / t / kt â€” unit glued to number (no space) */
const formatWeight = (tonnes: number): string => {
  const abs = Math.abs(tonnes);
  if (abs < 0.001) return '0t';
  if (abs < 1) return `${(tonnes * 1000).toFixed(0)}kg`;
  if (abs < 1000) return `${tonnes.toFixed(abs < 10 ? 2 : 1)}t`;
  return `${(tonnes / 1000).toFixed(abs < 10000 ? 2 : 1)}kt`;
};

const formatCompact = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(1);
};

const CURRENCY_ICON = 'Media/Game/Icons/Economy.svg';

const getStageIcon = (stage: string): string => {
  switch ((stage || '').toLowerCase()) {
    case 'retail':
    case 'commercial':
      return 'ZoneCommercial';
    case 'industrial':
      return 'ZoneIndustrial';
    case 'immaterial':
      return 'ZoneOffice';
    default:
      return 'ZoneExtractors';
  }
};

/* ———— Custom Slider ———— */
interface CustomSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

const CustomSlider: React.FC<CustomSliderProps> = ({ value, min, max, onChange }) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateValue = useCallback((clientX: number) => {
    if (!sliderRef.current) return value;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(min + pct * (max - min));
  }, [min, max, value]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startGlobalDrag();
    onChange(calculateValue(e.clientX));

    const onMove = (ev: MouseEvent) => onChange(calculateValue(ev.clientX));
    const onUp = () => {
      setIsDragging(false);
      stopGlobalDrag();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const range = max - min;
  const clampedValue = Math.max(min, Math.min(max, value));
  const pct = range > 0 ? ((clampedValue - min) / range) * 100 : 0;

  return (
    <div className="adv-slider-wrapper">
      <div ref={sliderRef} className="adv-slider-track" onMouseDown={handleMouseDown}>
        <div className="adv-slider-track-bounds">
          <div className="adv-slider-range-bounds" style={{ width: `${pct}%` }}>
            <div className="adv-slider-range" />
            <div className="adv-slider-thumb-container">
              <div className="adv-slider-thumb" style={{ cursor: isDragging ? 'grabbing' : 'grab' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ———— Resource Sub-Row ———— */
const ResourceSubRow = React.memo<{
  resource: ResourceRowVm;
  icon: string;
  localRate: number;
  selected: boolean;
  autoTaxDir?: AutoTaxResourceInfo;
  onRateChange: (key: string, rate: number) => void;
  onSelect: (key: string) => void;
  onTooltipShow: (lines: string[], el?: HTMLElement, alignRight?: boolean, clientX?: number, clientY?: number) => void;
  onTooltipHide: () => void;
}>(({ resource, icon, localRate, selected, autoTaxDir, onRateChange, onSelect, onTooltipShow, onTooltipHide }) => {
  const [hover, setHover] = useState(false);
  const prodRef = useRef<HTMLDivElement>(null);
  const isIncomeNegative = resource.taxIncome < 0;
  const stageIcon = getStageIcon(resource.stage);
  const stageFallbackIcon = resource.stage.toLowerCase() === 'retail' || resource.stage.toLowerCase() === 'commercial'
    ? 'Meals'
    : resource.stage.toLowerCase() === 'industrial'
      ? 'Machinery'
      : resource.stage.toLowerCase() === 'immaterial'
        ? 'Software'
        : 'Ore';
  const incomeText = formatCurrency(resource.taxIncome);
  const isSvc = resource.isService === true;
  const fmtVal = (v: number) => isSvc ? formatCompact(v) : formatWeight(v);
  const maxRef = Math.max(resource.production, resource.consumption, resource.demand ?? 0, 1);
  const prodWidth = `${Math.min(100, (resource.production / maxRef) * 100)}%`;
  const consWidth = `${Math.min(100, (resource.consumption / maxRef) * 100)}%`;
  const surplusWidth = resource.production > 0 ? `${Math.min(100, (resource.surplus / maxRef) * 100)}%` : '0%';
  const deficitWidth = resource.consumption > 0 ? `${Math.min(100, (resource.deficit / maxRef) * 100)}%` : '0%';
  const demandVal = resource.demand ?? 0;
  const demandWidth = demandVal > 0 ? `${Math.min(100, (demandVal / maxRef) * 100)}%` : '0%';
  const maxW = resource.maxWorkers ?? 0;
  const curW = resource.currentWorkers ?? 0;
  const workerPct = maxW > 0 ? Math.round((curW / maxW) * 100) : 0;

  const resourceTooltipLines: string[] = [
    `${isSvc ? 'Capacity' : 'Production'}: ${fmtVal(resource.production)}`,
    `${isSvc ? 'Used' : 'Consumption'}: ${fmtVal(resource.consumption)}`,
    `Surplus: ${fmtVal(resource.surplus)}`,
    `Deficit: ${fmtVal(resource.deficit)}`,
    ...(!isSvc && demandVal > 0 ? [`Demand: ${fmtVal(demandVal)}`] : []),
    ...(maxW > 0 ? [`Workers: ${curW.toLocaleString()}/${maxW.toLocaleString()} (${workerPct}%)`] : []),
    ...(resource.companyCount != null && resource.companyCount > 0 ? [`Companies: ${resource.companyCount}`] : []),
    `Tax Rate: ${localRate}\u00a0%`,
    `Tax Income: ${formatCurrency(resource.taxIncome)}`,
  ];
  return (
    <div
      className={`adv-resource-row${selected ? ' adv-resource-row-selected' : ''}${hover ? ' adv-resource-row-hover' : ''}`}
      onMouseOver={(e) => {
        setHover(true);
        // show floating tooltip at mouse coords to avoid clipping
        onTooltipShow(resourceTooltipLines, undefined, false, e.clientX, e.clientY);
      }}
      onMouseMove={(e) => {
        // update floating tooltip position while hovering
        onTooltipShow(resourceTooltipLines, undefined, false, e.clientX, e.clientY);
      }}
      onMouseOut={() => {
        setHover(false);
        onTooltipHide();
      }}
      onClick={() => onSelect(resource.key)}
    >
      <img className="adv-resource-icon" src={"Media/Game/Resources/" + icon + ".svg"} />
      <img
        className="adv-resource-stage-icon"
        src={"Media/Game/Icons/" + stageIcon + ".svg"}
        title={resource.stage}
        onError={(e) => {
          const el = e.currentTarget;
          if (!el.dataset.fallbackApplied) {
            el.dataset.fallbackApplied = '1';
            el.src = "Media/Game/Resources/" + stageFallbackIcon + ".svg";
          }
        }}
      />
      <div className="adv-resource-name">
        {resource.label}
        {autoTaxDir && autoTaxDir.direction !== 0 && ((
          () => {
            const fmtF = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);
            const tipLines = [
              `Score: ${fmtF(autoTaxDir.score)}`,
              `Prod/Cons Balance: ${fmtF(autoTaxDir.balance)}`,
              ...(autoTaxDir.demand !== 0 ? [`Demand Signal: ${fmtF(autoTaxDir.demand)}`] : []),
              `Taxable Income: ${fmtF(autoTaxDir.income)}`,
              `Company Profit: ${fmtF(autoTaxDir.profit)} (avg ${autoTaxDir.avgProfit > 0 ? '+' : ''}${autoTaxDir.avgProfit.toFixed(0)}%)`,
              `Happiness: ${fmtF(autoTaxDir.happiness)}`,
              `Rate Drag: ${fmtF(autoTaxDir.rateDrag)}`,
              ...(autoTaxDir.companies > 0 ? [`Companies: ${autoTaxDir.companies}`] : []),
            ];
            return (
              <span
                className={`adv-autotax-indicator ${autoTaxDir.direction > 0 ? 'adv-autotax-up' : 'adv-autotax-down'}`}
                title={tipLines.join('\n')}
              >
                {autoTaxDir.direction > 0 ? '▲' : '▼'}
              </span>
            );
          }
        )())}
      </div>
      <div className="adv-resource-slider-container">
          <div className="adv-resource-slider-column">
          <div className="adv-resource-rate">{`${localRate}\u00a0%`}</div>
          <CustomSlider value={localRate} min={-10} max={30} onChange={(v) => onRateChange(resource.key, v)} />
        </div>
        <div ref={prodRef} className="adv-resource-production-column">
          <div className="adv-resource-production-value">
            <div className="adv-prod-bars">
              <div className="adv-prod-bar-row">
                <div className="adv-prod-bar adv-prod-bar-production" style={{ width: prodWidth }} />
                <span className="adv-prod-bar-label">{fmtVal(resource.production)}</span>
              </div>
              <div className="adv-prod-bar-row">
                <div className="adv-prod-bar adv-prod-bar-consumption" style={{ width: consWidth }} />
                <span className="adv-prod-bar-label">{fmtVal(resource.consumption)}</span>
              </div>
              <div className="adv-prod-bar-row">
                <div className="adv-prod-bar adv-prod-bar-surplus" style={{ width: surplusWidth }} />
                <span className="adv-prod-bar-label">{fmtVal(resource.surplus)}</span>
              </div>
              <div className="adv-prod-bar-row">
                <div className="adv-prod-bar adv-prod-bar-deficit" style={{ width: deficitWidth }} />
                <span className="adv-prod-bar-label">{fmtVal(resource.deficit)}</span>
              </div>
              {!isSvc && demandVal > 0 && (
                <div className="adv-prod-bar-row">
                  <div className="adv-prod-bar adv-prod-bar-demand" style={{ width: demandWidth }} />
                  <span className="adv-prod-bar-label">{fmtVal(demandVal)}</span>
                </div>
              )}
            </div>
          </div>
          </div>
        <div className="adv-resource-income-column">
          <div className={`adv-resource-income-value${isIncomeNegative ? ' adv-income-negative' : ''}`}><img className="adv-currency-icon" src={CURRENCY_ICON} />{incomeText}</div>
        </div>
      </div>
    </div>
  );
});

/* â”€â”€ Category Group Row â”€â”€ */
const CategoryGroupRow = React.memo<{
  category: ResourceCategory;
  categoryRows: ResourceRowVm[];
  isFirst: boolean;
  iconMap: Map<string, string>;
  localRates: Record<string, number>;
  selectedRowKey: string | null;
  autoTaxDirections: Map<string, AutoTaxResourceInfo>;
  onRateChange: (key: string, rate: number) => void;
  onSelect: (key: string) => void;
  onTooltipShow: (lines: string[], el?: HTMLElement, alignRight?: boolean, clientX?: number, clientY?: number) => void;
  onTooltipHide: () => void;
  // when true (viewing 'All' resources) this group should start collapsed on mount
  isAllView?: boolean;
  onToggle?: (expanded: boolean) => void;
}>(({ category, categoryRows, isFirst, iconMap, localRates, selectedRowKey, autoTaxDirections, onRateChange, onSelect, onTooltipShow, onTooltipHide, isAllView, onToggle }) => {
  const [expanded, setExpanded] = useState<boolean>(isAllView ? false : true);
  const isAllViewMounted = useRef(false);
  useEffect(() => {
    if (!isAllViewMounted.current) {
      isAllViewMounted.current = true;
      return; // skip reset on initial mount - initial state already set correctly
    }
    // Only reset when the view mode actually switches (all <-> single category)
    const next = isAllView ? false : true;
    setExpanded(next);
    if (onToggle) {
      requestAnimationFrame(() => requestAnimationFrame(() => onToggle!(next)));
    }
  }, [isAllView]);
  const [headerHover, setHeaderHover] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);
  const catProdRef = useRef<HTMLDivElement>(null);

  const totalProduction = categoryRows.reduce((sum, r) => sum + r.production, 0);
  const totalConsumption = categoryRows.reduce((sum, r) => sum + r.consumption, 0);
  const totalSurplus = categoryRows.reduce((sum, r) => sum + r.surplus, 0);
  const totalDeficit = categoryRows.reduce((sum, r) => sum + r.deficit, 0);
  const totalTaxIncome = categoryRows.reduce((sum, r) => sum + r.taxIncome, 0);
  const isCategoryIncomeNegative = totalTaxIncome < 0;
  const categoryIncomeText = formatCurrency(totalTaxIncome);
  const catIsSvc = categoryRows.some(r => r.isService);
  const catFmt = (v: number) => catIsSvc ? formatCompact(v) : formatWeight(v);
  const totalCompanies = categoryRows.reduce((sum, r) => sum + (r.companyCount ?? 0), 0);
  const totalDemand = categoryRows.reduce((sum, r) => sum + (r.demand ?? 0), 0);
  const totalMaxWorkers = categoryRows.reduce((sum, r) => sum + (r.maxWorkers ?? 0), 0);
  const totalCurrentWorkers = categoryRows.reduce((sum, r) => sum + (r.currentWorkers ?? 0), 0);
  const catWorkerPct = totalMaxWorkers > 0 ? Math.round((totalCurrentWorkers / totalMaxWorkers) * 100) : 0;
  const catMaxRef = Math.max(totalProduction, totalConsumption, totalDemand, 1);
  const prodWidth = `${Math.min(100, (totalProduction / catMaxRef) * 100)}%`;
  const consWidth = `${Math.min(100, (totalConsumption / catMaxRef) * 100)}%`;
  const surplusWidth = totalProduction > 0 ? `${Math.min(100, (totalSurplus / catMaxRef) * 100)}%` : '0%';
  const deficitWidth = totalConsumption > 0 ? `${Math.min(100, (totalDeficit / catMaxRef) * 100)}%` : '0%';
  const catDemandWidth = totalDemand > 0 ? `${Math.min(100, (totalDemand / catMaxRef) * 100)}%` : '0%';
  const avgTax = categoryRows.length > 0
    ? Math.round(categoryRows.reduce((sum, r) => sum + (localRates[r.key] ?? r.taxRate), 0) / categoryRows.length)
    : 0;

  const handleGroupRateChange = (v: number) => {
    categoryRows.forEach((r) => onRateChange(r.key, v));
  };

  const catTooltipLines: string[] = [
    `${catIsSvc ? 'Capacity' : 'Production'}: ${catFmt(totalProduction)}`,
    `${catIsSvc ? 'Used' : 'Consumption'}: ${catFmt(totalConsumption)}`,
    `Surplus: ${catFmt(totalSurplus)}`,
    `Deficit: ${catFmt(totalDeficit)}`,
    ...(!catIsSvc && totalDemand > 0 ? [`Demand: ${catFmt(totalDemand)}`] : []),
    ...(totalMaxWorkers > 0 ? [`Workers: ${totalCurrentWorkers.toLocaleString()}/${totalMaxWorkers.toLocaleString()} (${catWorkerPct}%)`] : []),
    ...(totalCompanies > 0 ? [`Companies: ${totalCompanies}`] : []),
    `Avg Tax Rate: ${avgTax}\u00a0%`,
    `Tax Income: ${categoryIncomeText}`,
  ];

  return (
    <div className={isFirst ? 'adv-category-group' : 'adv-category-group adv-category-group-border'}>
      <div
        className={`adv-category-header${headerHover ? ' adv-category-header-hover' : ''}`}
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          if (onToggle) requestAnimationFrame(() => requestAnimationFrame(() => onToggle(next)));
        }}
        onMouseOver={(e) => {
          setHeaderHover(true);
          // show floating tooltip at mouse coords so it doesn't snap to production/consumption element
          onTooltipShow(catTooltipLines, undefined, false, e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          // update floating tooltip while moving inside header
          onTooltipShow(catTooltipLines, undefined, false, e.clientX, e.clientY);
        }}
        onMouseOut={() => {
          setHeaderHover(false);
          onTooltipHide();
        }}
      >
        <img className="adv-category-icon" src={"Media/Game/Resources/" + category.icon + ".svg"} />
        <div className="adv-category-title">{category.label}</div>
        <div
          className={`adv-expand-button${buttonHover ? ' adv-expand-button-hover' : ''}`}
          onMouseOver={() => setButtonHover(true)}
          onMouseOut={() => setButtonHover(false)}
        >
          <div className={`adv-expand-icon${expanded ? ' adv-expand-icon-expanded' : ''}`} />
        </div>
        <div className="adv-category-slider-container" onClick={(e) => e.stopPropagation()}>
            <div className="adv-category-slider-column">
            <div className="adv-category-rate">{`${avgTax}\u00a0%`}</div>
            <CustomSlider
              value={avgTax}
              min={-10}
              max={30}
              onChange={handleGroupRateChange}
            />
          </div>
          <div ref={catProdRef} className="adv-category-production-column">
            <div className="adv-category-production-value">
              <div className="adv-prod-bars">
                <div className="adv-prod-bar-row">
                  <div className="adv-prod-bar adv-prod-bar-production" style={{ width: prodWidth }} />
                  <span className="adv-prod-bar-label">{catFmt(totalProduction)}</span>
                </div>
                <div className="adv-prod-bar-row">
                  <div className="adv-prod-bar adv-prod-bar-consumption" style={{ width: consWidth }} />
                  <span className="adv-prod-bar-label">{catFmt(totalConsumption)}</span>
                </div>
                <div className="adv-prod-bar-row">
                  <div className="adv-prod-bar adv-prod-bar-surplus" style={{ width: surplusWidth }} />
                  <span className="adv-prod-bar-label">{catFmt(totalSurplus)}</span>
                </div>
                <div className="adv-prod-bar-row">
                  <div className="adv-prod-bar adv-prod-bar-deficit" style={{ width: deficitWidth }} />
                  <span className="adv-prod-bar-label">{catFmt(totalDeficit)}</span>
                </div>
                {!catIsSvc && totalDemand > 0 && (
                  <div className="adv-prod-bar-row">
                    <div className="adv-prod-bar adv-prod-bar-demand" style={{ width: catDemandWidth }} />
                    <span className="adv-prod-bar-label">{catFmt(totalDemand)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="adv-category-income-column">
            <div className={`adv-category-income-value${isCategoryIncomeNegative ? ' adv-income-negative' : ''}`}><img className="adv-currency-icon" src={CURRENCY_ICON} />{categoryIncomeText}</div>
          </div>
        </div>
      </div>
      <div className="adv-prefab-list" style={{ display: expanded ? 'flex' : 'none' }}>
          {categoryRows.map((r) => (
            <ResourceSubRow
              key={r.key}
              resource={r}
              icon={iconMap.get(r.key) ?? 'Money'}
              localRate={localRates[r.key] ?? r.taxRate}
              selected={selectedRowKey === r.key}
              autoTaxDir={autoTaxDirections.get(r.key)}
              onRateChange={onRateChange}
              onSelect={onSelect}
              onTooltipShow={onTooltipShow}
              onTooltipHide={onTooltipHide}
            />
          ))}
        </div>
    </div>
  );
});

/* ———— Main Advanced Window ———— */
const AdvancedTPMWindow: React.FC<AdvancedTPMWindowProps> = ({
  selectedCategory,
  rows,
  showTips,
  autoTaxEnabled,
  autoTaxStatus,
  autoTaxSettings,
  companyBrowserData,
  companyBrowserSummary,
  companyHappinessData,
  advisorData,
  decisionLogData,
  learningStatsData,
  learningEnabled,
  residentialBrowserData,
  residentialBuildingsData,
  residentialSignatureBuildingsData,
  servicesBrowserData,
  servicesBuildingsData,
districtBrowserData,
districtPoliciesData,
  signaturePrefabs,
  signatureCompaniesJson,
  signatureCacheStatus,
  onRefreshSignatureCache,
  onRefreshCompanyBrowserData,
  onToggleLearning,
  onAutoTaxToggle,
  onResourceTaxRateChange,
  onCategoryChange,
  onCollapseChange,
  onToggleDebugPanel,
  showModDebug,
  onToggleModDebug,
  onClose,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [useGameIcons, setUseGameIcons] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('atpm.useGameZoneIcons');
      if (v === null) return true; // default on
      return v === '1' || v === 'true';
    } catch { return true; }
  });

  // Listen for in-page changes to the icon mode (from settings panel) and update state
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const val = e && typeof e.detail !== 'undefined' ? !!e.detail : (localStorage.getItem('atpm.useGameIcons') === '1');
        setUseGameIcons(val);
      } catch { }
    };
    window.addEventListener('atpm.useGameIconsChanged', handler as EventListener);
    return () => window.removeEventListener('atpm.useGameIconsChanged', handler as EventListener);
  }, []);
  const [viewMode, setViewMode] = useState<'resources' | 'businesses' | 'signature' | 'advisor' | 'residential' | 'services' | 'districts'>('resources');

  useEffect(() => {
    let mode = viewMode as string;
    if (viewMode === 'resources') mode = 'overview';
    else if (viewMode === 'businesses') mode = 'company';
    else if (viewMode === 'districts') mode = 'district';
    trigger("taxProduction", "setActiveViewMode", mode);
  }, [viewMode]);

  const safeCategory = (selectedCategory || 'all').toLowerCase();
  const iconMap = new Map(resourceCategories.flatMap((c) => c.resources.map((r) => [r.key, r.icon] as const)));
  const autoTaxParsed = useMemo(() => parseAutoTaxStatus(autoTaxStatus), [autoTaxStatus]);
  const autoTaxDirections = autoTaxParsed?.directions ?? new Map();
  const businessCompanies = useMemo(() => parseCompanies(companyBrowserData || ''), [companyBrowserData]);

  // Compute signature companies using authoritative flags from the server (isSignature)
  // and an explicit list of signature company entity keys published by the C# system.
  let signatureCompanies: any[] = [];
  let signatureCount = 0;
  const _signatureCompanies = useMemo(() => {
    const all = businessCompanies;
    // Parse signature company keys published by the system (JSON array of "idx,ver" strings)
    const keySet = new Set<string>();
    if (signatureCompaniesJson) {
      try {
        const parsed = JSON.parse(signatureCompaniesJson);
        if (Array.isArray(parsed)) parsed.map((s: any) => String(s).trim()).filter((s: string) => s.length > 0).forEach(k => keySet.add(k));
      } catch {
        // Fallback: support legacy semicolon-delimited string
        signatureCompaniesJson.split(';').map((s: any) => String(s).trim()).filter((s: string) => s.length > 0).forEach(k => keySet.add(k));
      }
    }
    // Optionally accept authoritative prefab name list as well (signaturePrefabs JSON array).
    let names: string[] = [];
    if (signaturePrefabs) {
      try { const parsed = JSON.parse(signaturePrefabs); if (Array.isArray(parsed)) names = parsed.map((s: any) => String(s)); } catch { names = []; }
    }
    return all.filter((c) => c.isSignature || keySet.has(`${c.entityIndex},${c.entityVersion}`) || (names.length > 0 && names.includes(c.name)));
  }, [businessCompanies, signatureCompaniesJson, signaturePrefabs]);
  signatureCompanies = _signatureCompanies;

  // Parse residential signature buildings: entityKey|address|level|occupied|capacity|theme|assetPack
  const residentialSignatureBuildings = useMemo(() => {
    if (!residentialSignatureBuildingsData) return [];
    return residentialSignatureBuildingsData.split(';').map((chunk) => {
      const p = chunk.split('|');
      if (p.length < 7) return null;
      return {
        entityKey: p[0] || '',
        address: p[1] || '',
        level: Number(p[2]) || 1,
        occupied: Number(p[3]) || 0,
        capacity: Number(p[4]) || 0,
        theme: p[5] || 'Unknown',
        assetPack: p[6] || 'Base Game',
      };
    }).filter(Boolean) as Array<{ entityKey: string; address: string; level: number; occupied: number; capacity: number; theme: string; assetPack: string; }>;
  }, [residentialSignatureBuildingsData]);

  const serviceSignatureCount = useMemo(() => {
    if (!servicesBuildingsData) return 0;
    try {
      const arr = JSON.parse(servicesBuildingsData);
      if (!Array.isArray(arr)) return 0;
      return arr.filter((s: any) => s.isSignature).length;
    } catch { return 0; }
  }, [servicesBuildingsData]);

  signatureCount = signatureCompanies.length + residentialSignatureBuildings.length + serviceSignatureCount;

  // Parse panel opacity from autoTaxSettings (slot 8: ...||profitWeight|opacity)
  const panelOpacity = useMemo(() => {
    if (!autoTaxSettings) return 1;
    const parts = autoTaxSettings.split('|');
    // Index 8 is the 9th slot
    if (parts.length > 8) {
      const val = Number(parts[8]);
      if (!isNaN(val)) return val / 100;
    }
    return 1;
  }, [autoTaxSettings]);

  // Removed all references to resourceTaxIncomes, areaResources$, areaTypes$, bindingIncomes, bindingsReady, and mergedRows.
  // Use rows prop directly for display.

  const displayCategories = safeCategory === 'all'
    ? resourceCategories.filter((c) => c.id !== 'all')
    : resourceCategories.filter((c) => c.id === safeCategory);

  const getCategoryRows = (cat: ResourceCategory): ResourceRowVm[] =>
    cat.resources
      .map((cr) => rows.find((r) => r.key === cr.key) ?? {
        key: cr.key,
        label: cr.label,
        stage: cr.stage,
        production: 0,
        consumption: 0,
        taxRate: 0,
        surplus: 0,
        deficit: 0,
        taxIncome: 0,
        maxWorkers: 0,
        currentWorkers: 0,
        demand: 0,
      });

  const visibleRows = useMemo(
    () => displayCategories.flatMap((cat) => getCategoryRows(cat)),
    [displayCategories, rows]
  );

  const [localRates, setLocalRates] = useState<Record<string, number>>({});
  const rowKey = useMemo(() => rows.map((r) => `${r.key}:${r.taxRate}`).join(';'), [rows]);

  useEffect(() => {
    const next: Record<string, number> = {};
    rows.forEach((r) => { next[r.key] = r.taxRate; });
    setLocalRates(next);
  }, [rowKey]);

  useEffect(() => {
    onCollapseChange?.(collapsed);
  }, [collapsed, onCollapseChange]);

  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

  // Clear selection when category changes
  useEffect(() => {
    setSelectedRowKey(null);
  }, [safeCategory]);

  const handleRowSelect = (key: string) => {
    setSelectedRowKey((prev) => prev === key ? null : key);
  };

  // Refs for resources list
  const tableBodyRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);



  const handleRateChange = (key: string, rate: number) => {
    setLocalRates((prev) => ({ ...prev, [key]: rate }));
    onResourceTaxRateChange(key, rate);
  };

  // Tooltip state â€” rendered OUTSIDE .adv-window to escape overflow:hidden clipping in CoHTML
  // Tooltip may be anchored to an element (`rect`) or to explicit client coords (`x`,`y`) to float/follow cursor.
  const [tooltip, setTooltip] = useState<{ lines: string[]; rect?: DOMRect; alignRight?: boolean; x?: number; y?: number } | null>(null);
  const showTooltip = useCallback((lines: string[], el?: HTMLElement, alignRight?: boolean, clientX?: number, clientY?: number) => {
    if (clientX != null && clientY != null) {
      setTooltip({ lines, x: clientX, y: clientY, alignRight: !!alignRight });
    } else if (el) {
      setTooltip({ lines, rect: el.getBoundingClientRect(), alignRight: !!alignRight });
    }
  }, []);
  const hideTooltip = useCallback(() => setTooltip(null), []);

  const selectedRow = selectedRowKey ? visibleRows.find((r) => r.key === selectedRowKey) : null;
  const footerRows = selectedRow ? [selectedRow] : visibleRows;
  const totalProduction = footerRows.reduce((sum, r) => sum + r.production, 0);
  const totalConsumption = footerRows.reduce((sum, r) => sum + r.consumption, 0);
  const totalSurplus = footerRows.reduce((sum, r) => sum + r.surplus, 0);
  const totalDeficit = footerRows.reduce((sum, r) => sum + r.deficit, 0);
  const totalDemandFooter = footerRows.reduce((sum, r) => sum + (r.demand ?? 0), 0);
  const totalTaxIncome = footerRows.reduce((sum, r) => sum + r.taxIncome, 0);
  const isTotalIncomeNegative = totalTaxIncome < 0;
  const totalIncomeText = formatCurrency(totalTaxIncome);

  return (
    <>
    <div className={`adv-window${collapsed ? ' adv-window-collapsed' : ''}`} style={{ opacity: panelOpacity }}>
      <div className="adv-window-header tpm-drag-handle">
        <div className="adv-window-title">Advanced Tax & Production Manager</div>
        <button
          className={`adv-learn-toggle${learningEnabled ? ' adv-learn-active' : ''}`}
          onClick={() => onToggleLearning(!learningEnabled)}
          title={learningEnabled ? 'Learning: ON - Click to disable' : 'Learning: OFF - Click to enable'}
        >
          Learning
        </button>
        <button
          className={`adv-autotax-toggle${autoTaxEnabled ? ' adv-autotax-toggle-active' : ''}`}
          onClick={() => onAutoTaxToggle(!autoTaxEnabled)}
          title={autoTaxEnabled ? 'Auto-Tax: ON - Click to disable' : 'Auto-Tax: OFF - Click to enable'}
        >
          {autoTaxEnabled ? 'AUTO' : 'AUTO'}
        </button>
        <button
          className={`adv-settings-btn${showSettingsPanel ? ' adv-settings-btn-active' : ''}`}
          onClick={() => setShowSettingsPanel((v) => !v)}
          title="Auto-Tax Settings"
        >
          <svg className="adv-settings-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>
        </button>
        <button
          className="adv-collapse-btn"
          onClick={() => onToggleDebugPanel?.()}
          title="Open / close debug panel"
          style={{ fontSize: 11, opacity: 0.6 }}
        >DBG</button>
        <button className="adv-collapse-btn" onClick={() => setCollapsed((v) => !v)}>{collapsed ? '+' : '-'}</button>
        <button className="adv-close-btn" onClick={onClose}>X</button>
      </div>

      {!collapsed && (
      <>


      {/* View mode tabs */}
      <div className="adv-view-tabs">
        <button
          className={`adv-view-tab${viewMode === 'resources' ? ' adv-view-tab-active' : ''}`}
          onClick={() => setViewMode('resources')}
        >
          Resources
        </button>
        <button
          className={`adv-view-tab${viewMode === 'businesses' ? ' adv-view-tab-active' : ''}`}
          onClick={() => setViewMode('businesses')}
        >
          Businesses
        </button>
        <button
          className={`adv-view-tab${viewMode === 'signature' ? ' adv-view-tab-active' : ''}`}
          onClick={() => setViewMode('signature')}
        >
          Signature Buildings{signatureCount > 0 && (
            <span className="adv-tab-badge">{signatureCount}</span>
          )}
        </button>
        <button
          className={`adv-view-tab${viewMode === 'advisor' ? ' adv-view-tab-active' : ''}`}
          onClick={() => setViewMode('advisor')}
        >
          Advisor
        </button>
        <button
          className={`adv-view-tab${viewMode === 'residential' ? ' adv-view-tab-active' : ''}`}
          onClick={() => setViewMode('residential')}
        >
          Residential
        </button>
        <button
          className={`adv-view-tab${viewMode === 'services' ? ' adv-view-tab-active' : ''}`}
          onClick={() => setViewMode('services')}
        >
          Services
        </button>
        <button
          className={`adv-view-tab${viewMode === 'districts' ? ' adv-view-tab-active' : ''}`}
          onClick={() => setViewMode('districts')}
        >
          Districts
        </button>
      </div>

      {/* Category filter tabs â€” resources view only */}
      {viewMode === 'resources' && (
      <div className="adv-filter-bar">
        {resourceCategories.map((cat) => (
          <button
            key={cat.id}
            className={`adv-filter-tab${cat.id === safeCategory ? ' adv-filter-tab-active' : ''}`}
            onClick={() => onCategoryChange(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>
      )}

      {viewMode === 'resources' && showTips && (
        <div className="adv-tip-bar">
          Expand each category to adjust individual resource tax rates.
        </div>
      )}

       {viewMode === 'resources' && autoTaxEnabled && autoTaxParsed && ((
        () => {
          // Compute aggregate profit info from per-resource directions
          let totalAvgProfit = 0;
          let profitCount = 0;
          let posProfit = 0;
          let negProfit = 0;
          autoTaxParsed.directions.forEach((info) => {
            if (info.avgProfit !== 0 || info.companies > 0) {
              totalAvgProfit += info.avgProfit;
              profitCount++;
              if (info.avgProfit > 0) posProfit++;
              else if (info.avgProfit < 0) negProfit++;
            }
          });
          const overallAvg = profitCount > 0 ? totalAvgProfit / profitCount : 0;
          const profitColor = overallAvg > 5 ? '#8bdb46' : overallAvg < -5 ? '#e05050' : 'rgba(255,255,255,0.6)';
          return (
            <div className="adv-autotax-status-bar">
              <span className="adv-autotax-status-label">Auto-Tax</span>
              <span className="adv-autotax-status-happiness" title={`City Happiness: ${autoTaxParsed.happiness}% \u2014 Higher happiness allows the system to raise taxes more aggressively`}>
                {autoTaxParsed.happiness >= 70 ? '\uD83D\uDE0A' : autoTaxParsed.happiness >= 40 ? '\uD83D\uDE10' : '\uD83D\uDE1F'}
                {`\u00a0${autoTaxParsed.happiness}%`}
              </span>
              {profitCount > 0 && (
                <span
                  className="adv-autotax-status-profit"
                  style={{ color: getSafeColor(profitColor) }}
                  title={`Average company profitability across ${profitCount} tracked resource(s):\n${posProfit} profitable, ${negProfit} losing money\n\nThis reflects real company profit data from ECS entities.`}
                >
                  {`\u00a0\u2248${overallAvg > 0 ? '+' : ''}${overallAvg.toFixed(0)}% profit`}
                </span>
              )}
              {autoTaxParsed.raiseCount > 0
                ? <span className="adv-autotax-status-raise" title={`${autoTaxParsed.raiseCount} resource(s) had their tax rate increased this cycle`}>{`▲ ${autoTaxParsed.raiseCount}`}</span>
                : <span className="adv-autotax-status-raise adv-autotax-status-zero" title="No resources raised this cycle">{`▲ 0`}</span>}
              {autoTaxParsed.lowerCount > 0 
                ? <span className="adv-autotax-status-lower" title={`${autoTaxParsed.lowerCount} resource(s) had their tax rate decreased this cycle`}>{`▼ ${autoTaxParsed.lowerCount}`}</span>
                : <span className="adv-autotax-status-lower adv-autotax-status-zero" title="No resources lowered this cycle">{`▼ 0`}</span>}
              {autoTaxParsed.holdCount > 0
                ? <span className="adv-autotax-status-hold" title={`${autoTaxParsed.holdCount} resource(s) unchanged \u2014 tax rate is already optimal`}>{`→ ${autoTaxParsed.holdCount}`}</span>
                : <span className="adv-autotax-status-hold adv-autotax-status-zero" title="No resources at hold">{`→ 0`}</span>}
            </div>
          );
        }
      )())}

      {/* Businesses view */}
      {viewMode === 'businesses' && (
        <div className="adv-table-section">
          <CompanyBrowser companies={businessCompanies} summaryData={companyBrowserSummary} happinessData={companyHappinessData} isSignatureView={false} />
        </div>
      )}

      {/* Signature Buildings view â€” unified commercial + residential */}
      {viewMode === 'signature' && (
        <div className="adv-table-section">
          <SignatureUnifiedView
            signatureCompanies={signatureCompanies}
            residentialSignatureBuildings={residentialSignatureBuildings}
            servicesBuildingsData={servicesBuildingsData ?? ''}
          />
        </div>
      )}

      {/* Advisor view */}
      {viewMode === 'advisor' && (
        <div className="adv-table-section">
          <AdvisorPanel
            advisorData={advisorData}
            decisionLogData={decisionLogData}
            learningStatsData={learningStatsData}
            learningEnabled={learningEnabled}
            onToggleLearning={(enabled) => trigger('taxProduction', 'setLearningEnabled', enabled)}
            onResetLearning={() => trigger('taxProduction', 'resetLearning')}
            onSetAggressiveness={(level) => trigger('taxProduction', 'setLearningAggressiveness', level)}
          />
        </div>
      )}

      {viewMode === 'residential' && (
        <div className="adv-table-section">
          <ResidentialPanel residentialBrowserData={residentialBrowserData} residentialBuildingsData={residentialBuildingsData} />
        </div>
      )}

      {viewMode === 'services' && (
        <div className="adv-table-section">
          <ServicesPanel servicesBuildingsData={servicesBuildingsData} />
        </div>
      )}

      {viewMode === 'districts' && (
        <DistrictsPanel
          residentialBuildingsData={residentialBuildingsData}
          servicesBuildingsData={servicesBuildingsData}
          companyBrowserData={companyBrowserData}
          districtBrowserData={districtBrowserData}
          districtPoliciesData={districtPoliciesData}
          onToggleDebug={onToggleModDebug}
          showDebug={showModDebug}
        />
      )}

      {/* Resources view â€” Table structure */}
      {viewMode === 'resources' && (
      <div className="adv-table-section">
        <div className="adv-table-header">
          <div className="adv-column-headers">
            <div className="adv-col-type">Resource</div>
            <div className="adv-col-rate">Tax Rate</div>
            <div className="adv-col-production">Prod / Cons</div>
            <div className="adv-col-income">Tax Income</div>
          </div>
          {/* Legend removed - colors shown inline on bars and footer */}
        </div>

      <div className="adv-table-content-wrapper" ref={tableWrapperRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Scrollable vertical={true} className="adv-table-content" trackVisibility="scrollable" style={{ flex: 1, minHeight: 0 }}>
            {displayCategories.map((cat, idx) => {
              const catRows = getCategoryRows(cat);
              if (catRows.length === 0) return null;
              return (
                <CategoryGroupRow
                  key={cat.id}
                  category={cat}
                  categoryRows={catRows}
                  isFirst={idx === 0}
                  iconMap={iconMap}
                  localRates={localRates}
                  selectedRowKey={selectedRowKey}
                  autoTaxDirections={autoTaxDirections}
                  onRateChange={handleRateChange}
                  onSelect={handleRowSelect}
                  isAllView={safeCategory === 'all'}
                  onTooltipShow={showTooltip}
                  onTooltipHide={hideTooltip}
                />
              );
            })}
        </Scrollable>
        </div>
      </div>
      )}

      {/* Footer summary — resources view only */}
      {viewMode === 'resources' && (
      <div className="adv-footer">
        <div className="adv-footer-summary">
          {selectedRow && <span className="adv-footer-selected">{selectedRow.label}</span>}
          <span className="adv-footer-prod">{`Production:\u00a0${formatWeight(totalProduction)}`}</span>
          <span className="adv-footer-cons">{`Consumption:\u00a0${formatWeight(totalConsumption)}`}</span>
          {totalSurplus > 0 && <span className="adv-footer-surplus">{`Surplus:\u00a0${formatWeight(totalSurplus)}`}</span>}
          {totalDeficit > 0 && <span className="adv-footer-deficit">{`Deficit:\u00a0${formatWeight(totalDeficit)}`}</span>}
          {totalDemandFooter > 0 && <span className="adv-footer-demand">{`Demand:\u00a0${formatWeight(totalDemandFooter)}`}</span>}
          <span className={`adv-footer-income${isTotalIncomeNegative ? ' adv-income-negative' : ''}`}>{`Tax\u00a0Income:\u00a0`}<img className="adv-currency-icon-footer" src={CURRENCY_ICON} />{totalIncomeText}</span>
          {autoTaxEnabled && autoTaxParsed && (
            <span className="adv-footer-autotax" title="City happiness influences auto-tax decisions">{`Happiness:\u00a0${autoTaxParsed.happiness}%`}</span>
          )}
        </div>
      </div>
      )}
      </>
      )}

      </div>
      {showSettingsPanel && (
        <AutoTaxSettingsPanel
          settingsPayload={autoTaxSettings}
          onClose={() => setShowSettingsPanel(false)}
        />
      )}
      {tooltip && (() => {
      const { lines, rect, alignRight, x, y } = tooltip;
      const style: React.CSSProperties = { position: 'fixed', zIndex: 10000 };
      if (x != null && y != null) {
        // position relative to mouse coordinates, with a small offset
        const left = Math.min(Math.max(8, x + 12), Math.max(8, window.innerWidth - 320));
        const top = Math.min(Math.max(8, y + 12), Math.max(8, window.innerHeight - 120));
        style.left = left;
        style.top = top;
      } else if (rect) {
        const above = rect.top > 140;
        if (alignRight) {
          style.right = window.innerWidth - rect.right;
        } else {
          style.left = rect.left;
        }
        if (above) {
          style.bottom = window.innerHeight - rect.top + 4;
        } else {
          style.top = rect.bottom + 4;
        }
      }
      return (
        <div className="adv-row-tooltip" style={style}>
          {lines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      );
    })()}
      {showModDebug && <ModDebugPanel onClose={onToggleModDebug} />}
    </>
  );
};

/* â”€â”€ Unified Signature View â”€â”€ */
interface SigResBuilding { entityKey: string; address: string; level: number; occupied: number; capacity: number; theme: string; assetPack: string; }

type SigSortField = 'name' | 'type' | 'theme' | 'assetPack' | 'level';

const focusSignatureEntity = (entityKey: string) => {
  try {
    const parts = String(entityKey || '').split(',');
    const entity = { index: Number(parts[0]) || 0, version: Number(parts[1]) || 0 };
    camera.focusEntity(entity);
    selectedInfo.selectEntity(entity);
  } catch {}
};

const SignatureUnifiedView: React.FC<{ 
  signatureCompanies: any[]; 
  residentialSignatureBuildings: SigResBuilding[];
  servicesBuildingsData: string;
}> = ({
  signatureCompanies,
  residentialSignatureBuildings,
  servicesBuildingsData,
}) => {
  const [typeFilter, setTypeFilter] = useState('All');
  const [themeFilter, setThemeFilter] = useState('All');
  const [packFilter, setPackFilter] = useState('All');
  const [sortField, setSortField] = useState<SigSortField>('name');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [frozenItems, setFrozenItems] = useState<typeof allItems>([]);
  const [searchText, setSearchText] = useState('');
  const SIG_PAGE_SIZE = 50;


  // Parse services
  const serviceSignatures = useMemo(() => {
    if (!servicesBuildingsData) return [];
    try {
      const arr = JSON.parse(servicesBuildingsData);
      if (!Array.isArray(arr)) return [];
      return arr.filter((s: any) => s.isSignature).map((s: any) => {
        const [bIdx, bVer] = (s.entityKey || '').split(',').map(Number);
        return {
          entityKey: s.entityKey,
          name: s.name,
          address: s.address,
          type: s.isLandmark ? 'Landmark' : 'Services',
          theme: s.theme || 'USA',
          assetPack: s.assetPack || 'Base Game',
          level: s.level || 0,
          extraInfo: `Efficiency: ${Math.round(s.efficiency || 0)}%`,
          district: s.district || 'City',
          resourceKey: '',
          buildingIndex: bIdx || 0,
          buildingVersion: bVer || 0,
        };
      });
    } catch { return []; }
  }, [servicesBuildingsData]);

  // Build combined list
  const allItems = useMemo(() => {
    const commercial = signatureCompanies.map((c) => {
      const workers = c.workers || 0;
      const maxWorkers = c.maxWorkers || 0;
      const profit = c.profit || 0;
      const happiness = c.happiness || 0;
      
      let extra = c.resourceName ? `Resource: ${c.resourceName}` : '';
      if (maxWorkers > 0) extra += ` \u2022 Jobs: ${workers}/${maxWorkers}`;
      if (profit !== 0) extra += ` \u2022 Profit: ${profit > 0 ? '+' : ''}${profit.toFixed(1)}`;
      if (happiness > 0) extra += ` \u2022 Happy: ${Math.round(happiness)}%`;

      const rawType = c.zoneType || c.companyKind || 'Commercial';
      const mappedType = ['Residential', 'Commercial', 'Industrial', 'Office'].includes(rawType) ? rawType : 'Services';

      return {
        entityKey: `${c.entityIndex},${c.entityVersion}`,
        name: c.name || c.companyName || '',
        address: c.address || '',
        type: mappedType,
        theme: c.theme || 'USA',
        assetPack: c.assetPack || 'Base Game',
        level: c.level || 0,
        extraInfo: extra,
        district: c.district || 'City',
        resourceKey: c.resourceKey || '',
        buildingIndex: c.buildingIndex,
        buildingVersion: c.buildingVersion,
        // Carry over metrics for tooltip
        workers, maxWorkers, profit, happiness
      };
    });
    const residential = residentialSignatureBuildings.map((b) => {
      const occPct = b.capacity > 0 ? Math.round((b.occupied / b.capacity) * 100) : 0;
      const [bIdx, bVer] = (b.entityKey || '').split(',').map(Number);
      return {
        entityKey: b.entityKey,
        name: b.address,
        address: b.address,
        type: 'Residential',
        theme: b.theme || 'Unknown',
        assetPack: b.assetPack || 'Base Game',
        level: b.level || 0,
        extraInfo: b.capacity > 0 
          ? `${b.occupied}/${b.capacity} Households (${occPct}%)` 
          : (b.occupied > 0 ? `${b.occupied} Residents` : 'Empty'),
        district: (b as any).district || 'City',
        resourceKey: '',
        buildingIndex: bIdx || 0,
        buildingVersion: bVer || 0,
      };
    });
    return [...commercial, ...residential, ...serviceSignatures];
  }, [signatureCompanies, residentialSignatureBuildings, serviceSignatures]);

  const focusCompany = (entityKey: string) => {
    try {
      const parts = entityKey.split(',');
      const entity = { index: Number(parts[0]) || 0, version: Number(parts[1]) || 0 };
      camera.focusEntity(entity);
      selectedInfo.selectEntity(entity);
    } catch {}
  };

  const focusBuilding = (index: number, version: number) => {
    try {
      const entity = { index, version };
      camera.focusEntity(entity);
      selectedInfo.selectEntity(entity);
    } catch {}
  };

  const focusEntityOnly = (entityKey: string) => {
    try {
      const parts = entityKey.split(',');
      const entity = { index: Number(parts[0]) || 0, version: Number(parts[1]) || 0 };
      camera.focusEntity(entity);
      selectedInfo.selectEntity(entity);
    } catch {}
  };

  const [distFilter, setDistFilter] = useState('All');
  const [resFilter, setResFilter] = useState('All');

  const typeOptions = useMemo(() => ['All', ...Array.from(new Set(allItems.map((i) => String(i.type || '').trim()).filter(Boolean))).sort()], [allItems]);
  const themes = useMemo(() => ['All', ...Array.from(new Set(allItems.map((i) => i.theme).filter(Boolean)))], [allItems]);
  const packs = useMemo(() => ['All', ...Array.from(new Set(allItems.map((i) => i.assetPack).filter(Boolean)))], [allItems]);
  const districts = useMemo(() => ['All', ...Array.from(new Set(allItems.map((i) => (i as any).district).filter(Boolean))).sort()], [allItems]);
  const resources = useMemo(() => ['All', ...Array.from(new Set(allItems.map((i) => (i as any).resourceKey).filter(Boolean))).sort()], [allItems]);

  const filtered = useMemo(() => {
    let list = allItems;
    if (typeFilter !== 'All') list = list.filter((i) => String(i.type || '').toLowerCase() === typeFilter.toLowerCase());
    if (themeFilter !== 'All') list = list.filter((i) => String(i.theme || '').toLowerCase() === themeFilter.toLowerCase());
    if (packFilter !== 'All') list = list.filter((i) => String(i.assetPack || 'Base Game').toLowerCase().includes(packFilter.toLowerCase()));
    if (distFilter !== 'All') list = list.filter((i) => String((i as any).district || 'City').toLowerCase() === distFilter.toLowerCase());
    if (resFilter !== 'All') list = list.filter((i) => resourceIconName((i as any).resourceKey || '') === resFilter);
    if (searchText) {
      const lower = searchText.toLowerCase();
      list = list.filter((i) => 
        (i.name || '').toLowerCase().includes(lower) || 
        (i.address || '').toLowerCase().includes(lower) || 
        (i.type || '').toLowerCase().includes(lower) || 
        (i.assetPack || '').toLowerCase().includes(lower) || 
        (i.district || '').toLowerCase().includes(lower)
      );
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'type') cmp = a.type.localeCompare(b.type);
      else if (sortField === 'theme') cmp = a.theme.localeCompare(b.theme);
      else if (sortField === 'assetPack') cmp = a.assetPack.localeCompare(b.assetPack);
      else if (sortField === 'level') cmp = a.level - b.level;
      return sortDir * cmp;
    });
  }, [allItems, typeFilter, themeFilter, packFilter, distFilter, resFilter, sortField, sortDir, searchText]);

  // Reset page + unpause when filters or sort change
  useEffect(() => {
    setCurrentPage(0);
    setExpandedEntity(null);
    setIsPaused(false);
  }, [typeFilter, themeFilter, packFilter, distFilter, resFilter, sortField, sortDir, searchText]);

  // Freeze the displayed list while a row is expanded
  const displayItems = isPaused ? frozenItems : filtered;

  const handleSort = (f: SigSortField) => {
    if (sortField === f) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else { setSortField(f); setSortDir(1); }
  };

  const getItemTooltip = (item: { name: string; type: string; theme: string; assetPack: string; level: number; address: string; entityKey: string; extraInfo: string }) => [
    item.name,
    `Type: ${item.type}`,
    `Theme: ${item.theme} - Pack: ${item.assetPack}`,
    `Level: ${item.level > 0 ? `Lv ${item.level}` : '-'}`,
    ...(item.address && item.address !== item.name ? [`Address: ${item.address}`] : []),
    ...(item.extraInfo ? [item.extraInfo] : []),
    `Entity: ${item.entityKey}`,
    'Click row to expand details or use GO/CO/BLDG to focus camera',
  ].join('\n');

  const SortHdr: React.FC<{ field: SigSortField; label: string; style?: React.CSSProperties }> = ({ field, label, style }) => (
    <div
      className="sig-col-hdr"
      style={{ cursor: 'pointer', userSelect: 'none', ...style }}
      onClick={() => handleSort(field)}
    >
      {label}{sortField === field ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
    </div>
  );

  if (allItems.length === 0) {
    return (
      <div className="adv-table-section">
        <div className="adv-empty" style={{ padding: '20rem', textAlign: 'center', color: getSafeColor('rgba(255,255,255,0.55)'), fontSize: '13rem', fontStyle: 'italic' }}>
          No signature buildings unlocked yet. Build and complete signature building requirements to see them here.
        </div>
      </div>
    );
  }

  return (
    <div className="sig-view">
      {/* Filter bar */}
      <div className="sig-filters">
        <input 
          className="svc-search" 
          placeholder="Search signature/unique buildings..." 
          value={searchText} 
          onInput={(e: any) => setSearchText(e.target.value || '')}
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: '8rem' }}
        />
        <div className="sig-type-btns">
          {typeOptions.map((t) => (
            <button
              key={t}
              className={`sig-type-btn${typeFilter === t ? ' sig-type-btn-active' : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {t !== 'All' && <ServiceIcon category={t.toLowerCase() === 'residential' ? 'residential' : t} size={14} style={{ marginRight: '6rem' }} />}
              {t === 'Landmark' ? 'Landmarks' : t}
            </button>
          ))}
        </div>
        <div className="sig-filter-selects" style={{ display: 'flex', gap: '8rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <CustomSelect
            label="Theme"
            value={themeFilter}
            options={themes}
            onChange={setThemeFilter}
            displayValue={(v) => v === 'All' ? 'All Themes' : v}
          />
          <CustomSelect
            label="Pack"
            value={packFilter}
            options={packs}
            onChange={setPackFilter}
            displayValue={(v) => v === 'All' ? 'All Packs' : formatPackName(v)}
            icon={(v) => v === 'All' ? null : <PackIcon pack={v} size={24} />}
          />
          <CustomSelect
            label="District"
            value={distFilter}
            options={districts}
            onChange={setDistFilter}
            displayValue={(v) => v === 'All' ? 'All Districts' : v}
          />
          {resources.length > 2 && (
            <div className="sig-filter-pill-row" style={{ flexWrap: 'wrap' }}>
              <span className="sig-filter-pill-label">Resource</span>
              <button 
                className={`sig-filter-pill${resFilter === 'All' ? ' sig-filter-pill-active' : ''}`} 
                onClick={() => setResFilter('All')}
                title="All Resources"
              >
                All
              </button>
              {(() => {
                // Group by icon to avoid duplicates like Paper/Commercial Paper in filters
                const groups: Record<string, { icon: string, label: string }> = {};
                resources.forEach(r => {
                  if (r === 'All') return;
                  const icon = resourceIconName(r);
                  if (!groups[icon]) groups[icon] = { icon, label: resourceLabel(r) };
                });
                return Object.values(groups).sort((a,b) => a.label.localeCompare(b.label)).map(g => (
                  <button 
                    key={`res-${g.icon}`} 
                    className={`sig-filter-pill${resFilter === g.icon ? ' sig-filter-pill-active' : ''}`} 
                    onClick={() => setResFilter(resFilter === g.icon ? 'All' : g.icon)} 
                    title={g.label} 
                    style={{ padding: '2rem 4rem' }}
                  >
                    <img src={resourceIconSrc(g.icon)} alt="" style={{ width: '24rem', height: '24rem' }} />
                  </button>
                ));
              })()}
            </div>
          )}
          <div className="sig-summary-row" style={{ display: 'flex', alignItems: 'center', padding: '4rem 10rem', borderTopWidth: '1rem', borderTopStyle: 'solid', borderTopColor: 'rgba(255,255,255,0.05)', marginTop: '4rem' }}>
            <span className="sig-count" style={{ fontSize: '11rem', opacity: 0.6 }}>{filtered.length}{'\u00a0'}buildings shown</span>
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="sig-table-header">
        <SortHdr field="name" label="Building Name" style={{ flex: 3 }} />
        <SortHdr field="type" label="Type" style={{ width: '80rem' }} />
        <SortHdr field="theme" label="Theme" style={{ width: '80rem', textAlign: 'center' }} />
        <SortHdr field="assetPack" label="Pack" style={{ width: '80rem', textAlign: 'center' }} />
        <SortHdr field="level" label="Lv" style={{ width: '36rem', textAlign: 'center' }} />
        <div className="sig-col-hdr" style={{ width: '60rem', textAlign: 'center' }}>District</div>
        <div className="sig-col-hdr" style={{ width: '80rem', textAlign: 'center' }}>GO</div>
      </div>

      {/* Scrollable rows */}
      <div className="sig-rows-wrap" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Scrollable vertical={true} className="sig-rows-scroll" trackVisibility="scrollable">
          {(() => {
            const totalPages = Math.max(1, Math.ceil(displayItems.length / SIG_PAGE_SIZE));
            const safePage = Math.min(currentPage, totalPages - 1);
            const pageItems = displayItems.slice(safePage * SIG_PAGE_SIZE, (safePage + 1) * SIG_PAGE_SIZE);
            return pageItems;
          })().map((item) => (
            <div key={item.entityKey} className="sig-row-container" style={{ display: 'flex', flexDirection: 'column', width: '100%', borderBottomWidth: '1rem', borderBottomStyle: 'solid', borderBottomColor: 'rgba(255,255,255,0.05)' }}>
              <div className={`sig-row${expandedEntity === item.entityKey ? (String(item.type).toLowerCase() === 'residential' ? ' sig-row-active-res' : ' sig-row-active') : ''}`} 
                  onClick={() => {
                    const isOpening = expandedEntity !== item.entityKey;
                    setExpandedEntity(isOpening ? item.entityKey : null);
                    if (isOpening) { setFrozenItems(filtered); setIsPaused(true); }
                    else { setIsPaused(false); }
                  }} 
                  title={getItemTooltip(item)}
                  style={{ display: 'flex', alignItems: 'center', padding: '6rem 10rem', cursor: 'pointer', fontSize: '12rem' }}
              >
                <div className="sig-col-name" style={{ flex: 3, display: 'flex', alignItems: 'center' }}>
                  <span className="sig-expand-arrow">{expandedEntity === item.entityKey ? '\u25BC' : '\u25B6'}</span>
                  <ServiceIcon category={String(item.type).toLowerCase() === 'residential' ? 'residential' : item.type} size={24} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '6rem' }}>{item.name}</span>
                </div>
                <div className="sig-col-type" style={{ width: '80rem' }}>
                  <span className={`sig-type-badge sig-type-${String(item.type).toLowerCase()}`} style={{ fontSize: '11rem', fontWeight: 600, padding: '2rem 6rem', textTransform: 'uppercase', letterSpacing: '0.3rem', borderRadius: '2rem' }}>
                    {item.type}
                  </span>
                </div>
                <div className="sig-col-theme" style={{ width: '80rem', textAlign: 'center' }}>
                  {item.theme}
                </div>
                <div className="sig-col-pack" style={{ width: '80rem', display: 'flex', justifyContent: 'center' }}>
                  <PackIcon pack={item.assetPack} size={24} />
                </div>
                <div className="sig-col-level" style={{ width: '36rem', textAlign: 'center', color: getSafeColor('rgba(255,255,255,0.75)') }}>{item.level > 0 ? item.level : '-'}</div>
                <div className="sig-col-dist" style={{ width: '60rem', textAlign: 'center', opacity: 0.8, fontSize: '12rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.district}</div>
                <div className="sig-col-action" style={{ width: '80rem', display: 'flex', gap: '3rem', justifyContent: 'center' }}>
                  {item.buildingIndex && item.buildingIndex > 0 && item.entityKey !== `${item.buildingIndex},${item.buildingVersion}` ? (
                    <>
                      <button
                        className="cb-locate-btn cb-locate-co"
                        onClick={(e) => { e.stopPropagation(); focusCompany(item.entityKey); }}
                        title="Focus camera and inspect Company"
                        style={{ padding: '2rem 5rem', fontSize: '9rem', letterSpacing: '0' }}
                      >
                        GO
                      </button>
                      <button
                        className="cb-locate-btn cb-locate-bldg"
                        onClick={(e) => { e.stopPropagation(); focusBuilding(item.buildingIndex, item.buildingVersion); }}
                        title="Focus camera and inspect Building"
                        style={{ padding: '2rem 5rem', fontSize: '9rem', letterSpacing: '0' }}
                      >
                        BLD
                      </button>
                    </>
                  ) : (
                    <button
                      className="res-locate-btn"
                      onClick={(e) => { e.stopPropagation(); focusEntityOnly(item.entityKey); }}
                      title="Focus camera on this building"
                      style={{ padding: '2rem 14rem', fontSize: '10rem', fontWeight: 'bold' }}
                    >
                      GO
                    </button>
                  )}
                </div>
              </div>
              {expandedEntity === item.entityKey && (
                <div className="res-bldg-detail-row" style={{ padding: '8rem 10rem 8rem 34rem', backgroundColor: 'rgba(12,18,28,0.7)', borderTop: '1rem solid rgba(255,255,255,0.04)' }}>
                  <div className="res-entity-id-header" style={{ marginBottom: '6rem', paddingBottom: '4rem', borderBottom: '1rem solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center' }}>
                    <span className="res-entity-id-label" style={{ fontSize: '11rem', color: 'rgba(255, 255, 255, 0.5)', marginRight: '6rem', textTransform: 'uppercase', fontWeight: 700 }}>Entity ID:</span>
                    {item.buildingIndex && item.buildingIndex > 0 && item.entityKey !== `${item.buildingIndex},${item.buildingVersion}` ? (
                      <>
                        <span className="cb-entity-id-badge" title="Company Entity ID">CO {item.entityKey}</span>
                        <span className="cb-entity-id-badge cb-entity-id-bldg-badge" title="Building Entity ID" style={{ marginLeft: '6rem' }}>
                          BLDG {item.buildingIndex}:{item.buildingVersion}
                        </span>
                      </>
                    ) : (
                      <span className="res-entity-id-badge">{item.entityKey}</span>
                    )}
                  </div>
                  <div className="res-bldg-detail-grid" style={{ display: 'flex', flexWrap: 'wrap' }}>
                    <div style={{ width: '200rem', marginRight: '8rem', marginBottom: '4rem' }}><span className="res-bldg-detail-label" style={{ fontSize: '11rem', color: 'rgba(255,255,255,0.5)', marginRight: '4rem', textTransform: 'uppercase', fontWeight: 700 }}>Name</span><span className="res-bldg-detail-value" style={{ fontSize: '12rem', color: 'rgba(255,255,255,0.85)' }}>{item.name}</span></div>
                    {item.address && item.address !== item.name && (
                      <div style={{ width: '200rem', marginRight: '8rem', marginBottom: '4rem' }}><span className="res-bldg-detail-label" style={{ fontSize: '11rem', color: 'rgba(255,255,255,0.5)', marginRight: '4rem', textTransform: 'uppercase', fontWeight: 700 }}>Address</span><span className="res-bldg-detail-value" style={{ fontSize: '12rem', color: 'rgba(255,255,255,0.85)' }}>{item.address}</span></div>
                    )}
                    <div style={{ width: '200rem', marginRight: '8rem', marginBottom: '4rem' }}><span className="res-bldg-detail-label" style={{ fontSize: '11rem', color: 'rgba(255,255,255,0.5)', marginRight: '4rem', textTransform: 'uppercase', fontWeight: 700 }}>Type</span><span className="res-bldg-detail-value" style={{ fontSize: '12rem', color: 'rgba(255,255,255,0.85)' }}>{item.type}</span></div>
                    <div style={{ width: '200rem', marginRight: '8rem', marginBottom: '4rem' }}><span className="res-bldg-detail-label" style={{ fontSize: '11rem', color: 'rgba(255,255,255,0.5)', marginRight: '4rem', textTransform: 'uppercase', fontWeight: 700 }}>Theme</span><span className="res-bldg-detail-value" style={{ fontSize: '12rem', color: 'rgba(255,255,255,0.85)' }}>{item.theme}</span></div>
                    <div style={{ width: '200rem', marginRight: '8rem', marginBottom: '4rem' }}><span className="res-bldg-detail-label" style={{ fontSize: '11rem', color: 'rgba(255,255,255,0.5)', marginRight: '4rem', textTransform: 'uppercase', fontWeight: 700 }}>Pack</span><span className="res-bldg-detail-value" style={{ fontSize: '12rem', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center' }}><PackIcon pack={item.assetPack} size={20} style={{ marginRight: '6rem' }} />{item.assetPack || 'Base Game'}</span></div>
                    {item.level > 0 && (
                      <div style={{ width: '200rem', marginRight: '8rem', marginBottom: '4rem' }}><span className="res-bldg-detail-label" style={{ fontSize: '11rem', color: 'rgba(255,255,255,0.5)', marginRight: '4rem', textTransform: 'uppercase', fontWeight: 700 }}>Level</span><span className="res-bldg-detail-value" style={{ fontSize: '12rem', color: 'rgba(255,255,255,0.85)' }}>{`Lv ${item.level}`}</span></div>
                    )}
                    <div style={{ width: '200rem', marginRight: '8rem', marginBottom: '4rem' }}><span className="res-bldg-detail-label" style={{ fontSize: '11rem', color: 'rgba(255,255,255,0.5)', marginRight: '4rem', textTransform: 'uppercase', fontWeight: 700 }}>District</span><span className="res-bldg-detail-value" style={{ fontSize: '12rem', color: 'rgba(255,255,255,0.85)' }}>{item.district}</span></div>
                    {item.extraInfo && (
                      <div style={{ width: '400rem', marginRight: '8rem', marginBottom: '4rem' }}><span className="res-bldg-detail-label" style={{ fontSize: '11rem', color: 'rgba(255,255,255,0.5)', marginRight: '4rem', textTransform: 'uppercase', fontWeight: 700 }}>Status / Info</span><span className="res-bldg-detail-value" style={{ fontSize: '12rem', color: '#50b8e9', fontWeight: 'bold' }}>{item.extraInfo}</span></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </Scrollable>
        {/* Pagination controls */}
        {displayItems.length > SIG_PAGE_SIZE && (() => {
          const totalPages = Math.max(1, Math.ceil(displayItems.length / SIG_PAGE_SIZE));
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
  );
};

export default React.memo(AdvancedTPMWindow);

