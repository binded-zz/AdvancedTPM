using Colossal.UI.Binding;
using Game.City;
using Game.Economy;
using Game.Simulation;
using Game.UI;
using System;
using System.Collections.Generic;
using System.Globalization;
using Unity.Collections;
using Unity.Entities;
using Unity.Jobs;

namespace AdvancedTPM
{
    public partial class AutoTaxSystem : UISystemBase
    {
        private ValueBinding<bool> _autoTaxEnabled;
        private ValueBinding<string> _autoTaxStatus;
        private ValueBinding<string> _autoTaxSettings;

        private TaxSystem _taxSystem;
        private CountCompanyDataSystem _countCompanyDataSystem;
        private IndustrialDemandSystem _industrialDemandSystem;
        private CommercialDemandSystem _commercialDemandSystem;
        private CityStatisticsSystem _cityStatisticsSystem;
        private CompanyBrowserSystem _companyBrowserSystem;
        private AdaptiveLearningSystem _adaptiveLearningSystem;
        private SimulationSystem _simulationSystem;

        private int _tickCounter;
        private bool _firstRunPending;

        // Set by AutoTaxSystem after adjustments so TaxingProductionUISystem forces a re-read
        public static volatile bool TaxRatesChanged;

        // Per-resource exclusion: resources in this set are skipped by auto-tax
        private readonly HashSet<string> _excludedResources = new HashSet<string>();

        // Per-resource min/max tax rate overrides (key → (min, max)); absent = use global
        private readonly Dictionary<string, (int min, int max)> _perResourceRanges = new Dictionary<string, (int min, int max)>();

        private enum ResourceTaxArea { Industrial, Commercial, Office }

        // Per-resource auto-tax state: tracks direction and score for UI display
        private readonly Dictionary<string, AutoTaxResourceState> _resourceStates = new Dictionary<string, AutoTaxResourceState>();

