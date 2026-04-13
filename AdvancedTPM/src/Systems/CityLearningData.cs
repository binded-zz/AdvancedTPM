using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;

namespace AdvancedTPM
{
    /// <summary>
    /// Periodic snapshot of city-wide and per-resource metrics.
    /// Captured at regular intervals for before/after comparison.
    /// </summary>
    public class CitySnapshot
    {
        public uint GameTick { get; set; }
        public long TimestampUtc { get; set; }
        public int Happiness { get; set; }
        public float TotalTaxIncome { get; set; }
        public int TotalCompanies { get; set; }
        public float AvgProfitability { get; set; }

        /// <summary>Per-resource metrics at snapshot time. Key = resource key (e.g. "grain", "c_food").</summary>
        public Dictionary<string, ResourceSnapshot> Resources { get; set; } = new Dictionary<string, ResourceSnapshot>();

        public CitySnapshot Clone()
        {
            var clone = new CitySnapshot
            {
                GameTick = GameTick,
                TimestampUtc = TimestampUtc,
                Happiness = Happiness,
                TotalTaxIncome = TotalTaxIncome,
                TotalCompanies = TotalCompanies,
                AvgProfitability = AvgProfitability,
                Resources = new Dictionary<string, ResourceSnapshot>()
            };
            foreach (var kvp in Resources)
            {
                clone.Resources[kvp.Key] = kvp.Value.Clone();
            }
            return clone;
        }
    }

    /// <summary>Per-resource metrics within a snapshot.</summary>
    public class ResourceSnapshot
    {
        public int TaxRate { get; set; }
        public float Production { get; set; }
        public float Consumption { get; set; }
        public float TaxIncome { get; set; }
        public int CompanyCount { get; set; }
        public float AvgProfit { get; set; }

        /// <summary>Tax income per company. Measures marginal revenue efficiency.</summary>
        public float RevenuePerCompany { get; set; }

        public ResourceSnapshot Clone()
        {
            return new ResourceSnapshot
            {
                TaxRate = TaxRate,
                Production = Production,
                Consumption = Consumption,
                TaxIncome = TaxIncome,
                CompanyCount = CompanyCount,
                AvgProfit = AvgProfit,
                RevenuePerCompany = RevenuePerCompany
            };
        }
    }

    /// <summary>
    /// Records a tax rate change event for a specific resource.
    /// Used to evaluate the outcome after a delay period.
    /// </summary>
    public class TaxChangeEvent
    {
        public string ResourceKey { get; set; }
        public int OldRate { get; set; }
        public int NewRate { get; set; }
        public uint GameTickAtChange { get; set; }
        public CitySnapshot SnapshotBefore { get; set; }
        public bool Evaluated { get; set; }
    }

    /// <summary>
    /// Per-resource learned sensitivity profile.
    /// Tracks how the city responds to tax changes for each resource.
    /// Updated via exponential moving average as outcomes are observed.
    /// </summary>
    public class ResourceLearningProfile
    {
        /// <summary>
        /// Learned sensitivity: how much a 1% tax change affects the resource's health score.
        /// Positive = city responds well to increases (resilient sector).
        /// Negative = city responds poorly to increases (sensitive sector).
        /// Starts at 0 (neutral/unknown) and converges over time.
        /// Range: approximately -1.0 to +1.0.
        /// </summary>
        public float Sensitivity { get; set; }

        /// <summary>
        /// Learned income response: how much tax income changes per 1% rate change.
        /// Helps predict revenue impact of adjustments.
        /// </summary>
        public float IncomeResponse { get; set; }

        /// <summary>
        /// Learned company response: how company count changes after tax adjustments.
        /// Negative = companies leave when taxes rise.
        /// </summary>
        public float CompanyResponse { get; set; }

        /// <summary>
        /// Confidence level 0.0–1.0. Increases with each observed outcome.
        /// Higher confidence = stronger influence on scoring.
        /// </summary>
        public float Confidence { get; set; }

        /// <summary>Number of observations (evaluated tax change events).</summary>
        public int SampleCount { get; set; }

        /// <summary>Last game tick when this profile was updated.</summary>
        public uint LastUpdatedTick { get; set; }

        /// <summary>
        /// Running average of outcome scores for this resource.
        /// Positive = tax changes produced good outcomes overall.
        /// </summary>
        public float AvgOutcomeScore { get; set; }

        /// <summary>
        /// Learned production response: how production volume changes after tax adjustments.
        /// Positive = production grew after the change. Negative = production declined.
        /// </summary>
        public float ProductionResponse { get; set; }

        /// <summary>
        /// Learned revenue efficiency trend: change in income-per-company after tax adjustments.
        /// Tracks marginal return — whether each company is generating more or less tax income.
        /// </summary>
        public float RevenueEfficiency { get; set; }

