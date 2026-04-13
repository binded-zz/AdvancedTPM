using Colossal.UI.Binding;
using Game.City;
using Game.Economy;
using Game.Simulation;
using Game.UI;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using Unity.Collections;
using Unity.Entities;
using Unity.Jobs;

namespace AdvancedTPM
{
    /// <summary>
    /// Adaptive learning system that watches how the city responds to tax changes over time.
    /// Captures periodic city snapshots, tracks tax change outcomes, and updates per-resource
    /// learned sensitivity coefficients using exponential moving averages.
    /// Provides advisor recommendations and a decision log to the UI.
    /// Pause-aware: only advances when the simulation is running.
    /// </summary>
    public partial class AdaptiveLearningSystem : UISystemBase
    {
        private ValueBinding<bool> _learningEnabled;
        private ValueBinding<string> _advisorData;
        private ValueBinding<string> _decisionLogData;
        private ValueBinding<string> _learningStats;

        private TaxSystem _taxSystem;
        private CountCompanyDataSystem _countCompanyDataSystem;
        private CityStatisticsSystem _cityStatisticsSystem;
        private SimulationSystem _simulationSystem;
        private CompanyBrowserSystem _companyBrowserSystem;

        private LearningDatabase _database;
        private string _dataFilePath;

        private int _snapshotCounter;
        private int _evaluationCounter;
        private int _saveCounter;
        private uint _lastSimulationTick;
        private bool _wasPaused;

        // How many game ticks to wait before evaluating a tax change outcome
        // ~262144 ticks/game-month at normal speed; we use ~2 game-days (~17500 ticks)
        private const uint EvaluationDelay = 17500;

        // Snapshot capture interval in frames (at normal speed ~20s)
        private const int SnapshotFrameInterval = 1200;

        // Auto-save interval in frames (~5 minutes at 60fps)
        private const int SaveFrameInterval = 18000;

        // EMA alpha for learning updates (0.0–1.0; lower = slower learning, more stable)
        private const float DefaultEmaAlpha = 0.15f;

        // Same resource mappings used across the mod
        private static readonly Dictionary<string, Resource> ResourceKeyToEnum = AutoTaxSystemMaps.ResourceKeyToEnum;

        protected override void OnCreate()
        {
            base.OnCreate();

            try { _taxSystem = World.GetOrCreateSystemManaged<TaxSystem>(); } catch { }
            try { _countCompanyDataSystem = World.GetOrCreateSystemManaged<CountCompanyDataSystem>(); } catch { }
            try { _cityStatisticsSystem = World.GetOrCreateSystemManaged<CityStatisticsSystem>(); } catch { }
            try { _simulationSystem = World.GetOrCreateSystemManaged<SimulationSystem>(); } catch { }
            try { _companyBrowserSystem = World.GetOrCreateSystemManaged<CompanyBrowserSystem>(); } catch { }

            // Resolve persistence file path
            var settings = Mod.Settings;
            _dataFilePath = ResolveLearningDataPath(settings);
            _database = LearningDatabase.LoadFromFile(_dataFilePath);

            // Initialize profiles for any resources not yet in the database
            foreach (var key in ResourceKeyToEnum.Keys)
            {
                if (!_database.Profiles.ContainsKey(key))
                    _database.Profiles[key] = new ResourceLearningProfile();
            }

            AddBinding(_learningEnabled = new ValueBinding<bool>("taxProduction", "learningEnabled", settings?.AdaptiveLearningEnabled ?? false));
            AddBinding(_advisorData = new ValueBinding<string>("taxProduction", "advisorData", ""));
            AddBinding(_decisionLogData = new ValueBinding<string>("taxProduction", "decisionLogData", ""));
            AddBinding(_learningStats = new ValueBinding<string>("taxProduction", "learningStats", ""));

            AddBinding(new TriggerBinding<bool>("taxProduction", "setLearningEnabled", SetLearningEnabled));
            AddBinding(new TriggerBinding("taxProduction", "resetLearning", ResetLearning));
            AddBinding(new TriggerBinding<int>("taxProduction", "setLearningAggressiveness", SetAggressiveness));

            // Initial UI push
            UpdateAdvisorBindings();

            Mod.log.Info($"AdaptiveLearningSystem initialized -- profiles={_database.Profiles.Count} pending={_database.PendingEvents.Count} decisions={_database.DecisionLog.Count}");
        }