        // Same mappings as TaxingProductionUISystem — resource key → tax area and enum
        private static readonly Dictionary<string, ResourceTaxArea> ResourceTaxAreaMap = new Dictionary<string, ResourceTaxArea>
        {
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
            ["software"] = ResourceTaxArea.Office,
            ["telecom"] = ResourceTaxArea.Office,
            ["financial"] = ResourceTaxArea.Office,
            ["media"] = ResourceTaxArea.Office,
            ["lodging"] = ResourceTaxArea.Commercial,
            ["meals"] = ResourceTaxArea.Commercial,
            ["entertainment"] = ResourceTaxArea.Commercial,
            ["recreation"] = ResourceTaxArea.Commercial,
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
            ["software"]        = Resource.Software,
            ["telecom"]         = Resource.Telecom,
            ["financial"]       = Resource.Financial,
            ["media"]           = Resource.Media,
            ["lodging"]         = Resource.Lodging,
            ["meals"]           = Resource.Meals,
            ["entertainment"]   = Resource.Entertainment,
            ["recreation"]      = Resource.Recreation,
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

        protected override void OnCreate()
        {
            base.OnCreate();

            foreach (var key in ResourceKeyToEnum.Keys)
            {
                _resourceStates[key] = new AutoTaxResourceState();
            }

            try { _taxSystem = World.GetOrCreateSystemManaged<TaxSystem>(); } catch { }
            try { _countCompanyDataSystem = World.GetOrCreateSystemManaged<CountCompanyDataSystem>(); } catch { }
            try { _industrialDemandSystem = World.GetOrCreateSystemManaged<IndustrialDemandSystem>(); } catch { }
            try { _commercialDemandSystem = World.GetOrCreateSystemManaged<CommercialDemandSystem>(); } catch { }
            try { _cityStatisticsSystem = World.GetOrCreateSystemManaged<CityStatisticsSystem>(); } catch { }
            try { _companyBrowserSystem = World.GetOrCreateSystemManaged<CompanyBrowserSystem>(); } catch { }
            try { _adaptiveLearningSystem = World.GetOrCreateSystemManaged<AdaptiveLearningSystem>(); } catch { }
            try { _simulationSystem = World.GetOrCreateSystemManaged<SimulationSystem>(); } catch { }

            var settings = Mod.Settings;
            LoadExcludedResources(settings);
            LoadPerResourceRanges(settings);

            AddBinding(_autoTaxEnabled = new ValueBinding<bool>("taxProduction", "autoTaxEnabled", settings?.AutoTaxEnabled ?? false));
            AddBinding(_autoTaxStatus = new ValueBinding<string>("taxProduction", "autoTaxStatus", ""));
            AddBinding(_autoTaxSettings = new ValueBinding<string>("taxProduction", "autoTaxSettings", SerializeSettings(settings)));

            AddBinding(new TriggerBinding<bool>("taxProduction", "setAutoTaxEnabled", SetAutoTaxEnabled));
            AddBinding(new TriggerBinding<string>("taxProduction", "setAutoTaxSettings", ApplyAutoTaxSettings));

            Mod.log.Info("AutoTaxSystem initialized");
        }

        protected override void OnUpdate()
        {
            base.OnUpdate();

            var settings = Mod.Settings;
            if (settings == null) return;

            // Sync enabled state from settings
            if (_autoTaxEnabled.value != settings.AutoTaxEnabled)
            {
                _autoTaxEnabled.Update(settings.AutoTaxEnabled);
                if (settings.AutoTaxEnabled)
                    _firstRunPending = true;
            }

            if (!_autoTaxEnabled.value) return;
            if (_taxSystem == null || _countCompanyDataSystem == null) return;

            // First run fires immediately after enabling
            if (_firstRunPending)
            {
                _firstRunPending = false;
                _tickCounter = 0;
                Mod.log.Info("AutoTax: first run triggered");
                RunAutoTaxAdjustment(settings);
                return;
            }

            // Speed tier → frame count mapping
            // Tier 1=Very Fast (~5s), 2=Fast (~10s), 3=Normal (~20s), 4=Slow (~45s), 5=Very Slow (~90s)
            int tier = settings.AutoTaxInterval;
            if (tier < 1) tier = 1;
            if (tier > 5) tier = 5;
            int targetFrames;
            switch (tier)
            {
                case 1: targetFrames = 300; break;   // ~5s at 60fps
                case 2: targetFrames = 600; break;   // ~10s
                case 3: targetFrames = 1200; break;  // ~20s
                case 4: targetFrames = 2700; break;  // ~45s
                case 5: targetFrames = 5400; break;  // ~90s
                default: targetFrames = 1200; break;
            }

            _tickCounter++;
            if (_tickCounter < targetFrames) return;
            _tickCounter = 0;

            RunAutoTaxAdjustment(settings);
        }

        private void RunAutoTaxAdjustment(TPMModSettings settings)
        {
            int minRate = settings.AutoTaxMinRate;
            int maxRate = settings.AutoTaxMaxRate;
            if (minRate > maxRate) { int tmp = minRate; minRate = maxRate; maxRate = tmp; }
            int globalMin = minRate;
            int globalMax = maxRate;
            float happinessWeight = settings.AutoTaxHappinessWeight / 100f;
            float profitWeight = settings.AutoTaxProfitWeight / 100f;

            // Get city wellbeing as happiness proxy (0–100 scale)
            int happiness = 50;
            if (_cityStatisticsSystem != null)
            {
                try
                {
                    happiness = _cityStatisticsSystem.GetStatisticValue(StatisticType.Wellbeing);
                    happiness = Math.Max(0, Math.Min(100, happiness));
                }
                catch { }
            }

            // Happiness modifier: if happiness < 50, bias toward lowering taxes; if > 70, allow raising
            // Range: -1.0 (very unhappy, strong lower bias) to +1.0 (very happy, can raise)
            float happinessBias = (happiness - 50f) / 50f;

            // Get production data
            NativeArray<int> productionArray = default;
            bool hasProduction = false;
            try
            {
                JobHandle prodDeps;
                productionArray = _countCompanyDataSystem.GetProduction(out prodDeps);
                prodDeps.Complete();
                hasProduction = productionArray.IsCreated && productionArray.Length > 0;
            }
            catch { }

            NativeArray<int> industrialConsumption = default;
            bool hasIndustrialConsumption = false;
            if (_industrialDemandSystem != null)
            {
                try
                {
                    JobHandle consDeps;
                    industrialConsumption = _industrialDemandSystem.GetConsumption(out consDeps);
                    consDeps.Complete();
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
                    JobHandle commDeps;
                    commercialConsumption = _commercialDemandSystem.GetConsumption(out commDeps);
                    commDeps.Complete();
                    hasCommercialConsumption = commercialConsumption.IsCreated && commercialConsumption.Length > 0;
                }
                catch { }
            }

            // Get company data
            NativeArray<int> industrialCompanies = default;
            NativeArray<int> industrialDemand = default;
            bool hasIndustrialData = false;
            try
            {
                JobHandle indDeps;
                var indData = _countCompanyDataSystem.GetIndustrialCompanyDatas(out indDeps);
                indDeps.Complete();
                industrialCompanies = indData.m_ProductionCompanies;
                industrialDemand = indData.m_Demand;
                hasIndustrialData = industrialCompanies.IsCreated && industrialCompanies.Length > 0;
            }
            catch { }

            NativeArray<int> commercialCompanies = default;
            NativeArray<int> commercialCapacity = default;
            NativeArray<int> commercialAvailables = default;
            bool hasCommercialData = false;
            try
            {
                JobHandle comDeps;
                var comData = _countCompanyDataSystem.GetCommercialCompanyDatas(out comDeps);
                comDeps.Complete();
                commercialCompanies = comData.m_ServiceCompanies;
                commercialCapacity = comData.m_ProduceCapacity;
                commercialAvailables = comData.m_TotalAvailables;
                hasCommercialData = commercialCompanies.IsCreated && commercialCompanies.Length > 0;
            }
            catch { }

            int adjustCount = 0;
            int raiseCount = 0;
            int lowerCount = 0;
            int holdCount = 0;

            foreach (var kvp in ResourceKeyToEnum)
            {
                string key = kvp.Key;
                Resource resource = kvp.Value;
                if (!ResourceTaxAreaMap.TryGetValue(key, out var taxArea)) continue;
                if (!_resourceStates.TryGetValue(key, out var state)) continue;

                // Skip excluded resources
                if (_excludedResources.Contains(key))
                {
                    state.Direction = 0;
                    state.Score = 0f;
                    holdCount++;
                    continue;
                }

                int resourceIndex = EconomyUtils.GetResourceIndex(resource);
                if (resourceIndex < 0) continue;

                // Read current game tax rate
                int currentRate;
                switch (taxArea)
                {
                    case ResourceTaxArea.Industrial:
                        currentRate = _taxSystem.GetIndustrialTaxRate(resource);
                        break;
                    case ResourceTaxArea.Commercial:
                        currentRate = _taxSystem.GetCommercialTaxRate(resource);
                        break;
                    case ResourceTaxArea.Office:
                        currentRate = _taxSystem.GetOfficeTaxRate(resource);
                        break;
                    default:
                        continue;
                }

                bool useCommercialData = taxArea == ResourceTaxArea.Office || taxArea == ResourceTaxArea.Commercial;

                // Calculate profitability score (-1.0 to +1.0)
                // Positive = companies thriving, can raise tax
                // Negative = companies struggling, should lower tax
                float profitabilityScore = 0f;
                float f1_balance = 0f;
                float f3_demand = 0f;
                float f4_income = 0f;

                // Factor 1: Production vs Consumption balance (surplus = good)
                int prodRaw = 0;
                int consRaw = 0;

                if (useCommercialData && hasCommercialData)
                {
                    if (resourceIndex < commercialCapacity.Length)
                        prodRaw = Math.Max(0, commercialCapacity[resourceIndex]);
                    if (resourceIndex < commercialAvailables.Length)
                        consRaw = Math.Max(0, commercialAvailables[resourceIndex]);
                }
                else
                {
                    if (hasProduction && resourceIndex < productionArray.Length)
                        prodRaw = Math.Max(0, productionArray[resourceIndex]);
                    if (hasIndustrialConsumption && resourceIndex < industrialConsumption.Length)
                        consRaw += Math.Max(0, industrialConsumption[resourceIndex]);
                    if (hasCommercialConsumption && resourceIndex < commercialConsumption.Length)
                        consRaw += Math.Max(0, commercialConsumption[resourceIndex]);
                }

                if (prodRaw > 0 || consRaw > 0)
                {
                    float balance = (prodRaw - consRaw) / (float)Math.Max(prodRaw, consRaw);
                    // Surplus (balance > 0): healthy, score positive. Deficit (balance < 0): struggling.
                    f1_balance = balance * 0.4f;
                    profitabilityScore += f1_balance;
                }

                // Factor 2: Company count
                int companies = 0;
                if (!useCommercialData && hasIndustrialData && resourceIndex < industrialCompanies.Length)
                    companies = Math.Max(0, industrialCompanies[resourceIndex]);
                if (useCommercialData && hasCommercialData && resourceIndex < commercialCompanies.Length)
                    companies = Math.Max(0, commercialCompanies[resourceIndex]);

                // For Industrial/Commercial: skip if no companies at all
                // For Office: company count isn't in commercial arrays, so check taxable income instead
                if (companies == 0 && taxArea != ResourceTaxArea.Office)
                {
                    state.Direction = 0;
                    state.Score = 0f;
                    holdCount++;
                    continue;
                }

                // Factor 3: Demand signal (high demand = companies can handle more tax)
                if (!useCommercialData && hasIndustrialData && industrialDemand.IsCreated && resourceIndex < industrialDemand.Length)
                {
                    int demandRaw = Math.Max(0, industrialDemand[resourceIndex]);
                    if (demandRaw > 0 && prodRaw > 0)
                    {
                        float demandRatio = demandRaw / (float)prodRaw;
                        f3_demand = Math.Min(0.3f, demandRatio * 0.15f);
                        profitabilityScore += f3_demand;
                    }
                }

                // Factor 4: Taxable income signal (high income = companies profitable)
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
                        default:
                            statType = StatisticType.OfficeTaxableIncome;
                            break;
                    }

                    try
                    {
                        int taxableIncome = _cityStatisticsSystem.GetStatisticValue(statType, resourceIndex);
                        if (taxableIncome > 0)
                        {
                            if (companies > 0)
                            {
                                float perCompanyIncome = taxableIncome / (float)companies;
                                float incomeScore = Math.Min(0.3f, Math.Max(-0.3f, (perCompanyIncome - 500f) / 2000f));
                                f4_income = incomeScore;
                                profitabilityScore += incomeScore;
                            }
                            else
                            {
                                // Office: no company count available, use raw income as signal
                                float incomeScore = Math.Min(0.3f, Math.Max(-0.3f, (taxableIncome - 5000f) / 20000f));
                                f4_income = incomeScore;
                                profitabilityScore += incomeScore;
                            }
                        }
                        else if (taxableIncome == 0)
                        {
                            if (taxArea == ResourceTaxArea.Office)
                            {
                                // Office with zero income = no activity, hold
                                state.Direction = 0;
                                state.Score = 0f;
                                holdCount++;
                                continue;
                            }
                            if (currentRate > 0)
                            {
                                f4_income = -0.15f;
                                profitabilityScore -= 0.15f;
                            }
                        }
                    }
                    catch { }
                }

                // Factor 5: Real company profitability from CompanyBrowserSystem
                // This is the most direct signal — actual profit/loss from ECS entities
                float companyProfitSignal = 0f;
                float rawAvgProfit = 0f;
                if (_companyBrowserSystem != null)
                {
                    try
                    {
                        var avgProfits = _companyBrowserSystem.AvgProfitByResource;
                        if (avgProfits != null && avgProfits.TryGetValue(resource, out float avgProfit))
                        {
                            rawAvgProfit = avgProfit;
                            // avgProfit is %-based: -100 (bankrupt) to +100 (very profitable)
                            // Scale to ±0.4 signal — strongest single factor when profitWeight is high
                            companyProfitSignal = Math.Max(-0.4f, Math.Min(0.4f, avgProfit / 150f));
                        }
                    }
                    catch { }
                }

                // Factor 6: Adaptive learned sensitivity from AdaptiveLearningSystem
                // Applies a modifier based on observed city responses to past tax changes
                float learnedSignal = 0f;
                if (_adaptiveLearningSystem != null)
                {
                    learnedSignal = _adaptiveLearningSystem.GetLearnedSensitivity(key);
                    // Clamp to ±0.3 to prevent learned data from overwhelming other factors
                    learnedSignal = Math.Max(-0.3f, Math.Min(0.3f, learnedSignal));
                }

                // Blend: profitWeight controls balance between macro signals (Factors 1-4) and real profit (Factor 5)
                // At profitWeight=0: 100% macro, 0% real profit
                // At profitWeight=50%: 50% macro, 50% real profit
                // At profitWeight=100%: 0% macro, 100% real profit
                float blendedScore = profitabilityScore * (1f - profitWeight) + companyProfitSignal * profitWeight;

                // Add learned signal: scaled by confidence (already embedded in GetLearnedSensitivity)
                blendedScore += learnedSignal;

                // Apply happiness weight
                // Happiness acts as an asymmetric gate — NOT an additive score component:
                //   Low happiness (<50): strong negative pressure forces tax lowering
                //   Medium happiness (50-70): neutral — profitability alone drives decisions
                //   High happiness (>70): mild positive bonus, but does NOT force raises
                float happinessContrib;
                if (happiness < 50)
                {
                    // Full negative pressure when citizens are unhappy
                    happinessContrib = happinessBias * happinessWeight;
                }
                else
                {
                    // Only 20% positive credit when happy — permits but doesn't force raises
                    happinessContrib = happinessBias * happinessWeight * 0.2f;
                }

                // Tax rate drag: higher current rates create increasing downward pressure
                // This prevents the one-way ratchet to maxRate and creates natural equilibrium
                // At rate 5: -0.04, 10: -0.08, 15: -0.13, 20: -0.19, 25: -0.25, 30: -0.32
                float rateDrag = -((float)currentRate / 150f) * (1f + (float)currentRate / 50f);

                float finalScore = blendedScore * (1f - happinessWeight) + happinessContrib + rateDrag;

                // Clamp final score
                finalScore = Math.Max(-1f, Math.Min(1f, finalScore));

                // Store factor breakdown on state for UI
                state.BalanceFactor = f1_balance;
                state.DemandFactor = f3_demand;
                state.IncomeFactor = f4_income;
                state.ProfitFactor = companyProfitSignal;
                state.HappinessFactor = happinessContrib;
                state.RateDrag = rateDrag;
                state.Companies = companies;
                state.AvgProfit = rawAvgProfit;
                state.LearnedFactor = learnedSignal;

                // Determine per-resource or global min/max
                int effectiveMin = globalMin;
                int effectiveMax = globalMax;
                if (_perResourceRanges.TryGetValue(key, out var customRange))
                {
                    effectiveMin = customRange.min;
                    effectiveMax = customRange.max;
                    if (effectiveMin > effectiveMax) { int tmp2 = effectiveMin; effectiveMin = effectiveMax; effectiveMax = tmp2; }
                }

                // Immediately enforce range: if current rate is outside custom bounds, clamp it now
                if (currentRate > effectiveMax)
                {
                    switch (taxArea)
                    {
                        case ResourceTaxArea.Industrial:
                            _taxSystem.SetIndustrialTaxRate(resource, effectiveMax);
                            break;
                        case ResourceTaxArea.Commercial:
                            _taxSystem.SetCommercialTaxRate(resource, effectiveMax);
                            break;
                        case ResourceTaxArea.Office:
                            _taxSystem.SetOfficeTaxRate(resource, effectiveMax);
                            break;
                    }
                    state.Direction = -1;
                    state.Score = finalScore;
                    adjustCount++;
                    lowerCount++;
                    continue;
                }
                else if (currentRate < effectiveMin)
                {
                    switch (taxArea)
                    {
                        case ResourceTaxArea.Industrial:
                            _taxSystem.SetIndustrialTaxRate(resource, effectiveMin);
                            break;
                        case ResourceTaxArea.Commercial:
                            _taxSystem.SetCommercialTaxRate(resource, effectiveMin);
                            break;
                        case ResourceTaxArea.Office:
                            _taxSystem.SetOfficeTaxRate(resource, effectiveMin);
                            break;
                    }
                    state.Direction = 1;
                    state.Score = finalScore;
                    adjustCount++;
                    raiseCount++;
                    continue;
                }

                // Determine direction: only adjust by 1% per interval
                // Deadzone of ±0.15 prevents oscillation and creates stable hold behavior
                int direction = 0;
                if (finalScore > 0.15f && currentRate < effectiveMax)
                {
                    direction = 1; // Raise tax
                }
                else if (finalScore < -0.15f && currentRate > effectiveMin)
                {
                    direction = -1; // Lower tax
                }

                state.Direction = direction;
                state.Score = finalScore;

                if (direction != 0)
                {
                    int newRate = currentRate + direction;
                    newRate = Math.Max(effectiveMin, Math.Min(effectiveMax, newRate));

                    if (newRate != currentRate)
                    {
                        switch (taxArea)
                        {
                            case ResourceTaxArea.Industrial:
                                _taxSystem.SetIndustrialTaxRate(resource, newRate);
                                break;
                            case ResourceTaxArea.Commercial:
                                _taxSystem.SetCommercialTaxRate(resource, newRate);
                                break;
                            case ResourceTaxArea.Office:
                                _taxSystem.SetOfficeTaxRate(resource, newRate);
                                break;
                        }
                        adjustCount++;
                        if (direction > 0) raiseCount++;
                        else lowerCount++;

                        // Notify adaptive learning system of the tax change
                        try { _adaptiveLearningSystem?.RecordTaxChange(key, currentRate, newRate, _simulationSystem?.frameIndex ?? 0); } catch { }
                    }
                }
                else
                {
                    holdCount++;
                }
            }

