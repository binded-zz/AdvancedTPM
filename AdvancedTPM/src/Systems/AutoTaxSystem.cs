using Colossal.UI.Binding;
using Game.City;
using Game.Economy;
using Game.Simulation;
using Game.UI;
using System;
using System.Collections.Generic;
using System.Globalization;
using Unity.Burst;
using Unity.Collections;
using Unity.Entities;
using Unity.Jobs;
using Unity.Mathematics;
using AdvancedTPM.Systems;

namespace AdvancedTPM
{
    public partial class AutoTaxSystem : UISystemBase
    {
        private struct ResourceInputData
        {
            public int TaxArea; // 1 = Industrial, 2 = Commercial, 3 = Office, 0 = Invalid/Skip
            public int CurrentRate;
            public int EffectiveMin;
            public int EffectiveMax;
            public int TaxableIncome;
            public float AvgProfit;
            public float LearnedSignal;
        }

        private struct ResourceOutputData
        {
            public int Direction;
            public float Score;
            public float BalanceFactor;
            public float DemandFactor;
            public float IncomeFactor;
            public float ProfitFactor;
            public float HappinessFactor;
            public float RateDrag;
            public int Companies;
            public float AvgProfit;
            public float LearnedFactor;
            public int NewRate; 
        }

        [BurstCompile]
        private struct AutoTaxMathJob : IJob
        {
            public float HappinessBias;
            public float HappinessWeight;
            public float ProfitWeight;
            
            [ReadOnly] public NativeArray<int> Production;
            [ReadOnly] public NativeArray<int> IndustrialConsumption;
            [ReadOnly] public NativeArray<int> CommercialConsumption;
            [ReadOnly] public NativeArray<int> IndustrialCompanies;
            [ReadOnly] public NativeArray<int> IndustrialDemand;
            [ReadOnly] public NativeArray<int> CommercialCompanies;
            [ReadOnly] public NativeArray<int> CommercialCapacity;
            [ReadOnly] public NativeArray<int> CommercialAvailables;
            [ReadOnly] public NativeArray<ResourceInputData> InputData;

            public NativeArray<ResourceOutputData> OutputData;

