using Colossal;
using System.Collections.Generic;

namespace AdvancedTPM
{
    public class LocaleEN : IDictionarySource
    {
        private readonly TPMModSettings _settings;

        public LocaleEN(TPMModSettings settings)
        {
            _settings = settings;
        }

        public IEnumerable<KeyValuePair<string, string>> ReadEntries(IList<IDictionaryEntryError> errors, Dictionary<string, int> indexCounts)
        {
            var entries = new Dictionary<string, string>
            {
                // Mod name shown in the game settings menu sidebar
                { _settings.GetSettingsLocaleID(), "Advanced TPM" },

                // Tab
                { _settings.GetOptionTabLocaleID(TPMModSettings.TabSettings), "Advanced TPM" },

                // Groups
                { _settings.GetOptionGroupLocaleID(TPMModSettings.GroupGeneral), "General" },
                { _settings.GetOptionGroupLocaleID(TPMModSettings.GroupAutoTax), "Auto Tax" },
                { _settings.GetOptionGroupLocaleID(TPMModSettings.GroupAdvisor), "Advisor" },
                { _settings.GetOptionGroupLocaleID(TPMModSettings.GroupDebug), "Debug" },
                { _settings.GetOptionGroupLocaleID(TPMModSettings.GroupAbout), "About" },

                // General group
                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.DefaultGlobalTaxRate)), "Default Tax Rate" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.DefaultGlobalTaxRate)), "Base tax value applied to resource rows when loaded." },

                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.UpdateSpeed)), "UI Update Speed" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.UpdateSpeed)), "1 = Fast, 2 = Normal, 3 = Slow. Controls how often the UI refreshes data." },

                // Auto Tax group
                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.AutoTaxEnabled)), "Enable Auto Tax" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.AutoTaxEnabled)), "Automatically adjust per-resource tax rates based on profitability and happiness." },

                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.AutoTaxInterval)), "Adjustment Interval" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.AutoTaxInterval)), "How often auto-tax runs. Higher = less frequent adjustments." },

                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.AutoTaxMinRate)), "Minimum Tax Rate" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.AutoTaxMinRate)), "Auto-tax will never lower a rate below this value." },

                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.AutoTaxMaxRate)), "Maximum Tax Rate" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.AutoTaxMaxRate)), "Auto-tax will never raise a rate above this value." },

                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.AutoTaxHappinessWeight)), "Happiness Weight" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.AutoTaxHappinessWeight)), "How much city wellbeing influences tax direction. 0 = ignore, 100 = primary factor." },

                // Advisor group
                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.AdaptiveLearningEnabled)), "Enable Adaptive Learning" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.AdaptiveLearningEnabled)), "Learns how your city responds to tax changes over time and improves decisions automatically." },

                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.LearningAggressiveness)), "Learning Speed" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.LearningAggressiveness)), "1 = Very Conservative, 3 = Balanced, 5 = Very Aggressive. Controls how fast the system adapts." },

                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.ShowAdvisorPanel)), "Show Advisor Tab" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.ShowAdvisorPanel)), "Show the Advisor tab in the Advanced TPM window with recommendations and decision history." },

                // Debug group
                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.DebugEnabled)), "Enable Debug Logs" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.DebugEnabled)), "Write TPM actions to game logs." },

                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.ShowDebugPanel)), "Show Debug Panel" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.ShowDebugPanel)), "Display the on-screen debug panel when active." },

                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.ShowTips)), "Show Tips" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.ShowTips)), "Show tooltips and usage tips in basic and advanced UIs." },

                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.ResetAll)), "Reset All Settings" },
                { _settings.GetOptionDescLocaleID(nameof(TPMModSettings.ResetAll)), "Reset options, view mode, and saved window geometry." },

                // About group
                { _settings.GetOptionLabelLocaleID(nameof(TPMModSettings.AboutText)), "About" },
            };

            return entries;
        }

        public void Unload() { }
    }
}
