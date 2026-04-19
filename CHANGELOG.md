# Changelog

## v1.0.0 — Initial Release

### Tax & Production Dashboard
- Per-resource tax sliders for 50+ resources (raw materials, industrial, immaterial, commercial, entertainment)
- Real-time production, consumption, surplus, and deficit bars with tooltips
- Category grouping by supply chain (Agriculture, Forestry, Mining, Oil, Office, Entertainment, Commercial)
- Per-resource and total tax income with in-game currency formatting (₵)
- Demand and workforce metrics per resource
- Movable and resizable Advanced UI window with automatic position persistence

### Company Browser
- Sortable and filterable company table (zone, profitability tier, profit range, text search)
- Expandable detail panels with brand name, building address, building level pips, zone, output/input resources
- Efficiency factor analysis with CS2 in-game icons (Electricity, Water, Garbage, Mail, Telecom, etc.)
- Staffing bars and efficiency breakdown with color-coded health indicators
- Go-to-building camera jump for any company

### Auto-Tax Engine
- 6-factor scoring: profitability, happiness, production, demand, company count, tax income
- Per-resource min/max tax rate ranges
- Resource exclusion from auto-adjustment
- Configurable adjustment speed (1–5)

### Adaptive Learning Advisor
- Per-resource learned sensitivity profiles (sensitivity, income response, company response, production, revenue efficiency, volatility)
- Before/after snapshot comparison for outcome evaluation
- Confidence-weighted recommendations with decision logging
- Persistent learning database saved between sessions

## v1.1.0 — UI & integration updates

### UI: Company Browser
- Added compact `Happiness` column to the company rows with colorized scoring (green/blue/orange/red) to quickly surface business health.
- Expanded company detail panel continues to show the full happiness score and breakdown.
- Hovering the happiness value shows a tooltip with the numeric estimate.

### Signature Buildings
- Added server-side detection and client reporting for "signature" buildings (special landmark/prefab types). Signature flag is now exposed in the Company Browser payload and displayed in expanded company details.

### Misc
- Merge of `feature/company-happiness-planb` into `main` (UI, learning persistence, and company browser improvements).
- Robust loading for the adaptive learning database: loader now detects gzipped payloads and decompresses automatically to avoid JSON parse errors.

### Notes
- These changes are primarily UI additions and do not change the core auto-tax decision algorithms. See commit history for implementation details.

### Settings & Integration
- Game options page with General, Auto-Tax, Advisor, Debug, and About groups
- English localization with full settings string coverage
- Debug logging toggle and debug panel
- Toolbar button with ATPM icon

## v1.2.0 — Logging, Signature & Debug

**Released:** Published to Paradox Mods (PDX) and GitHub — 2026-04-19

### Added
- `PrefixedLogger` utility for per-system logging with Unity fallback.
- `signatureCompanies` binding published from C# (authoritative ECS entity keys for signature buildings) as JSON.
- `signatureCacheStatus` binding with timestamp and signature prefab count for debugging.
- Debug UI: signature prefab list, signature company keys, and cache status visible in Debug Panel; button to force-refresh signature cache.

### Changed
- CompanyBrowserSystem now publishes authoritative signature data and uses `PrefixedLogger` for diagnostics.
- UI no longer uses client-side heuristics to identify signature buildings; it relies on authoritative bindings.

### Notes
- Integrated from `feature/logging-signature-debug`. Build and in-game test required for runtime validation.