        protected override void OnUpdate()
        {
            base.OnUpdate();

            var settings = Mod.Settings;
            if (settings == null) return;

            // Sync enabled state from settings
            if (_learningEnabled.value != settings.AdaptiveLearningEnabled)
                _learningEnabled.Update(settings.AdaptiveLearningEnabled);

            if (!_learningEnabled.value) return;

            // Pause-aware: check if simulation is running
            bool isPaused = false;
            uint currentTick = 0;
            if (_simulationSystem != null)
            {
                try
                {
                    currentTick = _simulationSystem.frameIndex;
                    isPaused = currentTick == _lastSimulationTick;
                }
                catch { }
            }

            if (isPaused)
            {
                _wasPaused = true;
                return;
            }

            if (_wasPaused)
            {
                _wasPaused = false;
                // Just unpaused — skip one frame to let systems settle
                _lastSimulationTick = currentTick;
                return;
            }
            _lastSimulationTick = currentTick;

            // Snapshot capture
            _snapshotCounter++;
            int snapshotInterval = GetSnapshotInterval(settings);
            if (_snapshotCounter >= snapshotInterval)
            {
                _snapshotCounter = 0;
                CaptureSnapshot(currentTick);
            }

            // Evaluate pending tax change events
            _evaluationCounter++;
            if (_evaluationCounter >= 300) // Check every ~5 seconds
            {
                _evaluationCounter = 0;
                EvaluatePendingEvents(currentTick, settings);
            }

            // Auto-save
            _saveCounter++;
            if (_saveCounter >= SaveFrameInterval)
            {
                _saveCounter = 0;
                _database.SaveToFile(_dataFilePath);
            }
        }

        /// <summary>
        /// Called by AutoTaxSystem when it changes a tax rate.
        /// Records the event for future evaluation.
        /// </summary>
        public void RecordTaxChange(string resourceKey, int oldRate, int newRate, uint gameTick)
        {
            if (!_learningEnabled.value) return;
            if (oldRate == newRate) return;

            // Capture a snapshot at the moment of change
            var snapshot = BuildCurrentSnapshot(gameTick);

            var evt = new TaxChangeEvent
            {
                ResourceKey = resourceKey,
                OldRate = oldRate,
                NewRate = newRate,
                GameTickAtChange = gameTick,
                SnapshotBefore = snapshot,
                Evaluated = false
            };

            _database.PendingEvents.Add(evt);

            // Limit pending events to prevent unbounded growth
            while (_database.PendingEvents.Count > 200)
                _database.PendingEvents.RemoveAt(0);
        }

        /// <summary>
        /// Get the learned sensitivity coefficient for a resource.
        /// Returns 0 if no data or learning is disabled.
        /// </summary>
        public float GetLearnedSensitivity(string resourceKey)
        {
            if (_database == null || !_database.Profiles.TryGetValue(resourceKey, out var profile))
                return 0f;
            return profile.Sensitivity * profile.Confidence;
        }

        /// <summary>
        /// Get the full learning profile for a resource (for UI display).
        /// </summary>
        public ResourceLearningProfile GetProfile(string resourceKey)
        {
            if (_database == null || !_database.Profiles.TryGetValue(resourceKey, out var profile))
                return null;
            return profile;
        }

