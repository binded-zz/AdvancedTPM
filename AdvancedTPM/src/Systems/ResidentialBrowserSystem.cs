using Colossal.UI.Binding;
using Game.Buildings;
using Game.City;
using Game.Citizens;
using Game.Prefabs;
using Game.Simulation;
using Game.UI;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Reflection;
using Unity.Collections;
using Unity.Entities;

namespace AdvancedTPM
{
    public partial class ResidentialBrowserSystem : UISystemBase
    {
        public static bool IsSystemActive = false;
        private ValueBinding<string> _residentialBrowserData;
        private ValueBinding<string> _residentialBuildingsData;
        private ValueBinding<string> _residentialSignatureBuildingsData;
        private CountResidentialPropertySystem _countResidentialPropertySystem;
        private CountHouseholdDataSystem _countHouseholdDataSystem;
        private CitySystem _citySystem;
        private NameSystem _nameSystem;
        private PrefabSystem _prefabSystem;
        private TaxingProductionUISystem _taxingProductionUISystem;
        private readonly HashSet<int> _signaturePrefabIndices = new HashSet<int>();
        private EntityQuery _residentialBuildingQuery;
        private BufferLookup<Game.Prefabs.CityModifierData> m_CityModifierDataLookup;
        private BufferLookup<Game.Prefabs.LocalModifierData> m_LocalModifierDataLookup;
        private float m_UpdateTimer = 0f;
        private bool m_WasPanelOpen = false;
        private string m_LastViewMode = "";
        private string m_LastResidentialBrowserData = "{}";
        private string m_LastResidentialBuildingsData = "[]";
        private string m_LastResidentialSignatureBuildingsData = "[]";

        private TerrainAttractivenessSystem m_TerrainAttractivenessSystem;
        private TerrainSystem m_TerrainSystem;
        private EntityQuery m_SettingsQuery;
        private readonly List<string> _efficiencyFactorParts = new List<string>(16);

        private int m_LowPlaced = 0;
        private int m_MedPlaced = 0;
        private int m_HighPlaced = 0;
        private int m_LowUsa = 0;
        private int m_MedUsa = 0;
        private int m_HighUsa = 0;
        private int m_LowEu = 0;
        private int m_MedEu = 0;
        private int m_HighEu = 0;
        private string m_LowPacksJson = "{}";
        private string m_MedPacksJson = "{}";
        private string m_HighPacksJson = "{}";

