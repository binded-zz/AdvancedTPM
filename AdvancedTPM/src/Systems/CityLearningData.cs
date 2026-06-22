using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using Newtonsoft.Json;

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

        /// <summary>
        /// Number of consecutive evaluations where the tax rate was extreme (<= 0 or >= 25) 
        /// and the outcome was negative or neutral. Used to trigger bailout overrides.
        /// </summary>
        public int ConsecutiveExtremeEvaluations { get; set; }
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
        /// Serialize to JSON string.
        /// </summary>
        public string SerializeJson()
        {
            return JsonConvert.SerializeObject(this, Formatting.Indented);
        }

        /// <summary>
        /// Deserialize from JSON string. Expects JSON produced by SerializeJson.
        /// </summary>
        public static LearningDatabase DeserializeJson(string data)
        {
            if (string.IsNullOrEmpty(data)) return new LearningDatabase();
            try
            {
                var db = JsonConvert.DeserializeObject<LearningDatabase>(data);
                return db ?? new LearningDatabase();
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"LearningDatabase.DeserializeJson failed: {ex.Message}");
                return new LearningDatabase();
            }
        }

        /// <summary>
        /// Save the learning database to a file. Creates directory if needed.
        /// </summary>
        public void SaveToFile(string filePath)
        {
            try
            {
                // Ensure reasonable size by trimming before serializing
                TrimSnapshots();
                TrimDecisionLog();

                LastSaveUtc = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var dir = Path.GetDirectoryName(filePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    Directory.CreateDirectory(dir);

                // Serialize to JSON and write compressed .gz only (no plain JSON retained)
                try
                {
                    var json = JsonConvert.SerializeObject(this);
                    var gzPath = filePath; // filePath should be the .gz path

                    // atomic write to tmp then move
                    var tmpPath = gzPath + ".tmp";
                    using (var fs = new FileStream(tmpPath, FileMode.Create, FileAccess.Write, FileShare.None))
                    using (var gz = new GZipStream(fs, CompressionLevel.Optimal))
                    using (var sw = new StreamWriter(gz))
                    {
                        sw.Write(json);
                    }

                    if (File.Exists(gzPath)) File.Delete(gzPath);
                    File.Move(tmpPath, gzPath);
                }
                catch (Exception ex)
                {
                    Mod.log.Warn($"LearningDatabase.SaveToFile (json.gz) failed: {ex.Message}");
                }
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
                string data = null;

                if (File.Exists(filePath))
                {
                    // File exists. It may be plain JSON or a gzipped JSON blob. Detect gzip magic and handle both.
                    try
                    {
                        using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                        {
                            int first = fs.ReadByte();
                            int second = fs.ReadByte();
                            fs.Seek(0, SeekOrigin.Begin);
                            // GZip magic bytes: 0x1F 0x8B
                            if (first == 0x1F && second == 0x8B)
                            {
                                try
                                {
                                    using (var gz = new GZipStream(fs, CompressionMode.Decompress))
                                    using (var sr = new StreamReader(gz))
                                    {
                                        data = sr.ReadToEnd();
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Mod.log.Warn($"LearningDatabase.LoadFromFile (detected gz) failed: {ex.Message}");
                                }
                            }
                            else
                            {
                                using (var sr = new StreamReader(fs))
                                {
                                    data = sr.ReadToEnd();
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Mod.log.Warn($"LearningDatabase.LoadFromFile failed reading file: {ex.Message}");
                    }
                }
                else
                {
                    var gzPath = filePath + ".gz";
                    if (File.Exists(gzPath))
                    {
                        try
                        {
                            using (var fs = new FileStream(gzPath, FileMode.Open, FileAccess.Read, FileShare.Read))
                            using (var gz = new System.IO.Compression.GZipStream(fs, System.IO.Compression.CompressionMode.Decompress))
                            using (var sr = new StreamReader(gz))
                            {
                                data = sr.ReadToEnd();
                            }
                        }
                        catch (Exception ex)
                        {
                            Mod.log.Warn($"LearningDatabase.LoadFromFile (gz) failed: {ex.Message}");
                        }
                    }
                }

                if (!string.IsNullOrEmpty(data))
                    return DeserializeJson(data);
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