        /// <summary>
        /// Get all current advisor recommendations.
        /// </summary>
        public List<AdvisorRecommendation> GetRecommendations()
        {
            var recommendations = new List<AdvisorRecommendation>();
            if (_database == null || _taxSystem == null) return recommendations;

            foreach (var kvp in _database.Profiles)
            {
                if (kvp.Value.SampleCount < 3) continue; // Need minimum data
                if (kvp.Value.Confidence < 0.2f) continue;
                if (!ResourceKeyToEnum.TryGetValue(kvp.Key, out var resource)) continue;
                if (!AutoTaxSystemMaps.ResourceTaxAreaMap.TryGetValue(kvp.Key, out var area)) continue;

                int currentRate;
                switch (area)
                {
                    case AutoTaxSystemMaps.ResourceTaxArea.Industrial:
                        currentRate = _taxSystem.GetIndustrialTaxRate(resource);
                        break;
                    case AutoTaxSystemMaps.ResourceTaxArea.Commercial:
                        currentRate = _taxSystem.GetCommercialTaxRate(resource);
                        break;
                    case AutoTaxSystemMaps.ResourceTaxArea.Office:
                        currentRate = _taxSystem.GetOfficeTaxRate(resource);
                        break;
                    default:
                        continue;
                }

                var profile = kvp.Value;
                int direction = 0;
                string reason = "";

                // Use learned sensitivity to suggest direction
                float weightedSens = profile.Sensitivity * profile.Confidence;

                if (weightedSens > 0.1f && profile.AvgOutcomeScore > 0)
                {
                    // Resilient resource with positive outcomes — can handle more tax
                    direction = 1;
                    reason = $"Resilient ({profile.SampleCount} observations, {profile.Confidence:P0} confidence)";
                }
                else if (weightedSens < -0.1f && profile.AvgOutcomeScore < 0)
                {
                    // Sensitive resource with negative outcomes — lower tax
                    direction = -1;
                    reason = $"Sensitive ({profile.SampleCount} observations, {profile.Confidence:P0} confidence)";
                }
                else if (profile.SampleCount >= 5 && Math.Abs(profile.AvgOutcomeScore) < 0.1f)
                {
                    // Stable — hold current rate
                    reason = $"Stable ({profile.SampleCount} observations)";
                }
                else
                {
                    continue; // Not enough signal
                }

                recommendations.Add(new AdvisorRecommendation
                {
                    ResourceKey = kvp.Key,
                    CurrentRate = currentRate,
                    SuggestedRate = currentRate + direction,
                    Confidence = profile.Confidence,
                    Direction = direction,
                    Reason = reason
                });
            }

            return recommendations;
        }

        private void CaptureSnapshot(uint gameTick)
        {
            var snapshot = BuildCurrentSnapshot(gameTick);
            _database.RecentSnapshots.Add(snapshot);
            _database.TrimSnapshots();
        }