            public void Execute()
            {
                int length = InputData.Length;
                for (int i = 0; i < length; i++)
                {
                    var input = InputData[i];
                    if (input.TaxArea == 0) continue;

                    int currentRate = input.CurrentRate;
                    int taxArea = input.TaxArea;
                    
                    if (currentRate > input.EffectiveMax)
                    {
                        OutputData[i] = new ResourceOutputData { Direction = -1, Score = -1f, NewRate = input.EffectiveMax };
                        continue;
                    }
                    else if (currentRate < input.EffectiveMin)
                    {
                        OutputData[i] = new ResourceOutputData { Direction = 1, Score = 1f, NewRate = input.EffectiveMin };
                        continue;
                    }

                    bool useCommercialData = (taxArea == 3 || taxArea == 2);
                    bool hasCommercialData = CommercialCompanies.IsCreated && CommercialCompanies.Length > 0;
                    bool hasIndustrialData = IndustrialCompanies.IsCreated && IndustrialCompanies.Length > 0;

                    float profitabilityScore = 0f;
                    float f1_balance = 0f;
                    float f3_demand = 0f;
                    float f4_income = 0f;

                    int prodRaw = 0;
                    int consRaw = 0;

                    if (useCommercialData && hasCommercialData)
                    {
                        if (i < CommercialCapacity.Length) prodRaw = math.max(0, CommercialCapacity[i]);
                        if (i < CommercialAvailables.Length) consRaw = math.max(0, CommercialAvailables[i]);
                    }
                    else
                    {
                        if (Production.IsCreated && i < Production.Length) prodRaw = math.max(0, Production[i]);
                        if (IndustrialConsumption.IsCreated && i < IndustrialConsumption.Length) consRaw += math.max(0, IndustrialConsumption[i]);
                        if (CommercialConsumption.IsCreated && i < CommercialConsumption.Length) consRaw += math.max(0, CommercialConsumption[i]);
                    }

                    if (prodRaw > 0 || consRaw > 0)
                    {
                        float balance = (prodRaw - consRaw) / (float)math.max(prodRaw, consRaw);
                        f1_balance = balance * 0.4f;
                        profitabilityScore += f1_balance;
                    }

                    int companies = 0;
                    if (!useCommercialData && hasIndustrialData && i < IndustrialCompanies.Length)
                        companies = math.max(0, IndustrialCompanies[i]);
                    if (useCommercialData && hasCommercialData && i < CommercialCompanies.Length)
                        companies = math.max(0, CommercialCompanies[i]);

                    if (companies == 0 && taxArea != 3) 
                    {
                        if (currentRate > 10)
                            OutputData[i] = new ResourceOutputData { Direction = -1, Score = -0.5f, NewRate = currentRate - 1 };
                        else
                            OutputData[i] = new ResourceOutputData { Direction = 0, Score = 0f, NewRate = currentRate };
                        continue;
                    }

                    if (!useCommercialData && hasIndustrialData && IndustrialDemand.IsCreated && i < IndustrialDemand.Length)
                    {
                        int demandRaw = math.max(0, IndustrialDemand[i]);
                        if (demandRaw > 0 && prodRaw > 0)
                        {
                            float demandRatio = demandRaw / (float)prodRaw;
                            f3_demand = math.min(0.3f, demandRatio * 0.15f);
                            profitabilityScore += f3_demand;
                        }
                    }

                    int taxableIncome = input.TaxableIncome;
                    if (taxableIncome > 0)
                    {
                        if (companies > 0)
                        {
                            float perCompanyIncome = taxableIncome / (float)companies;
                            float incomeScore = math.min(0.3f, math.max(-0.3f, (perCompanyIncome - 500f) / 2000f));
                            f4_income = incomeScore;
                            profitabilityScore += incomeScore;
                        }
                        else
                        {
                            float incomeScore = math.min(0.3f, math.max(-0.3f, (taxableIncome - 5000f) / 20000f));
                            f4_income = incomeScore;
                            profitabilityScore += incomeScore;
                        }
                    }
                    else if (taxableIncome == 0)
                    {
                        if (taxArea == 3)
                        {
                            OutputData[i] = new ResourceOutputData { Direction = 0, Score = 0f, NewRate = currentRate };
                            continue;
                        }
                        if (currentRate > 0)
                        {
                            f4_income = -0.15f;
                            profitabilityScore -= 0.15f;
                        }
                    }

                    float companyProfitSignal = math.max(-0.4f, math.min(0.4f, input.AvgProfit / 150f));
                    float learnedSignal = math.max(-0.3f, math.min(0.3f, input.LearnedSignal));

                    float blendedScore = profitabilityScore * (1f - ProfitWeight) + companyProfitSignal * ProfitWeight;
                    blendedScore += learnedSignal;

                    float happinessContrib;
                    if (HappinessBias < 0)
                        happinessContrib = HappinessBias * HappinessWeight;
                    else
                        happinessContrib = HappinessBias * HappinessWeight * 0.2f;

                    float absRate = math.abs((float)currentRate);
                    float rateDrag = -math.sign((float)currentRate) * (absRate / 150f) * (1f + absRate / 50f);
                    float finalScore = blendedScore * (1f - HappinessWeight) + happinessContrib + rateDrag;
                    finalScore = math.max(-1f, math.min(1f, finalScore));

                    int direction = 0;
                    int newRate = currentRate;
                    if (finalScore > 0.15f && currentRate < input.EffectiveMax)
                    {
                        direction = 1;
                        newRate = currentRate + 1;
                    }
                    else if (finalScore < -0.15f && currentRate > input.EffectiveMin)
                    {
                        direction = -1;
                        newRate = currentRate - 1;
                    }

                    OutputData[i] = new ResourceOutputData
                    {
                        Direction = direction,
                        Score = finalScore,
                        BalanceFactor = f1_balance,
                        DemandFactor = f3_demand,
                        IncomeFactor = f4_income,
                        ProfitFactor = companyProfitSignal,
                        HappinessFactor = happinessContrib,
                        RateDrag = rateDrag,
                        Companies = companies,
                        AvgProfit = input.AvgProfit,
                        LearnedFactor = learnedSignal,
                        NewRate = newRate
                    };
                }
            }
        }

        private AdvancedTPM.Utilities.PrefixedLogger m_Log;
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
        private TaxingProductionUISystem _taxingProductionUISystem;

        private float m_UpdateTimer = 0f;   // Real-time DeltaTime accumulator (replaces frame counter)
        private bool _firstRunPending;

        // Set by AutoTaxSystem after adjustments so TaxingProductionUISystem forces a re-read
        public static volatile bool TaxRatesChanged;

        // Per-resource exclusion: resources in this set are skipped by auto-tax
        private readonly HashSet<string> _excludedResources = new HashSet<string>();

