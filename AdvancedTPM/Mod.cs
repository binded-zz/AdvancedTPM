using Colossal.Logging;
using Colossal.IO.AssetDatabase;
using Game;
using Game.Modding;
using Game.SceneFlow;
using Game.Settings;

namespace AdvancedTPM
{
    public class Mod : IMod
    {
        public static readonly string Name = "AdvancedTPM";
        public static readonly string Version = "1.0.0";
        public static ILog log = LogManager.GetLogger($"{nameof(AdvancedTPM)}.{nameof(Mod)}").SetShowsErrorsInUI(false);
        public static TPMModSettings Settings { get; private set; }

        public void OnLoad(UpdateSystem updateSystem)
        {
            log.Info($"Loading {Name} v{Version}");
            // Ensure mod directories exist under game's LocalLow path
            try { AdvancedTPM.Utilities.FilePaths.EnsureModDirectories(); } catch { }

            Settings = new TPMModSettings(this);
            // Load persisted settings from our mod data folder (if present)
        var settingsPath = AdvancedTPM.Utilities.SettingsFileModel.GetSettingsFilePath();
        var settingsFileExists = false;
        try { settingsFileExists = !string.IsNullOrEmpty(settingsPath) && System.IO.File.Exists(settingsPath); } catch { }
        try { AdvancedTPM.Utilities.SettingsFileModel.LoadInto(Settings); } catch { }

        // If there was no settings file (first run), compute a sensible default window size
        // scaled for the current screen resolution (UI uses rem units with 1rem ~= 1px at 1080p).
        if (!settingsFileExists)
        {
            try
            {
                var baseWidth = 520f; // design value at 1080p
                var baseHeight = 420f;
                var height = UnityEngine.Screen.height;
                var scale = (height > 0) ? (height / 1080f) : 1f;
                var proposedW = (int)System.Math.Round(baseWidth * scale);
                var proposedH = (int)System.Math.Round(baseHeight * scale);
                // Clamp to allowed slider bounds in TPMModSettings attributes
                proposedW = System.Math.Max(360, System.Math.Min(1200, proposedW));
                proposedH = System.Math.Max(240, System.Math.Min(900, proposedH));
                Settings.AdvancedWindowWidth = proposedW;
                Settings.AdvancedWindowHeight = proposedH;
                log.Info($"First-run: setting default advanced window size to {proposedW}x{proposedH} (scale={scale:F2})");
                // Persist the computed defaults so subsequent launches use them
                try { AdvancedTPM.Utilities.SettingsFileModel.Save(Settings); } catch { }
            }
            catch (System.Exception ex)
            {
                log.Warn($"Failed to compute scaled default window size: {ex.Message}");
            }
        }
            Settings.RegisterInOptionsUI();
            GameManager.instance.localizationManager.AddSource("en-US", new LocaleEN(Settings));
            AssetDatabase.global.LoadSettings(nameof(AdvancedTPM), Settings, new TPMModSettings(this));

            updateSystem.UpdateAt<TaxingProductionUISystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<AutoTaxSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<CompanyBrowserSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<AdaptiveLearningSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<ResidentialBrowserSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<ServicesBrowserSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<DistrictBrowserSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<AdvancedTPM.Systems.DistrictHappinessAggregationSystem>(SystemUpdatePhase.GameSimulation);
            updateSystem.UpdateAt<ModDebugSystem>(SystemUpdatePhase.UIUpdate);

            log.Info($"{Name} loaded successfully");

            // Save settings to our mod data folder to ensure they're available next load
            try { AdvancedTPM.Utilities.SettingsFileModel.Save(Settings); } catch { }
        }

        public void OnDispose()
        {
            Settings?.UnregisterInOptionsUI();
            Settings = null;
            log.Info($"Disposing {Name}");
        }

    }
}
