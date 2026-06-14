# AdvancedTPM — Advanced Tax and Production Manager

A comprehensive Cities: Skylines 2 mod for per-resource tax control, production monitoring, company analysis, and AI-powered tax optimization.

![Version](https://img.shields.io/badge/version-1.1.4-blue)
![CS2](https://img.shields.io/badge/Cities%3A%20Skylines%202-compatible-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Features

### Tax & Production Dashboard
- **Per-resource tax sliders** — set tax rates individually for 50+ resources across raw materials, industrial goods, immaterial services, commercial retail, and entertainment.
- **Production & consumption bars** — real-time metrics with surplus/deficit indicators.
- **Category grouping** — resources organized by supply chain (Agriculture, Forestry, Mining, Oil, Office, Entertainment, Commercial).
- **Tax income tracking** — per-resource and total income with in-game currency formatting.
- **Demand & worker metrics** — workforce stats and demand signals per resource.

### Residential Browser
- **Full content support — no updates needed** — automatically supports Base Game buildings, all DLC region packs, themed content, and any custom creator content. New packs added to the game in future updates will appear in the UI automatically.
- **Native icon integration** — theme and pack filters pull their icons directly from the game's internal ImageSystem. If a DLC or creator pack has a native icon it is displayed exactly as it appears in the game's own menus.
- **Pack placement counts** — the top summary table shows exactly how many residential buildings of each installed content pack are currently placed on your map, broken down by density tier (Low, Medium, High).
- **Theme & region filter** — filter by theme or regional style. Each option shows the content pack's own icon in the dropdown.
- **Advanced filtering & sorting** — sort and filter by address, density, level, households, occupancy, happiness range, signature status, theme, or asset pack.
- **Dual Go buttons** — each row has two camera actions: jump to the building on the map, or select and focus it in the game's own info panel.
- **Paginated rendering** — 50 buildings per page for fast load and smooth scrolling regardless of city size.
- **Auto-pause on expand** — expanding a row pauses live data updates so the detail view stays stable while you read it. Updates resume when collapsed.
- **Intelligent asset resolution** — uses a multi-tier extraction system checking asset pack data, zone types, native DLC requirements, and Paradox Mods metadata so no custom building slips through the cracks.
- **Smart name normalization** — messy backend filenames are cleaned up automatically. PascalCase names like "BridgesAndPorts" become "Bridges And Ports" and internal tags like "Pack" or "Filter" are stripped so filter lists look clean.
- **Multi-pack support** — if an asset belongs to multiple themes or packs the UI renders all associated native icons side-by-side.
- **High-performance caching** — content pack lookups use a concurrent caching dictionary. Pack dependencies are calculated once and reused for every subsequent lookup, keeping UI navigation smooth.

### Company Browser
- **Sortable & filterable table** — browse all companies by zone, profitability tier, profit range, or text search.
- **Company detail panels** — expand any row to see brand name, building address, building level, zone, output/input resources, staffing bars, and efficiency breakdown.
- **Efficiency factor analysis** — real game data showing each factor (Electricity, Water, Garbage, Mail, Telecom, Staffing, etc.) with CS2 icons, percentage impact, and cumulative efficiency.
- **Company Happiness** — compact colorized happiness score is visible in the company rows and expanded detail panels. The score is estimated from efficiency, profit, staffing, and tax (the server provides an authoritative value when available).
- **Signature building detection** — special landmark/prefab detection is exposed in the Company Browser. All known DLC signature buildings are flagged in the detail panel and used by the Advisor when relevant.
- **Go-to-building** — click to jump the camera directly to any company's building.

### Auto-Tax Engine & Adaptive Learning Advisor
- **6-factor scoring** — auto-balances profitability, happiness, production, demand, company count, and tax income when recommending rate adjustments.
- **Per-resource bounds** — fine-tune allowed tax bounds for each resource, or exclude specific resources from auto-adjustment entirely.
- **Machine-learned resource profiles** — tracks sensitivity, income response, company response, production impact, revenue efficiency, and volatility for each resource.
- **Outcome evaluation** — records before/after snapshots when tax rates change and scores outcomes after an observation period.
- **Decision log & Persistent learning** — browse recent advisor decisions with outcome scores. Profiles are saved to disk and loaded between sessions.

### Under the Hood
- **High-performance prefab caching** — asset pack lookups use a `ConcurrentDictionary` cache. Pack dependencies are calculated exactly once per asset and reused instantly for every subsequent lookup, eliminating main-thread CPU spikes during UI generation.
- **Deep ECS extraction** — the backend checks `AssetPackItem`, falls back to `SpawnableBuilding` zone data, checks native `DlcRequirements`, and queries Paradox Mods metadata (`asset.GetMeta()`) to find creator display names. No custom building is missed.
- **Smart name normalization** — PascalCase internal names are automatically split into readable text and redundant tags like "Asset", "Pack", or "Filter" are stripped, so every filter list looks clean without any manual configuration.
- **Multi-pack icon rendering** — pack icon URLs are parsed as comma-separated lists. If an asset belongs to multiple packs or themes, the UI lines up all associated native icons side-by-side.
- **Direct-DOM rendering** — built specifically for the Cohtml engine. UI thread cost is approximately 1.3ms with no measurable impact on game FPS.
- **Paginated lists** — all data tables render 50 rows per page.
- **Auto-pause on expand** — live updates pause when a row is expanded and resume automatically on collapse.

---

## Installation

### From PDX Mods (Recommended)
1. Subscribe to AdvancedTPM on [Paradox Mods](https://mods.paradoxplaza.com/).
2. Enable the mod in-game from the mod manager.

### Manual Install
1. Download the latest release.
2. Copy the mod folder to:
   `%LOCALAPPDATA%Low\Colossal Order\Cities Skylines II\Mods\AdvancedTPM\`
3. Ensure the folder contains: `AdvancedTPM.dll`, `mod.json`, `AdvancedTPM.mjs`, `AdvancedTPM.css`, `locale/en-US.json`, and `.thumbnail.png`.
4. Enable the mod in the game's mod manager.

---

## Usage

1. **Open the panel** — click the ATPM toolbar button in the top-left game UI.
2. **Browse resources** — scroll through categories, hover for tooltips, adjust tax sliders.
3. **Company Browser tab** — switch to the Businesses tab to inspect individual companies.
4. **Auto-Tax** — enable from the Auto-Tax Settings panel or mod settings; configure per-resource ranges.
5. **Advisor** — enable Adaptive Learning in settings to see AI recommendations in the Advisor tab.

---

## Building from Source

### Prerequisites
- .NET Framework 4.8 SDK
- Node.js 18+ with npm
- Cities: Skylines 2 installed (for game DLL references)

### Build Instructions
```bash
# Install UI dependencies (from the repo root or the AdvancedTPM UI folder)
cd AdvancedTPM
npm install

# Build (compiles C# + bundles TypeScript/React UI + deploys to game Mods folder)
# Run from the repository root
dotnet build AdvancedTPM/AdvancedTPM.csproj
Notes:

The dotnet build target invokes the UI bundler (webpack) and will deploy the generated .mjs/.css assets to your local CS2 Mods folder if CSII_USERDATAPATH is configured in the environment.

You can run npm run dev in AdvancedTPM for a faster watch-mode UI iteration loop (webpack --watch) while the game is running.

Project Structure
Plaintext
├── AdvancedTPM/AdvancedTPM.csproj     # C# project (net48, Assembly: AdvancedTPM)
├── mod.json                           # Mod metadata for CS2
├── src/
│   ├── ModEntry.cs                    # Mod entry point (IMod)
│   ├── TPMModSettings.cs              # Game options/settings
│   ├── LocaleEN.cs                    # Localization strings
│   ├── Systems/
│   │   ├── TaxingProductionUISystem.cs # Core tax/production ECS system
│   │   ├── AutoTaxSystem.cs            # Auto-tax engine
│   │   ├── CompanyBrowserSystem.cs     # Company data ECS queries
│   │   ├── AdaptiveLearningSystem.cs   # AI advisor system
│   │   └── CityLearningData.cs         # Learning data models
│   ├── mods/
│   │   ├── TaxMod.tsx                # Toolbar button registration
│   │   ├── TaxWindow.tsx             # Main window orchestrator
│   │   └── bindings.ts               # C# ↔ UI data bindings
│   └── UI/
│       ├── components/               # React components (CompanyBrowser, AdvisorPanel, etc.)
│       ├── data/                     # Resource taxonomy data
│       └── assets/                   # SVG icons
├── locale/en-US.json                  # English locale strings
├── webpack.config.js                  # UI bundler config
└── Refs/                              # Game DLL references (gitignored)
References & Credits
This mod was built with guidance from:

Cities Skylines 2 Modding Guide

CS2 Modding Instructions

License
MIT License — see LICENSE for details.

Author
binded-zz — GitHub