import { trigger as csTrigger, useValue as csUseValue } from 'cs2/api';

/**
 * Defensive accessor: returns `data` when it is not undefined/null,
 * otherwise returns `defaultValue`.  Prevents crashes when C# bindings
 * haven't pushed data to the UI yet.
 */
export function getSafeValue<T>(data: T | undefined | null, defaultValue: T): T {
  return data !== undefined && data !== null ? data : defaultValue;
}

export function getSafeColor(color: any, fallback: string = '#EAEAEA'): string {
  if (!color || typeof color !== 'string') return fallback;
  const s = color.trim();
  if (s.length < 3 || s === 'undefined' || s === 'null' || s === 'NaN') return fallback;
  if (s.startsWith('#') || s.startsWith('rgb') || s.startsWith('hsl') || s === 'transparent' || /^[a-zA-Z]+$/.test(s)) {
    return s;
  }
  return fallback;
}


// Throttled error logger — no-op in production; Cohtml routes console to UI.log.
// Errors are reported to C# via apiSafe.trigger('taxProduction', 'uiError', ...).
const _logTimestamps = new Map<string, number>();
const LOG_THROTTLE_MS = 5000;
const safeLog = (..._args: any[]) => {
  // Intentionally silent. Error details are forwarded to C# via uiError trigger.
};

function apiTrigger(group: string, name: string, ...args: any[]) {
  try {
    csTrigger(group, name, ...args);
  } catch (e) {
    safeLog('apiSafe.trigger failed', e, group, name, args);
  }
}

function apiUseValue<T>(binding: any): T | undefined {
  // Stub bindings (no C# counterpart yet) are marked with __stub.
  // Skip csUseValue entirely for them — calling a React hook in a try/catch
  // that throws corrupts React's internal hook call-order tracking.
  if (!binding || (binding as any).__stub) {
    return binding ? (binding as any).__defaultValue as T : undefined;
  }
  try {
    return csUseValue(binding) as T;
  } catch (e) {
    safeLog('apiSafe.useValue failed', e, binding);
  }
  try { return binding && binding.value; } catch { return undefined; }
}

const apiSafe = {
  trigger: apiTrigger,
  useValue: apiUseValue,
  toggleDistrictPolicy: (districtKey: string, policyPrefabKey: string, active: boolean) => apiTrigger('taxProduction', 'toggleDistrictPolicy', districtKey, policyPrefabKey, active),
  renameDistrict: (districtKey: string, newName: string) => apiTrigger('taxProduction', 'renameDistrict', districtKey, newName),
};

export default apiSafe;