        private CitySnapshot BuildCurrentSnapshot(uint gameTick)
        {
            var snapshot = new CitySnapshot
            {
                GameTick = gameTick,
                TimestampUtc = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };

            // City happiness
            if (_cityStatisticsSystem != null)
            {
                try { snapshot.Happiness = Math.Max(0, Math.Min(100, _cityStatisticsSystem.GetStatisticValue(StatisticType.Wellbeing))); }
                catch { snapshot.Happiness = 50; }
            }

            // Per-resource data from production system + tax system
            int totalCompanies = 0;
            float totalIncome = 0f;
            float totalProfit = 0f;
            int profitCount = 0;

            NativeArray<int> productionArray = default;
            bool hasProduction = false;
            if (_countCompanyDataSystem != null)
            {
                try
                {
                    JobHandle prodDeps;
                    productionArray = _countCompanyDataSystem.GetProduction(out prodDeps);
                    prodDeps.Complete();
                    hasProduction = productionArray.IsCreated && productionArray.Length > 0;
                }
                catch { }
            }

            NativeArray<int> industrialCompanies = default;
            bool hasIndustrialData = false;
            if (_countCompanyDataSystem != null)
            {
                try
                {
                    JobHandle indDeps;
                    var indData = _countCompanyDataSystem.GetIndustrialCompanyDatas(out indDeps);
                    indDeps.Complete();
                    industrialCompanies = indData.m_ProductionCompanies;
                    hasIndustrialData = industrialCompanies.IsCreated && industrialCompanies.Length > 0;
                }
                catch { }
            }

            NativeArray<int> commercialCompanies = default;
            bool hasCommercialData = false;
            if (_countCompanyDataSystem != null)
            {
                try
                {
                    JobHandle comDeps;
                    var comData = _countCompanyDataSystem.GetCommercialCompanyDatas(out comDeps);
                    comDeps.Complete();
                    commercialCompanies = comData.m_ServiceCompanies;
                    hasCommercialData = commercialCompanies.IsCreated && commercialCompanies.Length > 0;
                }
                catch { }
            }

            var avgProfits = _companyBrowserSystem?.AvgProfitByResource;

            foreach (var kvp in ResourceKeyToEnum)
            {
                string key = kvp.Key;
                Resource resource = kvp.Value;
                if (!AutoTaxSystemMaps.ResourceTaxAreaMap.TryGetValue(key, out var area)) continue;

                int resourceIndex = EconomyUtils.GetResourceIndex(resource);
                if (resourceIndex < 0) continue;

                var rs = new ResourceSnapshot();

                // Tax rate
                if (_taxSystem != null)
                {
                    try
                    {
                        switch (area)
                        {
                            case AutoTaxSystemMaps.ResourceTaxArea.Industrial:
                                rs.TaxRate = _taxSystem.GetIndustrialTaxRate(resource);
                                break;
                            case AutoTaxSystemMaps.ResourceTaxArea.Commercial:
                                rs.TaxRate = _taxSystem.GetCommercialTaxRate(resource);
                                break;
                            case AutoTaxSystemMaps.ResourceTaxArea.Office:
                                rs.TaxRate = _taxSystem.GetOfficeTaxRate(resource);
                                break;
                        }
                    }
                    catch { }
                }

                // Production
                if (hasProduction && resourceIndex < productionArray.Length)
                    rs.Production = Math.Max(0, productionArray[resourceIndex]) / 1000f;

                // Company count
                bool useCommercial = area == AutoTaxSystemMaps.ResourceTaxArea.Office || area == AutoTaxSystemMaps.ResourceTaxArea.Commercial;
                if (!useCommercial && hasIndustrialData && resourceIndex < industrialCompanies.Length)
                    rs.CompanyCount = Math.Max(0, industrialCompanies[resourceIndex]);
                if (useCommercial && hasCommercialData && resourceIndex < commercialCompanies.Length)
                    rs.CompanyCount = Math.Max(0, commercialCompanies[resourceIndex]);
                totalCompanies += rs.CompanyCount;

                // Tax income
                if (_cityStatisticsSystem != null)
                {
                    try
                    {
                        StatisticType statType;
                        switch (area)
                        {
                            case AutoTaxSystemMaps.ResourceTaxArea.Industrial:
                                statType = StatisticType.IndustrialTaxableIncome;
                                break;
                            case AutoTaxSystemMaps.ResourceTaxArea.Commercial:
                                statType = StatisticType.CommercialTaxableIncome;
                                break;
                            default:
                                statType = StatisticType.OfficeTaxableIncome;
                                break;
                        }
                        int taxableIncome = _cityStatisticsSystem.GetStatisticValue(statType, resourceIndex);
                        rs.TaxIncome = taxableIncome * rs.TaxRate / 100f;
                        totalIncome += rs.TaxIncome;
                    }
                    catch { }
                }

                // Average profitability from CompanyBrowserSystem
                if (avgProfits != null && avgProfits.TryGetValue(resource, out float avgProf))
                {
                    rs.AvgProfit = avgProf;
                    totalProfit += avgProf;
                    profitCount++;
                }

                // Revenue efficiency: income per company
                rs.RevenuePerCompany = rs.CompanyCount > 0 ? rs.TaxIncome / rs.CompanyCount : 0f;

                snapshot.Resources[key] = rs;
            }

            snapshot.TotalCompanies = totalCompanies;
            snapshot.TotalTaxIncome = totalIncome;
            snapshot.AvgProfitability = profitCount > 0 ? totalProfit / profitCount : 0f;

            return snapshot;
        }