        protected override void OnCreate()
        {
            base.OnCreate();
            Mod.log?.Info("ResidentialBrowserSystem OnCreate started");
            try { _countResidentialPropertySystem = World.GetOrCreateSystemManaged<CountResidentialPropertySystem>(); } catch (Exception e) { Mod.log?.Error($"Failed to load CountResidentialPropertySystem: {e.Message}"); }
            try { _countHouseholdDataSystem = World.GetOrCreateSystemManaged<CountHouseholdDataSystem>(); } catch (Exception e) { Mod.log?.Error($"Failed to load CountHouseholdDataSystem: {e.Message}"); }
            try { _citySystem = World.GetOrCreateSystemManaged<CitySystem>(); } catch (Exception e) { Mod.log?.Error($"Failed to load CitySystem: {e.Message}"); }
            try { _nameSystem = World.GetOrCreateSystemManaged<NameSystem>(); } catch (Exception e) { Mod.log?.Error($"Failed to load NameSystem: {e.Message}"); }
            try { _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>(); } catch (Exception e) { Mod.log?.Error($"Failed to load PrefabSystem: {e.Message}"); }
            try { _taxingProductionUISystem = World.GetOrCreateSystemManaged<TaxingProductionUISystem>(); } catch (Exception e) { Mod.log?.Error($"Failed to load TaxingProductionUISystem: {e.Message}"); }

            try { m_TerrainAttractivenessSystem = World.GetOrCreateSystemManaged<TerrainAttractivenessSystem>(); } catch { }
            try { m_TerrainSystem = World.GetOrCreateSystemManaged<TerrainSystem>(); } catch { }
            m_SettingsQuery = GetEntityQuery(ComponentType.ReadOnly<AttractivenessParameterData>());


            // Query residential buildings: any building entity with a ResidentialProperty tag/component
            try
            {
                _residentialBuildingQuery = GetEntityQuery(new EntityQueryDesc
                {
                    All = new ComponentType[]
                    {
                        ComponentType.ReadOnly<ResidentialProperty>(),
                        ComponentType.ReadOnly<PrefabRef>(),
                    }
                });
            }
            catch (Exception ex) { Mod.log?.Warn($"ResidentialBrowserSystem Query Error: {ex.Message}"); }

            m_CityModifierDataLookup = GetBufferLookup<Game.Prefabs.CityModifierData>(true);
            m_LocalModifierDataLookup = GetBufferLookup<Game.Prefabs.LocalModifierData>(true);

            AddBinding(_residentialBrowserData = new ValueBinding<string>("taxProduction", "residentialBrowserData", "{}"));
            AddBinding(_residentialBuildingsData = new ValueBinding<string>("taxProduction", "residentialBuildingsData", "[]"));
            AddBinding(_residentialSignatureBuildingsData = new ValueBinding<string>("taxProduction", "residentialSignatureBuildingsData", "[]"));
            
            try { InitializeHappinessDependencies(); } catch (Exception ex) { Mod.log?.Warn($"Failed to initialize happiness dependencies: {ex.Message}"); }

            Mod.log?.Info("ResidentialBrowserSystem OnCreate finished");
        }

        private int m_FrameCounter = 0;
        protected override void OnUpdate()
        {
            if (!IsSystemActive)
            {
                this.Dependency = Dependency;
                return;
            }
            // ── Global UI Sleep Gate ──────────────────────────────────────────────────
            // Building queries and JSON serialization serve no purpose while the panel is hidden.
            if (_taxingProductionUISystem == null || !_taxingProductionUISystem.IsPanelOpen || (_taxingProductionUISystem.ActiveViewMode != "residential" && _taxingProductionUISystem.ActiveViewMode != "signature"))
            {
                m_WasPanelOpen = false;
                m_LastViewMode = "";
                this.Dependency = Dependency;
                return;
            }

            string currentViewMode = _taxingProductionUISystem.ActiveViewMode;
            bool viewModeChanged = (currentViewMode != m_LastViewMode);
            m_LastViewMode = currentViewMode;

            bool justOpened = !m_WasPanelOpen || viewModeChanged;
            m_WasPanelOpen = true;

            if (Mod.Settings == null)
            {
                this.Dependency = Dependency;
                return;
            }
            
            m_CityModifierDataLookup.Update(this);
            m_LocalModifierDataLookup.Update(this);
            
            try { UpdateHappinessDependencies(); } catch (Exception ex) { Mod.log?.Warn($"Failed to update happiness dependencies: {ex.Message}"); }

            m_UpdateTimer += World.Time.DeltaTime;
            if (m_UpdateTimer < 10.0f && !justOpened)
            {
                this.Dependency = Dependency;
                return;
            }
            m_UpdateTimer = 0f;
            
            if (currentViewMode == "signature")
            {
                try { UpdateSignatureResidentialBuildings(justOpened); } catch (Exception ex) { try { Mod.log?.Warn($"ResidentialBrowserSystem UpdateSignatureResidentialBuildings Error: {ex.Message}"); } catch { } }
            }
            else
            {
                try { UpdateResidentialData(justOpened); } catch (Exception ex) { try { Mod.log?.Warn($"ResidentialBrowserSystem UpdateResidentialData Error: {ex.Message}"); } catch { } }
            }
        }