            // Update status string for UI
            string status = SerializeStatus(happiness, adjustCount, raiseCount, lowerCount, holdCount);
            _autoTaxStatus.Update(status);

            // Signal TaxingProductionUISystem to re-read rates immediately
            if (adjustCount > 0)
            {
                TaxRatesChanged = true;
                Mod.log.Info($"AutoTax: happiness={happiness} adjusted={adjustCount} (raise={raiseCount} lower={lowerCount} hold={holdCount})");
            }
        }

        private string SerializeStatus(int happiness, int adjustCount, int raiseCount, int lowerCount, int holdCount)
        {
            // Format: happiness|adjustCount|raiseCount|lowerCount|holdCount|perResourceDirections
            // Per-resource directions: key=direction:score,key=direction:score,...
            var parts = new List<string>
            {
                happiness.ToString(CultureInfo.InvariantCulture),
                adjustCount.ToString(CultureInfo.InvariantCulture),
                raiseCount.ToString(CultureInfo.InvariantCulture),
                lowerCount.ToString(CultureInfo.InvariantCulture),
                holdCount.ToString(CultureInfo.InvariantCulture)
            };

            var resourceParts = new List<string>();
            foreach (var kvp in _resourceStates)
            {
                if (kvp.Value.Direction != 0 || Math.Abs(kvp.Value.Score) > 0.01f)
                {
                    // Format: key=direction:score:balance:demand:income:profit:happiness:rateDrag:companies:avgProfit:learned
                    resourceParts.Add(string.Format(CultureInfo.InvariantCulture,
                        "{0}={1}:{2:0.##}:{3:0.##}:{4:0.##}:{5:0.##}:{6:0.##}:{7:0.##}:{8:0.##}:{9}:{10:0.#}:{11:0.##}",
                        kvp.Key, kvp.Value.Direction, kvp.Value.Score,
                        kvp.Value.BalanceFactor, kvp.Value.DemandFactor,
                        kvp.Value.IncomeFactor, kvp.Value.ProfitFactor,
                        kvp.Value.HappinessFactor, kvp.Value.RateDrag,
                        kvp.Value.Companies, kvp.Value.AvgProfit,
                        kvp.Value.LearnedFactor));
                }
            }
            parts.Add(string.Join(",", resourceParts));

            return string.Join("|", parts);
        }