        private void EvaluatePendingEvents(uint currentTick, TPMModSettings settings)
        {
            if (_database.PendingEvents.Count == 0) return;

            float alpha = GetEmaAlpha(settings);
            bool anyEvaluated = false;

            for (int i = _database.PendingEvents.Count - 1; i >= 0; i--)
            {
                var evt = _database.PendingEvents[i];
                if (evt.Evaluated) continue;

                // Check if enough time has passed
                uint elapsed = currentTick >= evt.GameTickAtChange
                    ? currentTick - evt.GameTickAtChange
                    : 0;

                if (elapsed < EvaluationDelay) continue;

                // Evaluate this event
                var outcome = EvaluateOutcome(evt, currentTick);
                ApplyLearning(evt.ResourceKey, outcome, alpha);

                // Record in decision log
                var decision = new AdvisorDecision
                {
                    ResourceKey = evt.ResourceKey,
                    OldRate = evt.OldRate,
                    NewRate = evt.NewRate,
                    GameTick = evt.GameTickAtChange,
                    OutcomeScore = outcome.Score,
                    Confidence = _database.Profiles.TryGetValue(evt.ResourceKey, out var p) ? p.Confidence : 0f,
                    Summary = outcome.Summary
                };
                _database.DecisionLog.Add(decision);
                _database.TrimDecisionLog();

                evt.Evaluated = true;
                anyEvaluated = true;
            }

            // Remove evaluated events
            _database.PendingEvents.RemoveAll(e => e.Evaluated);

            if (anyEvaluated)
            {
                UpdateAdvisorBindings();
            }
        }

        private OutcomeResult EvaluateOutcome(TaxChangeEvent evt, uint currentTick)
        {
            var before = evt.SnapshotBefore;
            if (before == null || !before.Resources.TryGetValue(evt.ResourceKey, out var beforeRes))
            {
                return new OutcomeResult { Score = 0f, Summary = "No baseline data" };
            }

            // Build current state for comparison
            var currentSnapshot = BuildCurrentSnapshot(currentTick);
            if (!currentSnapshot.Resources.TryGetValue(evt.ResourceKey, out var afterRes))
            {
                return new OutcomeResult { Score = 0f, Summary = "No current data" };
            }

            // Evaluate multiple dimensions
            float score = 0f;
            var reasons = new List<string>();
            int taxDirection = evt.NewRate > evt.OldRate ? 1 : -1;

            // 1. Income change (weighted 25%)
            float incomeDelta = afterRes.TaxIncome - beforeRes.TaxIncome;
            float incomeScore = 0f;
            if (Math.Abs(beforeRes.TaxIncome) > 1f)
            {
                float incomePctChange = incomeDelta / Math.Abs(beforeRes.TaxIncome);
                incomeScore = Math.Max(-0.25f, Math.Min(0.25f, incomePctChange));
            }
            else if (afterRes.TaxIncome > 0)
            {
                incomeScore = 0.08f;
            }
            score += incomeScore;

            // 2. Company count change (weighted 25%)
            float companyDelta = afterRes.CompanyCount - beforeRes.CompanyCount;
            float companyScore = 0f;
            if (beforeRes.CompanyCount > 0)
            {
                float companyPctChange = companyDelta / (float)beforeRes.CompanyCount;
                companyScore = Math.Max(-0.25f, Math.Min(0.25f, companyPctChange * 2f));
            }
            score += companyScore;

            // 3. Profitability change (weighted 15%)
            float profitDelta = afterRes.AvgProfit - beforeRes.AvgProfit;
            float profitScore = Math.Max(-0.15f, Math.Min(0.15f, profitDelta / 50f));
            score += profitScore;

            // 4. Happiness change (weighted 15%)
            float happinessDelta = currentSnapshot.Happiness - before.Happiness;
            float happinessScore = Math.Max(-0.15f, Math.Min(0.15f, happinessDelta / 20f));
            score += happinessScore;

            // 5. Production trend (weighted 10%)
            float productionDelta = afterRes.Production - beforeRes.Production;
            float productionScore = 0f;
            if (Math.Abs(beforeRes.Production) > 0.1f)
            {
                float prodPctChange = productionDelta / Math.Abs(beforeRes.Production);
                productionScore = Math.Max(-0.1f, Math.Min(0.1f, prodPctChange));
            }
            score += productionScore;

            // 6. Revenue efficiency — income per company (weighted 10%)
            float revEffScore = 0f;
            float revEffDelta = afterRes.RevenuePerCompany - beforeRes.RevenuePerCompany;
            if (Math.Abs(beforeRes.RevenuePerCompany) > 0.1f)
            {
                float revEffPctChange = revEffDelta / Math.Abs(beforeRes.RevenuePerCompany);
                revEffScore = Math.Max(-0.1f, Math.Min(0.1f, revEffPctChange));
            }
            score += revEffScore;

            // Determine if the outcome aligned with the tax direction
            float alignedScore = score * taxDirection;

            // Build summary
            if (incomeDelta > 0) reasons.Add($"Income+{incomeDelta:0}");
            else if (incomeDelta < -1) reasons.Add($"Income{incomeDelta:0}");
            if (companyDelta > 0) reasons.Add($"Companies+{companyDelta:0}");
            else if (companyDelta < 0) reasons.Add($"Companies{companyDelta:0}");
            if (Math.Abs(profitDelta) > 1) reasons.Add($"Profit{(profitDelta > 0 ? "+" : "")}{profitDelta:0.#}%");
            if (Math.Abs(happinessDelta) > 1) reasons.Add($"Happiness{(happinessDelta > 0 ? "+" : "")}{happinessDelta:0}");
            if (Math.Abs(productionDelta) > 0.5f) reasons.Add($"Prod{(productionDelta > 0 ? "+" : "")}{productionDelta:0.#}");
            if (Math.Abs(revEffDelta) > 0.5f) reasons.Add($"RevEff{(revEffDelta > 0 ? "+" : "")}{revEffDelta:0.#}");

            string summary = reasons.Count > 0 ? string.Join(" ", reasons) : "No significant change";

            return new OutcomeResult
            {
                Score = score,
                AlignedScore = alignedScore,
                IncomeDelta = incomeDelta,
                CompanyDelta = companyDelta,
                ProfitDelta = profitDelta,
                HappinessDelta = happinessDelta,
                ProductionDelta = productionDelta,
                RevEffDelta = revEffDelta,
                Summary = summary
            };
        }

