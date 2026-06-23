using Colossal.UI.Binding;
using Game.Buildings;
using Game.Citizens;
using Game.City;
using Game.Companies;
using Game.Prefabs;
using Game.Simulation;
using Game.UI;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using Unity.Collections;
using Unity.Entities;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace AdvancedTPM
{
    [Serializable]
    public class ServiceBuildingInfo
    {
        [JsonProperty("entityKey")] public string EntityKey { get; set; }
        [JsonProperty("name")] public string Name { get; set; }
        [JsonProperty("address")] public string Address { get; set; }
        [JsonProperty("district")] public string District { get; set; }
        [JsonProperty("category")] public string Category { get; set; }
        [JsonProperty("theme")] public string Theme { get; set; }
        [JsonProperty("themeIcon")] public string ThemeIcon { get; set; }
        [JsonProperty("assetPack")] public string AssetPack { get; set; }
        [JsonProperty("assetPackIcon")] public string AssetPackIcon { get; set; }
        [JsonProperty("iconUrl")] public string IconUrl { get; set; }
        [JsonProperty("level")] public int Level { get; set; }
        [JsonProperty("efficiency")] public float Efficiency { get; set; }
        [JsonProperty("attractiveness")] public int Attractiveness { get; set; }
        [JsonProperty("capacity")] public int Capacity { get; set; }
        [JsonProperty("usage")] public int Usage { get; set; }
        [JsonProperty("vehicles")] public int Vehicles { get; set; }
        [JsonProperty("vehiclesMax")] public int VehiclesMax { get; set; }
        [JsonProperty("currentOccupants")] public int CurrentOccupants { get; set; }
        [JsonProperty("maxOccupants")] public int MaxOccupants { get; set; }
        [JsonProperty("electricityConsumption")] public float ElectricityConsumption { get; set; }
        [JsonProperty("waterConsumption")] public float WaterConsumption { get; set; }
        [JsonProperty("garbageAccumulation")] public float GarbageAccumulation { get; set; }
        [JsonProperty("mailAccumulation")] public float MailAccumulation { get; set; }
        [JsonProperty("mailSending")] public float MailSending { get; set; }
        [JsonProperty("mailReceiving")] public float MailReceiving { get; set; }
        [JsonProperty("crimeProbability")] public float CrimeProbability { get; set; }
        [JsonProperty("condition")] public int Condition { get; set; }
        [JsonProperty("currentEmployees")] public int CurrentEmployees { get; set; }
        [JsonProperty("workers")] public int Workers { get; set; }
        [JsonProperty("workersMax")] public int WorkersMax { get; set; }
        [JsonProperty("details")] public List<string> Details { get; set; }
        [JsonProperty("addons")] public List<string> Addons { get; set; }
        [JsonProperty("cityEffects")] public List<string> CityEffects { get; set; }
        [JsonProperty("localEffects")] public List<string> LocalEffects { get; set; }
        [JsonProperty("isSignature")] public bool IsSignature { get; set; }
        [JsonProperty("isLandmark")] public bool IsLandmark { get; set; }
    }

    [Serializable]
    public class ServiceCategoryData
    {
        [JsonProperty("category")] public string Category { get; set; }
        [JsonProperty("count")] public int Count { get; set; }
        [JsonProperty("upkeep")] public int Upkeep { get; set; }
    }

    public partial class ServicesBrowserSystem : UISystemBase
    {
        public static bool IsSystemActive = false;
        private ValueBinding<string> _servicesBrowserData;
        private ValueBinding<string> _servicesBuildingsData;
        // Caching signature prefabs via unstable reflection is disabled.
        private CitySystem _citySystem;
        private NameSystem _nameSystem;
        private PrefabSystem _prefabSystem;
        private TaxingProductionUISystem _taxingProductionUISystem;
        private EntityQuery _serviceBuildingQuery;
        
        [ReadOnly] private ComponentLookup<Game.Buildings.ElectricityConsumer> m_ElectricityConsumerLookup;
        [ReadOnly] private ComponentLookup<Game.Buildings.ElectricityProducer> m_ElectricityProducerLookup;
        [ReadOnly] private ComponentLookup<Game.Buildings.WaterConsumer> m_WaterConsumerLookup;
        private ComponentLookup<GarbageProducer> m_GarbageProducerLookup;
        private ComponentLookup<MailProducer> m_MailProducerLookup;
        private ComponentLookup<CrimeProducer> m_CrimeProducerLookup;
        private ComponentLookup<Game.Buildings.BuildingCondition> m_BuildingConditionLookup;
        private BufferLookup<Game.Prefabs.CityModifierData> m_CityModifierDataLookup;
        private BufferLookup<Game.Prefabs.LocalModifierData> m_LocalModifierDataLookup;

        private float m_UpdateTimer = 0f;
        private bool m_WasPanelOpen = false;
        private string m_LastViewMode = "";
        private string m_LastServicesBrowserData = "[]";
        private string m_LastServicesBuildingsData = "[]";

        protected override void OnCreate()
        {
            base.OnCreate();
            Mod.log.Info("ServicesBrowserSystem OnCreate started");
            try { _citySystem = World.GetOrCreateSystemManaged<CitySystem>(); } catch (Exception e) { Mod.log.Error($"Failed to load CitySystem: {e.Message}"); }
            try { _nameSystem = World.GetOrCreateSystemManaged<NameSystem>(); } catch (Exception e) { Mod.log.Error($"Failed to load NameSystem: {e.Message}"); }
            try { _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>(); } catch (Exception e) { Mod.log.Error($"Failed to load PrefabSystem: {e.Message}"); }
            try { _taxingProductionUISystem = World.GetOrCreateSystemManaged<TaxingProductionUISystem>(); } catch (Exception e) { Mod.log.Error($"Failed to load TaxingProductionUISystem: {e.Message}"); }
            
            _serviceBuildingQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<Game.Buildings.Building>(),
                    ComponentType.ReadOnly<PrefabRef>(),
                },
                None = new ComponentType[]
                {
                    ComponentType.ReadOnly<Game.Buildings.ResidentialProperty>(),
                    ComponentType.ReadOnly<Game.Companies.IndustrialCompany>(),
                    ComponentType.ReadOnly<Game.Companies.CommercialCompany>(),
                    ComponentType.ReadOnly<Game.Buildings.ExtractorFacility>(),
                }
            });

            m_ElectricityConsumerLookup = GetComponentLookup<ElectricityConsumer>(true);
            m_ElectricityProducerLookup = GetComponentLookup<ElectricityProducer>(true);
            m_WaterConsumerLookup = GetComponentLookup<WaterConsumer>(true);
            m_GarbageProducerLookup = GetComponentLookup<GarbageProducer>(true);
            m_MailProducerLookup = GetComponentLookup<MailProducer>(true);
            m_CrimeProducerLookup = GetComponentLookup<CrimeProducer>(true);
            m_BuildingConditionLookup = GetComponentLookup<Game.Buildings.BuildingCondition>(true);
            m_CityModifierDataLookup = GetBufferLookup<Game.Prefabs.CityModifierData>(true);
            m_LocalModifierDataLookup = GetBufferLookup<Game.Prefabs.LocalModifierData>(true);

            AddBinding(_servicesBrowserData = new ValueBinding<string>("taxProduction", "servicesBrowserData", "[]"));
            AddBinding(_servicesBuildingsData = new ValueBinding<string>("taxProduction", "servicesBuildingsData", "[]"));
            Mod.log.Info("ServicesBrowserSystem OnCreate finished");
        }

        protected override void OnUpdate()
        {
            if (!IsSystemActive)
            {
                this.Dependency = Dependency;
                return;
            }
            // ── Global UI Sleep Gate ──────────────────────────────────────────────────
            // Building queries and JSON serialization serve no purpose while the panel is hidden.
            if (_taxingProductionUISystem == null || !_taxingProductionUISystem.IsPanelOpen || (_taxingProductionUISystem.ActiveViewMode != "services" && _taxingProductionUISystem.ActiveViewMode != "signature"))
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

            m_ElectricityConsumerLookup.Update(ref CheckedStateRef);
            m_ElectricityProducerLookup.Update(ref CheckedStateRef);
            m_WaterConsumerLookup.Update(ref CheckedStateRef);
            m_GarbageProducerLookup.Update(ref CheckedStateRef);
            m_MailProducerLookup.Update(ref CheckedStateRef);
            m_CrimeProducerLookup.Update(ref CheckedStateRef);
            m_BuildingConditionLookup.Update(ref CheckedStateRef);
            m_CityModifierDataLookup.Update(ref CheckedStateRef);
            m_LocalModifierDataLookup.Update(ref CheckedStateRef);

            m_UpdateTimer += World.Time.DeltaTime;

            if (m_UpdateTimer < 10.0f && !justOpened)
            {
                this.Dependency = Dependency;
                return;
            }
            m_UpdateTimer = 0f;

            if (currentViewMode == "signature")
            {
                try { UpdateServicesBuildingsData(justOpened); } catch (Exception ex) { try { Mod.log.Warn($"ServicesBrowserSystem UpdateServicesBuildingsData Error: {ex.Message}"); } catch { } }
            }
            else
            {
                try { UpdateServicesData(justOpened); } catch (Exception ex) { try { Mod.log.Warn($"ServicesBrowserSystem UpdateServicesData Error: {ex.Message}"); } catch { } }
                try { UpdateServicesBuildingsData(justOpened); } catch (Exception ex) { try { Mod.log.Warn($"ServicesBrowserSystem UpdateServicesBuildingsData Error: {ex.Message}"); } catch { } }
            }
        }

        private void UpdateServicesBuildingsData(bool forceUpdate = false)
        {
            if (_servicesBuildingsData == null) return;
            var em = EntityManager;
            var entities = _serviceBuildingQuery.ToEntityArray(Unity.Collections.Allocator.Temp);
            var list = new List<ServiceBuildingInfo>();

            try
            {
                foreach (var ent in entities)
                {
                    try
                    {
                        var prefabRef = em.GetComponentData<PrefabRef>(ent);
                        var prefab = prefabRef.m_Prefab;

                        bool isSignature = false;
                        bool isLandmark = false;
                        try
                        {
                            isSignature = em.HasComponent<Game.Buildings.Signature>(ent) || 
                                          em.HasComponent<Game.Objects.UniqueObject>(ent) || 
                                          em.HasComponent<Game.Prefabs.SignatureBuildingData>(prefab) || 
                                          em.HasComponent<Game.Prefabs.UniqueObjectData>(prefab);
                            isLandmark = em.HasComponent<Game.Objects.UniqueObject>(ent) || 
                                         em.HasComponent<Game.Prefabs.UniqueObjectData>(prefab);

                            if ((!isSignature || !isLandmark) && _prefabSystem != null)
                            {
                                string pName = _prefabSystem.GetPrefabName(prefab) ?? "";
                                string pNameLower = pName.ToLowerInvariant();
                                if (pNameLower.Contains("signature") || pNameLower.Contains("landmark") || pNameLower.Contains("monument") || pNameLower.Contains("unique"))
                                {
                                    isSignature = true;
                                    isLandmark = true;
                                }
                            }
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        if (em.HasComponent<Game.Prefabs.BuildingPropertyData>(prefab) && !isSignature) continue;
                        if (em.HasComponent<Game.Prefabs.IndustrialProcessData>(prefab)) continue;

                        string name = "";
                        try { if (_prefabSystem != null) name = _prefabSystem.GetPrefabName(prefab); } catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }
                        if (string.IsNullOrEmpty(name)) name = "Building " + ent.Index;

                        string address = "";
                        try { if (_nameSystem != null) address = _nameSystem.GetRenderedLabelName(ent); } catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }
                        if (string.IsNullOrEmpty(address)) address = "Unknown Address";

                        string category = "Other";
                        string lowerName = "";
                        if (em.HasComponent<Game.Buildings.PoliceStation>(ent)) category = "Police & Administration";
                        else if (em.HasComponent<Game.Buildings.FireStation>(ent)) category = "Fire & Rescue";
                        else if (em.HasComponent<Game.Buildings.Hospital>(ent) || em.HasComponent<Game.Buildings.DeathcareFacility>(ent)) category = "Healthcare & Deathcare";
                        else if (em.HasComponent<Game.Buildings.GarbageFacility>(ent)) category = "Garbage Management";
                        else if (em.HasComponent<Game.Buildings.School>(ent) || em.HasComponent<Game.Buildings.ResearchFacility>(ent)) category = "Education & Research";
                        else if (em.HasComponent<Game.Buildings.TransportDepot>(ent) || em.HasComponent<Game.Buildings.TransportStation>(ent) || em.HasComponent<Game.Buildings.ParkingFacility>(ent)) category = "Transportation";
                        else if (em.HasComponent<Game.Buildings.Park>(ent)) category = "Parks & Recreation";
                        else if (em.HasComponent<Game.Buildings.PostFacility>(ent) || em.HasComponent<Game.Buildings.TelecomFacility>(ent)) category = "Communications";
                        else
                        {
                            lowerName = name.ToLowerInvariant();
                            if (lowerName.Contains("water") || lowerName.Contains("sewage") || lowerName.Contains("pump") || lowerName.Contains("drain") || lowerName.Contains("treatment")) category = "Water & Sewage";
                            else if (lowerName.Contains("electricity") || lowerName.Contains("power") || lowerName.Contains("turbine") || lowerName.Contains("transformer") || lowerName.Contains("plant")) category = "Electricity";
                            else if (lowerName.Contains("welfare") || lowerName.Contains("homeless")) category = "Welfare";
                        }

                        int level = 0;
                        if (em.HasComponent<Game.Prefabs.SpawnableBuildingData>(prefab))
                            level = em.GetComponentData<Game.Prefabs.SpawnableBuildingData>(prefab).m_Level;

                        float efficiency01 = 1f;
                        if (em.HasBuffer<Game.Buildings.Efficiency>(ent))
                        {
                            efficiency01 = Game.Buildings.BuildingUtils.GetEfficiency(em.GetBuffer<Game.Buildings.Efficiency>(ent));
                        }

                        float efficiency = efficiency01 * 100f;

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
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        string theme = "USA";
                        string themeIcon = "";
                        string assetPack = "Base Game";
                        string assetPackIcon = "";
                        int capacity = 0;
                        int usage = 0;
                        int vehicles = 0;
                        int vehiclesMax = 0;
                        int currentOccupants = 0;
                        int maxOccupants = 0;
                        int currentEmployees = 0;
                        int workers = 0;
                        int workersMax = 0;
                        var detailParts = new List<string>();

                        if (_prefabSystem != null)
                        {
                            try
                            {
                                var pb = _prefabSystem.GetPrefab<PrefabBase>(prefab);
                                if (pb != null)
                                {
                                    var packInfo = PackHelper.GetPrefabAssetInfo(pb);
                                    theme = packInfo.Theme;
                                    themeIcon = packInfo.ThemeIcon;
                                    assetPack = packInfo.AssetPack;
                                    assetPackIcon = packInfo.PackThumbnails != null ? string.Join(",", packInfo.PackThumbnails) : "";
                                }
                            }
                            catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }
                        }

                        try
                        {
                            if (em.HasBuffer<Employee>(ent))
                            {
                                var empBuf = em.GetBuffer<Employee>(ent);
                                workers = empBuf.Length;
                            }
                            if (em.HasComponent<WorkProvider>(ent))
                            {
                                var wp = em.GetComponentData<WorkProvider>(ent);
                                workersMax = wp.m_MaxWorkers;
                            }
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        if (em.HasBuffer<Game.Companies.Employee>(ent))
                        {
                            currentEmployees = em.GetBuffer<Game.Companies.Employee>(ent).Length;
                        }

                        try
                        {
                            if (em.HasComponent<SchoolData>(prefab))
                            {
                                var sd = em.GetComponentData<SchoolData>(prefab);
                                capacity = sd.m_StudentCapacity;
                                maxOccupants = sd.m_StudentCapacity;
                                if (em.HasBuffer<Game.Buildings.Student>(ent))
                                {
                                    usage = em.GetBuffer<Game.Buildings.Student>(ent).Length;
                                    currentOccupants = usage;
                                }
                            }
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        try
                        {
                            if (em.HasComponent<Game.Buildings.Hospital>(ent))
                            {
                                if (Game.Prefabs.UpgradeUtils.TryGetCombinedComponent<Game.Prefabs.HospitalData>(em, ent, prefab, out var hospData))
                                {
                                    capacity = hospData.m_PatientCapacity;
                                    maxOccupants = hospData.m_PatientCapacity;
                                    vehiclesMax = Game.Buildings.BuildingUtils.GetVehicleCapacity(efficiency01, hospData.m_AmbulanceCapacity);
                                }
                                if (em.HasBuffer<Game.Buildings.Patient>(ent))
                                {
                                    usage = em.GetBuffer<Game.Buildings.Patient>(ent).Length;
                                    currentOccupants = usage;
                                }
                                if (em.HasBuffer<Game.Vehicles.OwnedVehicle>(ent)) vehicles = em.GetBuffer<Game.Vehicles.OwnedVehicle>(ent).Length;
                            }
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        try
                        {
                            if (em.HasComponent<Game.Buildings.PoliceStation>(ent) && Game.Prefabs.UpgradeUtils.TryGetCombinedComponent<Game.Prefabs.PoliceStationData>(em, ent, prefab, out var policeData))
                            {
                                capacity = policeData.m_JailCapacity;
                                maxOccupants = policeData.m_JailCapacity;
                                vehiclesMax = Game.Buildings.BuildingUtils.GetVehicleCapacity(efficiency01, policeData.m_PatrolCarCapacity);
                                if (em.HasBuffer<Game.Buildings.Occupant>(ent))
                                {
                                    usage = em.GetBuffer<Game.Buildings.Occupant>(ent).Length;
                                    currentOccupants = usage;
                                }
                                if (em.HasBuffer<Game.Vehicles.OwnedVehicle>(ent)) vehicles = em.GetBuffer<Game.Vehicles.OwnedVehicle>(ent).Length;
                            }
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        try
                        {
                            if (em.HasComponent<Game.Buildings.FireStation>(ent) && Game.Prefabs.UpgradeUtils.TryGetCombinedComponent<Game.Prefabs.FireStationData>(em, ent, prefab, out var fireData))
                            {
                                vehiclesMax = Game.Buildings.BuildingUtils.GetVehicleCapacity(efficiency01, fireData.m_FireEngineCapacity);
                                if (em.HasBuffer<Game.Vehicles.OwnedVehicle>(ent)) vehicles = em.GetBuffer<Game.Vehicles.OwnedVehicle>(ent).Length;
                            }
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        try
                        {
                            if (em.HasComponent<Game.Buildings.DeathcareFacility>(ent) && Game.Prefabs.UpgradeUtils.TryGetCombinedComponent<Game.Prefabs.DeathcareFacilityData>(em, ent, prefab, out var deathcareData))
                            {
                                capacity = deathcareData.m_StorageCapacity;
                                vehiclesMax = Game.Buildings.BuildingUtils.GetVehicleCapacity(efficiency01, deathcareData.m_HearseCapacity);
                                if (em.HasBuffer<Game.Buildings.Patient>(ent)) usage = em.GetBuffer<Game.Buildings.Patient>(ent).Length;
                                if (em.HasBuffer<Game.Vehicles.OwnedVehicle>(ent)) vehicles = em.GetBuffer<Game.Vehicles.OwnedVehicle>(ent).Length;
                            }
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        try
                        {
                            if (em.HasComponent<Game.Buildings.GarbageFacility>(ent))
                            {
                                if (Game.Prefabs.UpgradeUtils.TryGetCombinedComponent<Game.Prefabs.GarbageFacilityData>(em, ent, prefab, out var gfData))
                                {
                                    if (capacity == 0) capacity = gfData.m_GarbageCapacity;
                                    vehiclesMax = Game.Buildings.BuildingUtils.GetVehicleCapacity(efficiency01, gfData.m_VehicleCapacity);
                                }
                                if (usage == 0 && em.HasBuffer<Game.Economy.Resources>(ent))
                                {
                                    var resources = em.GetBuffer<Game.Economy.Resources>(ent);
                                    for (int rIdx = 0; rIdx < resources.Length; rIdx++)
                                    {
                                        if (resources[rIdx].m_Resource == Game.Economy.Resource.Garbage)
                                        {
                                            usage = resources[rIdx].m_Amount;
                                            break;
                                        }
                                    }
                                }
                                if (em.HasBuffer<Game.Vehicles.OwnedVehicle>(ent)) vehicles = em.GetBuffer<Game.Vehicles.OwnedVehicle>(ent).Length;
                            }
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        int attractiveness = 0;
                        try
                        {
                            if (Game.Prefabs.UpgradeUtils.TryGetCombinedComponent<Game.Prefabs.AttractionData>(em, ent, prefab, out var attractionData))
                                attractiveness = attractionData.m_Attractiveness;
                                
                            if (em.HasComponent<Game.Buildings.AttractivenessProvider>(ent))
                            {
                                var attrProv = em.GetComponentData<Game.Buildings.AttractivenessProvider>(ent);
                                if (attrProv.m_Attractiveness > attractiveness) attractiveness = attrProv.m_Attractiveness;
                            }
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        List<string> addons = new List<string>();
                        try
                        {
                            if (em.HasBuffer<Game.Buildings.InstalledUpgrade>(ent))
                            {
                                var upgrades = em.GetBuffer<Game.Buildings.InstalledUpgrade>(ent);
                                foreach (var up in upgrades)
                                {
                                    if (em.HasComponent<PrefabRef>(up.m_Upgrade))
                                    {
                                        var upPrefab = em.GetComponentData<PrefabRef>(up.m_Upgrade).m_Prefab;
                                        if (_prefabSystem != null)
                                        {
                                            string upName = _prefabSystem.GetPrefabName(upPrefab);
                                            if (!string.IsNullOrEmpty(upName))
                                                addons.Add(upName);
                                        }
                                    }
                                }
                            }
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        try
                        {
                            if (em.HasBuffer<Game.Buildings.Efficiency>(ent))
                            {
                                var effBuf = em.GetBuffer<Game.Buildings.Efficiency>(ent);
                                for (int fi = 0; fi < effBuf.Length; fi++)
                                {
                                    if (effBuf[fi].m_Efficiency > 0)
                                    {
                                        string ftype = Enum.GetName(typeof(Game.Buildings.EfficiencyFactor), effBuf[fi].m_Factor) ?? effBuf[fi].m_Factor.ToString();
                                        detailParts.Add($"{ftype}: {(int)Math.Round(effBuf[fi].m_Efficiency * 100f)}%");
                                    }
                                }
                            }
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        float elecConsumption = 0f;
                        float waterConsumption = 0f;
                        float garbageAccum = 0f;
                        float mailAccum = 0f;
                        float crimeProb = 0f;
                        float mailSending = 0f;
                        float mailReceiving = 0f;
                        int condition = 0;

                        try
                        {
                            if (m_ElectricityConsumerLookup.HasComponent(ent)) elecConsumption = m_ElectricityConsumerLookup[ent].m_WantedConsumption;
                            if (m_ElectricityProducerLookup.HasComponent(ent))
                            {
                                // Net electricity: subtract production so that net production is negative (or just keep production separate)
                                // Actually let's just make it negative to represent output to grid.
                                elecConsumption -= m_ElectricityProducerLookup[ent].m_LastProduction;
                            }
                            if (m_WaterConsumerLookup.HasComponent(ent)) waterConsumption = m_WaterConsumerLookup[ent].m_WantedConsumption;
                            if (m_GarbageProducerLookup.HasComponent(ent)) garbageAccum = m_GarbageProducerLookup[ent].m_Garbage;
                            if (m_MailProducerLookup.HasComponent(ent))
                            {
                                var mail = m_MailProducerLookup[ent];
                                mailAccum = (float)(mail.m_SendingMail + mail.m_ReceivingMail);
                                mailSending = (float)mail.m_SendingMail;
                                mailReceiving = (float)mail.m_ReceivingMail;
                            }
                            if (m_CrimeProducerLookup.HasComponent(ent)) crimeProb = m_CrimeProducerLookup[ent].m_Crime;
                            if (m_BuildingConditionLookup.HasComponent(ent)) condition = m_BuildingConditionLookup[ent].m_Condition;
                        }
                        catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }

                        List<string> cityEffects = new List<string>();
                        List<string> localEffects = new List<string>();
                        if (em.HasComponent<PrefabRef>(ent))
                        {
                            var pref = em.GetComponentData<PrefabRef>(ent).m_Prefab;
                            if (m_CityModifierDataLookup.HasBuffer(pref))
                            {
                                var cBuf = m_CityModifierDataLookup[pref];
                                foreach (var c in cBuf)
                                {
                                    string sMode = c.m_Mode == Game.Prefabs.ModifierValueMode.Relative ? "%" : "";
                                    cityEffects.Add($"{c.m_Type} | {c.m_Range.min}{sMode} to {c.m_Range.max}{sMode}");
                                }
                            }
                            if (m_LocalModifierDataLookup.HasBuffer(pref))
                            {
                                var lBuf = m_LocalModifierDataLookup[pref];
                                foreach (var l in lBuf)
                                {
                                    string sMode = l.m_Mode == Game.Prefabs.ModifierValueMode.Relative ? "%" : "";
                                    localEffects.Add($"{l.m_Type} | Delta: {l.m_Delta.min}{sMode} to {l.m_Delta.max}{sMode} | Reach: {l.m_Radius.max}");
                                }
                            }
                        }

                        list.Add(new ServiceBuildingInfo
                        {
                            EntityKey = ent.Index + "," + ent.Version,
                            Name = name ?? "",
                            Address = address ?? "",
                            District = districtName ?? "City",
                            Category = category ?? "Other",
                            Theme = theme ?? "USA",
                            ThemeIcon = themeIcon ?? "",
                            AssetPack = assetPack ?? "Base Game",
                            AssetPackIcon = assetPackIcon ?? "",
                            IconUrl = "",
                            Level = level,
                            Efficiency = efficiency,
                            Attractiveness = attractiveness,
                            Capacity = capacity,
                            Usage = usage,
                            Vehicles = vehicles,
                            VehiclesMax = vehiclesMax,
                            CurrentOccupants = currentOccupants,
                            MaxOccupants = maxOccupants,
                            CurrentEmployees = currentEmployees,
                            Workers = workers,
                            WorkersMax = workersMax,
                            ElectricityConsumption = elecConsumption,
                            WaterConsumption = waterConsumption,
                            GarbageAccumulation = garbageAccum,
                            MailAccumulation = mailAccum,
                            MailSending = mailSending,
                            MailReceiving = mailReceiving,
                            CrimeProbability = crimeProb,
                            Condition = condition,
                            Details = detailParts,
                            Addons = addons,
                            CityEffects = cityEffects,
                            LocalEffects = localEffects,
                            IsSignature = isSignature,
                            IsLandmark = isLandmark
                        });

                        if (list.Count >= 1000) break;
                    }
                    catch (Exception ex) { if (_taxingProductionUISystem != null && _taxingProductionUISystem.IsPanelOpen) Mod.log.Debug($"ServicesBrowser error on entity {ent.Index}: {ex.Message}"); }
                }
            }
            finally { entities.Dispose(); }

            var payload = JsonConvert.SerializeObject(list, new JsonSerializerSettings 
            { 
                ContractResolver = new CamelCasePropertyNamesContractResolver() 
            });
            if (payload != m_LastServicesBuildingsData || forceUpdate)
            {
                _servicesBuildingsData.Update(payload);
                m_LastServicesBuildingsData = payload;
            }
        }

        private void RefreshSignatureCache() { }

        private void UpdateServicesData(bool forceUpdate = false)
        {
            if (_servicesBrowserData == null || _citySystem == null) return;
            var em = EntityManager;
            var city = _citySystem.City;
            if (!em.Exists(city)) return;
            var serviceEnumType = (Type)null;
            var map = new Dictionary<int, ServiceInfo>();

            // CRITICAL: Reflection-based buffer reading is unstable.
            // Replaced with safe placeholder logic.
            /*
            ReadServiceBuffer(em, city, "ServiceBudget", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Budget", "m_BudgetPercentage", "m_Percentage" }, (info, val) => info.Budget = val);
            ReadServiceBuffer(em, city, "ServiceFee", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Fee", "m_FeePercentage", "m_Percentage" }, (info, val) => info.Fee = val);
            ReadServiceBuffer(em, city, "ServiceUpkeep", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Upkeep", "m_Cost", "m_Value" }, (info, val) => info.Upkeep = val);
            ReadServiceBuffer(em, city, "ServiceEfficiency", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Efficiency", "m_Value" }, (info, val) => info.Efficiency = val);
            ReadServiceBuffer(em, city, "ServiceCoverage", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Coverage", "m_Value" }, (info, val) => info.Coverage = val);
            ReadServiceBuffer(em, city, "ServiceCapacity", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Capacity", "m_Value" }, (info, val) => info.Capacity = val);
            ReadServiceBuffer(em, city, "ServiceUsage", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Usage", "m_Value" }, (info, val) => info.Usage = val);
            */

            // If no buffers were found, still publish a list of services from the enum
            // so the UI can render the known service names with zeroed values.
            if (map.Count == 0 && serviceEnumType != null && serviceEnumType.IsEnum)
            {
                try
                {
                    foreach (var val in Enum.GetValues(serviceEnumType))
                    {
                        int id = Convert.ToInt32(val);
                        if (!map.ContainsKey(id))
                        {
                            map[id] = new ServiceInfo(id) { TypeName = val.ToString() };
                        }
                    }
                }
                catch { }
            }

            var list = map.Values.OrderBy(v => v.ServiceId).ToList();
            if (list.Count == 0) return;
            var payload = "[" + string.Join(",", list.Select(i => i.ToJson(serviceEnumType))) + "]";
            if (_servicesBrowserData != null && (payload != m_LastServicesBrowserData || forceUpdate))
            {
                _servicesBrowserData.Update(payload);
                m_LastServicesBrowserData = payload;
            }
            try { Mod.log?.Info($"ServicesBrowserSystem: payload len={payload?.Length ?? 0} services={list.Count}"); } catch { /* Colossal logger can throw internally */ }
        }



        private static Type FindType(string typeName) => null;

        private void ReadServiceBuffer(EntityManager em, Entity city, string bufferName, Type serviceEnumType, Dictionary<int, ServiceInfo> map, string[] serviceFields, string[] valueFields, Action<ServiceInfo, float> setter) { }

        private sealed class ServiceInfo
        {
            public int ServiceId { get; }
            public string TypeName { get; set; }
            public float Budget { get; set; }
            public float Fee { get; set; }
            public float Upkeep { get; set; }
            public float Efficiency { get; set; }
            public float Coverage { get; set; }
            public float Capacity { get; set; }
            public float Usage { get; set; }

            public ServiceInfo(int id) { ServiceId = id; }

            public string ToJson(Type serviceEnumType)
            {
                string name = serviceEnumType != null && Enum.IsDefined(serviceEnumType, ServiceId)
                    ? Enum.GetName(serviceEnumType, ServiceId)
                    : "Service " + ServiceId.ToString(CultureInfo.InvariantCulture);
                name = name ?? ("Service " + ServiceId.ToString(CultureInfo.InvariantCulture));
                string typeName = TypeName ?? name;
                string category = GetCategory(typeName);
                name = name.Replace("\"", "\\\"");
                typeName = typeName.Replace("\"", "\\\"");
                category = category.Replace("\"", "\\\"");
                return string.Format(CultureInfo.InvariantCulture,
                    "{{\"id\":{0},\"name\":\"{1}\",\"type\":\"{2}\",\"category\":\"{3}\",\"budget\":{4:0.##},\"fee\":{5:0.##},\"upkeep\":{6:0.##},\"efficiency\":{7:0.##},\"coverage\":{8:0.##},\"capacity\":{9:0.##},\"usage\":{10:0.##}}}",
                    ServiceId, name, typeName, category, Budget, Fee, Upkeep, Efficiency, Coverage, Capacity, Usage);
            }

            private static string GetCategory(string name)
            {
                var lower = (name ?? string.Empty).ToLowerInvariant();
                if (lower.Contains("electric") || lower.Contains("water") || lower.Contains("sewage") || lower.Contains("garbage")) return "Utilities";
                if (lower.Contains("health") || lower.Contains("death") || lower.Contains("fire") || lower.Contains("police") || lower.Contains("disaster")) return "Emergency";
                if (lower.Contains("road")) return "Networks";
                if (lower.Contains("transport") || lower.Contains("bus") || lower.Contains("tram") || lower.Contains("train") || lower.Contains("metro") || lower.Contains("taxi") || lower.Contains("harbor") || lower.Contains("airport")) return "Transportation";
                if (lower.Contains("park") || lower.Contains("recreation") || lower.Contains("plaza") || lower.Contains("tourism")) return "Parks";
                if (lower.Contains("post") || lower.Contains("telecom")) return "Communications";
                if (lower.Contains("education") || lower.Contains("research") || lower.Contains("admin")) return "Other";
                return "Other";
            }
        }
    }
}
