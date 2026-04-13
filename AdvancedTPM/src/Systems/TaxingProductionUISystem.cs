using Colossal.UI.Binding;
using Game.City;
using Game.Economy;
using Game.Prefabs;
using Game.Simulation;
using Game.UI;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Unity.Collections;
using Unity.Entities;
using Unity.Jobs;

namespace AdvancedTPM
{
    public partial class TaxingProductionUISystem : UISystemBase
    {
        private ValueBinding<bool> _advancedVisible;
        private ValueBinding<int> _globalTaxRate;
        private ValueBinding<string> _selectedResourceCategory;
        private ValueBinding<bool> _debugEnabled;
        private ValueBinding<bool> _debugPanelVisible;
        private ValueBinding<bool> _showTips;
        private ValueBinding<string> _debugLastAction;
        private ValueBinding<int> _advancedWindowX;
        private ValueBinding<int> _advancedWindowY;
        private ValueBinding<int> _advancedWindowWidth;
        private ValueBinding<int> _advancedWindowHeight;
        private ValueBinding<string> _resourceRowsData;

        private CountCompanyDataSystem _countCompanyDataSystem;
        private IndustrialDemandSystem _industrialDemandSystem;
        private CommercialDemandSystem _commercialDemandSystem;
        private TaxSystem _taxSystem;
        private ResourceSystem _resourceSystem;
        private SimulationSystem _simulationSystem;
        private CityStatisticsSystem _cityStatisticsSystem;
        private int _updateCounter;
        private bool _initialTaxRatesLoaded;

        private enum ResourceTaxArea { Industrial, Commercial, Office }

        private static readonly Dictionary<string, ResourceTaxArea> ResourceTaxAreaMap = new Dictionary<string, ResourceTaxArea>
        {
            // Raw Materials — Industrial
            ["grain"] = ResourceTaxArea.Industrial,
            ["vegetables"] = ResourceTaxArea.Industrial,
            ["cotton"] = ResourceTaxArea.Industrial,
            ["livestock"] = ResourceTaxArea.Industrial,
            ["fish"] = ResourceTaxArea.Industrial,
            ["wood"] = ResourceTaxArea.Industrial,
            ["ore"] = ResourceTaxArea.Industrial,
            ["stone"] = ResourceTaxArea.Industrial,
            ["coal"] = ResourceTaxArea.Industrial,
            ["oil"] = ResourceTaxArea.Industrial,
            // Processed Goods — Industrial
            ["food"] = ResourceTaxArea.Industrial,
            ["beverages"] = ResourceTaxArea.Industrial,
            ["conveniencefood"] = ResourceTaxArea.Industrial,
            ["textiles"] = ResourceTaxArea.Industrial,
            ["timber"] = ResourceTaxArea.Industrial,
            ["paper"] = ResourceTaxArea.Industrial,
            ["furniture"] = ResourceTaxArea.Industrial,
            ["metals"] = ResourceTaxArea.Industrial,
            ["steel"] = ResourceTaxArea.Industrial,
            ["minerals"] = ResourceTaxArea.Industrial,
            ["concrete"] = ResourceTaxArea.Industrial,
            ["machinery"] = ResourceTaxArea.Industrial,
            ["electronics"] = ResourceTaxArea.Industrial,
            ["vehicles"] = ResourceTaxArea.Industrial,
            ["petrochemicals"] = ResourceTaxArea.Industrial,
            ["plastics"] = ResourceTaxArea.Industrial,
            ["chemicals"] = ResourceTaxArea.Industrial,
            ["pharmaceuticals"] = ResourceTaxArea.Industrial,
            // Office — Software, Telecom, Financial, Media
            ["software"] = ResourceTaxArea.Office,
            ["telecom"] = ResourceTaxArea.Office,
            ["financial"] = ResourceTaxArea.Office,
            ["media"] = ResourceTaxArea.Office,
            // Commercial — Lodging, Meals, Entertainment, Recreation
            ["lodging"] = ResourceTaxArea.Commercial,
            ["meals"] = ResourceTaxArea.Commercial,
            ["entertainment"] = ResourceTaxArea.Commercial,
            ["recreation"] = ResourceTaxArea.Commercial,
            // Commercial Retail — goods sold in commercial zones
            ["c_food"] = ResourceTaxArea.Commercial,
            ["c_beverages"] = ResourceTaxArea.Commercial,
            ["c_conveniencefood"] = ResourceTaxArea.Commercial,
            ["c_textiles"] = ResourceTaxArea.Commercial,
            ["c_timber"] = ResourceTaxArea.Commercial,
            ["c_paper"] = ResourceTaxArea.Commercial,
            ["c_furniture"] = ResourceTaxArea.Commercial,
            ["c_metals"] = ResourceTaxArea.Commercial,
            ["c_steel"] = ResourceTaxArea.Commercial,
            ["c_minerals"] = ResourceTaxArea.Commercial,
            ["c_concrete"] = ResourceTaxArea.Commercial,
            ["c_machinery"] = ResourceTaxArea.Commercial,
            ["c_electronics"] = ResourceTaxArea.Commercial,
            ["c_vehicles"] = ResourceTaxArea.Commercial,
            ["c_petrochemicals"] = ResourceTaxArea.Commercial,
            ["c_plastics"] = ResourceTaxArea.Commercial,
            ["c_chemicals"] = ResourceTaxArea.Commercial,
            ["c_pharmaceuticals"] = ResourceTaxArea.Commercial,
        };

