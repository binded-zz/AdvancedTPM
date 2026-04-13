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
            try { AdvancedTPM.Utilities.SettingsFileModel.LoadInto(Settings); } catch { }
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