        private void SetAutoTaxEnabled(bool enabled)
        {
            _autoTaxEnabled.Update(enabled);
            if (Mod.Settings != null)
            {
                Mod.Settings.AutoTaxEnabled = enabled;
                Mod.Settings.ApplyAndSave();
            }

            if (enabled)
            {
                _firstRunPending = true;
                _tickCounter = 0;
            }
            else
            {
                // Clear all auto-tax directions
                foreach (var state in _resourceStates.Values)
                {
                    state.Direction = 0;
                    state.Score = 0f;
                }
                _autoTaxStatus.Update("");
            }

            Mod.log.Info($"AutoTax: enabled={enabled}");
        }

        /// <summary>
        /// Serialize all auto-tax settings + excluded resources + per-resource ranges into a string for the UI binding.
        /// Format: interval|minRate|maxRate|happinessWeight|updateSpeed|excludedKey1,excludedKey2,...|key:min:max,key:min:max,...
        /// </summary>
        private string SerializeSettings(TPMModSettings settings)
        {
            if (settings == null) return "3|0|25|50|2|||50|95";
            string excluded = string.Join(",", _excludedResources);
            var rangeParts = new List<string>();
            foreach (var kvp in _perResourceRanges)
            {
                rangeParts.Add(string.Format(CultureInfo.InvariantCulture, "{0}:{1}:{2}", kvp.Key, kvp.Value.min, kvp.Value.max));
            }
            string ranges = string.Join(",", rangeParts);
            return string.Format(CultureInfo.InvariantCulture,
                "{0}|{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}",
                settings.AutoTaxInterval,
                settings.AutoTaxMinRate,
                settings.AutoTaxMaxRate,
                settings.AutoTaxHappinessWeight,
                settings.UpdateSpeed,
                excluded,
                ranges,
                settings.AutoTaxProfitWeight,
                settings.AutoTaxPanelOpacity);
        }