        // Per-resource min/max tax rate overrides (key → (min, max)); absent = use global
        private readonly Dictionary<string, (int min, int max)> _perResourceRanges = new Dictionary<string, (int min, int max)>();
        private readonly Dictionary<string, AutoTaxResourceState> _resourceStates = new Dictionary<string, AutoTaxResourceState>();

        protected override void OnCreate()
        {
            base.OnCreate();

            foreach (var key in TPMDataDefinitions.ResourceKeyToEnum.Keys)
            {
                _resourceStates[key] = new AutoTaxResourceState();
            }

            try { _taxSystem = World.GetOrCreateSystemManaged<TaxSystem>(); } catch (Exception e) { m_Log.Error($"Failed to load TaxSystem: {e.Message}"); }
            try { _countCompanyDataSystem = World.GetOrCreateSystemManaged<CountCompanyDataSystem>(); } catch (Exception e) { m_Log.Error($"Failed to load CountCompanyDataSystem: {e.Message}"); }
            try { _industrialDemandSystem = World.GetOrCreateSystemManaged<IndustrialDemandSystem>(); } catch (Exception e) { m_Log.Error($"Failed to load IndustrialDemandSystem: {e.Message}"); }
            try { _commercialDemandSystem = World.GetOrCreateSystemManaged<CommercialDemandSystem>(); } catch (Exception e) { m_Log.Error($"Failed to load CommercialDemandSystem: {e.Message}"); }
            try { _cityStatisticsSystem = World.GetOrCreateSystemManaged<CityStatisticsSystem>(); } catch (Exception e) { m_Log.Error($"Failed to load CityStatisticsSystem: {e.Message}"); }
            try { _companyBrowserSystem = World.GetOrCreateSystemManaged<CompanyBrowserSystem>(); } catch (Exception e) { m_Log.Error($"Failed to load CompanyBrowserSystem: {e.Message}"); }
            try { _adaptiveLearningSystem = World.GetOrCreateSystemManaged<AdaptiveLearningSystem>(); } catch (Exception e) { m_Log.Error($"Failed to load AdaptiveLearningSystem: {e.Message}"); }
            try { _simulationSystem = World.GetOrCreateSystemManaged<SimulationSystem>(); } catch (Exception e) { m_Log.Error($"Failed to load SimulationSystem: {e.Message}"); }
            try { _taxingProductionUISystem = World.GetOrCreateSystemManaged<TaxingProductionUISystem>(); } catch (Exception e) { m_Log.Error($"Failed to load TaxingProductionUISystem: {e.Message}"); }

            var settings = Mod.Settings;
            LoadExcludedResources(settings);
            LoadPerResourceRanges(settings);

            AddBinding(_autoTaxEnabled = new ValueBinding<bool>("taxProduction", "autoTaxEnabled", settings?.AutoTaxEnabled ?? false));
            AddBinding(_autoTaxStatus = new ValueBinding<string>("taxProduction", "autoTaxStatus", ""));
            AddBinding(_autoTaxSettings = new ValueBinding<string>("taxProduction", "autoTaxSettings", SerializeSettings(settings)));

            AddBinding(new TriggerBinding<bool>("taxProduction", "setAutoTaxEnabled", SetAutoTaxEnabled));
            AddBinding(new TriggerBinding<string>("taxProduction", "setAutoTaxSettings", ApplyAutoTaxSettings));
            m_Log = new AdvancedTPM.Utilities.PrefixedLogger(nameof(AutoTaxSystem));
            m_Log.Info("AutoTaxSystem initialized");
        }

        protected override void OnUpdate()
        {
            var settings = Mod.Settings;
            if (settings != null && _autoTaxEnabled.value != settings.AutoTaxEnabled)
            {
                _autoTaxEnabled.Update(settings.AutoTaxEnabled);
                if (settings.AutoTaxEnabled)
                    _firstRunPending = true;
            }

            if (!_autoTaxEnabled.value) return;
            if (_taxSystem == null || _countCompanyDataSystem == null) return;

            if (_firstRunPending)
            {
                if (RunAutoTaxAdjustment(settings))
                {
                    _firstRunPending = false;
                    m_UpdateTimer = 0f;
                }
                return;
            }

            m_UpdateTimer += World.Time.DeltaTime;
            int tier = settings.AutoTaxInterval;
            if (tier < 1) tier = 1;
            if (tier > 5) tier = 5;
            float targetSeconds;
            switch (tier)
            {
                case 1: targetSeconds = 5f;  break;
                case 2: targetSeconds = 10f; break;
                case 3: targetSeconds = 20f; break;
                case 4: targetSeconds = 45f; break;
                case 5: targetSeconds = 90f; break;
                default: targetSeconds = 20f; break;
            }
            if (m_UpdateTimer < targetSeconds) return;

            if (RunAutoTaxAdjustment(settings))
            {
                m_UpdateTimer = 0f;
            }
        }

