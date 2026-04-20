import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { trigger } from 'cs2/api';
// Removed invalid imports from 'cs2/bindings'.
import { resourceCategories, ResourceCategory } from '../data/resourceTaxonomy';
import AutoTaxSettingsPanel from './AutoTaxSettingsPanel';
import CompanyBrowser, { parseCompanies } from './CompanyBrowser';
import AdvisorPanel from './AdvisorPanel';
import './AdvancedTPMWindow.css';

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

interface AdvancedTPMWindowProps {
  selectedCategory: string;
  rows: ResourceRowVm[];
  showTips: boolean;
  autoTaxEnabled: boolean;
  autoTaxStatus: string;
  autoTaxSettings: string;
  companyBrowserData: string;
  companySummaries?: string;
  companyDetail?: string;
  companyPerf?: string;
  overviewTwoColumn?: boolean;
  companyHappinessData: string;
  signaturePrefabs?: string;
  signatureCompaniesJson?: string;
  signatureCacheStatus?: string;
  signatureInfo?: string;
  advisorData: string;
  decisionLogData: string;
  learningStatsData: string;
  learningEnabled: boolean;
  onAutoTaxToggle: (enabled: boolean) => void;
  onToggleLearning: (enabled: boolean) => void;
  onResourceTaxRateChange: (key: string, rate: number) => void;
  onCategoryChange: (category: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
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

/** Format weight in game-style units: kg / t / kt — unit glued to number (no space) */
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

/* ── Custom Slider ── */
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
    onChange(calculateValue(e.clientX));

    const onMove = (ev: MouseEvent) => onChange(calculateValue(ev.clientX));
    const onUp = () => {
      setIsDragging(false);
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

/* ── Resource Sub-Row ── */
const ResourceSubRow: React.FC<{
  resource: ResourceRowVm;
  icon: string;
  localRate: number;
  selected: boolean;
  autoTaxDir?: AutoTaxResourceInfo;
  onRateChange: (key: string, rate: number) => void;
  onSelect: (key: string) => void;
  onTooltipShow: (lines: string[], el?: HTMLElement, alignRight?: boolean, clientX?: number, clientY?: number) => void;
  onTooltipHide: () => void;
}> = ({ resource, icon, localRate, selected, autoTaxDir, onRateChange, onSelect, onTooltipShow, onTooltipHide }) => {
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
};

/* ── Category Group Row ── */
const CategoryGroupRow: React.FC<{
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
}> = ({ category, categoryRows, isFirst, iconMap, localRates, selectedRowKey, autoTaxDirections, onRateChange, onSelect, onTooltipShow, onTooltipHide, isAllView, onToggle }) => {
  const [expanded, setExpanded] = useState<boolean>(isAllView ? false : true);
  // Keep expanded state in sync when view mode changes between 'all' and a single category
  useEffect(() => {
    const next = isAllView ? false : true;
    setExpanded(next);
    if (onToggle) {
      // allow layout to settle
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
          onClick={(e) => {
            e.stopPropagation();
            const next = !expanded;
            setExpanded(next);
            if (onToggle) requestAnimationFrame(() => requestAnimationFrame(() => onToggle(next)));
          }}
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
      {expanded && (
        <div className="adv-prefab-list">
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
      )}
    </div>
  );
};

/* ── Main Advanced Window ── */
const AdvancedTPMWindow: React.FC<AdvancedTPMWindowProps> = ({
  selectedCategory,
  rows,
  showTips,
  autoTaxEnabled,
  autoTaxStatus,
  autoTaxSettings,
  companyBrowserData,
  companyHappinessData,
  advisorData,
  decisionLogData,
  learningStatsData,
  learningEnabled,
  signaturePrefabs,
  signatureCompaniesJson,
  signatureCacheStatus,
  onToggleLearning,
  onAutoTaxToggle,
  onResourceTaxRateChange,
  onCategoryChange,
  onCollapseChange,
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
        const val = e && typeof e.detail !== 'undefined' ? !!e.detail : (localStorage.getItem('atpm.useGameZoneIcons') === '1');
        setUseGameIcons(val);
      } catch { }
    };
    window.addEventListener('atpm.useGameIconsChanged', handler as EventListener);
    return () => window.removeEventListener('atpm.useGameIconsChanged', handler as EventListener);
  }, []);
  const [viewMode, setViewMode] = useState<'resources' | 'businesses' | 'signature' | 'advisor'>('resources');
  const safeCategory = (selectedCategory || 'all').toLowerCase();
  const iconMap = new Map(resourceCategories.flatMap((c) => c.resources.map((r) => [r.key, r.icon] as const)));
  const autoTaxParsed = useMemo(() => parseAutoTaxStatus(autoTaxStatus), [autoTaxStatus]);
  const autoTaxDirections = autoTaxParsed?.directions ?? new Map();

  // Compute signature companies using authoritative flags from the server (isSignature)
  // and an explicit list of signature company entity keys published by the C# system.
  let signatureCompanies: any[] = [];
  let signatureCount = 0;
  const _signatureCompanies = useMemo(() => {
    const all = parseCompanies(companyBrowserData || '');
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
  }, [companyBrowserData, signatureCompaniesJson, signaturePrefabs]);
  signatureCompanies = _signatureCompanies;
  signatureCount = signatureCompanies.length;

  // Parse panel opacity from autoTaxSettings (slot 8: ...||profitWeight|opacity)
  const panelOpacity = useMemo(() => {
    if (!autoTaxSettings) return 1;
    const parts = autoTaxSettings.split('|');
    if (parts.length > 8) {
      const val = Number(parts[8]);
      if (!isNaN(val) && val >= 40 && val <= 100) return val / 100;
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

  // Overlay scrollbar for resources list
  const tableBodyRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const tableTrackRef = useRef<HTMLDivElement | null>(null);
  const tableThumbRef = useRef<HTMLDivElement | null>(null);
  const [tableThumbTop, setTableThumbTop] = useState(0);
  const [tableThumbHeight, setTableThumbHeight] = useState(48);

  const updateTableScrollbar = useCallback(() => {
    const body = tableBodyRef.current;
    const track = tableTrackRef.current;
    const thumb = tableThumbRef.current;
    const wrapper = tableWrapperRef.current;
    if (!body || !track || !thumb || !wrapper) return;
    // position track relative to wrapper using bounding rects
    try {
      const bodyRect = body.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      let relTop = bodyRect.top - wrapperRect.top;
      relTop = Math.max(0, Math.min(relTop, Math.max(0, wrapperRect.height - body.clientHeight)));
      track.style.top = `${relTop}px`;
      track.style.height = `${body.clientHeight}px`;
    } catch {}
    const visible = body.clientHeight;
    const total = body.scrollHeight || 1;
    if (visible >= total || !Number.isFinite(visible) || !Number.isFinite(total)) {
      try { track.style.display = 'none'; } catch {}
      return;
    }
    try { track.style.display = 'block'; } catch {}
    const ratio = Math.max(0.03, Math.min(1, visible / total));
    const trackHeight = track.clientHeight;
    const thumbH = Math.max(16, Math.round(trackHeight * ratio));
    const scrollTop = body.scrollTop;
    const maxScroll = total - visible;
    const top = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * (trackHeight - thumbH)) : 0;
    setTableThumbHeight(thumbH);
    setTableThumbTop(top);
  }, []);

  useEffect(() => {
    const onResize = () => updateTableScrollbar();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateTableScrollbar]);

  useEffect(() => {
    updateTableScrollbar();
  }, [displayCategories.length, rows, selectedRowKey, updateTableScrollbar]);

  const handleTableBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    updateTableScrollbar();
  };

  // Thumb drag
  useEffect(() => {
    let dragging = false;
    let startY = 0;
    let startTop = 0;
    const thumb = tableThumbRef.current;
    const track = tableTrackRef.current;
    const body = tableBodyRef.current;
    if (!thumb || !track || !body) return;
    const onDown = (ev: any) => {
      try { if (ev.stopPropagation) ev.stopPropagation(); } catch {}
      dragging = true;
      startY = ev.clientY || (ev.touches && ev.touches[0] && ev.touches[0].clientY) || 0;
      startTop = tableThumbTop;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove as any, { passive: false });
      document.addEventListener('touchend', onUp as any);
      ev.preventDefault();
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragging) return;
      const dy = ev.clientY - startY;
      const trackH = track.clientHeight;
      const maxTop = trackH - tableThumbHeight;
      const newTop = Math.max(0, Math.min(maxTop, startTop + dy));
      const total = body.scrollHeight - body.clientHeight;
      const scrollPos = total > 0 ? Math.round((newTop / (trackH - tableThumbHeight)) * total) : 0;
      body.scrollTop = scrollPos;
      setTableThumbTop(newTop);
    };
    const onUp = () => {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove as any);
      document.removeEventListener('touchend', onUp as any);
      updateTableScrollbar();
    };
    try { thumb.addEventListener('pointerdown', onDown as any); } catch {}
    try { thumb.addEventListener('mousedown', onDown as any); } catch {}
    try { thumb.addEventListener('touchstart', onDown as any); } catch {}
    return () => {
      try { thumb.removeEventListener('mousedown', onDown as any); } catch {}
    };
  }, [tableThumbTop, tableThumbHeight]);

