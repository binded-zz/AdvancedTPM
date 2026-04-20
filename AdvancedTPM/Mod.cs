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

        // If there was no settings file (first run), set the user-provided default window position/size
        if (!settingsFileExists)
        {
            try
            {
                Settings.AdvancedWindowX = 180;
                Settings.AdvancedWindowY = 20;
                Settings.AdvancedWindowWidth = 1300;
                Settings.AdvancedWindowHeight = 940;
                log.Info($"First-run: applying default advanced window position/size {Settings.AdvancedWindowX},{Settings.AdvancedWindowY} {Settings.AdvancedWindowWidth}x{Settings.AdvancedWindowHeight}");
                try { AdvancedTPM.Utilities.SettingsFileModel.Save(Settings); } catch { }
            }
            catch (System.Exception ex)
            {
                log.Warn($"Failed to apply default window size: {ex.Message}");
            }
        }
            Settings.RegisterInOptionsUI();
            GameManager.instance.localizationManager.AddSource("en-US", new LocaleEN(Settings));
            AssetDatabase.global.LoadSettings(nameof(AdvancedTPM), Settings, new TPMModSettings(this));

            updateSystem.UpdateAt<TaxingProductionUISystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<AutoTaxSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<CompanyBrowserSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<AdaptiveLearningSystem>(SystemUpdatePhase.UIUpdate);

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