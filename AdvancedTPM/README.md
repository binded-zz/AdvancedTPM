# AdvancedTPM — Advanced Tax and Production Manager

A comprehensive Cities: Skylines 2 mod for per-resource tax control, production monitoring, company analysis, and AI-powered tax optimization.

![Version](https://img.shields.io/badge/version-1.1.5-blue)
![CS2](https://img.shields.io/badge/Cities%3A%20Skylines%202-compatible-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Features

### 🧠 Adaptive AI Auto-Tax
- **Smart Optimization:** Enable the AI Auto-Taxer to dynamically adjust your city's tax rates based on real-time profitability and supply chain demand.
- **The Bailout Failsafe:** Built-in economic protection that detects death-spiraling industries, automatically nudges taxes to a safe baseline, and unlearns bad behaviors.

### 📊 Tax & Production Dashboard
- **Per-resource tax sliders** — Set tax rates individually for 50+ resources across raw materials, industrial goods, immaterial services, and commercial retail.
- **Production & consumption bars** — Real-time metrics with surplus/deficit indicators.
- **Tax income tracking** — Per-resource and total income with in-game currency formatting.

### 🏢 Deep Company & Service Analytics
- **Company Browser:** Sort and filter every business in your city by profitability, tax rate, efficiency, and worker counts.
- **Accurate Storage Metrics:** View true metric tonnage (t) of physical freight sitting in company warehouses.
- **Service Buildings Panel:** Deep-dive into your city's infrastructure. Track active vehicle ratios, employee capacities, and precise electricity/water/garbage consumption for every service building.

### 🏘️ Residential & District Tracking
- **Full Custom Content Support:** Automatically detects and tracks Base Game buildings, DLC region packs, themed content, and Paradox Mods custom creator packs. 
- **District Dashboards:** View district-level demographics, household wealth, crime risk, and localized effects in a drag-and-drop widget layout.
- **Happiness Factors:** See exactly what is impacting the happiness and efficiency of individual homes and businesses.
- **PolicyPlus Compatibility:** Full support for expanded city policies from the `PolicyPlus` mod, featuring active conflict detection and toggle blocking.

## Performance Optimized
Built from the ground up for Megalopolis-sized cities. AdvancedTPM utilizes zero-allocation buffers, concurrent caching, and Burst-compiled math jobs to keep UI rendering cost under 1.5ms with zero impact on simulation tick speed.

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