  useEffect(() => {
    const body = tableBodyRef.current;
    if (!body) return;
    const mo = new MutationObserver(() => updateTableScrollbar());
    mo.observe(body, { childList: true, subtree: true, attributes: true });
    return () => mo.disconnect();
  }, [tableBodyRef.current, updateTableScrollbar]);


  const handleRateChange = (key: string, rate: number) => {
    setLocalRates((prev) => ({ ...prev, [key]: rate }));
    onResourceTaxRateChange(key, rate);
  };

  // Tooltip state — rendered OUTSIDE .adv-window to escape overflow:hidden clipping in CoHTML
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
      <div className="adv-window-header">
        <div className="adv-window-title">Advanced Tax & Production Manager</div>
        <button
          className={`adv-learn-toggle${learningEnabled ? ' adv-learn-active' : ''}`}
          onClick={() => onToggleLearning(!learningEnabled)}
          title={learningEnabled ? 'Learning: ON — Click to disable' : 'Learning: OFF — Click to enable'}
        >
          Learning
        </button>
        <button
          className={`adv-autotax-toggle${autoTaxEnabled ? ' adv-autotax-toggle-active' : ''}`}
          onClick={() => onAutoTaxToggle(!autoTaxEnabled)}
          title={autoTaxEnabled ? 'Auto-Tax: ON — Click to disable' : 'Auto-Tax: OFF — Click to enable'}
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
        <button className="adv-collapse-btn" onClick={() => setCollapsed((v) => !v)}>{collapsed ? '+' : '−'}</button>
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
      </div>

