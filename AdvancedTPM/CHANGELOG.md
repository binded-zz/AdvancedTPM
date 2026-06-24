# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-06-24

### Added
- **"★ Sig Only" Filters**: Added a filter toggle button to both Businesses (`CompanyBrowser`) and Services (`ServicesPanel`) to view signature buildings only, matching the Residential panel's functionality.
- **Centralized Asset/Icon Library**: Abstracted all raw asset pathways, theme names, DLC filters, and efficiency factor labels/paths into a master library `iconLibrary.ts` (`src/UI/data/iconLibrary.ts`) to improve code cleanliness and reduce duplicate path strings.
- **Universal Custom Sort Hook**: Added `useTableSort` hook (`src/UI/hooks/useTableSort.ts`) to centralize table sorting and paginated header indicator logic, standardizing sorting behavior and eliminating hundreds of lines of duplicate UI state code.

### Fixed
- **Base Game Icon Resolution**: Fixed the missing Paradox Star base game icon path by resolving it cleanly with the Cohtml-safe prefix `coui://ui-game/Media/Menu/ParadoxLogoNoText.svg`.
- **OCC% Layout Fix**: Prevented wrapping issues in the occupancy percentage column header and cell contents on the Residential panel.

### Changed
- **Modern JSON Serialization Migration**: Overhauled the C# backend systems and TSX frontend bindings to communicate using standard Newtonsoft.Json string serialization and native `JSON.parse()`. This replaces old manual string interpolation methods and solves type-casting issues for boolean values (such as `isSignature`).

## [1.1.5] - 2026-06-23

### Added
- **AI Auto-Tax Failsafe (The Bailout System):** Added a robust intervention mechanism. If an industry gets trapped at extreme tax rates with poor outcomes, the AI will actively intervene, nudge the rate toward a safe baseline, and push a notification to the Advisor feed.
- **Service Buildings Metrics:** The Services tab now displays deep, real-time metrics including electricity/water consumption, garbage/mail accumulation, and active vehicle/occupancy ratios.
- **District Dashboard Expansion:** Added extensive data to the District dashboard card views, including crime risk, building condition/wear, and district-level unemployment.
- **Tooltip Portaling:** Ported the tooltip renderer to a React Portal, allowing tooltips to render globally over the window boundary instead of being clipped by the main panel.
- **PolicyPlus Compatibility:** Added support for expanded city policies and integrated compatibility with the `PolicyPlus` mod. Includes dynamic conflict detection matching PolicyPlus conflict arrays, visual disabled states, and warning tooltips without font rendering bugs.

### Changed
- **Burst-Compiled Backend:** Overhauled the AutoTax profitability and EMA math. Heavy calculations now execute in microseconds via Unity `[BurstCompile]` jobs, drastically reducing main-thread CPU overhead.
- **Accurate Resource Storage:** The "Resource Storage" stat in the Company Browser has been completely rewritten. It now accurately filters out cash/immaterial goods, correctly converts raw game units to metric tonnes (t), and gracefully hides itself for non-physical companies.
- **Native UI Scaling:** Replaced all hardcoded pixel sizes with Cohtml-native `rem` units, ensuring the UI scales perfectly on 4K monitors and respects the user's in-game UI scaling settings.
- **Game Compatibility:** Compatibility update for Cities: Skylines II version 1.6.

### Fixed
- Fixed an issue where percentage signs (`%`) would word-wrap to new lines in narrow table columns.
- Fixed an issue where deep subsidies (negative tax rates) caused mathematical errors in the rate drag calculations.
- Silenced empty `catch` blocks across the C# backend to prevent native game log spam.

## [1.1.4] - 2026-06-24

### Added
- **Residential Browser**: Full overhaul with native custom content tracking. Automatically detects and tracks Base Game buildings, DLC region packs, themed content, and Paradox Mods custom creator packs. No mod update needed for future content.
- **Native Icon Integration**: Theme and pack filters pull icons directly from the game's internal image system. Pack icons display exactly as they appear in the game menus.
- **Pack Placement Dashboard**: Summary table counting how many residential buildings from each installed content pack are on the map, broken down by density tier (Low, Medium, High).
- **Dual Go Actions**: Each building row has two camera actions — jump to the building on the map, or focus it in the game's native info panel.
- **Signature Buildings Tab**: Dedicated unified tab showing all signature buildings across commercial, residential, and service categories in one view with a live badge count.
- **Prefab Caching System**: Concurrent caching for asset pack lookups. Pack dependencies are calculated once and reused instantly, eliminating main-thread CPU spikes during UI generation.
- **Profitability Weight Slider**: Added to the Auto-Tax settings panel for finer control over the 6-factor scoring formula.
- **CustomSelect Component**: New reusable dropdown component replacing native selects panel-wide to fix viewport clipping in the Cohtml engine.

### Fixed
- Fixed Signature tab icon rendering. Full DLC building whitelist is now complete.
- Fixed UI clipping in panel dropdowns caused by the game viewport cutting off native `<select>` elements.
- Fixed window dragging release issues that occasionally left the window stuck in drag state.
- Fixed Districts expanded panel overflowing outside the mod window bounds.
- Fixed Demographics card in Districts — Residents/Students/Tourists/Homeless rows were clipped directly under the age group bar.
- Removed fake `assetPackIcon` fallback stubs that produced blank icons for user-created mods.
- Resolved C# compilation errors in school, hospital, and garbage data extraction systems.
- Eliminated spammy heartbeat log calls that were triggering `NullReferenceException` soft-crashes.
- Replaced plain-text pack names in the Residential summary table header with proper `PackIcon` icon components.

### Changed
- Smart name normalization: PascalCase internal asset names (e.g. "BridgesAndPorts") are automatically split into readable text and redundant file tags like "Pack" or "Filter" are stripped.
- Improved locale description strings for Auto-Tax settings.
- Fixed count label spacing in the Auto-Tax enabled resource counter.

## [1.1.3] - 2026-06-13

### Added
- **Residential Browser**: A new Residential Panel tracking all residential zones in the city.
  - Sortable and filterable table by address, density, level, occupied/capacity, theme, and custom asset packs.
  - Residential building details panel exposing underlying building data, households, and demographics.
  - Integration with custom assets: automatically detects and groups buildings by their custom creator packs.
  - Dynamic "All Packs" table header summarizing residential building counts per installed content pack.
- **District Level Metrics**: Exposed district-level demographics, household information, and localized stats within the browser.

### Fixed
- Fixed Base Game icon not displaying properly for vanilla assets, now correctly replaced with the Paradox Star icon.
- Improved custom asset theme normalization to preserve the author's specified theme name instead of coercing unrecognized themes.
- Improved custom asset pack name condensation for consistent formatting across all custom packs.
- Performance: Memory footprint for building data parsing significantly reduced with zero-allocation buffers.
