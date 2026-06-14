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

### Company Browser
- **Sortable & filterable table** — browse all companies by zone, profitability tier, profit range, or text search.
- **Company detail panels** — expand any row to see brand name, building address, building level, zone, output/input resources, staffing bars, and efficiency breakdown.
- **Efficiency factor analysis** — real game data showing each factor (Electricity, Water, Garbage, Mail, Telecom, Staffing, etc.) with CS2 icons, percentage impact, and cumulative efficiency.
- **Go-to-building** — click to jump the camera directly to any company's building.
- **Company Happiness (row + detail)** — compact colorized happiness score visible in rows and expanded detail panels.
- **Signature building detection** — all known DLC signature buildings are flagged in the detail panel and used by the Advisor.

### Residential Browser
- **Full content support — no updates needed** — the Residential Browser supports Base Game buildings, all DLC region packs, themed content, and any custom creator content automatically. If a content pack provides a filter icon, the mod uses it. New packs added to the game in future updates will appear in the UI without any mod update required.
- **Theme & region filter** — filter by theme or regional style (North American, European, or any creator-assigned theme). Each theme option shows the content pack's own icon in the filter dropdown.
- **DLC, regional pack & custom content filters** — dedicated filter for asset pack source. Pack icons are pulled directly from the content pack itself so every pack looks exactly as it does in the game's own menus.
- **Pack placement counts** — the top summary table shows exactly how many residential buildings of each installed content pack are currently placed on your map, broken down by density tier (Low, Medium, High).
- **Paginated table — 50 buildings per page** — the building list renders 50 rows at a time for fast load and smooth scrolling regardless of city size.
- **Auto-pause on expand** — expanding a building row pauses live data updates so the detail view stays stable while you read it. Updates resume automatically when you collapse the row.
- **Dual Go buttons** — each building row has two camera actions: jump directly to the building on the map, or select and focus the building in the game's own info panel.
- **Sortable columns** — sort by address, zone density, level, active households, property size, occupancy percentage, theme, or asset pack.
- **Filterable by density, level, district, occupancy state, happiness range, and signature status.**

### Signature Buildings
- **Full DLC Whitelist** — all known DLC signature buildings are correctly identified and flagged in the Company Browser.
- **Signature Tab Icons** — the Signature tab icon renders correctly.
- **Detail Panel Flag** — signature buildings are highlighted in the expanded company detail view and used by the Advisor.

### Auto-Tax Engine
- **6-factor scoring** — balances profitability, happiness, production, demand, company count, and tax income when recommending rate adjustments.
- **Per-resource min/max ranges** — fine-tune allowed tax bounds for each resource.
- **Excluded resources** — lock specific resources from auto-adjustment.
- **Adjustable speed** — control how frequently the engine makes changes.
- **Profitability weight slider** — fine-tune how much company profit influences the scoring formula.

### Adaptive Learning Advisor
- **Machine-learned resource profiles** — tracks sensitivity, income response, company response, production impact, revenue efficiency, and volatility for each resource.
- **Outcome evaluation** — records before/after snapshots when tax rates change and scores outcomes after an observation period.
- **Confidence-weighted recommendations** — higher confidence = stronger influence on scoring.
- **Decision log** — browse recent advisor decisions with outcome scores.
- **Persistent learning** — profiles saved to disk and loaded between sessions.

### Districts Dashboard
- Reorderable district cards with settings gear, demographic metrics, and district-level policies.
- Happiness aggregation integrated into the panel.

### Services Browser
- Filterable panel for tracking city service buildings with live metrics.

### Settings
- **Game options integration** — mod settings page with General, Auto-Tax, Advisor, Debug, and About groups.
- **Movable/resizable window** — drag and resize the Advanced UI; position auto-persists.
- **Tips toggle** — in-UI tooltips with production details and guidance.

### Performance
- Built specifically for the Cohtml engine using direct-DOM manipulation. UI thread cost is approximately 1.3ms.
- Paginated lists (50 rows per page) keep rendering fast in large cities.
- Live data updates pause automatically when a row is expanded so detail views are always stable.

---

## Forum Post

### AdvancedTPM — Advanced Tax and Production Manager

Hey everyone,

I wanted to share **AdvancedTPM**, a mod I have been building to give a much deeper look at the economy and residential side of Cities: Skylines 2.

**What it does:**