        private void UpdateResidentialData(bool forceUpdate = false)
        {
            if (_residentialBrowserData == null) return;

            // 1. Run UpdatePerBuildingData first to compile summary statistics from the query
            UpdatePerBuildingData(forceUpdate);
            UpdateSignatureResidentialBuildings(forceUpdate);

            int lowTotal = 0, medTotal = 0, highTotal = 0;
            int lowFree = 0, medFree = 0, highFree = 0;
            int lowOccupied = 0, medOccupied = 0, highOccupied = 0;
            float avgHappiness = 0f;
            float unemploymentRate = 0f;
            int homelessHouseholds = 0;
            int movedInHouseholds = 0;

            try
            {
                if (_countResidentialPropertySystem != null)
                {
                    var residentialData = _countResidentialPropertySystem.GetResidentialPropertyData();
                    var total = residentialData.m_TotalProperties;
                    var free = residentialData.m_FreeProperties;
                    lowTotal = total.x; medTotal = total.y; highTotal = total.z;
                    lowFree = free.x; medFree = free.y; highFree = free.z;
                    lowOccupied = Math.Max(0, lowTotal - lowFree);
                    medOccupied = Math.Max(0, medTotal - medFree);
                    highOccupied = Math.Max(0, highTotal - highFree);
                }
            }
            catch { }

            try
            {
                if (_countHouseholdDataSystem != null)
                {
                    var hh = _countHouseholdDataSystem.GetHouseholdCountData();
                    homelessHouseholds = hh.m_HomelessHouseholdCount;
                    movedInHouseholds = hh.m_MovedInHouseholdCount;
                    unemploymentRate = _countHouseholdDataSystem.UnemploymentRate;
                }
            }
            catch { }

            try
            {
                if (_citySystem != null)
                {
                    var city = _citySystem.City;
                    if (EntityManager.Exists(city) && EntityManager.HasComponent<Population>(city))
                    {
                        var population = EntityManager.GetComponentData<Population>(city);
                        avgHappiness = population.m_AverageHappiness;
                    }
                }
            }
            catch { }

            // 2. Now serialize payload with the full city summary counts
            var payload = string.Format(CultureInfo.InvariantCulture,
                "{{\"lowTotal\":{0},\"medTotal\":{1},\"highTotal\":{2},\"lowFree\":{3},\"medFree\":{4},\"highFree\":{5},\"lowOccupied\":{6},\"medOccupied\":{7},\"highOccupied\":{8},\"avgHappiness\":{9:0.##},\"unemploymentRate\":{10:0.##},\"homelessHouseholds\":{11},\"movedInHouseholds\":{12},\"lowPlaced\":{13},\"medPlaced\":{14},\"highPlaced\":{15},\"lowUsa\":{16},\"medUsa\":{17},\"highUsa\":{18},\"lowEu\":{19},\"medEu\":{20},\"highEu\":{21},\"lowPacks\":{22},\"medPacks\":{23},\"highPacks\":{24}}}",
                lowTotal, medTotal, highTotal,
                lowFree, medFree, highFree,
                lowOccupied, medOccupied, highOccupied,
                avgHappiness, unemploymentRate,
                homelessHouseholds, movedInHouseholds,
                m_LowPlaced, m_MedPlaced, m_HighPlaced,
                m_LowUsa, m_MedUsa, m_HighUsa,
                m_LowEu, m_MedEu, m_HighEu,
                m_LowPacksJson, m_MedPacksJson, m_HighPacksJson);

            if (payload != m_LastResidentialBrowserData || forceUpdate)
            {
                _residentialBrowserData.Update(payload);
                m_LastResidentialBrowserData = payload;
            }
        }

        private string DictionaryToJson(Dictionary<string, int> dict)
        {
            var items = new List<string>();
            foreach (var kvp in dict)
            {
                string key = (kvp.Key ?? "Base Game").Replace("\"", "\\\"");
                items.Add(string.Format(CultureInfo.InvariantCulture, "\"{0}\":{1}", key, kvp.Value));
            }
            return "{" + string.Join(",", items) + "}";
        }