        /// <summary>
        /// Receive updated settings from the UI settings panel.
        /// Payload format: interval|minRate|maxRate|happinessWeight|updateSpeed|excludedKey1,excludedKey2,...|key:min:max,key:min:max,...
        /// </summary>
        private void ApplyAutoTaxSettings(string payload)
        {
            if (string.IsNullOrEmpty(payload)) return;
            var parts = payload.Split('|');
            if (parts.Length < 6) return;

            var settings = Mod.Settings;
            if (settings == null) return;

            try
            {
                int interval = int.Parse(parts[0], CultureInfo.InvariantCulture);
                int minRate = int.Parse(parts[1], CultureInfo.InvariantCulture);
                int maxRate = int.Parse(parts[2], CultureInfo.InvariantCulture);
                int happinessWeight = int.Parse(parts[3], CultureInfo.InvariantCulture);
                int updateSpeed = int.Parse(parts[4], CultureInfo.InvariantCulture);
                string excludedRaw = parts[5];

                settings.AutoTaxInterval = Math.Max(1, Math.Min(5, interval));
                settings.AutoTaxMinRate = Math.Max(-10, Math.Min(30, minRate));
                settings.AutoTaxMaxRate = Math.Max(-10, Math.Min(30, maxRate));
                settings.AutoTaxHappinessWeight = Math.Max(0, Math.Min(100, happinessWeight));
                settings.UpdateSpeed = Math.Max(1, Math.Min(3, updateSpeed));

                // Parse profitWeight (slot 7) and opacity (slot 8)
                if (parts.Length > 7 && int.TryParse(parts[7], NumberStyles.Integer, CultureInfo.InvariantCulture, out int profWeight))
                    settings.AutoTaxProfitWeight = Math.Max(0, Math.Min(100, profWeight));
                if (parts.Length > 8 && int.TryParse(parts[8], NumberStyles.Integer, CultureInfo.InvariantCulture, out int opacityVal))
                    settings.AutoTaxPanelOpacity = Math.Max(40, Math.Min(100, opacityVal));

                // Parse excluded resources
                _excludedResources.Clear();
                if (!string.IsNullOrEmpty(excludedRaw))
                {
                    foreach (var key in excludedRaw.Split(','))
                    {
                        var trimmed = key.Trim();
                        if (trimmed.Length > 0 && ResourceKeyToEnum.ContainsKey(trimmed))
                            _excludedResources.Add(trimmed);
                    }
                }
                settings.AutoTaxExcludedResources = string.Join(",", _excludedResources);

                // Parse per-resource ranges (slot 6)
                _perResourceRanges.Clear();
                if (parts.Length > 6 && !string.IsNullOrEmpty(parts[6]))
                {
                    foreach (var entry in parts[6].Split(','))
                    {
                        var segments = entry.Split(':');
                        if (segments.Length == 3)
                        {
                            var rKey = segments[0].Trim();
                            if (rKey.Length > 0 && ResourceKeyToEnum.ContainsKey(rKey)
                                && int.TryParse(segments[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out int rMin)
                                && int.TryParse(segments[2], NumberStyles.Integer, CultureInfo.InvariantCulture, out int rMax))
                            {
                                rMin = Math.Max(-10, Math.Min(30, rMin));
                                rMax = Math.Max(-10, Math.Min(30, rMax));
                                _perResourceRanges[rKey] = (rMin, rMax);
                            }
                        }
                    }
                }
                settings.AutoTaxPerResourceRanges = SerializePerResourceRanges();

                settings.ApplyAndSave();
                _autoTaxSettings.Update(SerializeSettings(settings));

                Mod.log.Info($"AutoTax: settings updated -- interval={settings.AutoTaxInterval} min={settings.AutoTaxMinRate} max={settings.AutoTaxMaxRate} happiness={settings.AutoTaxHappinessWeight} profit={settings.AutoTaxProfitWeight} excluded={_excludedResources.Count} perResourceRanges={_perResourceRanges.Count}");
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"AutoTax: failed to parse settings payload: {ex.Message}");
            }
        }