        private bool RunAutoTaxAdjustment(TPMModSettings settings)
        {
            int minRate = settings.AutoTaxMinRate;
            int maxRate = settings.AutoTaxMaxRate;
            if (minRate > maxRate) { int tmp = minRate; minRate = maxRate; maxRate = tmp; }
            int globalMin = minRate;
            int globalMax = maxRate;
            float happinessWeight = settings.AutoTaxHappinessWeight / 100f;
            float profitWeight = settings.AutoTaxProfitWeight / 100f;

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

            float happinessBias = (happiness - 50f) / 50f;

            NativeArray<int> productionArray = default;
            JobHandle prodDeps = default;
            try { productionArray = _countCompanyDataSystem.GetProduction(out prodDeps); } catch { }

            NativeArray<int> industrialConsumption = default;
            JobHandle consDeps = default;
            if (_industrialDemandSystem != null)
            {
                try { industrialConsumption = _industrialDemandSystem.GetConsumption(out consDeps); } catch { }
            }

            NativeArray<int> commercialConsumption = default;
            JobHandle commDeps = default;
            if (_commercialDemandSystem != null)
            {
                try { commercialConsumption = _commercialDemandSystem.GetConsumption(out commDeps); } catch { }
            }

            NativeArray<int> industrialCompanies = default;
            NativeArray<int> industrialDemand = default;
            JobHandle indDeps = default;
            try
            {
                var indData = _countCompanyDataSystem.GetIndustrialCompanyDatas(out indDeps);
                industrialCompanies = indData.m_ProductionCompanies;
                industrialDemand = indData.m_Demand;
            }
            catch { }

            NativeArray<int> commercialCompanies = default;
            NativeArray<int> commercialCapacity = default;
            NativeArray<int> commercialAvailables = default;
            JobHandle comDeps = default;
            try
            {
                var comData = _countCompanyDataSystem.GetCommercialCompanyDatas(out comDeps);
                commercialCompanies = comData.m_ServiceCompanies;
                commercialCapacity = comData.m_ProduceCapacity;
                commercialAvailables = comData.m_TotalAvailables;
            }
            catch { }

            var combinedDeps = JobHandle.CombineDependencies(
                JobHandle.CombineDependencies(prodDeps, consDeps),
                JobHandle.CombineDependencies(commDeps, indDeps),
                comDeps
            );

            if (!combinedDeps.IsCompleted) return false;

            combinedDeps.Complete();

            bool hasProduction = productionArray.IsCreated && productionArray.Length > 0;
            bool hasIndustrialConsumption = industrialConsumption.IsCreated && industrialConsumption.Length > 0;
            bool hasCommercialConsumption = commercialConsumption.IsCreated && commercialConsumption.Length > 0;
            bool hasIndustrialData = industrialCompanies.IsCreated && industrialCompanies.Length > 0;
            bool hasCommercialData = commercialCompanies.IsCreated && commercialCompanies.Length > 0;

            int adjustCount = 0;
            int raiseCount = 0;
            int lowerCount = 0;
            int holdCount = 0;

            int maxIndex = 0;
            foreach (var r in TPMDataDefinitions.ResourceKeyToEnum.Values)
            {
                int idx = EconomyUtils.GetResourceIndex(r);
                if (idx > maxIndex) maxIndex = idx;
            }
            int arrayLen = maxIndex + 1;

            var inputData = new NativeArray<ResourceInputData>(arrayLen, Allocator.TempJob);
            var outputData = new NativeArray<ResourceOutputData>(arrayLen, Allocator.TempJob);

            foreach (var kvp in TPMDataDefinitions.ResourceKeyToEnum)
            {
                string key = kvp.Key;
                Resource resource = kvp.Value;
                int idx = EconomyUtils.GetResourceIndex(resource);
                if (idx < 0) continue;

                if (!TPMDataDefinitions.ResourceTaxAreaMap.TryGetValue(key, out var taxAreaEnum)) continue;
                if (_excludedResources.Contains(key)) continue;
                if (!_resourceStates.TryGetValue(key, out var state)) continue;

                int currentRate = 0;
                int taxAreaInt = 0;
                StatisticType statType = StatisticType.IndustrialTaxableIncome;

                switch (taxAreaEnum)
                {
                    case TPMDataDefinitions.ResourceTaxArea.Industrial:
                        currentRate = _taxSystem.GetIndustrialTaxRate(resource);
                        taxAreaInt = 1;
                        statType = StatisticType.IndustrialTaxableIncome;
                        break;
                    case TPMDataDefinitions.ResourceTaxArea.Commercial:
                        currentRate = _taxSystem.GetCommercialTaxRate(resource);
                        taxAreaInt = 2;
                        statType = StatisticType.CommercialTaxableIncome;
                        break;
                    case TPMDataDefinitions.ResourceTaxArea.Office:
                        currentRate = _taxSystem.GetOfficeTaxRate(resource);
                        taxAreaInt = 3;
                        statType = StatisticType.OfficeTaxableIncome;
                        break;
                }

                int effectiveMin = globalMin;
                int effectiveMax = globalMax;
                if (_perResourceRanges.TryGetValue(key, out var customRange))
                {
                    effectiveMin = customRange.min;
                    effectiveMax = customRange.max;
                    if (effectiveMin > effectiveMax) { int tmp2 = effectiveMin; effectiveMin = effectiveMax; effectiveMax = tmp2; }
                }

                int taxableIncome = 0;
                if (_cityStatisticsSystem != null)
                {
                    try { taxableIncome = _cityStatisticsSystem.GetStatisticValue(statType, idx); } catch { }
                }

                float avgProfit = 0f;
                if (_companyBrowserSystem != null && _companyBrowserSystem.AvgProfitByResource != null)
                {
                    _companyBrowserSystem.AvgProfitByResource.TryGetValue(resource, out avgProfit);
                }

                float learnedSignal = 0f;
                if (_adaptiveLearningSystem != null)
                {
                    learnedSignal = _adaptiveLearningSystem.GetLearnedSensitivity(key);
                }

                inputData[idx] = new ResourceInputData
                {
                    TaxArea = taxAreaInt,
                    CurrentRate = currentRate,
                    EffectiveMin = effectiveMin,
                    EffectiveMax = effectiveMax,
                    TaxableIncome = taxableIncome,
                    AvgProfit = avgProfit,
                    LearnedSignal = learnedSignal
                };
            }

            var job = new AutoTaxMathJob
            {
                HappinessBias = happinessBias,
                HappinessWeight = happinessWeight,
                ProfitWeight = profitWeight,
                Production = productionArray,
                IndustrialConsumption = industrialConsumption,
                CommercialConsumption = commercialConsumption,
                IndustrialCompanies = industrialCompanies,
                IndustrialDemand = industrialDemand,
                CommercialCompanies = commercialCompanies,
                CommercialCapacity = commercialCapacity,
                CommercialAvailables = commercialAvailables,
                InputData = inputData,
                OutputData = outputData
            };

            job.Run();

            foreach (var kvp in TPMDataDefinitions.ResourceKeyToEnum)
            {
                string key = kvp.Key;
                Resource resource = kvp.Value;
                int idx = EconomyUtils.GetResourceIndex(resource);
                if (idx < 0) continue;

                var output = outputData[idx];
                var input = inputData[idx];
                
                if (input.TaxArea == 0) 
                {
                    if (_resourceStates.TryGetValue(key, out var st) && _excludedResources.Contains(key))
                    {
                        st.Direction = 0;
                        st.Score = 0f;
                        holdCount++;
                    }
                    continue;
                }

                if (!_resourceStates.TryGetValue(key, out var state)) continue;
                if (!TPMDataDefinitions.ResourceTaxAreaMap.TryGetValue(key, out var taxAreaEnum)) continue;

                if (output.NewRate != input.CurrentRate)
                {
                    UpdateTaxRate(taxAreaEnum, resource, output.NewRate);
                    adjustCount++;
                    if (output.Direction > 0) raiseCount++;
                    else if (output.Direction < 0) lowerCount++;

                    try { _adaptiveLearningSystem?.RecordTaxChange(key, input.CurrentRate, output.NewRate, _simulationSystem?.frameIndex ?? 0); } catch { }
                }
                else
                {
                    holdCount++;
                }

                state.Direction = output.Direction;
                state.Score = output.Score;
                state.BalanceFactor = output.BalanceFactor;
                state.DemandFactor = output.DemandFactor;
                state.IncomeFactor = output.IncomeFactor;
                state.ProfitFactor = output.ProfitFactor;
                state.HappinessFactor = output.HappinessFactor;
                state.RateDrag = output.RateDrag;
                state.Companies = output.Companies;
                state.AvgProfit = output.AvgProfit;
                state.LearnedFactor = output.LearnedFactor;
            }

            inputData.Dispose();
            outputData.Dispose();

            string status = SerializeStatus(happiness, adjustCount, raiseCount, lowerCount, holdCount);
            _autoTaxStatus.Update(status);

            if (adjustCount > 0)
            {
                TaxRatesChanged = true;
                Mod.log.Info($"AutoTax: happiness={happiness} adjusted={adjustCount} (raise={raiseCount} lower={lowerCount} hold={holdCount})");
            }
            return true;
        }

