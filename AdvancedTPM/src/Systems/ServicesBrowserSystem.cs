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

namespace AdvancedTPM
{
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
        private float m_UpdateTimer = 0f;
        private bool m_WasPanelOpen = false;
        private string m_LastViewMode = "";
        private string m_LastServicesBrowserData = "[]";
        private string m_LastServicesBuildingsData = "[]";

        protected override void OnCreate()
        {
            base.OnCreate();
            Mod.log.Info("ServicesBrowserSystem OnCreate started");
            try { _citySystem = World.GetOrCreateSystemManaged<CitySystem>(); } catch { }
            try { _nameSystem = World.GetOrCreateSystemManaged<NameSystem>(); } catch { }
            try { _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>(); } catch { }
            try { _taxingProductionUISystem = World.GetOrCreateSystemManaged<TaxingProductionUISystem>(); } catch { }
            
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

            AddBinding(_servicesBrowserData = new ValueBinding<string>("taxProduction", "servicesBrowserData", "[]"));
            AddBinding(_servicesBuildingsData = new ValueBinding<string>("taxProduction", "servicesBuildingsData", "[]"));
            Mod.log.Info("ServicesBrowserSystem OnCreate finished");
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
            var list = new List<string>();

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
                        catch { }

                        // Exclude zoned buildings (residential, commercial, industrial, office) unless it is a signature or unique building
                        if (em.HasComponent<Game.Prefabs.BuildingPropertyData>(prefab) && !isSignature) continue;

                        // Exclude raw industrial / fishing buildings — these belong in the Businesses tab
                        if (em.HasComponent<Game.Prefabs.IndustrialProcessData>(prefab)) continue;

                        string name = "";
                        try { if (_prefabSystem != null) name = _prefabSystem.GetPrefabName(prefab); } catch { }
                        if (string.IsNullOrEmpty(name)) name = "Building " + ent.Index;

                        string address = "";
                        try { if (_nameSystem != null) address = _nameSystem.GetRenderedLabelName(ent); } catch { }
                        if (string.IsNullOrEmpty(address)) address = "Unknown Address";

                        string category = "Other";
                        string lowerName = name.ToLowerInvariant();
                        if (lowerName.Contains("electricity") || lowerName.Contains("power") || lowerName.Contains("turbine") || lowerName.Contains("station")) category = "Electricity";
                        else if (lowerName.Contains("water") || lowerName.Contains("sewage") || lowerName.Contains("pump") || lowerName.Contains("drain")) category = "Water & Sewage";
                        else if (lowerName.Contains("garbage") || lowerName.Contains("waste") || lowerName.Contains("incinerat") || lowerName.Contains("recycl")) category = "Garbage Management";
                        else if (lowerName.Contains("hospital") || lowerName.Contains("clinic") || lowerName.Contains("medical") || lowerName.Contains("cemetery") || lowerName.Contains("crematorium")) category = "Healthcare & Deathcare";
                        else if (lowerName.Contains("fire") || lowerName.Contains("rescue") || lowerName.Contains("emergency")) category = "Fire & Rescue";
                        else if (lowerName.Contains("police") || lowerName.Contains("prison") || lowerName.Contains("administration") || lowerName.Contains("jail") || lowerName.Contains("court")) category = "Police & Administration";
                        else if (lowerName.Contains("school") || lowerName.Contains("college") || lowerName.Contains("university") || lowerName.Contains("education") || lowerName.Contains("library")) category = "Education & Research";
                        else if (lowerName.Contains("transport") || lowerName.Contains("bus") || lowerName.Contains("train") || lowerName.Contains("metro") || lowerName.Contains("tram") || lowerName.Contains("airport") || lowerName.Contains("depot")) category = "Transportation";
                        else if (lowerName.Contains("park") || lowerName.Contains("plaza") || lowerName.Contains("playground") || lowerName.Contains("recreation") || lowerName.Contains("stadium")) category = "Parks & Recreation";
                        else if (lowerName.Contains("post") || lowerName.Contains("telecom") || lowerName.Contains("radio") || lowerName.Contains("server") || lowerName.Contains("tower")) category = "Communications";
                        else if (lowerName.Contains("welfare") || lowerName.Contains("homeless") || lowerName.Contains("center")) category = "Welfare";

                        int level = 0;
                        if (em.HasComponent<Game.Prefabs.SpawnableBuildingData>(prefab))
                            level = em.GetComponentData<Game.Prefabs.SpawnableBuildingData>(prefab).m_Level;

                        float efficiency = 100f;
                        if (em.HasBuffer<Game.Buildings.Efficiency>(ent))
                        {
                            var buf = em.GetBuffer<Game.Buildings.Efficiency>(ent);
                            float combined = 1f;
                            for (int i = 0; i < buf.Length; i++)
                            {
                                if (buf[i].m_Efficiency > 0) combined *= buf[i].m_Efficiency;
                            }
                            efficiency = combined * 100f;
                        }

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

                        string theme = "USA";
                        string assetPack = "Base Game";
                        string assetPackIcon = "";
                        int capacity = 0;
                        int usage = 0;
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
                                    var info = PackHelper.GetPrefabAssetInfo(pb);
                                    theme = info.Theme;
                                    assetPack = info.AssetPack;
                                    assetPackIcon = info.PackThumbnails != null ? string.Join(",", info.PackThumbnails) : "";
                                }
                            }
                            catch { }
                        }

                        // ── Workers (Employee buffer + WorkProvider) ─────────────────────────────
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
                            if (workersMax > 0)
                                detailParts.Add($"Workers:{workers}/{workersMax}");
                        }
                        catch { }

                        // ── School: students / capacity (SchoolData + Student buffer) ───────────
                        try
                        {
                            if (em.HasComponent<SchoolData>(prefab))
                            {
                                var sd = em.GetComponentData<SchoolData>(prefab);
                                capacity = sd.m_StudentCapacity;
                                if (em.HasBuffer<Game.Buildings.Student>(ent))
                                {
                                    var stuBuf = em.GetBuffer<Game.Buildings.Student>(ent);
                                    usage = stuBuf.Length;
                                }
                                detailParts.Add($"Students:{usage}/{capacity}");
                            }
                        }
                        catch { }

                        // ── Hospital: patient capacity (Game.Prefabs.HospitalData) ─────────────────
                        try
                        {
                            if (em.HasComponent<Game.Buildings.Hospital>(ent))
                            {
                                if (em.HasComponent<Game.Prefabs.HospitalData>(prefab))
                                {
                                    var hospData = em.GetComponentData<Game.Prefabs.HospitalData>(prefab);
                                    capacity = hospData.m_PatientCapacity;
                                }
                                if (em.HasBuffer<Game.Buildings.Patient>(ent))
                                {
                                    var patientBuf = em.GetBuffer<Game.Buildings.Patient>(ent);
                                    usage = patientBuf.Length;
                                }
                                detailParts.Add($"Patients:{usage}/{capacity}");
                            }
                        }
                        catch { }

                        // ── Park maintenance ────────────────────────────────────────────────────
                        try
                        {
                            if (em.HasComponent<Game.Buildings.Park>(ent) &&
                                em.HasComponent<ParkData>(prefab))
                            {
                                var park = em.GetComponentData<Game.Buildings.Park>(ent);
                                var parkData = em.GetComponentData<ParkData>(prefab);
                                if (parkData.m_MaintenancePool > 0)
                                {
                                    int maint = (int)Math.Round((park.m_Maintenance / (float)parkData.m_MaintenancePool) * 100f);
                                    detailParts.Add($"Maintenance:{maint}%");
                                }
                            }
                        }
                        catch { }

                        // ── Garbage facility throughput ──────────────────────────────────────────
                        try
                        {
                            if (em.HasComponent<Game.Buildings.GarbageFacility>(ent))
                            {
                                if (em.HasComponent<Game.Prefabs.GarbageFacilityData>(prefab))
                                {
                                    var gfData = em.GetComponentData<Game.Prefabs.GarbageFacilityData>(prefab);
                                    if (capacity == 0) capacity = gfData.m_GarbageCapacity;
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
                            }
                        }
                        catch { }

                        // ── Efficiency breakdown (same as ExtendedTooltip EfficiencyTooltipBuilder) ──
                        try
                        {
                            if (em.HasBuffer<Game.Buildings.Efficiency>(ent))
                            {
                                var effBuf = em.GetBuffer<Game.Buildings.Efficiency>(ent);
                                float combined = 1f;
                                var factors = new List<string>();
                                for (int fi = 0; fi < effBuf.Length; fi++)
                                {
                                    if (effBuf[fi].m_Efficiency > 0)
                                    {
                                        combined *= effBuf[fi].m_Efficiency;
                                        // Include factor name if it has a type field
                                        string ftype = effBuf[fi].m_Efficiency < 1f ? "low" : "ok";
                                        factors.Add($"{(int)Math.Round(effBuf[fi].m_Efficiency * 100f)}%");
                                    }
                                }
                                efficiency = combined * 100f;
                                if (factors.Count > 0 && factors.Count <= 4)
                                    detailParts.Add($"EffFactors:{string.Join("|", factors)}");
                            }
                        }
                        catch { }

                        // JSON escape strings
                        name = (name ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"");
                        address = (address ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"");
                        districtName = (districtName ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"");
                        category = (category ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"");

                        string escapedIcon = (assetPackIcon ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"");
                        string detailInfo = string.Join(";", detailParts).Replace("\\", "\\\\").Replace("\"", "\\\"");
                        list.Add(string.Format(CultureInfo.InvariantCulture,
                            "{{\"entityKey\":\"{0},{1}\",\"name\":\"{2}\",\"address\":\"{3}\",\"district\":\"{4}\",\"category\":\"{5}\",\"theme\":\"{6}\",\"assetPack\":\"{7}\",\"assetPackIcon\":\"{8}\",\"level\":{9},\"efficiency\":{10:0.##},\"capacity\":{11},\"usage\":{12},\"workers\":{13},\"workersMax\":{14},\"detailInfo\":\"{15}\",\"isSignature\":{16},\"isLandmark\":{17}}}",
                            ent.Index, ent.Version, name, address, districtName, category, theme, assetPack, escapedIcon, level, efficiency, capacity, usage, workers, workersMax, detailInfo, isSignature ? "true" : "false", isLandmark ? "true" : "false"));
                        
                        if (list.Count >= 1000) break; // Safety limit
                    }
                    catch { }
                }
            }
            finally { entities.Dispose(); }

            var payload = "[" + string.Join(",", list) + "]";
            if (payload != m_LastServicesBuildingsData || forceUpdate)
            {
                _servicesBuildingsData.Update(payload);
                m_LastServicesBuildingsData = payload;
            }
        }

        private void RefreshSignatureCache()
        {
            // CRITICAL: World system iteration with reflection is unstable.
            // Neutralized to prevent native crashes.
        }

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



        private static Type FindType(string typeName)
        {
            // CRITICAL: Type discovery via assembly scanning is unstable.
            return null;
        }
        
        private void ReadServiceBuffer(EntityManager em, Entity city, string bufferName, Type serviceEnumType, Dictionary<int, ServiceInfo> map, string[] serviceFields, string[] valueFields, Action<ServiceInfo, float> setter)
        {
            // CRITICAL: Reflection-based buffer reading is unstable.
        }

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
