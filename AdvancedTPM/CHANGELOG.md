# Changelog

All notable changes to this project will be documented in this file.

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