        private void UpdateTaxRate(TPMDataDefinitions.ResourceTaxArea area, Resource resource, int rate)
        {
            switch (area)
            {
                case TPMDataDefinitions.ResourceTaxArea.Industrial:
                    _taxSystem.SetIndustrialTaxRate(resource, rate);
                    break;
                case TPMDataDefinitions.ResourceTaxArea.Commercial:
                    _taxSystem.SetCommercialTaxRate(resource, rate);
                    break;
                case TPMDataDefinitions.ResourceTaxArea.Office:
                    _taxSystem.SetOfficeTaxRate(resource, rate);
                    break;
            }
        }

        private string SerializeStatus(int happiness, int adjustCount, int raiseCount, int lowerCount, int holdCount)
        {
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
                    resourceParts.Add(string.Format(CultureInfo.InvariantCulture,
                        "{0}={1}:{2:0.##}:{3:0.##}:{4:0.##}:{5:0.##}:{6:0.##}:{7}:{8:0.##}:{9}:{10:0.#}:{11:0.##}",
                        kvp.Key, kvp.Value.Direction, kvp.Value.Score,
                        kvp.Value.BalanceFactor, kvp.Value.DemandFactor,
                        kvp.Value.IncomeFactor, kvp.Value.ProfitFactor,
                        happiness,
                        kvp.Value.RateDrag,
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
                m_UpdateTimer = 0f;
            }
            else
            {
                foreach (var state in _resourceStates.Values)
                {
                    state.Direction = 0;
                    state.Score = 0f;
                }
                _autoTaxStatus.Update("");
            }

            Mod.log.Info($"AutoTax: enabled={enabled}");
        }

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

                if (parts.Length > 7 && int.TryParse(parts[7], NumberStyles.Integer, CultureInfo.InvariantCulture, out int profWeight))
                    settings.AutoTaxProfitWeight = Math.Max(0, Math.Min(100, profWeight));
                if (parts.Length > 8 && int.TryParse(parts[8], NumberStyles.Integer, CultureInfo.InvariantCulture, out int opacityVal))
                    settings.AutoTaxPanelOpacity = Math.Max(40, Math.Min(100, opacityVal));

                _excludedResources.Clear();
                if (!string.IsNullOrEmpty(excludedRaw))
                {
                    foreach (var key in excludedRaw.Split(','))
                    {
                        var trimmed = key.Trim();
                        if (trimmed.Length > 0 && TPMDataDefinitions.ResourceKeyToEnum.ContainsKey(trimmed))
                            _excludedResources.Add(trimmed);
                    }
                }
                settings.AutoTaxExcludedResources = string.Join(",", _excludedResources);

                _perResourceRanges.Clear();
                if (parts.Length > 6 && !string.IsNullOrEmpty(parts[6]))
                {
                    foreach (var entry in parts[6].Split(','))
                    {
                        var segments = entry.Split(':');
                        if (segments.Length == 3)
                        {
                            var rKey = segments[0].Trim();
                            if (rKey.Length > 0 && TPMDataDefinitions.ResourceKeyToEnum.ContainsKey(rKey)
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

        private void LoadExcludedResources(TPMModSettings settings)
        {
            _excludedResources.Clear();
            if (settings == null || string.IsNullOrEmpty(settings.AutoTaxExcludedResources)) return;

            foreach (var key in settings.AutoTaxExcludedResources.Split(','))
            {
                var trimmed = key.Trim();
                if (trimmed.Length > 0 && TPMDataDefinitions.ResourceKeyToEnum.ContainsKey(trimmed))
                    _excludedResources.Add(trimmed);
            }
        }

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
                    if (rKey.Length > 0 && TPMDataDefinitions.ResourceKeyToEnum.ContainsKey(rKey)
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