        /// <summary>
        /// Load excluded resource keys from the settings comma-separated string into the HashSet.
        /// </summary>
        private void LoadExcludedResources(TPMModSettings settings)
        {
            _excludedResources.Clear();
            if (settings == null || string.IsNullOrEmpty(settings.AutoTaxExcludedResources)) return;

            foreach (var key in settings.AutoTaxExcludedResources.Split(','))
            {
                var trimmed = key.Trim();
                if (trimmed.Length > 0 && ResourceKeyToEnum.ContainsKey(trimmed))
                    _excludedResources.Add(trimmed);
            }
        }

        /// <summary>
        /// Load per-resource min/max ranges from the settings string.
        /// Format: key:min:max,key:min:max,...
        /// </summary>
        private void LoadPerResourceRanges(TPMModSettings settings)
        {
            _perResourceRanges.Clear();
            if (settings == null || string.IsNullOrEmpty(settings.AutoTaxPerResourceRanges)) return;

            foreach (var entry in settings.AutoTaxPerResourceRanges.Split(','))
            {
                var segments = entry.Split(':');
                if (segments.Length == 3)
                {
                    var rKey = segments[0].Trim();
                    if (rKey.Length > 0 && ResourceKeyToEnum.ContainsKey(rKey)
                        && int.TryParse(segments[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out int rMin)
                        && int.TryParse(segments[2], NumberStyles.Integer, CultureInfo.InvariantCulture, out int rMax))
                    {
                        _perResourceRanges[rKey] = (Math.Max(-10, Math.Min(30, rMin)), Math.Max(-10, Math.Min(30, rMax)));
                    }
                }
            }
        }

        /// <summary>
        /// Serialize per-resource ranges to a comma-separated string for settings persistence.
        /// </summary>
        private string SerializePerResourceRanges()
        {
            var parts = new List<string>();
            foreach (var kvp in _perResourceRanges)
            {
                parts.Add(string.Format(CultureInfo.InvariantCulture, "{0}:{1}:{2}", kvp.Key, kvp.Value.min, kvp.Value.max));
            }
            return string.Join(",", parts);
        }

        private class AutoTaxResourceState
        {
            public int Direction { get; set; }   // -1 = lowering, 0 = hold, +1 = raising
            public float Score { get; set; }      // -1.0 to +1.0 final score
            public float BalanceFactor { get; set; }   // Factor 1: production/consumption
            public float DemandFactor { get; set; }    // Factor 3: demand signal
            public float IncomeFactor { get; set; }    // Factor 4: taxable income
            public float ProfitFactor { get; set; }    // Factor 5: company profit
            public float HappinessFactor { get; set; } // happiness contribution
            public float RateDrag { get; set; }        // rate drag
            public int Companies { get; set; }         // company count
            public float AvgProfit { get; set; }       // raw avg profit %
            public float LearnedFactor { get; set; }   // Factor 6: adaptive learned sensitivity
        }
    }
}
