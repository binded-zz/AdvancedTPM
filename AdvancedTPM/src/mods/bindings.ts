// Bindings for the taxProduction mod group.
// Uses bindValue from cs2/api for bindings that ARE registered in C#.
// Uses stub() for bindings whose C# counterpart is not yet deployed — these
// never reach csUseValue so they cannot corrupt React's hook call order.
import { bindValue } from 'cs2/api';

const G = 'taxProduction';

/** Stub binding: returned immediately by apiSafe.useValue without calling any React hook. */
const stub = <T>(defaultValue: T) => ({ __stub: true, __defaultValue: defaultValue, value: defaultValue });

// ?? Bindings registered in C# with initial values ???????????????????????????
export const advancedVisible$ = bindValue<boolean>(G, 'advancedVisible');
export const selectedResourceCategory$ = bindValue<string>(G, 'selectedResourceCategory');
export const debugEnabled$ = bindValue<boolean>(G, 'debugEnabled');
export const debugPanelVisible$ = bindValue<boolean>(G, 'debugPanelVisible');
export const showTips$ = bindValue<boolean>(G, 'showTips');
export const debugLastAction$ = bindValue<string>(G, 'debugLastAction');
export const advancedWindowX$ = bindValue<number>(G, 'advancedWindowX');
export const advancedWindowY$ = bindValue<number>(G, 'advancedWindowY');
export const advancedWindowWidth$ = bindValue<number>(G, 'advancedWindowWidth');
export const advancedWindowHeight$ = bindValue<number>(G, 'advancedWindowHeight');
export const showTopLeftButton$ = bindValue<boolean>(G, 'showTopLeftButton');
export const resourceRowsData$ = bindValue<string>(G, 'resourceRowsData');
export const autoTaxEnabled$ = bindValue<boolean>(G, 'autoTaxEnabled');
export const autoTaxStatus$ = bindValue<string>(G, 'autoTaxStatus');
export const autoTaxSettings$ = bindValue<string>(G, 'autoTaxSettings');
export const companyBrowserData$ = bindValue<string>(G, 'companyBrowserData');
export const companyHappinessData$ = bindValue<string>(G, 'companyHappinessData');
export const signaturePrefabs$ = bindValue<string>(G, 'signaturePrefabs');
export const signatureCompanies$ = bindValue<string>(G, 'signatureCompanies');
export const signatureCacheStatus$ = bindValue<string>(G, 'signatureCacheStatus');
export const learningEnabled$ = bindValue<boolean>(G, 'learningEnabled');
export const advisorData$ = bindValue<string>(G, 'advisorData');
export const decisionLogData$ = bindValue<string>(G, 'decisionLogData');
export const learningStats$ = bindValue<string>(G, 'learningStats');
export const residentialBrowserData$ = bindValue<string>(G, 'residentialBrowserData');
export const residentialBuildingsData$ = bindValue<string>(G, 'residentialBuildingsData');
export const residentialSignatureBuildingsData$ = bindValue<string>(G, 'residentialSignatureBuildingsData');
export const servicesBrowserData$ = bindValue<string>(G, 'servicesBrowserData');
export const servicesBuildingsData$ = bindValue<string>(G, 'servicesBuildingsData');
export const districtBrowserData$ = bindValue<string>(G, 'districtBrowserData');
export const districtPoliciesData$ = bindValue<string>(G, 'districtPoliciesData');

// Game-namespace bindings (read-only, provided by the game itself)
export interface GameFactor { factor: string; weight: number; }
/** City-wide happiness factors — the same data the game shows on the Demographics right panel */
// Stabilized as a stub to avoid crashes when game-side binding is unavailable/late.
export const gameHappinessFactors$ = stub<GameFactor[]>([]);

// ?? Stub bindings: C# counterparts exist in source but not yet deployed ??????
// Switch these to bindValue once the updated DLL is deployed to the Mods folder.
export const companySummaries$ = stub('');
export const companyDetail$ = stub('');
export const companyPerf$ = stub('');
export const overviewTwoColumn$ = stub(false);
export const signatureInfo$ = stub('');
export const educationBrowserData$ = stub('');
export const administrationBrowserData$ = stub('');
export const debugFileContents$ = stub('');
export const debugWindowX$ = stub(0);
export const debugWindowY$ = stub(0);
export const debugWindowWidth$ = stub(320);
export const debugWindowHeight$ = stub(380);