        private void ApplyLearning(string resourceKey, OutcomeResult outcome, float alpha)
        {
            if (!_database.Profiles.TryGetValue(resourceKey, out var profile))
            {
                profile = new ResourceLearningProfile();
                _database.Profiles[resourceKey] = profile;
            }

            // Exponential moving average update
            // Sensitivity: how the resource responds to tax increases
            profile.Sensitivity = profile.Sensitivity * (1f - alpha) + outcome.AlignedScore * alpha;

            // Income response: how income changed
            profile.IncomeResponse = profile.IncomeResponse * (1f - alpha) + outcome.IncomeDelta * alpha;

            // Company response: how company count changed
            profile.CompanyResponse = profile.CompanyResponse * (1f - alpha) + outcome.CompanyDelta * alpha;

            // Production response: how production volume changed
            profile.ProductionResponse = profile.ProductionResponse * (1f - alpha) + outcome.ProductionDelta * alpha;

            // Revenue efficiency: how income-per-company changed
            profile.RevenueEfficiency = profile.RevenueEfficiency * (1f - alpha) + outcome.RevEffDelta * alpha;

            // Average outcome score
            profile.AvgOutcomeScore = profile.AvgOutcomeScore * (1f - alpha) + outcome.Score * alpha;

            // Volatility: detect direction reversals
            int currentDirection = outcome.AlignedScore >= 0 ? 1 : -1;
            if (profile.LastDirection != 0 && currentDirection != profile.LastDirection)
            {
                // Direction reversed — increase volatility
                profile.Volatility = Math.Min(1f, profile.Volatility * (1f - alpha) + 1f * alpha);
            }
            else
            {
                // Same direction — decrease volatility
                profile.Volatility = profile.Volatility * (1f - alpha * 0.5f);
            }
            profile.LastDirection = currentDirection;

            // Update confidence: increases with each sample, asymptotically approaches 1.0
            profile.SampleCount++;
            float baseConfidence = 1f - (1f / (1f + profile.SampleCount * 0.2f));
            // Dampen confidence when volatility is high (oscillating decisions are unreliable)
            float volatilityPenalty = 1f - profile.Volatility * 0.4f;
            profile.Confidence = Math.Min(0.95f, baseConfidence * Math.Max(0.3f, volatilityPenalty));

            profile.LastUpdatedTick = _lastSimulationTick;

            if (Mod.Settings?.DebugEnabled == true)
            {
                Mod.log.Info($"Learning: {resourceKey} sens={profile.Sensitivity:0.###} income={profile.IncomeResponse:0.#} companies={profile.CompanyResponse:0.##} prod={profile.ProductionResponse:0.##} revEff={profile.RevenueEfficiency:0.##} vol={profile.Volatility:0.##} conf={profile.Confidence:P0} samples={profile.SampleCount} outcome={outcome.Score:0.##}");
            }
        }

