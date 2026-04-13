using System;
using System.IO;
using System.Text;
using Newtonsoft.Json;

namespace AdvancedTPM.Utilities
{
    public class SettingsFileModel
    {
        public int DefaultGlobalTaxRate { get; set; }
        public int UpdateSpeed { get; set; }
        public int AdvancedWindowX { get; set; }
        public int AdvancedWindowY { get; set; }
        public int AdvancedWindowWidth { get; set; }
        public int AdvancedWindowHeight { get; set; }
        public bool AutoTaxEnabled { get; set; }
        public int AutoTaxInterval { get; set; }
        public int AutoTaxMinRate { get; set; }
        public int AutoTaxMaxRate { get; set; }
        public int AutoTaxHappinessWeight { get; set; }
        public string AutoTaxExcludedResources { get; set; }
        public string AutoTaxPerResourceRanges { get; set; }
        public int AutoTaxProfitWeight { get; set; }
        public int AutoTaxPanelOpacity { get; set; }
        public bool AdaptiveLearningEnabled { get; set; }
        public int LearningAggressiveness { get; set; }
        public bool ShowAdvisorPanel { get; set; }
        public bool DebugEnabled { get; set; }
        public bool ShowDebugPanel { get; set; }
        public bool ShowTips { get; set; }

        public static SettingsFileModel FromSettings(TPMModSettings s)
        {
            return new SettingsFileModel
            {
                DefaultGlobalTaxRate = s.DefaultGlobalTaxRate,
                UpdateSpeed = s.UpdateSpeed,
                AdvancedWindowX = s.AdvancedWindowX,
                AdvancedWindowY = s.AdvancedWindowY,
                AdvancedWindowWidth = s.AdvancedWindowWidth,
                AdvancedWindowHeight = s.AdvancedWindowHeight,
                AutoTaxEnabled = s.AutoTaxEnabled,
                AutoTaxInterval = s.AutoTaxInterval,
                AutoTaxMinRate = s.AutoTaxMinRate,
                AutoTaxMaxRate = s.AutoTaxMaxRate,
                AutoTaxHappinessWeight = s.AutoTaxHappinessWeight,
                AutoTaxExcludedResources = s.AutoTaxExcludedResources,
                AutoTaxPerResourceRanges = s.AutoTaxPerResourceRanges,
                AutoTaxProfitWeight = s.AutoTaxProfitWeight,
                AutoTaxPanelOpacity = s.AutoTaxPanelOpacity,
                AdaptiveLearningEnabled = s.AdaptiveLearningEnabled,
                LearningAggressiveness = s.LearningAggressiveness,
                ShowAdvisorPanel = s.ShowAdvisorPanel,
                DebugEnabled = s.DebugEnabled,
                ShowDebugPanel = s.ShowDebugPanel,
                ShowTips = s.ShowTips,
            };
        }

        public void ApplyTo(TPMModSettings s)
        {
            s.DefaultGlobalTaxRate = DefaultGlobalTaxRate;
            s.UpdateSpeed = UpdateSpeed;
            s.AdvancedWindowX = AdvancedWindowX;
            s.AdvancedWindowY = AdvancedWindowY;
            s.AdvancedWindowWidth = AdvancedWindowWidth;
            s.AdvancedWindowHeight = AdvancedWindowHeight;
            s.AutoTaxEnabled = AutoTaxEnabled;
            s.AutoTaxInterval = AutoTaxInterval;
            s.AutoTaxMinRate = AutoTaxMinRate;
            s.AutoTaxMaxRate = AutoTaxMaxRate;
            s.AutoTaxHappinessWeight = AutoTaxHappinessWeight;
            s.AutoTaxExcludedResources = AutoTaxExcludedResources;
            s.AutoTaxPerResourceRanges = AutoTaxPerResourceRanges;
            s.AutoTaxProfitWeight = AutoTaxProfitWeight;
            s.AutoTaxPanelOpacity = AutoTaxPanelOpacity;
            s.AdaptiveLearningEnabled = AdaptiveLearningEnabled;
            s.LearningAggressiveness = LearningAggressiveness;
            s.ShowAdvisorPanel = ShowAdvisorPanel;
            s.DebugEnabled = DebugEnabled;
            s.ShowDebugPanel = ShowDebugPanel;
            s.ShowTips = ShowTips;
        }

        public static string GetSettingsFilePath()
        {
            var settingsFolder = FilePaths.GetModsSettingsFolder();
            if (string.IsNullOrEmpty(settingsFolder)) return null;
            try { if (!Directory.Exists(settingsFolder)) Directory.CreateDirectory(settingsFolder); } catch { }
            return Path.Combine(settingsFolder, "settings.json");
        }

        public static void Save(TPMModSettings settings)
        {
            try
            {
                var model = FromSettings(settings);
                var path = GetSettingsFilePath();
                if (string.IsNullOrEmpty(path)) return;
                var json = JsonConvert.SerializeObject(model, Formatting.Indented);
                File.WriteAllText(path, json);
            }
            catch { }
        }

        public static void LoadInto(TPMModSettings settings)
        {
            try
            {
                var path = GetSettingsFilePath();
                if (string.IsNullOrEmpty(path) || !File.Exists(path)) return;
                var json = File.ReadAllText(path);
                var model = JsonConvert.DeserializeObject<SettingsFileModel>(json);
                if (model != null) model.ApplyTo(settings);
            }
            catch { }
        }
    }
}