        private void UpdatePerBuildingData(bool forceUpdate = false)
        {
            if (_residentialBuildingsData == null || _residentialBuildingQuery == null) return;
            if (_residentialBuildingQuery.IsEmptyIgnoreFilter) { _residentialBuildingsData.Update(""); return; }

            // Reset summary counters
            m_LowPlaced = 0; m_MedPlaced = 0; m_HighPlaced = 0;
            m_LowUsa = 0; m_MedUsa = 0; m_HighUsa = 0;
            m_LowEu = 0; m_MedEu = 0; m_HighEu = 0;
            var lowPacks = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var medPacks = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var highPacks = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            // Refresh signature cache if needed
            RefreshSignatureCache();

            var em = EntityManager;
            var parts = new List<string>(256);
            var entities = _residentialBuildingQuery.ToEntityArray(Allocator.Temp);
            try
            {
                for (int i = 0; i < entities.Length; i++)
                {
                    var ent = entities[i];
                    try
                    {
                        // Capacity, level, theme, assetPack from prefab
                        int capacity = 0;
                        int level = 1;
                        string density = "Residential";
                        string theme = "Unknown";
                        string assetPack = "Base Game";
                        string assetPackIcon = "";
                        string themeIcon = "";
                        string cityEffects = "";
                        string localEffects = "";
                        string attractivenessFactors = "";
                        bool isSignature = false;

                        if (em.HasComponent<PrefabRef>(ent))
                        {
                            var pr = em.GetComponentData<PrefabRef>(ent);
                            var prefab = pr.m_Prefab;

                            // Check if signature building
                            isSignature = em.HasComponent<Game.Buildings.Signature>(ent) || 
                                          em.HasComponent<Game.Objects.UniqueObject>(ent) || 
                                          em.HasComponent<Game.Prefabs.SignatureBuildingData>(prefab) || 
                                          em.HasComponent<Game.Prefabs.UniqueObjectData>(prefab);
                            if (!isSignature && _prefabSystem != null)
                            {
                                try
                                {
                                    string pName = _prefabSystem.GetPrefabName(prefab) ?? "";
                                    string pNameLower = pName.ToLowerInvariant();
                                    if (pNameLower.Contains("signature") || pNameLower.Contains("landmark") || pNameLower.Contains("monument") || pNameLower.Contains("unique"))
                                    {
                                        isSignature = true;
                                    }
                                }
                                catch {}
                            }

                            if (em.HasComponent<BuildingPropertyData>(prefab))
                            {
                                var bpd = em.GetComponentData<BuildingPropertyData>(prefab);
                                capacity = bpd.m_ResidentialProperties;
                            }
                            if (em.HasComponent<SpawnableBuildingData>(prefab))
                            {
                                var sbd = em.GetComponentData<SpawnableBuildingData>(prefab);
                                level = sbd.m_Level;
                            }

                            // Extract theme and asset pack
                            ExtractThemeAndAssetPack(em, prefab, out theme, out themeIcon, out assetPack, out assetPackIcon);

                            List<string> cEffects = new List<string>();
                            List<string> lEffects = new List<string>();
                            if (m_CityModifierDataLookup.HasBuffer(prefab))
                            {
                                foreach (var c in m_CityModifierDataLookup[prefab])
                                {
                                    string sMode = c.m_Mode == Game.Prefabs.ModifierValueMode.Relative ? "%" : "";
                                    cEffects.Add($"{c.m_Type} | {c.m_Range.min}{sMode} to {c.m_Range.max}{sMode}");
                                }
                            }
                            if (m_LocalModifierDataLookup.HasBuffer(prefab))
                            {
                                foreach (var l in m_LocalModifierDataLookup[prefab])
                                {
                                    string sMode = l.m_Mode == Game.Prefabs.ModifierValueMode.Relative ? "%" : "";
                                    lEffects.Add($"{l.m_Type} | Delta: {l.m_Delta.min}{sMode} to {l.m_Delta.max}{sMode} | Reach: {l.m_Radius.max}");
                                }
                            }
                            cityEffects = string.Join("^", cEffects);
                            localEffects = string.Join("^", lEffects);
                        }

                        // Occupied count from Renter buffer
                        int occupied = 0;
                        try { if (em.HasBuffer<Renter>(ent)) occupied = em.GetBuffer<Renter>(ent).Length; } catch { }

                        // Determine density from unit count
                        if (capacity > 0)
                        {
                            if (capacity <= 4) density = "Low";
                            else if (capacity <= 20) density = "Medium";
                            else density = "High";
                        }
                        else if (occupied > 0)
                        {
                            if (occupied <= 4) density = "Low";
                            else if (occupied <= 20) density = "Medium";
                            else density = "High";
                        }

                        // --- Attractiveness ---
                        int attractiveness = 0;
                        try
                        {
                            if (em.HasComponent<PrefabRef>(ent))
                            {
                                Entity prefab = em.GetComponentData<PrefabRef>(ent).m_Prefab;
                                if (Game.Prefabs.UpgradeUtils.TryGetCombinedComponent<Game.Prefabs.AttractionData>(em, ent, prefab, out var attractionData))
                                    attractiveness = attractionData.m_Attractiveness;
                            }

                            if (em.HasComponent<Game.Buildings.AttractivenessProvider>(ent))
                            {
                                var attrProv = em.GetComponentData<Game.Buildings.AttractivenessProvider>(ent);
                                if (attrProv.m_Attractiveness > attractiveness) attractiveness = attrProv.m_Attractiveness;
                            }
                        }
                        catch { }

                        // Determine theme (USA/EU)
                        string address = "";
                        try { if (_nameSystem != null) address = (_nameSystem.GetRenderedLabelName(ent) ?? "").Replace("|", " ").Replace(";", " "); } catch { }
                        
                        string themeLower = $"{theme} {address}".ToLower();
                        bool isEu = themeLower.Contains("eu") || themeLower.Contains("europe") || themeLower.Contains("mediterranean");

                        // Aggregate counts globally across all residential buildings in the city
                        if (density == "Low")
                        {
                            m_LowPlaced++;
                            if (isEu) m_LowEu++; else m_LowUsa++;
                            lowPacks[assetPack] = lowPacks.TryGetValue(assetPack, out var count) ? count + 1 : 1;
                        }
                        else if (density == "Medium")
                        {
                            m_MedPlaced++;
                            if (isEu) m_MedEu++; else m_MedUsa++;
                            medPacks[assetPack] = medPacks.TryGetValue(assetPack, out var count) ? count + 1 : 1;
                        }
                        else if (density == "High")
                        {
                            m_HighPlaced++;
                            if (isEu) m_HighEu++; else m_HighUsa++;
                            highPacks[assetPack] = highPacks.TryGetValue(assetPack, out var count) ? count + 1 : 1;
                        }

                        // Write to detail row list only if within limit (to avoid rendering 10000 elements)
                        if (parts.Count < 5000)
                        {
                            // Ensure we have something useful to display
                            if (string.IsNullOrEmpty(address)) address = "Building " + ent.Index;

                            string districtName = "City";
                            try
                            {
                                Entity districtEntity = Entity.Null;
                                if (em.HasComponent<Game.Areas.CurrentDistrict>(ent)) 
                                    districtEntity = em.GetComponentData<Game.Areas.CurrentDistrict>(ent).m_District;

                                if (districtEntity != Entity.Null && _nameSystem != null)
                                {
                                    districtName = _nameSystem.GetRenderedLabelName(districtEntity) ?? "City";
                                }
                            }
                            catch { }

                            // Clean pipe and semicolon from theme/assetPack to prevent parsing issues
                            theme = (theme ?? "Unknown").Replace("|", "-").Replace(";", "-");
                            themeIcon = (themeIcon ?? "").Replace("|", "").Replace(";", "");
                            assetPack = (assetPack ?? "Base Game").Replace("|", "-").Replace(";", "-");
                            assetPackIcon = (assetPackIcon ?? "").Replace("|", "").Replace(";", "");

                            string happinessFactors = GetHappinessFactorsString(ent);
                            parts.Add(string.Format(CultureInfo.InvariantCulture,
                                "{0},{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}|{9}|{10}|{11}|{12}|{13}|{14}|{15}|{16}|{17}",
                                ent.Index, ent.Version, address, districtName, density, level, occupied, capacity, theme, assetPack, isSignature ? "1" : "0", assetPackIcon, themeIcon, cityEffects, localEffects, attractiveness, attractivenessFactors, happinessFactors));
                        }
                    }
                    catch { }
                }
            }
            finally { entities.Dispose(); }

            // Serialize dictionary packs to JSON strings
            m_LowPacksJson = DictionaryToJson(lowPacks);
            m_MedPacksJson = DictionaryToJson(medPacks);
            m_HighPacksJson = DictionaryToJson(highPacks);

            string payload = string.Join(";", parts);
            if (payload != m_LastResidentialBuildingsData || forceUpdate)
            {
                _residentialBuildingsData.Update(payload);
                m_LastResidentialBuildingsData = payload;
            }
        }

