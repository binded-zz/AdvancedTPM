using Colossal.IO.AssetDatabase;
using Game.Modding;
using Game.Settings;

namespace AdvancedTPM
{
    [FileLocation("ModsSettings/AdvancedTPM/Settings")]
    [SettingsUITabOrder(TabSettings)]
    [SettingsUIGroupOrder(GroupGeneral, GroupAutoTax, GroupAdvisor, GroupDebug, GroupAbout)]
    public class TPMModSettings : ModSetting
    {
        public const string TabSettings = "AdvancedTPM";

        public const string GroupGeneral = "General";
        public const string GroupInterface = "General";
        public const string GroupAutoTax = "AutoTax";
        public const string GroupAdvisor = "Advisor";
        public const string GroupDebug = "Debug";
        public const string GroupAbout = "About";

        [SettingsUISection(TabSettings, GroupGeneral)]
        [SettingsUIDisplayName("DefaultGlobalTaxRate", "Default Tax Rate")]
        [SettingsUISlider(min = -10, max = 30, step = 1)]
        public int DefaultGlobalTaxRate { get; set; } = 15;

        [SettingsUISection(TabSettings, GroupGeneral)]
        [SettingsUIDisplayName("ShowTopLeftButton", "Show Top Left Button")]
        public bool ShowTopLeftButton { get; set; } = true;

        [SettingsUISection(TabSettings, GroupGeneral)]
        [SettingsUIDisplayName("ShowUMMButton", "Show UMM Button")]
        public bool ShowUMMButton { get; set; } = true;

        [SettingsUISection(TabSettings, GroupGeneral)]
        [SettingsUIDisplayName("UpdateSpeed", "UI Update Speed")]
        [SettingsUISlider(min = 1, max = 3, step = 1)]
        public int UpdateSpeed { get; set; } = 2;

        [SettingsUISection(TabSettings, GroupGeneral)]
        [SettingsUIHidden]
        [SettingsUISlider(min = 20, max = 2400, step = 10)]
        public int AdvancedWindowX { get; set; } = 140;

        [SettingsUISection(TabSettings, GroupGeneral)]
        [SettingsUIHidden]
        [SettingsUISlider(min = 20, max = 1400, step = 10)]
        public int AdvancedWindowY { get; set; } = 150;

        [SettingsUISection(TabSettings, GroupGeneral)]
        [SettingsUIHidden]
        [SettingsUISlider(min = 360, max = 1200, step = 10)]
        public int AdvancedWindowWidth { get; set; } = 520;

        [SettingsUISection(TabSettings, GroupGeneral)]
        [SettingsUIHidden]
        [SettingsUISlider(min = 240, max = 900, step = 10)]
        public int AdvancedWindowHeight { get; set; } = 420;

        [SettingsUISection(TabSettings, GroupAutoTax)]
        [SettingsUIDisplayName("AutoTaxEnabled", "Enable Auto Tax")]
        public bool AutoTaxEnabled { get; set; } = false;

        [SettingsUISection(TabSettings, GroupAutoTax)]
        [SettingsUIDisplayName("AutoTaxInterval", "Adjustment Speed")]
        [SettingsUISlider(min = 1, max = 5, step = 1)]
        public int AutoTaxInterval { get; set; } = 3;

        [SettingsUISection(TabSettings, GroupAutoTax)]
        [SettingsUIDisplayName("AutoTaxMinRate", "Minimum Tax Rate")]
        [SettingsUISlider(min = -10, max = 30, step = 1)]
        public int AutoTaxMinRate { get; set; } = 0;

        [SettingsUISection(TabSettings, GroupAutoTax)]
        [SettingsUIDisplayName("AutoTaxMaxRate", "Maximum Tax Rate")]
        [SettingsUISlider(min = -10, max = 30, step = 1)]
        public int AutoTaxMaxRate { get; set; } = 25;

        [SettingsUISection(TabSettings, GroupAutoTax)]
        [SettingsUIDisplayName("AutoTaxHappinessWeight", "Happiness Weight")]
        [SettingsUISlider(min = 0, max = 100, step = 5)]
        public int AutoTaxHappinessWeight { get; set; } = 50;