        private void UpdateAdvisorBindings()
        {
            try
            {
                // Advisor data: per-resource learning profiles
                var profileParts = new List<string>();
                foreach (var kvp in _database.Profiles)
                {
                    var p = kvp.Value;
                    if (p.SampleCount == 0 && Math.Abs(p.Sensitivity) < 0.001f) continue;
                    profileParts.Add(string.Format(CultureInfo.InvariantCulture,
                        "{0}={1:0.###}:{2:0.##}:{3:0.##}:{4:0.##}:{5}:{6:0.###}:{7:0.##}:{8:0.##}:{9:0.##}",
                        kvp.Key, p.Sensitivity, p.IncomeResponse, p.CompanyResponse,
                        p.Confidence, p.SampleCount, p.AvgOutcomeScore,
                        p.ProductionResponse, p.RevenueEfficiency, p.Volatility));
                }

                // Recommendations
                var recommendations = GetRecommendations();
                var recParts = new List<string>();
                foreach (var r in recommendations)
                {
                    recParts.Add(string.Format(CultureInfo.InvariantCulture,
                        "{0}={1}:{2}:{3:0.##}:{4}",
                        r.ResourceKey, r.Direction, r.CurrentRate, r.Confidence,
                        r.Reason ?? ""));
                }

                // Format: totalSamples|totalProfiles|profileData|recommendationData
                int totalSamples = _database.Profiles.Values.Sum(p => p.SampleCount);
                int activeProfiles = _database.Profiles.Values.Count(p => p.SampleCount > 0);
                string advisorPayload = string.Format(CultureInfo.InvariantCulture,
                    "{0}|{1}|{2}|{3}",
                    totalSamples, activeProfiles,
                    string.Join(",", profileParts),
                    string.Join(",", recParts));

                _advisorData.Update(advisorPayload);

                // Decision log: last 20 entries for UI
                var logParts = new List<string>();
                var recentDecisions = _database.DecisionLog
                    .Skip(Math.Max(0, _database.DecisionLog.Count - 20))
                    .ToList();

                foreach (var d in recentDecisions)
                {
                    logParts.Add(string.Format(CultureInfo.InvariantCulture,
                        "{0}:{1}:{2}:{3:0.##}:{4:0.##}:{5}",
                        d.ResourceKey, d.OldRate, d.NewRate,
                        d.OutcomeScore, d.Confidence, d.Summary ?? ""));
                }
                _decisionLogData.Update(string.Join("|", logParts));

                // Learning stats: pending|snapshots|totalSamples|avgConfidence|aggressiveness
                float avgConfidence = _database.Profiles.Values.Count > 0
                    ? _database.Profiles.Values.Where(p => p.SampleCount > 0).Select(p => p.Confidence).DefaultIfEmpty(0f).Average()
                    : 0f;
                int aggressiveness = Mod.Settings?.LearningAggressiveness ?? 3;
                _learningStats.Update(string.Format(CultureInfo.InvariantCulture,
                    "{0}|{1}|{2}|{3:0.##}|{4}",
                    _database.PendingEvents.Count,
                    _database.RecentSnapshots.Count,
                    totalSamples,
                    avgConfidence,
                    aggressiveness));
            }
            catch (Exception ex)
            {
                if (Mod.Settings?.DebugEnabled == true)
                    Mod.log.Warn($"AdaptiveLearning: UpdateAdvisorBindings failed: {ex.Message}");
            }
        }