        private void RefreshSignatureCache()
        {
        }

        private void ExtractThemeAndAssetPack(EntityManager em, Entity prefabEntity, out string theme, out string themeIcon, out string assetPack, out string assetPackIcon)
        {
            theme = "Unknown";
            themeIcon = "";
            assetPack = "Base Game";
            assetPackIcon = "";

            if (_prefabSystem == null) return;

            try
            {
                var pb = _prefabSystem.GetPrefab<PrefabBase>(prefabEntity);
                if (pb != null)
                {
                    var info = PackHelper.GetPrefabAssetInfo(pb);
                    theme = info.Theme;
                    themeIcon = info.ThemeIcon;
                    assetPack = info.AssetPack;
                    assetPackIcon = info.PackThumbnails != null ? string.Join(",", info.PackThumbnails) : "";
                }
            }
            catch { }
        }

        private void UpdateSignatureResidentialBuildings(bool forceUpdate = false)
        {
            if (_residentialSignatureBuildingsData == null) return;

            try
            {
                var em = EntityManager;
                var signatureBuildings = new List<string>();
                var entities = _residentialBuildingQuery.ToEntityArray(Allocator.Temp);
                try
                {
                    foreach (var ent in entities)
                    {
                        try
                        {
                             if (!em.HasComponent<PrefabRef>(ent)) continue;
                             var pr = em.GetComponentData<PrefabRef>(ent);
                             var prefab = pr.m_Prefab;

                             bool isSig = em.HasComponent<Game.Buildings.Signature>(ent) || 
                                          em.HasComponent<Game.Objects.UniqueObject>(ent) || 
                                          em.HasComponent<Game.Prefabs.SignatureBuildingData>(prefab) || 
                                          em.HasComponent<Game.Prefabs.UniqueObjectData>(prefab);
                             if (!isSig && _prefabSystem != null)
                             {
                                 try
                                 {
                                     string pName = _prefabSystem.GetPrefabName(prefab) ?? "";
                                     string pNameLower = pName.ToLowerInvariant();
                                     if (pNameLower.Contains("signature") || pNameLower.Contains("landmark") || pNameLower.Contains("monument") || pNameLower.Contains("unique"))
                                     {
                                         isSig = true;
                                     }
                                 }
                                 catch {}
                             }
                             if (!isSig) continue;

                            string address = "";
                            try { if (_nameSystem != null) address = (_nameSystem.GetRenderedLabelName(ent) ?? "").Replace("|", " ").Replace(";", " "); } catch { }
                            if (string.IsNullOrEmpty(address)) address = "Signature Building " + ent.Index;

                            int occupied = 0;
                            try { if (em.HasBuffer<Renter>(ent)) occupied = em.GetBuffer<Renter>(ent).Length; } catch { }

                            int capacity = 0;
                            int level = 1;
                            string theme = "Unknown";
                            string assetPack = "Base Game";

                            if (em.HasComponent<BuildingPropertyData>(prefab))
                            {
                                var bpd = em.GetComponentData<BuildingPropertyData>(prefab);
                                capacity = bpd.m_ResidentialProperties;
                            }
                            if (em.HasComponent<SpawnableBuildingData>(prefab))
                            {
                                var sbd = em.GetComponentData<SpawnableBuildingData>(prefab);
                                level = sbd.m_Level;
                            }

                            string themeIcon = "";
                            string assetPackIcon = "";
                            ExtractThemeAndAssetPack(em, prefab, out theme, out themeIcon, out assetPack, out assetPackIcon);

                            int attractiveness = 0;
                            string attractivenessFactors = "";
                            try
                            {
                                if (Game.Prefabs.UpgradeUtils.TryGetCombinedComponent<Game.Prefabs.AttractionData>(em, ent, prefab, out var attractionData))
                                    attractiveness = attractionData.m_Attractiveness;

                                if (em.HasComponent<Game.Buildings.AttractivenessProvider>(ent))
                                {
                                    var attrProv = em.GetComponentData<Game.Buildings.AttractivenessProvider>(ent);
                                    if (attrProv.m_Attractiveness > attractiveness) attractiveness = attrProv.m_Attractiveness;
                                }
                            } catch { }

                            List<string> cEffects = new List<string>();
                            List<string> lEffects = new List<string>();
                            if (m_CityModifierDataLookup.HasBuffer(prefab))
                            {
                                foreach (var c in m_CityModifierDataLookup[prefab])
                                {
                                    string sMode = c.m_Mode == Game.Prefabs.ModifierValueMode.Relative ? "%" : "";
                                    cEffects.Add($"{c.m_Type} | {c.m_Range.min}{sMode} to {c.m_Range.max}{sMode}");
                                }
                            }
                            if (m_LocalModifierDataLookup.HasBuffer(prefab))
                            {
                                foreach (var l in m_LocalModifierDataLookup[prefab])
                                {
                                    string sMode = l.m_Mode == Game.Prefabs.ModifierValueMode.Relative ? "%" : "";
                                    lEffects.Add($"{l.m_Type} | Delta: {l.m_Delta.min}{sMode} to {l.m_Delta.max}{sMode} | Reach: {l.m_Radius.max}");
                                }
                            }
                            string cityEffects = string.Join("^", cEffects);
                            string localEffects = string.Join("^", lEffects);

                            theme = (theme ?? "Unknown").Replace("|", "-").Replace(";", "-");
                            themeIcon = (themeIcon ?? "").Replace("|", "").Replace(";", "");
                            assetPack = (assetPack ?? "Base Game").Replace("|", "-").Replace(";", "-");
                            assetPackIcon = (assetPackIcon ?? "").Replace("|", "").Replace(";", "");

                            string happinessFactors = GetHappinessFactorsString(ent);

                            signatureBuildings.Add(string.Format(CultureInfo.InvariantCulture,
                                "{0},{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}|{9}|{10}|{11}|{12}|{13}|{14}",
                                ent.Index, ent.Version, address, level, occupied, capacity, theme, assetPack, assetPackIcon, themeIcon, cityEffects, localEffects, attractiveness, attractivenessFactors, happinessFactors));
                        }
                        catch { }
                    }
                }
                finally { entities.Dispose(); }

                string payload = string.Join(";", signatureBuildings);
                if (payload != m_LastResidentialSignatureBuildingsData || forceUpdate)
                {
                    _residentialSignatureBuildingsData.Update(payload);
                    m_LastResidentialSignatureBuildingsData = payload;
                }
            }
            catch (Exception ex) { try { Mod.log?.Warn($"ResidentialBrowserSystem UpdateSignatureResidentialBuildings Error: {ex.Message}"); } catch { } }
        }
    }
}