        private static readonly Dictionary<string, Resource> ResourceKeyToEnum = new Dictionary<string, Resource>
        {
            // Raw Materials
            ["grain"]           = Resource.Grain,
            ["vegetables"]      = Resource.Vegetables,
            ["cotton"]          = Resource.Cotton,
            ["livestock"]       = Resource.Livestock,
            ["fish"]            = Resource.Fish,
            ["wood"]            = Resource.Wood,
            ["ore"]             = Resource.Ore,
            ["stone"]           = Resource.Stone,
            ["coal"]            = Resource.Coal,
            ["oil"]             = Resource.Oil,
            // Processed Goods
            ["food"]            = Resource.Food,
            ["beverages"]       = Resource.Beverages,
            ["conveniencefood"] = Resource.ConvenienceFood,
            ["textiles"]        = Resource.Textiles,
            ["timber"]          = Resource.Timber,
            ["paper"]           = Resource.Paper,
            ["furniture"]       = Resource.Furniture,
            ["metals"]          = Resource.Metals,
            ["steel"]           = Resource.Steel,
            ["minerals"]        = Resource.Minerals,
            ["concrete"]        = Resource.Concrete,
            ["machinery"]       = Resource.Machinery,
            ["electronics"]     = Resource.Electronics,
            ["vehicles"]        = Resource.Vehicles,
            ["petrochemicals"]  = Resource.Petrochemicals,
            ["plastics"]        = Resource.Plastics,
            ["chemicals"]       = Resource.Chemicals,
            ["pharmaceuticals"] = Resource.Pharmaceuticals,
            // Immaterial Goods
            ["software"]        = Resource.Software,
            ["telecom"]         = Resource.Telecom,
            ["financial"]       = Resource.Financial,
            ["media"]           = Resource.Media,
            ["lodging"]         = Resource.Lodging,
            ["meals"]           = Resource.Meals,
            ["entertainment"]   = Resource.Entertainment,
            ["recreation"]      = Resource.Recreation,
            // Commercial Retail
            ["c_food"]            = Resource.Food,
            ["c_beverages"]       = Resource.Beverages,
            ["c_conveniencefood"] = Resource.ConvenienceFood,
            ["c_textiles"]        = Resource.Textiles,
            ["c_timber"]          = Resource.Timber,
            ["c_paper"]           = Resource.Paper,
            ["c_furniture"]       = Resource.Furniture,
            ["c_metals"]          = Resource.Metals,
            ["c_steel"]           = Resource.Steel,
            ["c_minerals"]        = Resource.Minerals,
            ["c_concrete"]        = Resource.Concrete,
            ["c_machinery"]       = Resource.Machinery,
            ["c_electronics"]     = Resource.Electronics,
            ["c_vehicles"]        = Resource.Vehicles,
            ["c_petrochemicals"]  = Resource.Petrochemicals,
            ["c_plastics"]        = Resource.Plastics,
            ["c_chemicals"]       = Resource.Chemicals,
            ["c_pharmaceuticals"] = Resource.Pharmaceuticals,
        };