        [SettingsUISection(TabSettings, GroupAutoTax)]
        [SettingsUIHidden]
        public string AutoTaxExcludedResources { get; set; } = "";

        [SettingsUISection(TabSettings, GroupAutoTax)]
        [SettingsUIHidden]
        public string AutoTaxPerResourceRanges { get; set; } = "";

        [SettingsUISection(TabSettings, GroupAutoTax)]
        [SettingsUIHidden]
        [SettingsUISlider(min = 0, max = 100, step = 5)]
        public int AutoTaxProfitWeight { get; set; } = 50;

        [SettingsUISection(TabSettings, GroupAutoTax)]
        [SettingsUIHidden]
        [SettingsUISlider(min = 40, max = 100, step = 5)]
        public int AutoTaxPanelOpacity { get; set; } = 95;

        [SettingsUISection(TabSettings, GroupAdvisor)]
        [SettingsUIDisplayName("AdaptiveLearningEnabled", "Enable Adaptive Learning")]
        public bool AdaptiveLearningEnabled { get; set; } = false;

        [SettingsUISection(TabSettings, GroupAdvisor)]
        [SettingsUIDisplayName("LearningAggressiveness", "Learning Speed")]
        [SettingsUISlider(min = 1, max = 5, step = 1)]
        public int LearningAggressiveness { get; set; } = 3;

        [SettingsUISection(TabSettings, GroupAdvisor)]
        [SettingsUIDisplayName("ShowAdvisorPanel", "Show Advisor Tab")]
        public bool ShowAdvisorPanel { get; set; } = true;

        [SettingsUISection(TabSettings, GroupAdvisor)]
        [SettingsUIDisplayName("UseGameZoneIcons", "Use in-game zone icons in Advisor")]
        public bool UseGameZoneIcons { get; set; } = true;

        [SettingsUISection(TabSettings, GroupDebug)]
        [SettingsUIDisplayName("DebugEnabled", "Enable Debug Logs")]
        public bool DebugEnabled { get; set; } = false;

        [SettingsUISection(TabSettings, GroupDebug)]
        [SettingsUIDisplayName("ShowDebugPanel", "Show Debug Panel")]
        public bool ShowDebugPanel { get; set; } = false;

        [SettingsUISection(TabSettings, GroupDebug)]
        [SettingsUIDisplayName("ShowTips", "Show Tips")]
        public bool ShowTips { get; set; } = true;

        [SettingsUISection(TabSettings, GroupDebug)]
        [SettingsUIDisplayName("ResetAll", "Reset Settings")]
        [SettingsUIButton]
        public bool ResetAll
        {
            set
            {
                SetDefaults();
                ApplyAndSave();
            }
        }

        [SettingsUISection(TabSettings, GroupAbout)]
        [SettingsUIDisplayName("AboutText", "About")]
        [SettingsUIMultilineText]
        public string AboutText => "AdvancedTPM - Advanced Tax & Production Management\nVersion 1.0.0\n\nResource-level tax and production controls with movable/resizable window.";

        public TPMModSettings(IMod mod) : base(mod) { }

        public override void SetDefaults()
        {
            DefaultGlobalTaxRate = 15;
            ShowTopLeftButton = true;
            ShowUMMButton = true;
            UpdateSpeed = 2;
            AdvancedWindowX = 140;
            AdvancedWindowY = 150;
            AdvancedWindowWidth = 520;
            AdvancedWindowHeight = 420;
            AutoTaxEnabled = false;
            AutoTaxInterval = 3;
            AutoTaxMinRate = 0;
            AutoTaxMaxRate = 25;
            AutoTaxHappinessWeight = 50;
            AutoTaxExcludedResources = "";
            AutoTaxPerResourceRanges = "";
            AutoTaxProfitWeight = 50;
            AutoTaxPanelOpacity = 95;
            AdaptiveLearningEnabled = false;
            LearningAggressiveness = 3;
            ShowAdvisorPanel = true;
            UseGameZoneIcons = true;
            DebugEnabled = false;
            ShowDebugPanel = false;
            ShowTips = true;
        }

    }
}
