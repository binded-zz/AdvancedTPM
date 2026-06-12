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
        private float m_UpdateTimer = 0f;
        private bool m_WasPanelOpen = false;
        private string m_LastViewMode = "";
        private string m_LastResidentialBrowserData = "{}";
        private string m_LastResidentialBuildingsData = "[]";
        private string m_LastResidentialSignatureBuildingsData = "[]";

        protected override void OnCreate()
        {
            base.OnCreate();
            Mod.log?.Info("ResidentialBrowserSystem OnCreate started");
            try { _countResidentialPropertySystem = World.GetOrCreateSystemManaged<CountResidentialPropertySystem>(); } catch { }
            try { _countHouseholdDataSystem = World.GetOrCreateSystemManaged<CountHouseholdDataSystem>(); } catch { }
            try { _citySystem = World.GetOrCreateSystemManaged<CitySystem>(); } catch { }
            try { _nameSystem = World.GetOrCreateSystemManaged<NameSystem>(); } catch { }
            try { _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>(); } catch { }
            try { _taxingProductionUISystem = World.GetOrCreateSystemManaged<TaxingProductionUISystem>(); } catch { }


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

            AddBinding(_residentialBrowserData = new ValueBinding<string>("taxProduction", "residentialBrowserData", "{}"));
            AddBinding(_residentialBuildingsData = new ValueBinding<string>("taxProduction", "residentialBuildingsData", "[]"));
            AddBinding(_residentialSignatureBuildingsData = new ValueBinding<string>("taxProduction", "residentialSignatureBuildingsData", "[]"));
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

            // Simple JSON payload for summary cards
            var payload = string.Format(CultureInfo.InvariantCulture,
                "{{\"lowTotal\":{0},\"medTotal\":{1},\"highTotal\":{2},\"lowFree\":{3},\"medFree\":{4},\"highFree\":{5},\"lowOccupied\":{6},\"medOccupied\":{7},\"highOccupied\":{8},\"avgHappiness\":{9:0.##},\"unemploymentRate\":{10:0.##},\"homelessHouseholds\":{11},\"movedInHouseholds\":{12}}}",
                lowTotal, medTotal, highTotal,
                lowFree, medFree, highFree,
                lowOccupied, medOccupied, highOccupied,
                avgHappiness, unemploymentRate,
                homelessHouseholds, movedInHouseholds);

            if (payload != m_LastResidentialBrowserData || forceUpdate)
            {
                _residentialBrowserData.Update(payload);
                m_LastResidentialBrowserData = payload;
            }
            try { Mod.log?.Info($"ResidentialBrowserSystem: summary payload len={payload?.Length ?? 0} totalUnits={lowTotal+medTotal+highTotal} occupied={lowOccupied+medOccupied+highOccupied}"); } catch { }

            // Per-building data: entityKey|address|density|level|occupied|capacity|theme|assetPack|isSignature
            UpdatePerBuildingData(forceUpdate);
            UpdateSignatureResidentialBuildings(forceUpdate);
        }

        private void UpdatePerBuildingData(bool forceUpdate = false)
        {
            if (_residentialBuildingsData == null || _residentialBuildingQuery == null) return;
            if (_residentialBuildingQuery.IsEmptyIgnoreFilter) { _residentialBuildingsData.Update(""); return; }

            // Refresh signature cache if needed
            RefreshSignatureCache();

            var em = EntityManager;
            var parts = new List<string>(256);
            var entities = _residentialBuildingQuery.ToEntityArray(Allocator.Temp);
            try
            {
                for (int i = 0; i < entities.Length && parts.Count < 150; i++)
                {
                    var ent = entities[i];
                    try
                    {
                        // Address from NameSystem
                        string address = "";
                        try { if (_nameSystem != null) address = (_nameSystem.GetRenderedLabelName(ent) ?? "").Replace("|", " ").Replace(";", " "); } catch { }

                        // Occupied count from Renter buffer
                        int occupied = 0;
                        try { if (em.HasBuffer<Renter>(ent)) occupied = em.GetBuffer<Renter>(ent).Length; } catch { }

                        // Capacity, level, theme, assetPack from prefab
                        int capacity = 0;
                        int level = 1;
                        string density = "Residential";
                        string theme = "Unknown";
                        string assetPack = "Base Game";
                        string assetPackIcon = "";
                        bool isSignature = false;
                        try
                        {
                            if (em.HasComponent<PrefabRef>(ent))
                            {
                                var pr = em.GetComponentData<PrefabRef>(ent);
                                var prefab = pr.m_Prefab;

                                // Check if signature building
                                isSignature = em.HasComponent<Game.Buildings.Signature>(ent) || 
                                              em.HasComponent<Game.Objects.UniqueObject>(ent) || 
                                              em.HasComponent<Game.Prefabs.SignatureBuildingData>(prefab) || 
                                              em.HasComponent<Game.Prefabs.UniqueObjectData>(prefab);

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
                                ExtractThemeAndAssetPack(em, prefab, out theme, out assetPack, out assetPackIcon);
                            }
                        }
                        catch { }

                        // Determine density from unit count (heuristic  zone component is on lot entity, not building)
                        if (capacity > 0)
                        {
                            if (capacity <= 4) density = "Low";
                            else if (capacity <= 20) density = "Medium";
                            else density = "High";
                        }
                        else if (occupied > 0)
                        {
                            // No capacity known but we have occupants; use occupancy as proxy
                            if (occupied <= 4) density = "Low";
                            else if (occupied <= 20) density = "Medium";
                            else density = "High";
                        }

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
                        assetPack = (assetPack ?? "Base Game").Replace("|", "-").Replace(";", "-");
                        assetPackIcon = (assetPackIcon ?? "").Replace("|", "").Replace(";", "");

                        parts.Add(string.Format(CultureInfo.InvariantCulture,
                            "{0},{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}|{9}|{10}|{11}",
                            ent.Index, ent.Version, address, districtName, density, level, occupied, capacity, theme, assetPack, isSignature ? "1" : "0", assetPackIcon));
                    }
                    catch { }
                }
            }
            finally { entities.Dispose(); }

            string payload = string.Join(";", parts);
            if (payload != m_LastResidentialBuildingsData || forceUpdate)
            {
                _residentialBuildingsData.Update(payload);
                m_LastResidentialBuildingsData = payload;
            }
            try { if (Mod.log != null) Mod.log?.Info($"ResidentialBrowserSystem: buildings payload count={parts.Count}"); } catch { }
        }

        private void RefreshSignatureCache()
        {
        }

        private void ExtractThemeAndAssetPack(EntityManager em, Entity prefabEntity, out string theme, out string assetPack, out string assetPackIcon)
        {
            theme = "Unknown";
            assetPack = "Base Game";
            assetPackIcon = "";

            try
            {
                if (_prefabSystem == null) return;

                PrefabBase prefabBase = null;
                try { prefabBase = _prefabSystem.GetPrefab<PrefabBase>(prefabEntity); } catch { }
                if (prefabBase == null) return;

                string prefabName = prefabBase.name ?? "";

                // Extract theme from prefab name patterns
                if (theme == "Unknown")
                {
                    if (prefabName.Contains("European") || prefabName.Contains("EU_") || prefabName.StartsWith("EU_")) theme = "European";
                    else if (prefabName.Contains("NorthAmerican") || prefabName.Contains("NA_") || prefabName.StartsWith("NA_") || prefabName.Contains("USA_") || prefabName.StartsWith("USA_")) theme = "North American";
                    else if (prefabName.Contains("Asian")) theme = "Asian";
                    else if (prefabName.Contains("Modern")) theme = "Modern";
                    else theme = "Mixed";
                }

                // Detect asset pack using PrefabBase component helpers
                if (prefabBase.TryGet<ContentPrerequisite>(out var cp) && cp.m_ContentPrerequisite.TryGet<DlcRequirement>(out var dlc))
                {
                    // Official DLC / Region Pack - use the DLC's named SVG from the game's Media/DLC/ folder
                    try
                    {
                        string dlcName = Colossal.PSI.Common.PlatformManager.instance.GetDlcName(dlc.m_Dlc) ?? "DLC";
                        assetPack = dlcName;
                        // Strip spaces/special chars to get the SVG filename (e.g. "Bridges & Ports" -> "BridgesandPorts")
                        assetPackIcon = $"Media/DLC/{System.Text.RegularExpressions.Regex.Replace(dlcName, @"[^a-zA-Z0-9]", "")}.svg";
                    }
                    catch { assetPack = "DLC"; assetPackIcon = ""; }
                }
                else
                {
                    var assetPackItem = prefabBase.GetComponent<AssetPackItem>();
                    if (assetPackItem != null && assetPackItem.m_Packs != null && assetPackItem.m_Packs.Length > 0)
                    {
                        var pack = assetPackItem.m_Packs[0];
                        if (pack != null)
                        {
                            // PDX Mod / user asset pack - use ImageSystem to get the pack's uploaded thumbnail
                            assetPack = pack.name ?? "Custom";
                            try { assetPackIcon = ImageSystem.GetThumbnail(pack) ?? ""; } catch { assetPackIcon = ""; }
                        }
                    }
                    else if (prefabName.StartsWith("DLC") || prefabName.Contains("_DLC"))
                    {
                        if (prefabName.Contains("DLC1")) assetPack = "DLC 1";
                        else if (prefabName.Contains("DLC2")) assetPack = "DLC 2";
                        else assetPack = "DLC";
                    }
                    else if (prefabName.Contains("Mod_") || prefabName.Contains("Custom"))
                    {
                        assetPack = "Custom";
                    }
                    // else: Base Game, icon stays empty
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

                            ExtractThemeAndAssetPack(em, prefab, out theme, out assetPack, out _);

                            theme = (theme ?? "Unknown").Replace("|", "-").Replace(";", "-");
                            assetPack = (assetPack ?? "Base Game").Replace("|", "-").Replace(";", "-");

                            signatureBuildings.Add(string.Format(CultureInfo.InvariantCulture,
                                "{0},{1}|{2}|{3}|{4}|{5}|{6}|{7}",
                                ent.Index, ent.Version, address, level, occupied, capacity, theme, assetPack));
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
