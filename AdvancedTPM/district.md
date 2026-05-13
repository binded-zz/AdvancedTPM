# Districts Dashboard Mod - Technical Overview

## Summary of Changes
We have completely overhauled the Districts Panel to transform it from a simple table into a high-performance, interactive dashboard.

### 1. UI/UX Overhaul
- **Dashboard Cards**: Replaced the static table view with dynamic, reorderable "Dashboard Cards" for key metrics (Households, Demographics, Worker Stats, School Data, etc.).
- **Grid Layout**: Implemented a flexible grid layout with persistence. Users can reorder cards using the arrow buttons or move them to the absolute TOP/BOTTOM.
- **Mod-Consistent Styling**: Integrated a settings gear icon that matches the main mod settings button (`adv-settings-btn`), providing global toggles for Compact Mode and Raw Data view.
- **Clean Interface**: Removed redundant navigation tabs and debug buttons to focus on district-specific data.

### 2. Backend Data Pipeline (`DistrictBrowserSystem.cs`)
- **Authoritative Data**: Integrated `CountHouseholdDataSystem` to provide high-accuracy city-wide statistics for population, tourists, and students.
- **Job-Based Processing**: Used ECS Jobs (`UpdateDistrictDataJob`, `UpdateCitizenStatsJob`, `UpdateHouseholdStatsJob`) to aggregate data across thousands of entities with minimal performance impact.
- **Wealth & Rent Logic**: Implemented calculations for total wealth, average income, and average rent per district using `EconomyUtils`.
- **School Metrics**: Added detailed school capacity and enrollment tracking for all education levels (Elementary, High School, College, University).

### 3. Frontend Architecture (`DistrictsPanel.tsx`)
- **Persistent State**: Card visibility and ordering are stored in `localStorage` (`advtpm_district_layout`).
- **Dynamic Icons**: Dashboard header icons use Game UI SVG assets (scaled to 28rem) for a premium look.
- **SVG Path Optimization**: Replaced generic image tags with inline SVG paths for high-frequency interactive elements like the settings gear.

## Future Work: Happiness Factors
The next phase involves refining the **Happiness Factors** card.
- **Current State**: We have a basic list of happiness factors pulled from `DistrictHappinessAggregationSystem`.
- **Goal**: Clean up the labeling and visualization of these factors to match the rest of the premium dashboard design.
- **Task**: Identify all possible happiness factor IDs and map them to human-readable labels in the `HAPPINESS_FACTORS` constant.

## Troubleshooting & Maintenance
- **Data Refresh**: Data is sent from C# to React every 0.5 seconds via `ValueBinding`.
- **Layout Reset**: If the dashboard layout becomes corrupted, use the "RESET TO DEFAULT" button in the Layout Settings menu to clear `localStorage`.
- **Component Entry**: The main entry point is `DistrictsPanel.tsx`. The individual cards are rendered inside the `renderDashboard()` method using a switch-case on `card.id`.

---
*Created on 2026-05-13*
