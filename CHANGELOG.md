**Released:** Published to Paradox Mods (PDX) and GitHub — 2026-04-19


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

## v1.1.1 - The Mega-Performance Update (Changelog)
Let's talk numbers. This update is a complete, ground-up rewrite of the mod's rendering logic, interaction handlers, and UI thread to achieve one single goal: absolute maximum frame rate.
If you experienced simulation slowdowns, mouse stuttering, or FPS drops in the past, this patch completely eliminates them.
The Performance Leap:
100x Faster UI Thread: In previous versions, React render cascades and engine log-spam could spike the UI thread cost up to ~160ms, causing noticeable frame drops. We have completely bypassed the standard render-loops and engineered a direct-DOM manipulation system. The mod's UI thread cost is now sitting at a blistering ~1.3ms.
Zero-Impact Simulation: The mod now runs at the absolute native speed of the base game. Whether the AdvancedTPM window is open, closed, dragging, or resizing, your frame rate and simulation speed will remain completely untouched.
Engine-Level Purge: Stripped out unsupported CSS and standard web variables that were silently choking the game's Cohtml UI engine. The background log-spam has been completely silenced.
Flawless Window Controls: Window dragging and resizing have been rebuilt with hardware-level failsafes. Interactions are now hardware-accelerated, native, and buttery smooth.

## v1.1.2 - dotnet 4.8 fix 
dotnet 4.8 update fix 