        private void SetLearningEnabled(bool enabled)
        {
            _learningEnabled.Update(enabled);
            if (Mod.Settings != null)
            {
                Mod.Settings.AdaptiveLearningEnabled = enabled;
                Mod.Settings.ApplyAndSave();
            }
            Mod.log.Info($"AdaptiveLearning: enabled={enabled}");
        }

        private void ResetLearning()
        {
            _database = new LearningDatabase();
            foreach (var key in ResourceKeyToEnum.Keys)
                _database.Profiles[key] = new ResourceLearningProfile();

            _database.SaveToFile(_dataFilePath);
            UpdateAdvisorBindings();
            Mod.log.Info("AdaptiveLearning: reset all learned data");
        }

        private void SetAggressiveness(int level)
        {
            level = Math.Max(1, Math.Min(5, level));
            if (Mod.Settings != null)
            {
                Mod.Settings.LearningAggressiveness = level;
                Mod.Settings.ApplyAndSave();
            }
            UpdateAdvisorBindings();
        }

        protected override void OnDestroy()
        {
            // Save on shutdown
            if (_database != null && !string.IsNullOrEmpty(_dataFilePath))
            {
                _database.SaveToFile(_dataFilePath);
                Mod.log.Info("AdaptiveLearning: saved learning data on shutdown");
            }
            base.OnDestroy();
        }

        private float GetEmaAlpha(TPMModSettings settings)
        {
            // Aggressiveness 1-5 maps to alpha 0.05–0.30
            int level = settings?.LearningAggressiveness ?? 3;
            switch (level)
            {
                case 1: return 0.05f;  // Very conservative
                case 2: return 0.10f;
                case 3: return 0.15f;  // Default
                case 4: return 0.22f;
                case 5: return 0.30f;  // Very aggressive
                default: return DefaultEmaAlpha;
            }
        }

        private int GetSnapshotInterval(TPMModSettings settings)
        {
            // Slower snapshot rate at lower aggressiveness
            int level = settings?.LearningAggressiveness ?? 3;
            switch (level)
            {
                case 1: return 2400;  // ~40s
                case 2: return 1800;  // ~30s
                case 3: return 1200;  // ~20s
                case 4: return 900;   // ~15s
                case 5: return 600;   // ~10s
                default: return SnapshotFrameInterval;
            }
        }

        private static string ResolveLearningDataPath(TPMModSettings settings)
        {
            // Store learning data alongside mod settings
            string basePath = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string modDataDir = Path.Combine(basePath, "..", "LocalLow", "Colossal Order", "Cities Skylines II", "ModsSettings", "CitiesTPM");
            return Path.Combine(modDataDir, "learning_data.dat");
        }

        private struct OutcomeResult
        {
            public float Score;
            public float AlignedScore;
            public float IncomeDelta;
            public float CompanyDelta;
            public float ProfitDelta;
            public float HappinessDelta;
            public float ProductionDelta;
            public float RevEffDelta;
            public string Summary;
        }
    }

    /// <summary>
    /// Shared resource mappings used by both AutoTaxSystem and AdaptiveLearningSystem.
    /// Avoids duplicating the large dictionaries.
    /// </summary>
    public static class AutoTaxSystemMaps
    {
        public enum ResourceTaxArea { Industrial, Commercial, Office }

        public static readonly Dictionary<string, ResourceTaxArea> ResourceTaxAreaMap = new Dictionary<string, ResourceTaxArea>
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

        public static readonly Dictionary<string, Resource> ResourceKeyToEnum = new Dictionary<string, Resource>
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
    }
}