The core of the mod is a full economic dashboard — per-resource tax sliders for 50+ resources, real-time production and consumption bars, per-resource tax income tracking, and an auto-tax engine that adjusts rates dynamically based on profitability, happiness, demand, and more. There is also an adaptive learning advisor that builds a profile for each resource over time and uses it to weight future recommendations.

The **Residential Browser** is the part I am most excited about right now. It gives you a sortable, filterable, paginated table of every residential building in your city. You can filter by density, level, district, theme, asset pack, occupancy state, and happiness range. The theme and pack filters use the content pack's own icons straight from the game — the same icons you see in the game's own menus.

The big design goal here was that **it should never need a mod update to support new content**. If a new DLC region pack, creator pack, or themed content is added to the game, it shows up in the filter automatically. If it has a pack icon, the mod uses that icon. No hardcoded lists, no manual updates needed.

The top of the panel shows a **pack placement count table** — how many buildings from each installed content pack are actually placed on your map, split by density tier. It is a quick way to see which content packs are actually contributing to your city.

For performance I switched the building list to a paginated view, 50 buildings per page. It keeps things fast even in a city with tens of thousands of residential buildings. When you expand a building row the live data updates pause automatically so the detail stays stable while you read it. There are two camera buttons per row — one jumps to the building on the map, the other selects and focuses it in the game's info panel.

The rest of the mod includes a Company Browser with efficiency breakdowns and happiness scores, a Districts Dashboard with demographic metrics and reorderable cards, a Services Browser, and a Signature Buildings tab that tracks all DLC landmark buildings.

It is on PDX Mods now. Happy to hear any feedback.

---

## Installation

### From PDX Mods (Recommended)
1. Subscribe to AdvancedTPM on [Paradox Mods](https://mods.paradoxplaza.com/).
2. Enable the mod in-game from the mod manager.

### Manual Install
1. Download the latest release.
2. Copy the mod folder to:
   ```
   %LOCALAPPDATA%Low\Colossal Order\Cities Skylines II\Mods\AdvancedTPM\
   ```
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
- .NET Framework 4.8 SDK (project targets .NET Framework 4.8)
- Node.js 18+ with npm
- Cities: Skylines 2 installed (for game DLL references)

### Build
```bash
# Install UI dependencies (from the repo root or the `AdvancedTPM` UI folder)
cd AdvancedTPM
npm install

# Build (compiles C# + bundles TypeScript/React UI + deploys to game Mods folder)
# Run from the repository root
dotnet build AdvancedTPM/AdvancedTPM.csproj
```

Notes:
1. The `dotnet build` target invokes the UI bundler (webpack) and will deploy the generated `.mjs`/`.css` assets to your local CS2 Mods folder if `CSII_USERDATAPATH` is configured in the environment.
2. You can run `npm run dev` in `AdvancedTPM` for a faster watch-mode UI iteration loop (webpack --watch) while the game is running.

### Project Structure
```
├── AdvancedTPM/AdvancedTPM.csproj        # C# project (net48, Assembly: AdvancedTPM)
├── mod.json                    # Mod metadata for CS2
├── src/
│   ├── ModEntry.cs             # Mod entry point (IMod)
│   ├── TPMModSettings.cs       # Game options/settings
│   ├── LocaleEN.cs             # Localization strings
│   ├── Systems/
│   │   ├── TaxingProductionUISystem.cs    # Core tax/production ECS system
│   │   ├── AutoTaxSystem.cs               # Auto-tax engine
│   │   ├── CompanyBrowserSystem.cs        # Company data ECS queries
│   │   ├── AdaptiveLearningSystem.cs      # AI advisor system
│   │   └── CityLearningData.cs            # Learning data models
│   ├── mods/
│   │   ├── TaxMod.tsx          # Toolbar button registration
│   │   ├── TaxWindow.tsx       # Main window orchestrator
│   │   └── bindings.ts         # C# bindings
│   └── UI/
│       ├── components/         # React components
│       ├── data/               # Resource taxonomy data
│       └── assets/             # SVG icons
├── locale/en-US.json           # English locale strings
├── webpack.config.js           # UI bundler config
└── Refs/                       # Game DLL references (gitignored)
```

---

## References

- [Cities Skylines 2 Modding Guide](https://github.com/ps1ke/Cities-Skylines-2-Modding-Guide)
- [CS2 Modding Instructions](https://github.com/rcav8tr/CS2-Modding-Instructions)

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Author

**binded-zz** — [GitHub](https://github.com/binded-zz/AdvancedTPM)