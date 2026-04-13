# AdvancedTPM — Advanced Tax & Production Manager

A comprehensive Cities: Skylines 2 mod for per-resource tax control, production monitoring, company analysis, and AI-powered tax optimization.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
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

### Auto-Tax Engine
- **6-factor scoring** — balances profitability, happiness, production, demand, company count, and tax income when recommending rate adjustments.
- **Per-resource min/max ranges** — fine-tune allowed tax bounds for each resource.
- **Excluded resources** — lock specific resources from auto-adjustment.
- **Adjustable speed** — control how frequently the engine makes changes.

### Adaptive Learning Advisor
- **Machine-learned resource profiles** — tracks sensitivity, income response, company response, production impact, revenue efficiency, and volatility for each resource.
- **Outcome evaluation** — records before/after snapshots when tax rates change and scores outcomes after an observation period.
- **Confidence-weighted recommendations** — higher confidence = stronger influence on scoring.
- **Decision log** — browse recent advisor decisions with outcome scores.
- **Persistent learning** — profiles saved to disk and loaded between sessions.

### Settings
- **Game options integration** — mod settings page with General, Auto-Tax, Advisor, Debug, and About groups.
- **Movable/resizable window** — drag and resize the Advanced UI; position auto-persists.
- **Tips toggle** — in-UI tooltips with production details and guidance.

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
- .NET Framework 4.7.2 SDK
- Node.js 18+ with npm
- Cities: Skylines 2 installed (for game DLL references)

### Build
```bash
# Install UI dependencies
npm install

# Build (compiles C# + bundles TypeScript/React UI + deploys to game Mods folder)
dotnet build cities/cities.csproj
```

The build automatically:
1. Compiles the C# mod DLL (`AdvancedTPM.dll`)
2. Runs webpack to bundle the React/TypeScript UI
3. Deploys everything to the CS2 Mods folder

### Project Structure
```
├── cities/cities.csproj        # C# project (net472, Assembly: AdvancedTPM)
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
│   │   └── bindings.ts         # C# ↔ UI data bindings
│   └── UI/
│       ├── components/         # React components (AdvancedTPMWindow, CompanyBrowser, AdvisorPanel, etc.)
│       ├── data/               # Resource taxonomy data
│       └── assets/             # SVG icons
├── locale/en-US.json           # English locale strings
├── webpack.config.js           # UI bundler config
└── Refs/                       # Game DLL references (gitignored)
```

---

## References

This mod was built with guidance from:
- [Cities Skylines 2 Modding Guide](https://github.com/ps1ke/Cities-Skylines-2-Modding-Guide)
- [CS2 Modding Instructions](https://github.com/rcav8tr/CS2-Modding-Instructions)

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Author

**binded-zz** — [GitHub](https://github.com/binded-zz/cities)