        /// <summary>
        /// Volatility score: how often the tax rate direction reverses for this resource.
        /// High volatility = system is oscillating (raise/lower/raise) which is bad.
        /// Range 0.0–1.0. Used to dampen confidence when oscillating.
        /// </summary>
        public float Volatility { get; set; }

        /// <summary>
        /// Tracks the direction of the last tax change: +1 = raised, -1 = lowered, 0 = none.
        /// Used to detect direction reversals for volatility calculation.
        /// </summary>
        public int LastDirection { get; set; }
    }

    /// <summary>
    /// Top-level container for all adaptive learning data.
    /// Persisted to JSON between game sessions.
    /// </summary>
    public class LearningDatabase
    {
        public int Version { get; set; } = 1;
        public long LastSaveUtc { get; set; }

        /// <summary>Per-resource learned profiles.</summary>
        public Dictionary<string, ResourceLearningProfile> Profiles { get; set; } = new Dictionary<string, ResourceLearningProfile>();

        /// <summary>Recent city snapshots (ring buffer, last N snapshots).</summary>
        public List<CitySnapshot> RecentSnapshots { get; set; } = new List<CitySnapshot>();

        /// <summary>Pending tax change events awaiting evaluation.</summary>
        public List<TaxChangeEvent> PendingEvents { get; set; } = new List<TaxChangeEvent>();

        /// <summary>Recent advisor decisions for the decision log (last N).</summary>
        public List<AdvisorDecision> DecisionLog { get; set; } = new List<AdvisorDecision>();

        /// <summary>Maximum snapshots to retain.</summary>
        public const int MaxSnapshots = 50;

        /// <summary>Maximum decision log entries.</summary>
        public const int MaxDecisionLog = 100;

        public void TrimSnapshots()
        {
            while (RecentSnapshots.Count > MaxSnapshots)
                RecentSnapshots.RemoveAt(0);
        }

        public void TrimDecisionLog()
        {
            while (DecisionLog.Count > MaxDecisionLog)
                DecisionLog.RemoveAt(0);
        }

        /// <summary>
        /// Serialize the entire learning database to a flat string for file persistence.
        /// Format: line-based, sections separated by markers.
        /// </summary>
        public string Serialize()
        {
            var lines = new List<string>();
            lines.Add($"V|{Version}|{LastSaveUtc}");

            // Profiles section
            lines.Add("PROFILES");
            foreach (var kvp in Profiles)
            {
                var p = kvp.Value;
                lines.Add(string.Format(CultureInfo.InvariantCulture,
                    "P|{0}|{1:0.####}|{2:0.####}|{3:0.####}|{4:0.####}|{5}|{6}|{7:0.####}|{8:0.####}|{9:0.####}|{10:0.####}|{11}",
                    kvp.Key, p.Sensitivity, p.IncomeResponse, p.CompanyResponse,
                    p.Confidence, p.SampleCount, p.LastUpdatedTick, p.AvgOutcomeScore,
                    p.ProductionResponse, p.RevenueEfficiency, p.Volatility, p.LastDirection));
            }

            // Decision log section
            lines.Add("DECISIONS");
            foreach (var d in DecisionLog)
            {
                lines.Add(string.Format(CultureInfo.InvariantCulture,
                    "D|{0}|{1}|{2}|{3}|{4:0.##}|{5:0.##}|{6}",
                    d.ResourceKey, d.OldRate, d.NewRate, d.GameTick,
                    d.OutcomeScore, d.Confidence, d.Summary ?? ""));
            }

            lines.Add("END");
            return string.Join("\n", lines);
        }