      {/* Category filter tabs — resources view only */}
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
                  style={{ color: profitColor }}
                  title={`Average company profitability across ${profitCount} tracked resource(s):\n${posProfit} profitable, ${negProfit} losing money\n\nThis reflects real company profit data from ECS entities.`}
                >
                  {`\u00a0\u2248${overallAvg > 0 ? '+' : ''}${overallAvg.toFixed(0)}% profit`}
                </span>
              )}
              {autoTaxParsed.raiseCount > 0
                ? <span className="adv-autotax-status-raise" title={`${autoTaxParsed.raiseCount} resource(s) had their tax rate increased this cycle`}>{`\u25B2 ${autoTaxParsed.raiseCount}`}</span>
                : <span className="adv-autotax-status-raise adv-autotax-status-zero" title="No resources raised this cycle">{`\u25B2 0`}</span>}
              {autoTaxParsed.lowerCount > 0
                ? <span className="adv-autotax-status-lower" title={`${autoTaxParsed.lowerCount} resource(s) had their tax rate decreased this cycle`}>{`\u25BC ${autoTaxParsed.lowerCount}`}</span>
                : <span className="adv-autotax-status-lower adv-autotax-status-zero" title="No resources lowered this cycle">{`\u25BC 0`}</span>}
              {autoTaxParsed.holdCount > 0
                ? <span className="adv-autotax-status-hold" title={`${autoTaxParsed.holdCount} resource(s) unchanged \u2014 tax rate is already optimal`}>{`\u2192 ${autoTaxParsed.holdCount}`}</span>
                : <span className="adv-autotax-status-hold adv-autotax-status-zero" title="No resources at hold">{`\u2192 0`}</span>}
            </div>
          );
        }
      )())}

      {/* Businesses view */}
      {viewMode === 'businesses' && (
        <div className="adv-table-section">
          <CompanyBrowser companies={parseCompanies(companyBrowserData)} happinessData={companyHappinessData} isSignatureView={false} />
        </div>
      )}

      {/* Signature Buildings view (filtered subset of businesses) */}
      {viewMode === 'signature' && (
        <div className="adv-table-section">
          {(() => {
            const filtered = signatureCompanies;
            if (filtered.length === 0) {
              return (
                <div className="adv-empty" style={{ padding: '20rem', textAlign: 'center' }}>
                  No signature buildings unlocked.
                </div>
              );
            }
            return <CompanyBrowser companies={filtered} happinessData={companyHappinessData} isSignatureView={true} />;
          })()}
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
            useGameIcons={useGameIcons}
            onToggleLearning={(enabled) => trigger('taxProduction', 'setLearningEnabled', enabled)}
            onResetLearning={() => trigger('taxProduction', 'resetLearning')}
            onSetAggressiveness={(level) => trigger('taxProduction', 'setLearningAggressiveness', level)}
          />
        </div>
      )}

      {/* Resources view — Table structure */}
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

      <div className="adv-table-content-wrapper" ref={tableWrapperRef}>
        <div className="adv-table-content" ref={tableBodyRef} onScroll={handleTableBodyScroll}>
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
                  onToggle={() => {
                    // allow CSS transitions/layout to settle before recalculating
                    requestAnimationFrame(() => requestAnimationFrame(() => updateTableScrollbar()));
                  }}
                />
              );
            })}
          </div>
          <div ref={tableTrackRef} className="adv-scrollbar-track" aria-hidden>
            <div ref={tableThumbRef} className="adv-scrollbar-thumb" style={{ top: `${tableThumbTop}px`, height: `${tableThumbHeight}px` }} />
          </div>

          <div className="adv-table-lines">
            <div className="adv-table-lines-name" />
            <div className="adv-table-lines-rate" />
            <div className="adv-table-lines-production" />
            <div className="adv-table-lines-income" />
          </div>
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
      {/* Bottom resize handle — visual cue for users that window can be resized from bottom edge */}
      <div className="adv-resize-handle" title="Drag to resize vertically" />
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
    </>
  );
};

export default AdvancedTPMWindow;
