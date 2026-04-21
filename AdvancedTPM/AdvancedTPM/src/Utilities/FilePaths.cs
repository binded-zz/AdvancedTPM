using System;
using System.IO;

namespace AdvancedTPM.Utilities
{
    public static class FilePaths
    {
        // Returns the LocalLow game root for Cities Skylines II (AppData\LocalLow\Colossal Order\Cities Skylines II)
        public static string GetGameLocalLowFolder()
        {
            try
            {
                var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                // Construct AppData\LocalLow path reliably
                var localLow = Path.Combine(userProfile, "AppData", "LocalLow");
                var gameFolder = Path.Combine(localLow, "Colossal Order", "Cities Skylines II");
                return gameFolder;
            }
            catch
            {
                return null;
            }
        }

        // Mods folder under the game LocalLow
        public static string GetModsFolder()
        {
            var root = GetGameLocalLowFolder();
            if (string.IsNullOrEmpty(root)) return null;
            return Path.Combine(root, "Mods");
        }

        // Mod-specific folder for AdvancedTPM under Mods
        public static string GetModFolder()
        {
            var mods = GetModsFolder();
            if (string.IsNullOrEmpty(mods)) return null;
            return Path.Combine(mods, "AdvancedTPM");
        }

        // ModsSettings folder (global settings area) -> ModsSettings\AdvancedTPM
        public static string GetModsSettingsFolder()
        {
            var root = GetGameLocalLowFolder();
            if (string.IsNullOrEmpty(root)) return null;
            return Path.Combine(root, "ModsSettings", "AdvancedTPM");
        }

        // ModsData folder (global mod data) -> ModsData\AdvancedTPM
        public static string GetModsDataFolder()
        {
            var root = GetGameLocalLowFolder();
            if (string.IsNullOrEmpty(root)) return null;
            return Path.Combine(root, "ModsData", "AdvancedTPM");
        }

        // Logs folder used by the game
        public static string GetGameLogsFolder()
        {
            var root = GetGameLocalLowFolder();
            if (string.IsNullOrEmpty(root)) return null;
            return Path.Combine(root, "Logs");
        }

        // Ensure all standard directories for the mod exist
        public static void EnsureModDirectories()
        {
            try
            {
                var modFolder = GetModFolder();
                if (!string.IsNullOrEmpty(modFolder) && !Directory.Exists(modFolder))
                    Directory.CreateDirectory(modFolder);

                var logs = GetGameLogsFolder();
                if (!string.IsNullOrEmpty(logs) && !Directory.Exists(logs))
                    Directory.CreateDirectory(logs);

                var settings = GetModsSettingsFolder();
                if (!string.IsNullOrEmpty(settings) && !Directory.Exists(settings))
                    Directory.CreateDirectory(settings);

                var data = GetModsDataFolder();
                if (!string.IsNullOrEmpty(data) && !Directory.Exists(data))
                    Directory.CreateDirectory(data);
            }
            catch { }
        }
    }
}
