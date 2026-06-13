using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using Colossal.Logging;
using Game.Prefabs;
using Game.UI;
using Unity.Entities;

namespace AdvancedTPM
{
    public struct PrefabAssetInfo
    {
        public string Theme;
        public string ThemeIcon;
        public string AssetPack;
        public string AssetPackIcon;
        public string NativePackIcon;
        public string[] PackThumbnails;
    }

    public static class PackHelper
    {
        private static readonly ILog s_Log = LogManager.GetLogger($"{nameof(AdvancedTPM)}.{nameof(PackHelper)}");

        private static readonly ConcurrentDictionary<string, PrefabAssetInfo> s_Cache =
            new ConcurrentDictionary<string, PrefabAssetInfo>(StringComparer.OrdinalIgnoreCase);

        public static void ClearCache()
        {
            s_Cache.Clear();
        }

        private static string TryGetUIObjectIcon(PrefabBase prefab)
        {
            if (prefab == null) return "";
            try
            {
                var world = Unity.Entities.World.DefaultGameObjectInjectionWorld;
                if (world != null)
                {
                    var prefabSystem = world.GetExistingSystemManaged<PrefabSystem>();
                    if (prefabSystem != null && prefabSystem.TryGetEntity(prefab, out var entity))
                    {
                        var em = world.EntityManager;
                        if (em.HasComponent<Game.Prefabs.UIObjectData>(entity))
                        {
                            var uiData = em.GetComponentData<Game.Prefabs.UIObjectData>(entity);
                            var field = uiData.GetType().GetField("m_Icon", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
                            if (field != null)
                            {
                                var val = field.GetValue(uiData) as string;
                                if (!string.IsNullOrEmpty(val)) return val;
                            }

                            if (prefab.TryGet<UIObject>(out var uiObj))
                            {
                                return uiObj.m_Icon ?? "";
                            }
                        }
                    }
                }
            }
            catch { }
            return "";
        }

        public static PrefabAssetInfo GetPrefabAssetInfo(PrefabBase prefabBase)
        {
            if (prefabBase == null)
                return new PrefabAssetInfo { Theme = "Unknown", AssetPack = "Base Game", AssetPackIcon = "", NativePackIcon = "", PackThumbnails = new string[0] };

            string name = prefabBase.name ?? "";
            if (s_Cache.TryGetValue(name, out var cachedInfo))
                return cachedInfo;

            var info = ResolvePrefabAssetInfo(prefabBase);
            s_Cache[name] = info;
            return info;
        }

        private static PrefabAssetInfo ResolvePrefabAssetInfo(PrefabBase prefabBase)
        {
            string theme = "Unknown";
            string themeIcon = "";
            string assetPack = "Base Game";
            string assetPackIcon = "";
            var packThumbnailsList = new List<string>();

            if (prefabBase == null)
                return new PrefabAssetInfo { Theme = theme, ThemeIcon = themeIcon, AssetPack = assetPack, AssetPackIcon = assetPackIcon, NativePackIcon = assetPackIcon, PackThumbnails = new string[0] };

            if (prefabBase.TryGet<ThemeObject>(out var themeObject) && themeObject.m_Theme != null)
            {
                theme = themeObject.m_Theme.name ?? "Unknown";
                themeIcon = TryGetUIObjectIcon(themeObject.m_Theme);
            }

            // Extract pack name and icon from AssetPackItem
            var assetPackItem = prefabBase.GetComponent<AssetPackItem>();
            if (assetPackItem?.m_Packs?.Length > 0)
            {
                var pack = assetPackItem.m_Packs[0];
                if (pack != null)
                {
                    assetPack = pack.name ?? "Custom";
                    assetPackIcon = TryGetUIObjectIcon(pack);
                }

                // Collect all thumbnails from all packs
                foreach (var p in assetPackItem.m_Packs)
                {
                    if (p != null)
                    {
                        try
                        {
                            string thumb = ImageSystem.GetThumbnail(p);
                            if (!string.IsNullOrEmpty(thumb))
                            {
                                packThumbnailsList.Add(thumb);
                            }
                            else
                            {
                                // Fallback to custom object icon if image system doesn't have it
                                string uiIcon = TryGetUIObjectIcon(p);
                                if (!string.IsNullOrEmpty(uiIcon))
                                    packThumbnailsList.Add(uiIcon);
                            }
                        }
                        catch { }
                    }
                }
            }
            else if (prefabBase.TryGet<Game.Prefabs.SpawnableBuilding>(out var spawnable) && spawnable.m_ZoneType != null)
            {
                var zonePackItem = spawnable.m_ZoneType.GetComponent<AssetPackItem>();
                if (zonePackItem?.m_Packs?.Length > 0)
                {
                    var pack = zonePackItem.m_Packs[0];
                    if (pack != null)
                    {
                        assetPack = pack.name ?? "Custom";
                        assetPackIcon = TryGetUIObjectIcon(pack);
                        
                        foreach (var p in zonePackItem.m_Packs)
                        {
                            if (p != null)
                            {
                                try
                                {
                                    string thumb = ImageSystem.GetThumbnail(p);
                                    if (!string.IsNullOrEmpty(thumb)) packThumbnailsList.Add(thumb);
                                }
                                catch { }
                            }
                        }
                    }
                }
                
                // Also try to get theme from ZoneType if still Unknown
                if (theme == "Unknown")
                {
                    var zoneTheme = spawnable.m_ZoneType.GetComponent<ThemeObject>();
                    if (zoneTheme != null && zoneTheme.m_Theme != null)
                    {
                        theme = zoneTheme.m_Theme.name ?? "Unknown";
                        themeIcon = string.IsNullOrEmpty(themeIcon) ? TryGetUIObjectIcon(zoneTheme.m_Theme) : themeIcon;
                    }
                }
            }

            if (assetPack == "Base Game" && prefabBase.TryGet<ContentPrerequisite>(out var cp) && cp.m_ContentPrerequisite.TryGet<DlcRequirement>(out var dlc))
            {
                try
                {
                    assetPack = Colossal.PSI.Common.PlatformManager.instance.GetDlcName(dlc.m_Dlc) ?? "DLC";
                }
                catch { assetPack = "DLC"; }
            }

            // Fallback for custom user created assets (Paradox Mods) that lack an AssetPackItem
            if (assetPack == "Base Game" && prefabBase.asset != null && !prefabBase.asset.isBuiltin)
            {
                try
                {
                    var meta = prefabBase.asset.GetMeta();
                    if (!string.IsNullOrEmpty(meta.displayName))
                    {
                        assetPack = meta.displayName;
                    }
                    else if (!string.IsNullOrEmpty(meta.packageName))
                    {
                        assetPack = meta.packageName;
                    }
                    else
                    {
                        assetPack = "Custom Content";
                    }
                }
                catch { }
            }


            // Normalize pack names for UI grouping and presentation FIRST
            if (!string.IsNullOrEmpty(assetPack) && assetPack != "Base Game" && assetPack != "Custom" && assetPack != "DLC")
            {
                // Convert PascalCase to spaced (e.g. "BridgesAndPorts" -> "Bridges And Ports")
                if (!assetPack.Contains(" "))
                {
                    assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, "([a-z])([A-Z])", "$1 $2");
                    assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, "([A-Z]+)([A-Z][a-z])", "$1 $2");
                }

                // Clean up underscores and strip redundant words for all other packs
                assetPack = assetPack.Replace("_", " ");
                assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, @"\bAsset\b", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, @"\bPack\b", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, @"\bFilter\b", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                
                // Cleanup double spaces
                assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, @"\s+", " ").Trim();
            }

            // If still no icon, fallback to the vanilla DLC path structure ONLY for Base Game
            if (string.IsNullOrEmpty(assetPackIcon))
            {
                if (assetPack == "Base Game")
                {
                    assetPackIcon = "coui://uil/Colored/BaseGame.svg";
                }
            }

            // Ensure PackThumbnails is populated at least with the primary icon if the list is empty
            if (packThumbnailsList.Count == 0 && !string.IsNullOrEmpty(assetPackIcon))
            {
                packThumbnailsList.Add(assetPackIcon);
            }

            return new PrefabAssetInfo
            {
                Theme = theme,
                ThemeIcon = themeIcon,
                AssetPack = assetPack,
                AssetPackIcon = assetPackIcon,
                NativePackIcon = assetPackIcon,
                PackThumbnails = packThumbnailsList.ToArray()
            };
        }
    }
}
