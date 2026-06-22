# Changelog

All notable changes to this project will be documented in this file.

## [1.1.5] - 2026-06-22

### Added
- **Service Buildings**: Added detailed metrics to service buildings in the Services tab, including electricity/water consumption, garbage/mail, condition, and localized effects.
- **District Dashboard**: Added extra data to the District dashboard card views, including crime, upkeep, resource cost, fees, area, and unemployment.

### Changed
- **Backend Refactor**: Refactored backend JSON code to utilize native built-in game systems (Newtonsoft.Json serialization).
- **Game Compatibility**: Compatibility update for Cities: Skylines II game version 1.6.0.
- **Performance & Refactor**: Refactored UI and Systems architectures for improved stability and performance.

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