        private readonly Dictionary<string, ResourceRowState> _resourceRows = new Dictionary<string, ResourceRowState>
        {
            // Raw Materials
            ["grain"]           = new ResourceRowState("grain",           "Grain",            "RawResource", 0f, 0f, 15),
            ["vegetables"]      = new ResourceRowState("vegetables",      "Vegetables",       "RawResource", 0f, 0f, 15),
            ["cotton"]          = new ResourceRowState("cotton",          "Cotton",           "RawResource", 0f, 0f, 15),
            ["livestock"]       = new ResourceRowState("livestock",       "Livestock",        "RawResource", 0f, 0f, 15),
            ["fish"]            = new ResourceRowState("fish",            "Fish",             "RawResource", 0f, 0f, 15),
            ["wood"]            = new ResourceRowState("wood",            "Wood",             "RawResource", 0f, 0f, 15),
            ["ore"]             = new ResourceRowState("ore",             "Ore",              "RawResource", 0f, 0f, 15),
            ["stone"]           = new ResourceRowState("stone",           "Stone",            "RawResource", 0f, 0f, 15),
            ["coal"]            = new ResourceRowState("coal",            "Coal",             "RawResource", 0f, 0f, 15),
            ["oil"]             = new ResourceRowState("oil",             "Crude Oil",        "RawResource", 0f, 0f, 15),
            // Processed Goods
            ["food"]            = new ResourceRowState("food",            "Food",             "Industrial",  0f, 0f, 15),
            ["beverages"]       = new ResourceRowState("beverages",       "Beverages",        "Industrial",  0f, 0f, 15),
            ["conveniencefood"] = new ResourceRowState("conveniencefood", "Convenience Food", "Industrial",  0f, 0f, 15),
            ["textiles"]        = new ResourceRowState("textiles",        "Textiles",         "Industrial",  0f, 0f, 15),
            ["timber"]          = new ResourceRowState("timber",          "Timber",           "Industrial",  0f, 0f, 15),
            ["paper"]           = new ResourceRowState("paper",           "Paper",            "Industrial",  0f, 0f, 15),
            ["furniture"]       = new ResourceRowState("furniture",       "Furniture",        "Industrial",  0f, 0f, 15),
            ["metals"]          = new ResourceRowState("metals",          "Metals",           "Industrial",  0f, 0f, 15),
            ["steel"]           = new ResourceRowState("steel",           "Steel",            "Industrial",  0f, 0f, 15),
            ["minerals"]        = new ResourceRowState("minerals",        "Minerals",         "Industrial",  0f, 0f, 15),
            ["concrete"]        = new ResourceRowState("concrete",        "Concrete",         "Industrial",  0f, 0f, 15),
            ["machinery"]       = new ResourceRowState("machinery",       "Machinery",        "Industrial",  0f, 0f, 15),
            ["electronics"]     = new ResourceRowState("electronics",     "Electronics",      "Industrial",  0f, 0f, 15),
            ["vehicles"]        = new ResourceRowState("vehicles",        "Vehicles",         "Industrial",  0f, 0f, 15),
            ["petrochemicals"]  = new ResourceRowState("petrochemicals",  "Petrochemicals",   "Industrial",  0f, 0f, 15),
            ["plastics"]        = new ResourceRowState("plastics",        "Plastics",         "Industrial",  0f, 0f, 15),
            ["chemicals"]       = new ResourceRowState("chemicals",       "Chemicals",        "Industrial",  0f, 0f, 15),
            ["pharmaceuticals"] = new ResourceRowState("pharmaceuticals", "Pharmaceuticals",  "Industrial",  0f, 0f, 15),
            // Immaterial Goods
            ["software"]        = new ResourceRowState("software",        "Software",         "Immaterial",  0f, 0f, 15),
            ["telecom"]         = new ResourceRowState("telecom",         "Telecom",          "Immaterial",  0f, 0f, 15),
            ["financial"]       = new ResourceRowState("financial",       "Financial",        "Immaterial",  0f, 0f, 15),
            ["media"]           = new ResourceRowState("media",           "Media",            "Immaterial",  0f, 0f, 15),
            ["lodging"]         = new ResourceRowState("lodging",         "Lodging",          "Retail",      0f, 0f, 15),
            ["meals"]           = new ResourceRowState("meals",           "Meals",            "Retail",      0f, 0f, 15),
            ["entertainment"]   = new ResourceRowState("entertainment",   "Entertainment",    "Retail",      0f, 0f, 15),
            ["recreation"]      = new ResourceRowState("recreation",      "Recreation",       "Retail",      0f, 0f, 15),
            // Commercial Retail
            ["c_food"]            = new ResourceRowState("c_food",            "Food",             "Commercial",  0f, 0f, 15),
            ["c_beverages"]       = new ResourceRowState("c_beverages",       "Beverages",        "Commercial",  0f, 0f, 15),
            ["c_conveniencefood"] = new ResourceRowState("c_conveniencefood", "Convenience Food", "Commercial",  0f, 0f, 15),
            ["c_textiles"]        = new ResourceRowState("c_textiles",        "Textiles",         "Commercial",  0f, 0f, 15),
            ["c_timber"]          = new ResourceRowState("c_timber",          "Timber",           "Commercial",  0f, 0f, 15),
            ["c_paper"]           = new ResourceRowState("c_paper",           "Paper",            "Commercial",  0f, 0f, 15),
            ["c_furniture"]       = new ResourceRowState("c_furniture",       "Furniture",        "Commercial",  0f, 0f, 15),
            ["c_metals"]          = new ResourceRowState("c_metals",          "Metals",           "Commercial",  0f, 0f, 15),
            ["c_steel"]           = new ResourceRowState("c_steel",           "Steel",            "Commercial",  0f, 0f, 15),
            ["c_minerals"]        = new ResourceRowState("c_minerals",        "Minerals",         "Commercial",  0f, 0f, 15),
            ["c_concrete"]        = new ResourceRowState("c_concrete",        "Concrete",         "Commercial",  0f, 0f, 15),
            ["c_machinery"]       = new ResourceRowState("c_machinery",       "Machinery",        "Commercial",  0f, 0f, 15),
            ["c_electronics"]     = new ResourceRowState("c_electronics",     "Electronics",      "Commercial",  0f, 0f, 15),
            ["c_vehicles"]        = new ResourceRowState("c_vehicles",        "Vehicles",         "Commercial",  0f, 0f, 15),
            ["c_petrochemicals"]  = new ResourceRowState("c_petrochemicals",  "Petrochemicals",   "Commercial",  0f, 0f, 15),
            ["c_plastics"]        = new ResourceRowState("c_plastics",        "Plastics",         "Commercial",  0f, 0f, 15),
            ["c_chemicals"]       = new ResourceRowState("c_chemicals",       "Chemicals",        "Commercial",  0f, 0f, 15),
            ["c_pharmaceuticals"] = new ResourceRowState("c_pharmaceuticals", "Pharmaceuticals",  "Commercial",  0f, 0f, 15),
        };

