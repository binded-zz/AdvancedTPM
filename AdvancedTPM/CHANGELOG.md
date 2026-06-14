# Changelog

All notable changes to this project will be documented in this file.

## [1.1.4] - 2026-06-24

### Added
- **Signature Tab Icon Rendering**: Fixed Signature tab icon rendering and completed the full DLC building whitelist. All known DLC signature buildings are now correctly identified and flagged.
- **ThemeIcon Support in Dropdowns**: Theme icons are now rendered correctly inside the Residential filter dropdowns.
- **Custom Select Component**: A new reusable `CustomSelect` component replaces native dropdowns across panels, fixing clipping issues inside the constrained game UI viewport.

### Fixed
- Removed fake `assetPackIcon` fallback stubs that were producing blank icons for user-created mods. Icon slots now correctly show nothing when no icon is available.
- Fixed UI clipping in panel dropdowns caused by the game viewport cutting off native `<select>` elements.
- Resolved C# compilation errors in school, hospital, and garbage data extraction systems.
- Eliminated spammy update loops and heartbeat log calls that were triggering `NullReferenceException` soft-crashes in the custom logger.
- Replaced mushed plain-text pack names in the Residential summary table header with proper `PackIcon` icon components.
- Fixed window dragging release issues that occasionally left the window in a "stuck" drag state.

### Changed
- Added profitability weight slider to the Auto-Tax settings panel for finer control over the 6-factor scoring.
- Improved locale description strings for Auto-Tax settings.
- Fixed count label spacing in the Auto-Tax enabled resource counter.

## [1.1.3] - 2026-06-13

### Added
- **Residential Browser**: A completely new Residential Panel that tracks all residential zones in the city.
  - Sortable and filterable table by address, density, level, occupied/capacity, theme, and custom asset packs.
  - Residential building details panel exposing underlying building data, households, and demographics.
  - Integration with custom assets: automatically detects and groups buildings by their custom creator packs.
  - Dynamic "All Packs" table header summarizing the counts of residential buildings per installed content pack.
- **District Level Metrics**: Exposed and surfaced district-level demographics, household information, and localized stats within the browser.

### Fixed
- Fixed an issue where the Base Game icon was not displaying properly for vanilla assets, correctly replacing it with the standard Paradox Star icon.
- Improved custom asset theme normalization to preserve the author's specified theme name (e.g., "Mixed", "Asian", "Modern") instead of coercing unrecognized themes to "USA".
- Improved custom asset pack name condensation to apply consistent formatting across all custom packs, including the removal of the NL Pack Filter exemptions.
- Performance optimization: Memory footprint for building data parsing was significantly reduced utilizing zero-allocation buffers.