        /// <summary>
        /// Deserialize a learning database from the flat string format.
        /// Returns a new LearningDatabase; returns empty DB on parse errors.
        /// </summary>
        public static LearningDatabase Deserialize(string data)
        {
            var db = new LearningDatabase();
            if (string.IsNullOrEmpty(data)) return db;

            try
            {
                var lines = data.Split('\n');
                string section = "";

                foreach (var rawLine in lines)
                {
                    var line = rawLine.Trim();
                    if (line.Length == 0) continue;

                    if (line == "PROFILES" || line == "DECISIONS" || line == "END")
                    {
                        section = line;
                        continue;
                    }

                    if (line.StartsWith("V|"))
                    {
                        var parts = line.Split('|');
                        if (parts.Length >= 3)
                        {
                            int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out int ver);
                            long.TryParse(parts[2], NumberStyles.Integer, CultureInfo.InvariantCulture, out long lastSave);
                            db.Version = ver;
                            db.LastSaveUtc = lastSave;
                        }
                        continue;
                    }

                    if (section == "PROFILES" && line.StartsWith("P|"))
                    {
                        var parts = line.Split('|');
                        if (parts.Length >= 8)
                        {
                            var key = parts[1];
                            float.TryParse(parts[2], NumberStyles.Float, CultureInfo.InvariantCulture, out float sensitivity);
                            float.TryParse(parts[3], NumberStyles.Float, CultureInfo.InvariantCulture, out float incomeResp);
                            float.TryParse(parts[4], NumberStyles.Float, CultureInfo.InvariantCulture, out float compResp);
                            float.TryParse(parts[5], NumberStyles.Float, CultureInfo.InvariantCulture, out float confidence);
                            int.TryParse(parts[6], NumberStyles.Integer, CultureInfo.InvariantCulture, out int sampleCount);
                            uint.TryParse(parts[7], NumberStyles.Integer, CultureInfo.InvariantCulture, out uint lastTick);
                            float avgOutcome = 0f;
                            if (parts.Length > 8)
                                float.TryParse(parts[8], NumberStyles.Float, CultureInfo.InvariantCulture, out avgOutcome);

                            float prodResp = 0f;
                            if (parts.Length > 9)
                                float.TryParse(parts[9], NumberStyles.Float, CultureInfo.InvariantCulture, out prodResp);
                            float revEff = 0f;
                            if (parts.Length > 10)
                                float.TryParse(parts[10], NumberStyles.Float, CultureInfo.InvariantCulture, out revEff);
                            float volatility = 0f;
                            if (parts.Length > 11)
                                float.TryParse(parts[11], NumberStyles.Float, CultureInfo.InvariantCulture, out volatility);
                            int lastDir = 0;
                            if (parts.Length > 12)
                                int.TryParse(parts[12], NumberStyles.Integer, CultureInfo.InvariantCulture, out lastDir);

                            db.Profiles[key] = new ResourceLearningProfile
                            {
                                Sensitivity = sensitivity,
                                IncomeResponse = incomeResp,
                                CompanyResponse = compResp,
                                Confidence = confidence,
                                SampleCount = sampleCount,
                                LastUpdatedTick = lastTick,
                                AvgOutcomeScore = avgOutcome,
                                ProductionResponse = prodResp,
                                RevenueEfficiency = revEff,
                                Volatility = volatility,
                                LastDirection = lastDir
                            };
                        }
                    }
                    else if (section == "DECISIONS" && line.StartsWith("D|"))
                    {
                        var parts = line.Split('|');
                        if (parts.Length >= 7)
                        {
                            var d = new AdvisorDecision
                            {
                                ResourceKey = parts[1]
                            };
                            int.TryParse(parts[2], NumberStyles.Integer, CultureInfo.InvariantCulture, out int oldRate);
                            int.TryParse(parts[3], NumberStyles.Integer, CultureInfo.InvariantCulture, out int newRate);
                            uint.TryParse(parts[4], NumberStyles.Integer, CultureInfo.InvariantCulture, out uint tick);
                            float.TryParse(parts[5], NumberStyles.Float, CultureInfo.InvariantCulture, out float outcome);
                            float.TryParse(parts[6], NumberStyles.Float, CultureInfo.InvariantCulture, out float conf);
                            d.OldRate = oldRate;
                            d.NewRate = newRate;
                            d.GameTick = tick;
                            d.OutcomeScore = outcome;
                            d.Confidence = conf;
                            d.Summary = parts.Length > 7 ? parts[7] : "";
                            db.DecisionLog.Add(d);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"LearningDatabase.Deserialize failed: {ex.Message}");
            }

            return db;
        }

        /// <summary>
        /// Save the learning database to a file. Creates directory if needed.
        /// </summary>
        public void SaveToFile(string filePath)
        {
            try
            {
                LastSaveUtc = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var dir = Path.GetDirectoryName(filePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    Directory.CreateDirectory(dir);
                File.WriteAllText(filePath, Serialize());
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"LearningDatabase.SaveToFile failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Load the learning database from a file. Returns empty DB if file doesn't exist.
        /// </summary>
        public static LearningDatabase LoadFromFile(string filePath)
        {
            try
            {
                if (File.Exists(filePath))
                {
                    var data = File.ReadAllText(filePath);
                    return Deserialize(data);
                }
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"LearningDatabase.LoadFromFile failed: {ex.Message}");
            }
            return new LearningDatabase();
        }
    }

    /// <summary>
    /// Records a completed advisor decision for the decision log UI.
    /// </summary>
    public class AdvisorDecision
    {
        public string ResourceKey { get; set; }
        public int OldRate { get; set; }
        public int NewRate { get; set; }
        public uint GameTick { get; set; }
        public float OutcomeScore { get; set; }
        public float Confidence { get; set; }
        public string Summary { get; set; }
    }

    /// <summary>
    /// Current recommendation from the advisor for a specific resource.
    /// </summary>
    public class AdvisorRecommendation
    {
        public string ResourceKey { get; set; }
        public int SuggestedRate { get; set; }
        public int CurrentRate { get; set; }
        public float Confidence { get; set; }
        public string Reason { get; set; }

        /// <summary>
        /// Direction: -1 = lower, 0 = hold, +1 = raise.
        /// </summary>
        public int Direction { get; set; }
    }
}
