import { useValue, trigger } from "cs2/api";
import React, { useState } from "react";
import apiSafe, { getSafeValue } from "./apiSafe";
import AdvancedTPMWindow from "../UI/components/AdvancedTPMWindow";
import ErrorBoundary from "../UI/components/ErrorBoundary";
import DebugPanel from "../UI/components/DebugPanel";
import TPMWindowShell from "../UI/components/TPMWindowShell";
import { districtBrowserData$, districtPoliciesData$, advancedVisible$, selectedResourceCategory$, debugEnabled$, debugPanelVisible$, showTips$, debugLastAction$, advancedWindowX$, advancedWindowY$, advancedWindowWidth$, advancedWindowHeight$, resourceRowsData$, autoTaxEnabled$, autoTaxStatus$, autoTaxSettings$, companyBrowserData$, companyHappinessData$, companySummaries$, companyDetail$, companyPerf$, overviewTwoColumn$, signaturePrefabs$, signatureCompanies$, signatureCacheStatus$, signatureInfo$, learningEnabled$, advisorData$, decisionLogData$, learningStats$, residentialBrowserData$, residentialBuildingsData$, residentialSignatureBuildingsData$, educationBrowserData$, administrationBrowserData$, servicesBrowserData$, servicesBuildingsData$, debugFileContents$, debugWindowX$, debugWindowY$, debugWindowWidth$, debugWindowHeight$ } from "./bindings";

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

const parseRows = (payload: string): ResourceRowVm[] => {
    if (!payload) return [];
    return payload
        .split(';')
        .map((chunk) => {
            const parts = chunk.split('|');
            const [key, label, stage, production, consumption, taxRate, surplus, deficit, taxIncome, incomeSource, resourceIndex, isService, companyCount, maxWorkers, currentWorkers, demand] = parts;
            if (!key || !label || !stage || production === undefined || taxRate === undefined) return null;
            return {
                key,
                label,
                stage,
                resourceIndex: resourceIndex !== undefined ? Number(resourceIndex) : undefined,
                production: Number(production) || 0,
                consumption: Number(consumption) || 0,
                taxRate: Number(taxRate) || 0,
                surplus: Number(surplus) || 0,
                deficit: Number(deficit) || 0,
                taxIncome: Number(taxIncome) || 0,
                incomeSource: incomeSource || undefined,
                isService: isService === '1',
                companyCount: companyCount !== undefined ? Number(companyCount) : 0,
                maxWorkers: maxWorkers !== undefined ? Number(maxWorkers) : 0,
                currentWorkers: currentWorkers !== undefined ? Number(currentWorkers) : 0,
                demand: demand !== undefined ? Number(demand) : 0,
            } as ResourceRowVm;
        })
        .filter((x): x is ResourceRowVm => x !== null);
};