        protected override void OnCreate()
        {
            base.OnCreate();

            var settings = Mod.Settings;
            var defaultTaxRate = settings?.DefaultGlobalTaxRate ?? 15;

            foreach (var row in _resourceRows.Values)
            {
                row.TaxRate = defaultTaxRate;
            }

            try
            {
                _countCompanyDataSystem = World.GetOrCreateSystemManaged<CountCompanyDataSystem>();
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"Could not get CountCompanyDataSystem: {ex.Message}");
            }

            try
            {
                _industrialDemandSystem = World.GetOrCreateSystemManaged<IndustrialDemandSystem>();
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"Could not get IndustrialDemandSystem: {ex.Message}");
            }

            try
            {
                _commercialDemandSystem = World.GetOrCreateSystemManaged<CommercialDemandSystem>();
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"Could not get CommercialDemandSystem: {ex.Message}");
            }

            try
            {
                _taxSystem = World.GetOrCreateSystemManaged<TaxSystem>();
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"Could not get TaxSystem: {ex.Message}");
            }

            try
            {
                _resourceSystem = World.GetOrCreateSystemManaged<ResourceSystem>();
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"Could not get ResourceSystem: {ex.Message}");
            }

            try
            {
                _simulationSystem = World.GetOrCreateSystemManaged<SimulationSystem>();
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"Could not get SimulationSystem: {ex.Message}");
            }

            try
            {
                _cityStatisticsSystem = World.GetOrCreateSystemManaged<CityStatisticsSystem>();
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"Could not get CityStatisticsSystem: {ex.Message}");
            }

            AddBinding(_advancedVisible = new ValueBinding<bool>("taxProduction", "advancedVisible", false));
            AddBinding(_globalTaxRate = new ValueBinding<int>("taxProduction", "globalTaxRate", defaultTaxRate));
            AddBinding(_selectedResourceCategory = new ValueBinding<string>("taxProduction", "selectedResourceCategory", "All"));
            AddBinding(_debugEnabled = new ValueBinding<bool>("taxProduction", "debugEnabled", settings?.DebugEnabled ?? false));
            AddBinding(_debugPanelVisible = new ValueBinding<bool>("taxProduction", "debugPanelVisible", settings?.ShowDebugPanel ?? false));
            AddBinding(_showTips = new ValueBinding<bool>("taxProduction", "showTips", settings?.ShowTips ?? true));
            AddBinding(_debugLastAction = new ValueBinding<string>("taxProduction", "debugLastAction", "init"));
            AddBinding(_advancedWindowX = new ValueBinding<int>("taxProduction", "advancedWindowX", settings?.AdvancedWindowX ?? 140));
            AddBinding(_advancedWindowY = new ValueBinding<int>("taxProduction", "advancedWindowY", settings?.AdvancedWindowY ?? 150));
            AddBinding(_advancedWindowWidth = new ValueBinding<int>("taxProduction", "advancedWindowWidth", settings?.AdvancedWindowWidth ?? 520));
            AddBinding(_advancedWindowHeight = new ValueBinding<int>("taxProduction", "advancedWindowHeight", settings?.AdvancedWindowHeight ?? 420));
            AddBinding(_resourceRowsData = new ValueBinding<string>("taxProduction", "resourceRowsData", SerializeRows()));

            AddBinding(new TriggerBinding("taxProduction", "toggleAdvancedWindow", ToggleAdvancedWindow));
            AddBinding(new TriggerBinding<int>("taxProduction", "setGlobalTaxRate", SetGlobalTaxRate));
            AddBinding(new TriggerBinding<string>("taxProduction", "setResourceTaxRate", SetResourceTaxRate));
            AddBinding(new TriggerBinding<string>("taxProduction", "setResourceCategory", SetResourceCategory));
            AddBinding(new TriggerBinding<bool>("taxProduction", "setDebugEnabled", SetDebugEnabled));
            AddBinding(new TriggerBinding<bool>("taxProduction", "setShowTips", SetShowTips));
            AddBinding(new TriggerBinding("taxProduction", "toggleDebugPanel", ToggleDebugPanel));
            AddBinding(new TriggerBinding<string>("taxProduction", "setAdvancedWindowRect", SetAdvancedWindowRect));
            AddBinding(new TriggerBinding("taxProduction", "resetDefaults", ResetDefaults));

            Mod.log.Info("TaxingProductionUISystem bindings initialized");
        }

        protected override void OnUpdate()
        {
            base.OnUpdate();

            var settings = Mod.Settings;
            if (settings == null)
            {
                return;
            }

            if (_showTips.value != settings.ShowTips)
            {
                _showTips.Update(settings.ShowTips);
            }

            // Load actual game tax rates once the TaxSystem is available
            if (!_initialTaxRatesLoaded)
            {
                _initialTaxRatesLoaded = ReadGameTaxRates();
            }

            _updateCounter++;
            // UpdateSpeed: 1=Fast(8/32), 2=Normal(16/64), 3=Slow(32/128)
            int speedSetting = settings.UpdateSpeed;
            int activeInterval, inactiveInterval;
            switch (speedSetting)
            {
                case 1: activeInterval = 8; inactiveInterval = 32; break;
                case 3: activeInterval = 32; inactiveInterval = 128; break;
                default: activeInterval = 16; inactiveInterval = 64; break;
            }
            int refreshInterval = _advancedVisible.value ? activeInterval : inactiveInterval;

            // Force immediate refresh when AutoTaxSystem changed rates
            if (AutoTaxSystem.TaxRatesChanged)
            {
                AutoTaxSystem.TaxRatesChanged = false;
                _updateCounter = 0;
                ReadGameTaxRates();
                UpdateProductionData();
                return;
            }

            if (_updateCounter >= refreshInterval)
            {
                _updateCounter = 0;
                ReadGameTaxRates();
                UpdateProductionData();
            }
        }

        private bool ReadGameTaxRates()
        {
            if (_taxSystem == null) return false;

            try
            {
                bool anyChanged = false;

                foreach (var kvp in ResourceKeyToEnum)
                {
                    if (!_resourceRows.TryGetValue(kvp.Key, out var row)) continue;
                    if (!ResourceTaxAreaMap.TryGetValue(kvp.Key, out var area)) continue;

                    int gameRate;
                    switch (area)
                    {
                        case ResourceTaxArea.Industrial:
                            gameRate = _taxSystem.GetIndustrialTaxRate(kvp.Value);
                            break;
                        case ResourceTaxArea.Commercial:
                            gameRate = _taxSystem.GetCommercialTaxRate(kvp.Value);
                            break;
                        case ResourceTaxArea.Office:
                            gameRate = _taxSystem.GetOfficeTaxRate(kvp.Value);
                            break;
                        default:
                            continue;
                    }

                    if (row.TaxRate != gameRate)
                    {
                        row.TaxRate = gameRate;
                        anyChanged = true;
                    }
                }

                if (anyChanged)
                {
                    _resourceRowsData.Update(SerializeRows());
                }

                return true;
            }
            catch (Exception ex)
            {
                if (_debugEnabled.value)
                {
                    Mod.log.Warn($"ReadGameTaxRates failed: {ex.Message}");
                }
                return false;
            }
        }

        private void WriteGameTaxRate(string resourceKey, int rate)
        {
            if (_taxSystem == null) return;
            if (!ResourceKeyToEnum.TryGetValue(resourceKey, out var resource)) return;
            if (!ResourceTaxAreaMap.TryGetValue(resourceKey, out var area)) return;

            try
            {
                switch (area)
                {
                    case ResourceTaxArea.Industrial:
                        _taxSystem.SetIndustrialTaxRate(resource, rate);
                        break;
                    case ResourceTaxArea.Commercial:
                        _taxSystem.SetCommercialTaxRate(resource, rate);
                        break;
                    case ResourceTaxArea.Office:
                        _taxSystem.SetOfficeTaxRate(resource, rate);
                        break;
                }
            }
            catch (Exception ex)
            {
                if (_debugEnabled.value)
                {
                    Mod.log.Warn($"WriteGameTaxRate({resourceKey}, {rate}) failed: {ex.Message}");
                }
            }
        }

        private void UpdateProductionData()
        {
            if (_countCompanyDataSystem == null) return;

            try
            {
                JobHandle productionDeps;
                NativeArray<int> productionArray = _countCompanyDataSystem.GetProduction(out productionDeps);
                productionDeps.Complete();

                NativeArray<int> industrialConsumption = default;
                bool hasIndustrialConsumption = false;
                if (_industrialDemandSystem != null)
                {
                    try
                    {
                        JobHandle consumptionDeps;
                        industrialConsumption = _industrialDemandSystem.GetConsumption(out consumptionDeps);
                        consumptionDeps.Complete();
                        hasIndustrialConsumption = industrialConsumption.IsCreated && industrialConsumption.Length > 0;
                    }
                    catch { }
                }

                NativeArray<int> commercialConsumption = default;
                bool hasCommercialConsumption = false;
                if (_commercialDemandSystem != null)
                {
                    try
                    {
                        JobHandle commercialDeps;
                        commercialConsumption = _commercialDemandSystem.GetConsumption(out commercialDeps);
                        commercialDeps.Complete();
                        hasCommercialConsumption = commercialConsumption.IsCreated && commercialConsumption.Length > 0;
                    }
                    catch { }
                }

                // Get industrial company data for production company counts, workers, demand
                NativeArray<int> industrialProductionCompanies = default;
                NativeArray<int> industrialMaxWorkers = default;
                NativeArray<int> industrialCurrentWorkers = default;
                NativeArray<int> industrialDemand = default;
                bool hasIndustrialCompanyData = false;
                try
                {
                    JobHandle industrialCompanyDeps;
                    var industrialData = _countCompanyDataSystem.GetIndustrialCompanyDatas(out industrialCompanyDeps);
                    industrialCompanyDeps.Complete();
                    industrialProductionCompanies = industrialData.m_ProductionCompanies;
                    industrialMaxWorkers = industrialData.m_MaxProductionWorkers;
                    industrialCurrentWorkers = industrialData.m_CurrentProductionWorkers;
                    industrialDemand = industrialData.m_Demand;
                    hasIndustrialCompanyData = industrialProductionCompanies.IsCreated && industrialProductionCompanies.Length > 0;
                }
                catch { }

                // Get commercial company data for service resources (ProduceCapacity, TotalAvailables, ServiceCompanies, Workers)
                NativeArray<int> commercialProduceCapacity = default;
                NativeArray<int> commercialTotalAvailables = default;
                NativeArray<int> commercialCurrentAvailables = default;
                NativeArray<int> commercialServiceCompanies = default;
                NativeArray<int> commercialMaxWorkers = default;
                NativeArray<int> commercialCurrentWorkers = default;
                bool hasCommercialCompanyData = false;
                try
                {
                    JobHandle commercialCompanyDeps;
                    var commercialData = _countCompanyDataSystem.GetCommercialCompanyDatas(out commercialCompanyDeps);
                    commercialCompanyDeps.Complete();
                    commercialProduceCapacity = commercialData.m_ProduceCapacity;
                    commercialTotalAvailables = commercialData.m_TotalAvailables;
                    commercialCurrentAvailables = commercialData.m_CurrentAvailables;
                    commercialServiceCompanies = commercialData.m_ServiceCompanies;
                    commercialMaxWorkers = commercialData.m_MaxServiceWorkers;
                    commercialCurrentWorkers = commercialData.m_CurrentServiceWorkers;
                    hasCommercialCompanyData = commercialProduceCapacity.IsCreated && commercialProduceCapacity.Length > 0;
                }
                catch { }

                bool anyChanged = false;

                foreach (var kvp in ResourceKeyToEnum)
                {
                    if (!_resourceRows.TryGetValue(kvp.Key, out var row)) continue;
                    if (!ResourceTaxAreaMap.TryGetValue(kvp.Key, out var taxArea)) continue;

                    int resourceIndex = EconomyUtils.GetResourceIndex(kvp.Value);
                    if (resourceIndex < 0) continue;

                    int productionRaw = 0;
                    int consumptionRaw = 0;
                    bool useCommercialData = taxArea == ResourceTaxArea.Office || taxArea == ResourceTaxArea.Commercial;
                    bool isService = row.Stage == "Retail" || row.Stage == "Immaterial";

                    if (useCommercialData && hasCommercialCompanyData)
                    {
                        // Service/commercial resources: use ProduceCapacity and TotalAvailables
                        if (resourceIndex < commercialProduceCapacity.Length)
                        {
                            productionRaw = Math.Max(0, commercialProduceCapacity[resourceIndex]);
                        }
                        // Consumption for services = TotalAvailables - CurrentAvailables (services consumed)
                        if (resourceIndex < commercialTotalAvailables.Length && resourceIndex < commercialCurrentAvailables.Length)
                        {
                            int total = Math.Max(0, commercialTotalAvailables[resourceIndex]);
                            int current = Math.Max(0, commercialCurrentAvailables[resourceIndex]);
                            consumptionRaw = Math.Max(0, total - current);
                        }
                        // If produce capacity is 0, try the standard production array as fallback
                        if (productionRaw == 0 && resourceIndex < productionArray.Length)
                        {
                            productionRaw = Math.Max(0, productionArray[resourceIndex]);
                        }
                    }
                    else
                    {
                        // Industrial/raw resources: use standard production + demand consumption
                        if (resourceIndex < productionArray.Length)
                        {
                            productionRaw = Math.Max(0, productionArray[resourceIndex]);
                        }

                        if (hasIndustrialConsumption && resourceIndex < industrialConsumption.Length)
                        {
                            consumptionRaw += Math.Max(0, industrialConsumption[resourceIndex]);
                        }

                        if (hasCommercialConsumption && resourceIndex < commercialConsumption.Length)
                        {
                            consumptionRaw += Math.Max(0, commercialConsumption[resourceIndex]);
                        }
                    }

                    float prodTonnes = productionRaw / 1000f;
                    float consTonnes = consumptionRaw / 1000f;
                    float surplus = Math.Max(0f, prodTonnes - consTonnes);
                    float deficit = Math.Max(0f, consTonnes - prodTonnes);

                    // Get company count for this resource
                    int companyCount = 0;
                    if (!useCommercialData && hasIndustrialCompanyData && resourceIndex < industrialProductionCompanies.Length)
                    {
                        companyCount += Math.Max(0, industrialProductionCompanies[resourceIndex]);
                    }
                    if (useCommercialData && hasCommercialCompanyData && commercialServiceCompanies.IsCreated && resourceIndex < commercialServiceCompanies.Length)
                    {
                        companyCount += Math.Max(0, commercialServiceCompanies[resourceIndex]);
                    }

                    // Get workers and demand for this resource
                    int maxWorkers = 0;
                    int currentWorkers = 0;
                    float demand = 0f;
                    if (useCommercialData)
                    {
                        if (hasCommercialCompanyData && commercialMaxWorkers.IsCreated && resourceIndex < commercialMaxWorkers.Length)
                        {
                            maxWorkers = Math.Max(0, commercialMaxWorkers[resourceIndex]);
                        }
                        if (hasCommercialCompanyData && commercialCurrentWorkers.IsCreated && resourceIndex < commercialCurrentWorkers.Length)
                        {
                            currentWorkers = Math.Max(0, commercialCurrentWorkers[resourceIndex]);
                        }
                    }
                    else
                    {
                        if (hasIndustrialCompanyData && industrialMaxWorkers.IsCreated && resourceIndex < industrialMaxWorkers.Length)
                        {
                            maxWorkers = Math.Max(0, industrialMaxWorkers[resourceIndex]);
                        }
                        if (hasIndustrialCompanyData && industrialCurrentWorkers.IsCreated && resourceIndex < industrialCurrentWorkers.Length)
                        {
                            currentWorkers = Math.Max(0, industrialCurrentWorkers[resourceIndex]);
                        }
                        if (hasIndustrialCompanyData && industrialDemand.IsCreated && resourceIndex < industrialDemand.Length)
                        {
                            demand = Math.Max(0, industrialDemand[resourceIndex]) / 1000f;
                        }
                    }

                    if (Math.Abs(row.Production - prodTonnes) > 0.01f ||
                        Math.Abs(row.Consumption - consTonnes) > 0.01f ||
                        Math.Abs(row.Surplus - surplus) > 0.01f ||
                        Math.Abs(row.Deficit - deficit) > 0.01f ||
                        row.IsService != isService ||
                        row.CompanyCount != companyCount ||
                        row.MaxWorkers != maxWorkers ||
                        row.CurrentWorkers != currentWorkers ||
                        Math.Abs(row.Demand - demand) > 0.01f)
                    {
                        row.Production = prodTonnes;
                        row.Consumption = consTonnes;
                        row.Surplus = surplus;
                        row.Deficit = deficit;
                        row.IsService = isService;
                        row.CompanyCount = companyCount;
                        row.MaxWorkers = maxWorkers;
                        row.CurrentWorkers = currentWorkers;
                        row.Demand = demand;
                        anyChanged = true;
                    }

                    float resourceIncome = 0f;
                    string incomeSource = "statistics";

                    if (_cityStatisticsSystem != null)
                    {
                        StatisticType statType;
                        switch (taxArea)
                        {
                            case ResourceTaxArea.Industrial:
                                statType = StatisticType.IndustrialTaxableIncome;
                                break;
                            case ResourceTaxArea.Commercial:
                                statType = StatisticType.CommercialTaxableIncome;
                                break;
                            case ResourceTaxArea.Office:
                                statType = StatisticType.OfficeTaxableIncome;
                                break;
                            default:
                                statType = StatisticType.IndustrialTaxableIncome;
                                break;
                        }

                        int taxableIncome = _cityStatisticsSystem.GetStatisticValue(statType, resourceIndex);
                        resourceIncome = taxableIncome * row.TaxRate / 100f;
                    }

                    if (Math.Abs(row.TaxIncome - resourceIncome) > 0.5f)
                    {
                        row.TaxIncome = resourceIncome;
                        row.IncomeSource = incomeSource;
                        anyChanged = true;
                    }
                    else if (row.IncomeSource != incomeSource)
                    {
                        row.IncomeSource = incomeSource;
                        anyChanged = true;
                    }
                }

                if (anyChanged)
                {
                    _resourceRowsData.Update(SerializeRows());
                }
            }
            catch (Exception ex)
            {
                if (_debugEnabled.value)
                {
                    Mod.log.Warn($"Production data update failed: {ex.Message}");
                }
            }
        }

        private void ToggleAdvancedWindow()
        {
            _advancedVisible.Update(!_advancedVisible.value);

            if (_advancedVisible.value)
            {
                ReadGameTaxRates();
                UpdateProductionData();
            }

            SetLastAction($"toggleAdvancedWindow:{_advancedVisible.value}");
        }

        private void SetGlobalTaxRate(int rate)
        {
            var clampedRate = ClampRate(rate);
            _globalTaxRate.Update(clampedRate);
            foreach (var row in _resourceRows.Values)
            {
                row.TaxRate = clampedRate;
                WriteGameTaxRate(row.Key, clampedRate);
            }
            _resourceRowsData.Update(SerializeRows());

            if (Mod.Settings != null)
            {
                Mod.Settings.DefaultGlobalTaxRate = clampedRate;
                Mod.Settings.ApplyAndSave();
            }

            SetLastAction($"setGlobalTaxRate:{clampedRate}");
        }

        private void SetResourceTaxRate(string payload)
        {
            if (string.IsNullOrWhiteSpace(payload)) return;
            var parts = payload.Split(':');
            if (parts.Length != 2 || !_resourceRows.TryGetValue(parts[0], out var row)) return;
            if (!int.TryParse(parts[1], out var parsedRate)) return;

            row.TaxRate = ClampRate(parsedRate);
            WriteGameTaxRate(row.Key, row.TaxRate);
            _resourceRowsData.Update(SerializeRows());
            SetLastAction($"setResourceTaxRate:{row.Key}:{row.TaxRate}");
        }

        private void SetResourceCategory(string category)
        {
            _selectedResourceCategory.Update(string.IsNullOrWhiteSpace(category) ? "All" : category);
            SetLastAction($"setResourceCategory:{_selectedResourceCategory.value}");
        }

        private void SetDebugEnabled(bool enabled)
        {
            _debugEnabled.Update(enabled);
            if (Mod.Settings != null)
            {
                Mod.Settings.DebugEnabled = enabled;
                Mod.Settings.ApplyAndSave();
            }
            SetLastAction($"setDebugEnabled:{enabled}");
        }

        private void SetShowTips(bool enabled)
        {
            _showTips.Update(enabled);
            if (Mod.Settings != null)
            {
                Mod.Settings.ShowTips = enabled;
                Mod.Settings.ApplyAndSave();
            }
            SetLastAction($"setShowTips:{enabled}");
        }

        private void ToggleDebugPanel()
        {
            _debugPanelVisible.Update(!_debugPanelVisible.value);
            if (Mod.Settings != null)
            {
                Mod.Settings.ShowDebugPanel = _debugPanelVisible.value;
                Mod.Settings.ApplyAndSave();
            }
            SetLastAction($"toggleDebugPanel:{_debugPanelVisible.value}");
        }

        private void SetAdvancedWindowRect(string payload)
        {
            if (string.IsNullOrWhiteSpace(payload)) return;
            var parts = payload.Split(',');
            if (parts.Length != 4) return;
            if (!int.TryParse(parts[0], out var x) || !int.TryParse(parts[1], out var y) || !int.TryParse(parts[2], out var width) || !int.TryParse(parts[3], out var height)) return;

            x = x < 20 ? 20 : x;
            y = y < 20 ? 20 : y;
            width = width < 360 ? 360 : width;
            height = height < 240 ? 240 : height;

            _advancedWindowX.Update(x);
            _advancedWindowY.Update(y);
            _advancedWindowWidth.Update(width);
            _advancedWindowHeight.Update(height);

            if (Mod.Settings != null)
            {
                Mod.Settings.AdvancedWindowX = x;
                Mod.Settings.AdvancedWindowY = y;
                Mod.Settings.AdvancedWindowWidth = width;
                Mod.Settings.AdvancedWindowHeight = height;
                Mod.Settings.ApplyAndSave();
            }

            SetLastAction($"setAdvancedWindowRect:{x},{y},{width},{height}");
        }

        private void ResetDefaults()
        {
            Mod.Settings?.SetDefaults();
            Mod.Settings?.ApplyAndSave();

            _globalTaxRate.Update(Mod.Settings?.DefaultGlobalTaxRate ?? 15);
            _debugEnabled.Update(Mod.Settings?.DebugEnabled ?? false);
            _debugPanelVisible.Update(Mod.Settings?.ShowDebugPanel ?? false);
            _showTips.Update(Mod.Settings?.ShowTips ?? true);
            _advancedWindowX.Update(Mod.Settings?.AdvancedWindowX ?? 140);
            _advancedWindowY.Update(Mod.Settings?.AdvancedWindowY ?? 150);
            _advancedWindowWidth.Update(Mod.Settings?.AdvancedWindowWidth ?? 520);
            _advancedWindowHeight.Update(Mod.Settings?.AdvancedWindowHeight ?? 420);

            // Re-read actual game tax rates instead of overriding with defaults
            _initialTaxRatesLoaded = false;
            ReadGameTaxRates();

            SetLastAction("resetDefaults");
        }

        private int ClampRate(int rate) => rate < -10 ? -10 : (rate > 30 ? 30 : rate);

        private string SerializeRows()
        {
            return string.Join(";", _resourceRows.Values.Select(r => string.Format(CultureInfo.InvariantCulture,
                "{0}|{1}|{2}|{3:0.##}|{4:0.##}|{5}|{6:0.##}|{7:0.##}|{8:0.#}|{9}|{10}|{11}|{12}|{13}|{14}|{15:0.##}",
                r.Key,
                r.Label,
                r.Stage,
                r.Production,
                r.Consumption,
                r.TaxRate,
                r.Surplus,
                r.Deficit,
                r.TaxIncome,
                r.IncomeSource ?? "unknown",
                ResourceKeyToEnum.TryGetValue(r.Key, out var res) ? EconomyUtils.GetResourceIndex(res) : -1,
                r.IsService ? "1" : "0",
                r.CompanyCount,
                r.MaxWorkers,
                r.CurrentWorkers,
                r.Demand)));
        }

        private class ResourceRowState
        {
            public ResourceRowState(string key, string label, string stage, float production, float consumption, int taxRate)
            {
                Key = key;
                Label = label;
                Stage = stage;
                Production = production;
                Consumption = consumption;
                TaxRate = taxRate;
            }

            public string Key { get; }
            public string Label { get; }
            public string Stage { get; }
            public float Production { get; set; }
            public float Consumption { get; set; }
            public int TaxRate { get; set; }
            public float Surplus { get; set; }
            public float Deficit { get; set; }
            public float TaxIncome { get; set; }
            public string IncomeSource { get; set; } = "unknown";
            public bool IsService { get; set; }
            public int CompanyCount { get; set; }
            public int MaxWorkers { get; set; }
            public int CurrentWorkers { get; set; }
            public float Demand { get; set; }
        }

        private void SetLastAction(string action)
        {
            _debugLastAction.Update(action);
            if (_debugEnabled.value)
            {
                Mod.log.Info($"TPM action: {action}");
            }
        }
    }
}