const TaxWindowContent: React.FC<{
    advancedVisible: boolean;
    debugPanelVisible: boolean;
}> = ({ advancedVisible, debugPanelVisible }) => {
    const [advancedCollapsed, setAdvancedCollapsed] = useState(false);
    const [showModDebug, setShowModDebug] = useState(false);
    const selectedCategory = getSafeValue(apiSafe.useValue<string>(selectedResourceCategory$), 'All');
    const debugEnabled = getSafeValue(apiSafe.useValue<boolean>(debugEnabled$), false);
    const showTips = getSafeValue(apiSafe.useValue<boolean>(showTips$), true);
    const debugLastAction = getSafeValue(apiSafe.useValue<string>(debugLastAction$), 'init');
    const advancedX = getSafeValue(apiSafe.useValue<number>(advancedWindowX$), 140);
    const advancedY = getSafeValue(apiSafe.useValue<number>(advancedWindowY$), 150);
    const advancedWidth = getSafeValue(apiSafe.useValue<number>(advancedWindowWidth$), 520);
    const advancedHeight = getSafeValue(apiSafe.useValue<number>(advancedWindowHeight$), 420);
    const rows = parseRows(getSafeValue(apiSafe.useValue<string>(resourceRowsData$), ''));
    const autoTaxEnabled = getSafeValue(apiSafe.useValue<boolean>(autoTaxEnabled$), false);
    const autoTaxStatus = getSafeValue(apiSafe.useValue<string>(autoTaxStatus$), '');
    const autoTaxSettings = getSafeValue(apiSafe.useValue<string>(autoTaxSettings$), '5|0|25|50|2|');
    const companyBrowserData = getSafeValue(apiSafe.useValue<string>(companyBrowserData$), '');
    const companyHappinessData = getSafeValue(apiSafe.useValue<string>(companyHappinessData$), '');
    const learningEnabled = getSafeValue(apiSafe.useValue<boolean>(learningEnabled$), false);
    const companySummaries = getSafeValue(apiSafe.useValue<string>(companySummaries$), '');
    const companyDetail = getSafeValue(apiSafe.useValue<string>(companyDetail$), '');
    const companyPerf = getSafeValue(apiSafe.useValue<string>(companyPerf$), '');
    const overviewTwoColumn = getSafeValue(apiSafe.useValue<boolean>(overviewTwoColumn$), false);
    const signaturePrefabs = getSafeValue(apiSafe.useValue<string>(signaturePrefabs$), '');
    const signatureCompaniesJson = getSafeValue(apiSafe.useValue<string>(signatureCompanies$), '');
    const signatureCacheStatus = getSafeValue(apiSafe.useValue<string>(signatureCacheStatus$), '');
    const signatureInfo = getSafeValue(apiSafe.useValue<string>(signatureInfo$), '');
    const advisorData = getSafeValue(apiSafe.useValue<string>(advisorData$), '');
    const decisionLogData = getSafeValue(apiSafe.useValue<string>(decisionLogData$), '');
    const learningStatsData = getSafeValue(apiSafe.useValue<string>(learningStats$), '');
    const residentialBrowserData = getSafeValue(apiSafe.useValue<string>(residentialBrowserData$), '');
    const residentialBuildingsData = getSafeValue(apiSafe.useValue<string>(residentialBuildingsData$), '');
    const residentialSignatureBuildingsData = getSafeValue(apiSafe.useValue<string>(residentialSignatureBuildingsData$), '');
    const administrationBrowserData = getSafeValue(apiSafe.useValue<string>(administrationBrowserData$), '');
    const servicesBrowserData = getSafeValue(apiSafe.useValue<string>(servicesBrowserData$), '');
    const servicesBuildingsData = getSafeValue(apiSafe.useValue<string>(servicesBuildingsData$), '');
    const districtBrowserData = getSafeValue(apiSafe.useValue<string>(districtBrowserData$), '[]');
    const districtPoliciesData = getSafeValue(apiSafe.useValue<string>(districtPoliciesData$), '[]');
    const debugFileContents = getSafeValue(apiSafe.useValue<string>(debugFileContents$), '');
    const debugWindowX = getSafeValue(apiSafe.useValue<number>(debugWindowX$), 0);
    const debugWindowY = getSafeValue(apiSafe.useValue<number>(debugWindowY$), 110);
    const debugWindowWidth = getSafeValue(apiSafe.useValue<number>(debugWindowWidth$), 320);
    const debugWindowHeight = getSafeValue(apiSafe.useValue<number>(debugWindowHeight$), 380);

    // Debug dump removed: console output routes to UI.log in Cohtml and spams 60x/sec.

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 99999 }}>
            {advancedVisible && (
                <div>
                    <TPMWindowShell
                        x={advancedX}
                        y={advancedY}
                        width={advancedWidth}
                        height={advancedHeight}
                        collapsed={advancedCollapsed}
                        collapsedHeight={74}
                        onSaveRect={(x, y, w, h) => apiSafe.trigger('taxProduction', 'setAdvancedWindowRect', `${x},${y},${w},${h}`)}
                    >
                        <ErrorBoundary name="AdvancedTPMWindow">
                        <AdvancedTPMWindow
                            selectedCategory={selectedCategory}
                            rows={rows}
                            showTips={showTips}
                            autoTaxEnabled={autoTaxEnabled}
                            autoTaxStatus={autoTaxStatus}
                            autoTaxSettings={autoTaxSettings}
                            companyBrowserData={companyBrowserData}
                            companySummaries={companySummaries}
                            companyDetail={companyDetail}
                            companyPerf={companyPerf}
                            overviewTwoColumn={overviewTwoColumn}
                            companyHappinessData={companyHappinessData}
                            signaturePrefabs={signaturePrefabs}
                            signatureCompaniesJson={signatureCompaniesJson}
                            signatureCacheStatus={signatureCacheStatus}
                            residentialBrowserData={residentialBrowserData}
                            residentialBuildingsData={residentialBuildingsData}
                            residentialSignatureBuildingsData={residentialSignatureBuildingsData}
                            administrationBrowserData={administrationBrowserData}
                            servicesBrowserData={servicesBrowserData}
                            servicesBuildingsData={servicesBuildingsData}
                            districtBrowserData={districtBrowserData}
                            districtPoliciesData={districtPoliciesData}
                            signatureInfo={signatureInfo}
                            advisorData={advisorData}
                            decisionLogData={decisionLogData}
                            learningStatsData={learningStatsData}
                            learningEnabled={learningEnabled}
                            onToggleLearning={(enabled: boolean) => apiSafe.trigger('taxProduction', 'setLearningEnabled', enabled)}
                            onAutoTaxToggle={(enabled: boolean) => apiSafe.trigger('taxProduction', 'setAutoTaxEnabled', enabled)}
                            onResourceTaxRateChange={(key: string, rate: number) => apiSafe.trigger('taxProduction', 'setResourceTaxRate', `${key}:${rate}`)}
                            onCategoryChange={(category: string) => apiSafe.trigger('taxProduction', 'setResourceCategory', category)}
                            onCollapseChange={setAdvancedCollapsed}
                            onRefreshCompanyBrowserData={() => apiSafe.trigger('taxProduction', 'refreshCompanyBrowserData', '1')}
                            onRefreshSignatureCache={() => apiSafe.trigger('taxProduction', 'refreshSignatureCache', '1')}
                            onToggleDebugPanel={() => apiSafe.trigger('taxProduction', 'toggleDebugPanel')}
                            showModDebug={showModDebug}
                            onToggleModDebug={() => setShowModDebug(!showModDebug)}
                            onClose={() => apiSafe.trigger('taxProduction', 'toggleAdvancedWindow')}
                        />
                        </ErrorBoundary>
                    </TPMWindowShell>
                </div>
            )}
            {debugPanelVisible && (
                <div>
                <ErrorBoundary name="DebugPanel">
                <DebugPanel
                        debugEnabled={debugEnabled}
                        debugFileContents={debugFileContents}
                        lastAction={debugLastAction}
                        onToggleDebug={(enabled: boolean) => apiSafe.trigger('taxProduction', 'setDebugEnabled', enabled)}
                        onToggleTips={(enabled: boolean) => apiSafe.trigger('taxProduction', 'setShowTips', enabled)}
                        showTips={showTips}
                        onTogglePanel={() => apiSafe.trigger('taxProduction', 'toggleDebugPanel')}
                        signaturePrefabs={signaturePrefabs}
                        signatureCompanies={signatureCompaniesJson}
                        signatureCacheStatus={signatureCacheStatus}
                        residentialData={residentialBrowserData}
                        servicesData={servicesBrowserData}
                        debugX={debugWindowX}
                        debugY={debugWindowY}
                        debugW={debugWindowWidth}
                        debugH={debugWindowHeight}
                    />
                </ErrorBoundary>
                </div>
            )}
        </div>
    );
};

const TaxWindow: React.FC = () => {
    const advancedVisible = getSafeValue(apiSafe.useValue<boolean>(advancedVisible$), false);
    const debugPanelVisible = getSafeValue(apiSafe.useValue<boolean>(debugPanelVisible$), false);

    if (!advancedVisible && !debugPanelVisible) return null;

    return (
        <TaxWindowContent
            advancedVisible={advancedVisible}
            debugPanelVisible={debugPanelVisible}
        />
    );
};

export default TaxWindow;



