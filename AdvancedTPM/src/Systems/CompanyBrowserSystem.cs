using Colossal.UI.Binding;
using Game.Buildings;
using Game.Companies;
using Game.Economy;
using Game.Prefabs;
using Game.Simulation;
using Game.UI;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using Unity.Collections;
using Unity.Entities;
using Unity.Mathematics;

// Alias to disambiguate from Unity.Transforms
using GameTransform = Game.Objects.Transform;

namespace AdvancedTPM
{
    /// <summary>
    /// Queries individual company entities via ECS and exposes data to the UI.
    /// Uses direct component access - all required types (Profitability, PropertyRenter,
    /// IndustrialProcessData, Transform, etc.) are public IComponentData in Game.dll.
    /// Pattern reference: InfoLoom IndustrialCompanySystem.
    /// </summary>
    using AdvancedTPM.Utilities;

    public partial class CompanyBrowserSystem : UISystemBase
    {
        public static bool IsSystemActive = false;
        private PrefixedLogger m_Log;
        private ValueBinding<string> _companyBrowserData;

        // Cache component Types for service components to avoid scanning assemblies per-entity
        private readonly Dictionary<string, Type> _serviceComponentTypeCache = new Dictionary<string, Type>(StringComparer.OrdinalIgnoreCase);

        private PrefabSystem _prefabSystem;
        private TaxSystem _taxSystem;
        private NameSystem _nameSystem;
        private TaxingProductionUISystem _taxingProductionUISystem;
        private Game.UI.InGame.SignatureBuildingUISystem _signatureSystem;
        private FieldInfo _signatureQueryField;
        private readonly HashSet<int> _signaturePrefabIndices = new HashSet<int>();
        private DateTime _signatureCacheTimestamp = DateTime.MinValue;
        private readonly TimeSpan _signatureCacheTtl = TimeSpan.FromSeconds(10);
        private ValueBinding<string> _signaturePrefabsBinding;
        private ValueBinding<string> _signatureCompaniesBinding;
        private ValueBinding<string> _signatureCacheStatusBinding;
        private float m_UpdateTimer = 0f;
        private bool m_WasPanelOpen = false;
        private string m_LastCompanyBrowserData = "";
        private string m_LastSignatureCompanies = "[]";
        private string m_LastSignatureCacheStatus = "{}";

        // ── Pre-allocated reusable buffers (zero GC per update cycle) ──────────
        private readonly List<CompanyInfo> _companyBuffer = new List<CompanyInfo>(2048);
        private readonly Dictionary<Resource, (float sum, int count)> _resourceProfitSums = new Dictionary<Resource, (float sum, int count)>();
        private readonly List<string> _sigKeyBuffer = new List<string>(64);
        private readonly List<string> _efficiencyFactorParts = new List<string>(16);
        private readonly System.Text.StringBuilder _sb = new System.Text.StringBuilder(128 * 1024);
        private static readonly Resource[] _allResources = (Resource[])Enum.GetValues(typeof(Resource));

        // Queries
        private EntityQuery _industrialQuery;
        private EntityQuery _commercialQuery;
        private EntityQuery _storageQuery;

        // Aggregate per-resource profitability for auto-tax integration
        private readonly Dictionary<Resource, float> _avgProfitByResource = new Dictionary<Resource, float>();
        public IReadOnlyDictionary<Resource, float> AvgProfitByResource => _avgProfitByResource;

        protected override void OnCreate()
        {
            base.OnCreate();

            try { _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>(); } catch { }
            try { _taxSystem = World.GetOrCreateSystemManaged<TaxSystem>(); } catch { }
            try { _nameSystem = World.GetOrCreateSystemManaged<NameSystem>(); } catch { }
            try { _taxingProductionUISystem = World.GetOrCreateSystemManaged<TaxingProductionUISystem>(); } catch { }
            try
            {
                _signatureSystem = World.GetOrCreateSystemManaged<Game.UI.InGame.SignatureBuildingUISystem>();
                // CRITICAL: Reflection-based signature query is unstable and causing native crashes.
                /*
                if (_signatureSystem != null)
                {
                    _signatureQueryField = _signatureSystem.GetType().GetField("m_UnlockedSignatureBuildingQuery", BindingFlags.NonPublic | BindingFlags.Instance);
                }
                */
            }
            catch { }

            // Build entity queries — match InfoLoom pattern:
            // Require PropertyRenter (active companies)
            _industrialQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<IndustrialCompany>(),
                    ComponentType.ReadOnly<PrefabRef>(),
                    ComponentType.ReadOnly<PropertyRenter>(),
                },
                None = new ComponentType[] { ComponentType.ReadOnly<Game.Companies.StorageCompany>() }
            });

            _commercialQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<CommercialCompany>(),
                    ComponentType.ReadOnly<PrefabRef>(),
                    ComponentType.ReadOnly<PropertyRenter>(),
                },
                None = new ComponentType[] { ComponentType.ReadOnly<Game.Companies.StorageCompany>() }
            });

            _storageQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<Game.Companies.StorageCompany>(),
                    ComponentType.ReadOnly<PrefabRef>(),
                    ComponentType.ReadOnly<PropertyRenter>(),
                }
            });

            AddBinding(_companyBrowserData = new ValueBinding<string>("taxProduction", "companyBrowserData", ""));
            try { AddBinding(_signaturePrefabsBinding = new ValueBinding<string>("taxProduction", "signaturePrefabs", "[]")); } catch { }
            try { AddBinding(_signatureCompaniesBinding = new ValueBinding<string>("taxProduction", "signatureCompanies", "[]")); } catch { }
            try { AddBinding(_signatureCacheStatusBinding = new ValueBinding<string>("taxProduction", "signatureCacheStatus", "{}")); } catch { }
            try
            {
                AddBinding(_companyHappinessData = new ValueBinding<string>("taxProduction", "companyHappinessData", ""));
                _companyHappinessData.Update("");
            }
            catch { }
            try { AddBinding(new TriggerBinding<string>("taxProduction", "requestCompanyHappiness", HandleCompanyHappinessRequest)); } catch { }
            try { AddBinding(new TriggerBinding<string>("taxProduction", "refreshSignatureCache", (s) => { RefreshSignatureCache(); })); } catch { }

            m_Log = new PrefixedLogger(nameof(CompanyBrowserSystem));
            m_Log.Info("CompanyBrowserSystem initialized (direct ECS)");
        }

        // Find a value-type component Type matching a short name (e.g. "ElectricityConsumer") and cache it.
        private Type FindServiceComponentType(string shortName)
        {
            // CRITICAL: Runtime assembly scanning is unstable on the simulation thread.
            return null;
        }

        // Read a numeric field from a component struct on the given entity using reflection.
        // em is passed to avoid referencing EntityManager property via reflection repeatedly.
        private double? TryReadComponentNumeric(EntityManager em, Entity ent, Type compType, string[] candidateFields)
        {
            // CRITICAL: Reflection-based data access is unstable and causing native crashes.
            return null;
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
            // Company queries iterate up to 2000 entities and serialize all results to JSON.
            // There is zero value in doing this when the AdvancedTPM panel is not visible.
            if (_taxingProductionUISystem == null || !_taxingProductionUISystem.IsPanelOpen || _taxingProductionUISystem.ActiveViewMode != "company")
            {
                m_WasPanelOpen = false;
                this.Dependency = Dependency;
                return;
            }

            bool justOpened = !m_WasPanelOpen;
            m_WasPanelOpen = true;

            if (m_FrameCounter++ % 600 == 0) Mod.log.Info("CompanyBrowserSystem Heartbeat");

            m_UpdateTimer += World.Time.DeltaTime;
            // ── 2-second throttle gate (reduced from 10s — profiler showed 60ms stalls on flush) ──
            if (m_UpdateTimer < 2.0f && !justOpened)
            {
                this.Dependency = Dependency;
                return;
            }
            m_UpdateTimer = 0f;

            // ── Tick signature cache once per update cycle, not per entity ────────────
            try
            {
                if ((DateTime.UtcNow - _signatureCacheTimestamp) > _signatureCacheTtl)
                    RefreshSignatureCache();
            }
            catch { }

            try
            {
                CollectCompanyData(_companyBuffer);
                var serialized = SerializeCompanies(_companyBuffer);
                if (serialized != m_LastCompanyBrowserData)
                {
                    _companyBrowserData.Update(serialized);
                    m_LastCompanyBrowserData = serialized;
                }
                try
                {
                    // Publish authoritative list of signature company entity keys as JSON array ["idx,ver",...]
                    if (_signatureCompaniesBinding != null)
                    {
                        _sigKeyBuffer.Clear();
                        foreach (var c in _companyBuffer)
                        {
                            if (c.IsSignature)
                                _sigKeyBuffer.Add(c.Entity.Index + "," + c.Entity.Version);
                        }
                        var json = "[" + string.Join(",", _sigKeyBuffer.ConvertAll(k => "\"" + k + "\"")) + "]";
                        if (json != m_LastSignatureCompanies)
                        {
                            _signatureCompaniesBinding.Update(json);
                            m_LastSignatureCompanies = json;
                        }
                    }
                    // Publish cache status for debug (timestamp + count of signature prefabs)
                    if (_signatureCacheStatusBinding != null)
                    {
                        var statusJson = "{\"timestamp\":\"" + DateTime.UtcNow.ToString("o") + "\",\"count\": " + _signaturePrefabIndices.Count + "}";
                        if (statusJson != m_LastSignatureCacheStatus)
                        {
                            _signatureCacheStatusBinding.Update(statusJson);
                            m_LastSignatureCacheStatus = statusJson;
                        }
                    }
                }
                catch { }
            }
            catch (Exception ex)
            {
                Mod.log.Warn("CompanyBrowserSystem update error: " + ex.Message);
            }

            this.Dependency = Dependency;
        }

        private struct CompanyInfo
        {
            public Entity Entity;
            public string Name;
            public string ZoneType;
            public string ResourceKey;
            public Resource ResourceEnum;
            public int Profit;
            public string ProfitabilityTier;
            public int CurrentWorkers;
            public int MaxWorkers;
            public float3 Position;
            public bool HasPosition;
            public int Efficiency;           // 0-100 building efficiency
            public string InputResource1;     // first input resource key
            public string InputResource2;     // second input resource key
            public int TaxRate;               // current tax rate for this resource
            public int BuildingLevel;         // 1-5 from SpawnableBuilding
            public string EfficiencyDetails;  // "factor:pct,..." non-100% factors
            public string BrandName;           // rendered company brand name (e.g. "Ordinateur")
            public string BuildingAddress;     // rendered building address (e.g. "32 Kingsgate Street")
            public int HappinessEstimate;
            // Lightweight numeric service metrics (optional, may be 0 if unavailable)
            public float ElectricityConsumption;
            public float WaterConsumption;
            public float GarbageAccumulation;
            public float MailAccumulation;
            public float CrimeProbability;
            public bool ProducesGarbage;
            public bool ProducesCrime;
            public bool ProducesMail;
            public bool NeedsElectricity;
            public bool NeedsWater;
            public bool IsSignature;
            public string District;
            public string Theme;
            public string AssetPack;
            public string CompanyKind;
        }

        private void CollectCompanyData(List<CompanyInfo> result)
        {
            // Reuse pre-allocated buffers — zero heap allocations per update cycle
            result.Clear();
            _resourceProfitSums.Clear();

            CollectFromQuery(_industrialQuery, "Industrial", result, _resourceProfitSums);
            CollectFromQuery(_commercialQuery, "Commercial", result, _resourceProfitSums);
            CollectFromQuery(_storageQuery, "Storage", result, _resourceProfitSums);

            // Compute average profit per resource for auto-tax integration
            _avgProfitByResource.Clear();
            foreach (var kvp in _resourceProfitSums)
            {
                if (kvp.Value.count > 0)
                    _avgProfitByResource[kvp.Key] = kvp.Value.sum / kvp.Value.count;
            }
        }

        private void CollectFromQuery(EntityQuery query, string defaultZone,
            List<CompanyInfo> result, Dictionary<Resource, (float sum, int count)> profitSums)
        {
            if (query.IsEmptyIgnoreFilter) return;

            var entities = query.ToEntityArray(Allocator.Temp);
            try
            {
                var em = EntityManager;
                for (int i = 0; i < entities.Length && result.Count < 2000; i++)
                {
                    var entity = entities[i];
                    var info = ReadCompanyInfo(em, entity, defaultZone);
                    if (info.HasValue)
                    {
                        var val = info.Value;
                        result.Add(val);

                        // Accumulate for auto-tax
                        if (val.ResourceEnum != Resource.NoResource)
                        {
                            if (profitSums.TryGetValue(val.ResourceEnum, out var existing))
                                profitSums[val.ResourceEnum] = (existing.sum + val.Profit, existing.count + 1);
                            else
                                profitSums[val.ResourceEnum] = (val.Profit, 1);
                        }
                    }
                }
            }
            finally { entities.Dispose(); }
        }

        private CompanyInfo? ReadCompanyInfo(EntityManager em, Entity entity, string defaultZone)
        {
            try
            {
                var info = new CompanyInfo
                {
                    Entity = entity,
                    ZoneType = defaultZone,
                    ProfitabilityTier = "Unknown",
                    ResourceEnum = Resource.NoResource,
                };

                // --- Brand name via NameSystem (like InfoLoom: m_Brand -> GetRenderedLabelName) ---
                if (_nameSystem != null && em.HasComponent<CompanyData>(entity))
                {
                    try
                    {
                        var companyData = em.GetComponentData<CompanyData>(entity);
                        info.BrandName = _nameSystem.GetRenderedLabelName(companyData.m_Brand);
                    }
                    catch { }
                }

                // --- Building address via NameSystem on the building entity ---
                if (_nameSystem != null && em.HasComponent<PropertyRenter>(entity))
                {
                    try
                    {
                        var renter = em.GetComponentData<PropertyRenter>(entity);
                        if (em.Exists(renter.m_Property))
                            info.BuildingAddress = _nameSystem.GetRenderedLabelName(renter.m_Property);
                    }
                    catch { }
                }

                // --- Prefab name and resource ---
                if (em.HasComponent<PrefabRef>(entity))
                {
                    var prefabRef = em.GetComponentData<PrefabRef>(entity);
                    Entity prefab = prefabRef.m_Prefab;

                    // Prefab name as fallback
                    if (_prefabSystem != null)
                    {
                        try
                        {
                            info.Name = _prefabSystem.GetPrefabName(prefab);
                        }
                        catch
                        {
                            info.Name = "Company #" + entity.Index;
                        }
                    }
                    else
                    {
                        info.Name = "Company #" + entity.Index;
                    }

                    // Get resource from IndustrialProcessData on the prefab entity
                    if (em.HasComponent<IndustrialProcessData>(prefab))
                    {
                        var processData = em.GetComponentData<IndustrialProcessData>(prefab);
                        Resource outputRes = processData.m_Output.m_Resource;
                        info.ResourceKey = GetResourceKey(outputRes);
                        info.ResourceEnum = outputRes;

                        // Input resources
                        if (processData.m_Input1.m_Resource != Resource.NoResource)
                            info.InputResource1 = GetResourceKey(processData.m_Input1.m_Resource);
                        if (processData.m_Input2.m_Resource != Resource.NoResource)
                            info.InputResource2 = GetResourceKey(processData.m_Input2.m_Resource);

                        // For commercial companies, physical goods get "c_" prefix to
                        // distinguish them from industrial goods in the UI taxonomy
                        if (em.HasComponent<CommercialCompany>(entity) && !string.IsNullOrEmpty(info.ResourceKey))
                        {
                            switch (outputRes)
                            {
                                case Resource.Food: case Resource.Beverages: case Resource.ConvenienceFood:
                                case Resource.Textiles: case Resource.Timber: case Resource.Paper:
                                case Resource.Furniture: case Resource.Metals: case Resource.Steel:
                                case Resource.Minerals: case Resource.Concrete: case Resource.Machinery:
                                case Resource.Electronics: case Resource.Vehicles:
                                case Resource.Petrochemicals: case Resource.Plastics:
                                case Resource.Chemicals: case Resource.Pharmaceuticals:
                                    info.ResourceKey = "c_" + info.ResourceKey;
                                    break;
                            }
                        }

                        // Determine zone: Office resources override default
                        if (defaultZone == "Industrial" || defaultZone == "RawIndustrial")
                        {
                            if (outputRes == Resource.Software || outputRes == Resource.Telecom ||
                                outputRes == Resource.Financial || outputRes == Resource.Media)
                            {
                                info.ZoneType = "Office";
                            }
                            else if (IsRawResource(outputRes))
                            {
                                info.ZoneType = "RawIndustrial";
                            }
                        }
                    }
                    else if (em.HasComponent<Game.Prefabs.StorageCompanyData>(prefab))
                    {
                        var storageCompany = em.GetComponentData<Game.Prefabs.StorageCompanyData>(prefab);
                        // Convert bitmask to a single Resource enum by taking the lowest set bit.
                        // Game.Economy.Resource is an enum with flags, usually companies focus on one.
                        Game.Economy.Resource storedFlags = storageCompany.m_StoredResources;
                        Resource storedRes = Resource.NoResource;

                        for (int rIdx = 0; rIdx < _allResources.Length; rIdx++)
                        {
                            Resource flag = _allResources[rIdx];
                            if (flag != Resource.NoResource && (storedFlags & flag) != 0)
                            {
                                storedRes = flag;
                                break;
                            }
                        }

                        info.ResourceKey = GetResourceKey(storedRes);
                        info.ResourceEnum = storedRes;
                        info.CompanyKind = "Storage";
                    }
                    else
                    {
                        info.Name = "Company #" + entity.Index;
                    }
                } // End of PrefabRef block

                // --- Tax rate for this company's resource ---
                        if (_taxSystem != null && info.ResourceEnum != Resource.NoResource)
                        {
                            try
                            {
                                if (info.ZoneType == "Office")
                                    info.TaxRate = _taxSystem.GetOfficeTaxRate(info.ResourceEnum);
                                else if (info.ZoneType == "Commercial")
                                    info.TaxRate = _taxSystem.GetCommercialTaxRate(info.ResourceEnum);
                                else
                                    info.TaxRate = _taxSystem.GetIndustrialTaxRate(info.ResourceEnum);
                            }
                            catch { }
                        }

                // --- Profitability (optional — not all companies have it immediately) ---
                if (em.HasComponent<Profitability>(entity))
                {
                    var prof = em.GetComponentData<Profitability>(entity);
                    // m_Profitability is byte (0-255), centered at 127.
                    // Convert to percentage: ((val - 127) / 127.5) * 100
                    info.Profit = (int)Math.Round(((prof.m_Profitability - 127f) / 127.5f) * 100f);
                    // Compute tier from profit % for consistent UI matching
                    info.ProfitabilityTier = info.Profit > 20 ? "Profitable"
                        : info.Profit > 0 ? "GettingBy"
                        : info.Profit > -10 ? "BreakingEven"
                        : info.Profit > -40 ? "LosingMoney"
                        : "Bankrupt";
                }

                // --- Position from PropertyRenter -> Building -> Transform ---
                if (em.HasComponent<PropertyRenter>(entity))
                {
                    var renter = em.GetComponentData<PropertyRenter>(entity);
                    Entity buildingEntity = renter.m_Property;
                    if (em.Exists(buildingEntity) && em.HasComponent<GameTransform>(buildingEntity))
                    {
                        var transform = em.GetComponentData<GameTransform>(buildingEntity);
                        info.Position = transform.m_Position;
                        info.HasPosition = true;
                    }
                }

                // --- Max workers from WorkProvider ---
                if (em.HasComponent<WorkProvider>(entity))
                {
                    var wp = em.GetComponentData<WorkProvider>(entity);
                    info.MaxWorkers = wp.m_MaxWorkers;
                }

                // --- Current employee count from Employee DynamicBuffer ---
                if (em.HasBuffer<Employee>(entity))
                {
                    var employees = em.GetBuffer<Employee>(entity);
                    info.CurrentWorkers = employees.Length;
                }

                // --- Building data from PropertyRenter -> Building ---
                if (em.HasComponent<PropertyRenter>(entity))
                {
                    var renter = em.GetComponentData<PropertyRenter>(entity);
                    Entity bldg = renter.m_Property;

                    // Building level from SpawnableBuildingData on the building's prefab
                    try
                    {
                        if (em.Exists(bldg) && em.HasComponent<PrefabRef>(bldg))
                        {
                            var bldgPrefRef = em.GetComponentData<PrefabRef>(bldg);
                            Entity bldgPrefab = bldgPrefRef.m_Prefab;
                            if (em.HasComponent<SpawnableBuildingData>(bldgPrefab))
                            {
                                var sbd = em.GetComponentData<SpawnableBuildingData>(bldgPrefab);
                                info.BuildingLevel = sbd.m_Level;
                            }
                        }
                    }
                    catch { }

                    // Efficiency factors from Efficiency DynamicBuffer
                    // m_Efficiency is a float multiplier: 1.0 = 100%, 1.14 = +14% bonus, 0.0 = not applicable
                    // Pattern reference: InfoLoom CommercialCompanyDataSystem.GetEfficiencyFactors
                    if (em.Exists(bldg) && em.HasBuffer<Efficiency>(bldg))
                    {
                        var effBuf = em.GetBuffer<Efficiency>(bldg);
                        if (effBuf.Length > 0)
                        {
                            float combined = 1f;
                            _efficiencyFactorParts.Clear();
                            for (int e = 0; e < effBuf.Length; e++)
                            {
                                float eff = Math.Max(0f, effBuf[e].m_Efficiency);
                                // 0 means "not applicable to this building" — skip entirely
                                if (eff == 0f) continue;

                                combined *= eff;
                                // percentageChange: how much this factor deviates from 100%
                                int percentageChange = (int)Math.Round(100f * eff) - 100;
                                if (percentageChange != 0)
                                {
                                    try
                                    {
                                        string fname = effBuf[e].m_Factor.ToString();
                                        int effCumulative = Math.Max(1, (int)Math.Round(combined * 100f));
                                        // Send as "Factor:change:cumulative" e.g. "EmployeeHappiness:+14:114"
                                        _efficiencyFactorParts.Add(fname + ":" + (percentageChange > 0 ? "+" : "") + percentageChange + ":" + effCumulative);
                                    }
                                    catch { }
                                }
                            }
                            info.Efficiency = Math.Max(0, Math.Min(999, (int)Math.Round(combined * 100f)));
                            if (_efficiencyFactorParts.Count > 0)
                                info.EfficiencyDetails = string.Join(",", _efficiencyFactorParts);
                        }
                        else
                        {
                            info.Efficiency = 100;
                        }
                    }
                    else
                    {
                        info.Efficiency = 100;
                    }
                }

                // --- Populate lightweight environmental/service flags and a server-side happiness estimate ---
                try
                {
                    Entity prop = Entity.Null;
                    if (em.HasComponent<PropertyRenter>(entity))
                    {
                        try { prop = em.GetComponentData<PropertyRenter>(entity).m_Property; } catch { prop = Entity.Null; }
                    }

                    bool producesGarbage = prop != Entity.Null && em.Exists(prop) && em.HasComponent<GarbageProducer>(prop);
                    bool producesCrime = prop != Entity.Null && em.Exists(prop) && em.HasComponent<CrimeProducer>(prop);
                    bool producesMail = prop != Entity.Null && em.Exists(prop) && em.HasComponent<MailProducer>(prop);
                    bool needsElec = prop != Entity.Null && em.Exists(prop) && em.HasComponent<ElectricityConsumer>(prop);
                    bool needsWater = prop != Entity.Null && em.Exists(prop) && em.HasComponent<WaterConsumer>(prop);

                    info.ProducesGarbage = producesGarbage;
                    info.ProducesCrime = producesCrime;
                    info.ProducesMail = producesMail;
                    info.NeedsElectricity = needsElec;
                    info.NeedsWater = needsWater;

                    // Attempt to read numeric service metrics from the property or prefab (use cached component type lookups)
                    double elecConsumption = double.NaN, waterConsumption = double.NaN, garbageAccum = double.NaN, mailAccum = double.NaN, crimeProb = double.NaN;
                    try
                    {
                        var elecType = FindServiceComponentType("ElectricityConsumer");
                        var waterType = FindServiceComponentType("WaterConsumer");
                        var garbageType = FindServiceComponentType("GarbageProducer");
                        var mailType = FindServiceComponentType("MailProducer");
                        var crimeType = FindServiceComponentType("CrimeProducer");

                        // Try on the property entity first
                        if (prop != Entity.Null && em.Exists(prop))
                        {
                            var r = TryReadComponentNumeric(em, prop, elecType, new[] { "m_CurrentConsumption", "m_PowerUsage", "m_Consumption", "m_ElectricityConsumption" });
                            if (r.HasValue) elecConsumption = r.Value;
                            r = TryReadComponentNumeric(em, prop, waterType, new[] { "m_CurrentConsumption", "m_WaterUsage", "m_Consumption", "m_WaterConsumption" });
                            if (r.HasValue) waterConsumption = r.Value;
                            r = TryReadComponentNumeric(em, prop, garbageType, new[] { "m_Accumulation", "m_GarbageAccumulation", "m_Amount" });
                            if (r.HasValue) garbageAccum = r.Value;
                            r = TryReadComponentNumeric(em, prop, mailType, new[] { "m_Accumulation", "m_MailAccumulation" });
                            if (r.HasValue) mailAccum = r.Value;
                            r = TryReadComponentNumeric(em, prop, crimeType, new[] { "m_Probability", "m_CrimeProbability" });
                            if (r.HasValue) crimeProb = r.Value;
                        }

                        // Fallback to prefab-level components if property didn't yield values
                        try
                        {
                            if (em.HasComponent<PropertyRenter>(entity))
                            {
                                var renter = em.GetComponentData<PropertyRenter>(entity);
                                var bldg = renter.m_Property;
                                if (em.Exists(bldg) && em.HasComponent<PrefabRef>(bldg))
                                {
                                    var bRef = em.GetComponentData<PrefabRef>(bldg);
                                    var bPrefab = bRef.m_Prefab;
                                    var r = TryReadComponentNumeric(em, bPrefab, elecType, new[] { "m_CurrentConsumption", "m_PowerUsage", "m_Consumption", "m_ElectricityConsumption" });
                                    if (r.HasValue && double.IsNaN(elecConsumption)) elecConsumption = r.Value;
                                    r = TryReadComponentNumeric(em, bPrefab, waterType, new[] { "m_CurrentConsumption", "m_WaterUsage", "m_Consumption", "m_WaterConsumption" });
                                    if (r.HasValue && double.IsNaN(waterConsumption)) waterConsumption = r.Value;
                                    r = TryReadComponentNumeric(em, bPrefab, garbageType, new[] { "m_Accumulation", "m_GarbageAccumulation", "m_Amount" });
                                    if (r.HasValue && double.IsNaN(garbageAccum)) garbageAccum = r.Value;
                                    r = TryReadComponentNumeric(em, bPrefab, mailType, new[] { "m_Accumulation", "m_MailAccumulation" });
                                    if (r.HasValue && double.IsNaN(mailAccum)) mailAccum = r.Value;
                                    r = TryReadComponentNumeric(em, bPrefab, crimeType, new[] { "m_Probability", "m_CrimeProbability" });
                                    if (r.HasValue && double.IsNaN(crimeProb)) crimeProb = r.Value;
                                }
                            }
                        }
                        catch { }
                    }
                    catch { }

                    info.ElectricityConsumption = double.IsNaN(elecConsumption) ? 0f : (float)elecConsumption;
                    info.WaterConsumption = double.IsNaN(waterConsumption) ? 0f : (float)waterConsumption;
                    info.GarbageAccumulation = double.IsNaN(garbageAccum) ? 0f : (float)garbageAccum;
                    info.MailAccumulation = double.IsNaN(mailAccum) ? 0f : (float)mailAccum;
                    info.CrimeProbability = double.IsNaN(crimeProb) ? 0f : (float)crimeProb;

                    // Server-side happiness estimate (same formula as client-side fallback)
                    var eff = Math.Max(0, info.Efficiency);
                    var profit = Math.Max(-100, Math.Min(100, info.Profit));
                    var staffPct = info.MaxWorkers > 0 ? (info.CurrentWorkers * 100f / info.MaxWorkers) : 100f;
                    var tax = info.TaxRate;
                    int estimate = (int)Math.Round(Math.Max(0, Math.Min(100, 50 + (eff - 100) * 0.2 + profit * 0.25 + (staffPct - 75) * 0.3 - Math.Max(0, tax - 10) * 0.5)));
                    info.HappinessEstimate = estimate;

                    // --- Signature detection (server-side) ---
                    try
                    {
                        // Start with no heuristic signals; prefer authoritative prefab/status checks below
                        bool sig = false;
                        // Inspect the building prefab (if available) for explicit signature/building-type flags
                        try
                        {
                            if (em.HasComponent<PropertyRenter>(entity))
                            {
                                var renter = em.GetComponentData<PropertyRenter>(entity);
                                var bldg = renter.m_Property;
                                if (em.Exists(bldg) && em.HasComponent<PrefabRef>(bldg))
                                {
                                    var bRef = em.GetComponentData<PrefabRef>(bldg);
                                    var bPrefab = bRef.m_Prefab;
                                    // CRITICAL: Reflection on SpawnableBuildingData is unstable.
                                    // Rely solely on explicit Signature component.
                                    try
                                    {
                                        if (em.HasComponent<Game.Buildings.Signature>(bPrefab) || em.HasComponent<Game.Buildings.Signature>(bldg))
                                        {
                                            sig = true;
                                        }
                                    }
                                    catch { }
                                }
                            }
                        }
                        catch { }

                        // If we have a cached authoritative list from SignatureBuildingUISystem, prefer that
                        try
                        {
                            // NOTE: Signature cache TTL is now refreshed once per update cycle in OnUpdate().
                            // Do NOT call RefreshSignatureCache() here to avoid per-entity overhead.
                            // building prefab check: compare building prefab index to cached set
                            if (!sig && em.HasComponent<PropertyRenter>(entity))
                            {
                                try
                                {
                                    var renter = em.GetComponentData<PropertyRenter>(entity);
                                    var bldg = renter.m_Property;
                                    if (em.Exists(bldg) && em.HasComponent<PrefabRef>(bldg))
                                    {
                                        var bRef = em.GetComponentData<PrefabRef>(bldg);
                                        var bPrefab = bRef.m_Prefab;
                                        if (_signaturePrefabIndices.Contains(bPrefab.Index)) sig = true;
                                    }
                                }
                                catch { }
                            }
                        }
                        catch { }

                        info.IsSignature = sig;

                        info.District = "City";
                        info.Theme = "USA";
                        info.AssetPack = "Base Game";
                        if (string.IsNullOrEmpty(info.CompanyKind))
                        {
                            if (info.ZoneType == "RawIndustrial") info.CompanyKind = "Extraction";
                            else info.CompanyKind = info.ZoneType;
                        }
                        try
                        {
                            if (prop != Entity.Null && em.Exists(prop))
                            {

                                if (em.HasComponent<PrefabRef>(prop))
                                {
                                    var pr = em.GetComponentData<PrefabRef>(prop);
                                    var prefab = pr.m_Prefab;
                                    if (_prefabSystem != null)
                                    {
                                        var pb = _prefabSystem.GetPrefab<PrefabBase>(prefab);
                                        if (pb != null)
                                        {
                                            string pn = pb.name ?? "";
                                            if (pn.Contains("European")) info.Theme = "European";
                                            else if (pn.Contains("NorthAmerican")) info.Theme = "North American";
                                            else if (pn.Contains("Asian")) info.Theme = "Asian";
                                            
                                            if (pn.StartsWith("DLC") || pn.Contains("_DLC")) info.AssetPack = "DLC";
                                            else if (pn.Contains("Mod_")) info.AssetPack = "Custom";
                                        }
                                    }
                                }
                            }
                        }
                        catch { }
                    }
                    catch { info.IsSignature = false; }
                }
                catch { }

                return info;
            }
            catch
            {
                return null;
            }
        }

        // --- Lightweight per-company happiness factor computation and UI trigger handling ---
        private ValueBinding<string> _companyHappinessData;
        private readonly Dictionary<long, string> _happinessCachePayload = new Dictionary<long, string>();
        private readonly Dictionary<long, DateTime> _happinessCacheTimestamp = new Dictionary<long, DateTime>();
        private readonly TimeSpan _happinessCacheTtl = TimeSpan.FromSeconds(10);

        protected override void OnStartRunning()
        {
            base.OnStartRunning();

            try
            {
                // Re-acquire signature system if it wasn't available at OnCreate
                if (_signatureSystem == null)
                {
                    try { _signatureSystem = World.GetOrCreateSystemManaged<Game.UI.InGame.SignatureBuildingUISystem>(); } catch { _signatureSystem = null; }
                    if (_signatureSystem != null && _signatureQueryField == null)
                    {
                        try { _signatureQueryField = _signatureSystem.GetType().GetField("m_UnlockedSignatureBuildingQuery", BindingFlags.NonPublic | BindingFlags.Instance); } catch { }
                    }
                }
            }
            catch { }

            try { RefreshSignatureCache(); } catch { }
        }

        private void HandleCompanyHappinessRequest(string payload)
        {
            if (string.IsNullOrEmpty(payload)) return;
            try
            {
                var parts = payload.Split(',');
                if (parts.Length < 2) return;
                int idx = int.Parse(parts[0]);
                int ver = int.Parse(parts[1]);
                bool force = parts.Length >= 3 && (parts[2] == "1" || parts[2].ToLowerInvariant() == "true");
                var entity = new Entity { Index = idx, Version = ver };

                long key = (((long)idx) << 32) | (uint)ver;
                if (!force && _happinessCachePayload.TryGetValue(key, out var cached) && _happinessCacheTimestamp.TryGetValue(key, out var ts) && (DateTime.UtcNow - ts) < _happinessCacheTtl)
                {
                    try { _companyHappinessData.Update(cached); } catch { }
                    return;
                }

                ComputeCompanyHappiness(entity);
            }
            catch (Exception ex)
            {
                Mod.log.Warn("CompanyHappiness request parse error: " + ex.Message);
            }
        }

        private void ComputeCompanyHappiness(Entity companyEntity)
        {
            var em = EntityManager;
            if (!em.Exists(companyEntity)) return;

            Entity property = Entity.Null;
            if (em.HasComponent<PropertyRenter>(companyEntity))
            {
                try { property = em.GetComponentData<PropertyRenter>(companyEntity).m_Property; } catch { }
            }

            // Basic heuristic factors computed from available components
            var factorMap = new Dictionary<string, float>();
            try
            {
                bool producesGarbage = property != Entity.Null && em.Exists(property) && em.HasComponent<GarbageProducer>(property);
                bool producesCrime = property != Entity.Null && em.Exists(property) && em.HasComponent<CrimeProducer>(property);
                bool producesMail = property != Entity.Null && em.Exists(property) && em.HasComponent<MailProducer>(property);
                bool needsElec = property != Entity.Null && em.Exists(property) && em.HasComponent<ElectricityConsumer>(property);
                bool needsWater = property != Entity.Null && em.Exists(property) && em.HasComponent<WaterConsumer>(property);

                // Try to extract authoritative numeric values from available components (reflective)
                double elecConsumption = double.NaN, waterConsumption = double.NaN, garbageAccum = double.NaN, mailAccum = double.NaN, crimeProb = double.NaN;
                try
                {
                    // helpers
                    Func<Entity, string, string[], double?> tryRead = (ent, compName, candFields) =>
                    {
                        try
                        {
                            var assemblies = AppDomain.CurrentDomain.GetAssemblies();
                            foreach (var asm in assemblies)
                            {
                                Type[] types = null;
                                try { types = asm.GetTypes(); } catch { continue; }
                                foreach (var t in types)
                                {
                                    if (!t.IsValueType) continue; // likely IComponentData structs
                                    if (!t.Name.Equals(compName, StringComparison.OrdinalIgnoreCase) && !t.Name.Contains(compName)) continue;
                                    // try to get component data via generic GetComponentData<T>
                                    try
                                    {
                                        var gm = em.GetType().GetMethod("GetComponentData", new Type[] { typeof(Entity) });
                                        if (gm == null) continue;
                                        var mg = gm.MakeGenericMethod(t);
                                        object compData = null;
                                        try { compData = mg.Invoke(em, new object[] { ent }); } catch { continue; }
                                        if (compData == null) continue;
                                        var dt = compData.GetType();
                                        foreach (var fn in candFields)
                                        {
                                            var f = dt.GetField(fn, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                                            if (f != null)
                                            {
                                                var v = f.GetValue(compData);
                                                if (v is float fv) return (double)fv;
                                                if (v is double dv) return dv;
                                                if (v is int iv) return (double)iv;
                                                if (v is long lv) return (double)lv;
                                            }
                                            var p = dt.GetProperty(fn, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                                            if (p != null)
                                            {
                                                var v = p.GetValue(compData);
                                                if (v is float fv2) return (double)fv2;
                                                if (v is double dv2) return dv2;
                                                if (v is int iv2) return (double)iv2;
                                                if (v is long lv2) return (double)lv2;
                                            }
                                        }
                                    }
                                    catch { continue; }
                                }
                            }
                        }
                        catch { }
                        return null;
                    };

                    // Try on the property entity first
                    if (property != Entity.Null && em.Exists(property))
                    {
                        var r = tryRead(property, "ElectricityConsumer", new[] { "m_CurrentConsumption", "m_PowerUsage", "m_Consumption", "m_ElectricityConsumption" });
                        if (r.HasValue) elecConsumption = r.Value;
                        r = tryRead(property, "WaterConsumer", new[] { "m_CurrentConsumption", "m_WaterUsage", "m_Consumption", "m_WaterConsumption" });
                        if (r.HasValue) waterConsumption = r.Value;
                        r = tryRead(property, "GarbageProducer", new[] { "m_Accumulation", "m_GarbageAccumulation", "m_Amount" });
                        if (r.HasValue) garbageAccum = r.Value;
                        r = tryRead(property, "MailProducer", new[] { "m_Accumulation", "m_MailAccumulation" });
                        if (r.HasValue) mailAccum = r.Value;
                        r = tryRead(property, "CrimeProducer", new[] { "m_Probability", "m_CrimeProbability" });
                        if (r.HasValue) crimeProb = r.Value;
                    }

                    // Try on the building prefab as fallback
                    try
                    {
                        if (em.HasComponent<PropertyRenter>(companyEntity))
                        {
                            var renter = em.GetComponentData<PropertyRenter>(companyEntity);
                            var bldg = renter.m_Property;
                            if (em.Exists(bldg) && em.HasComponent<PrefabRef>(bldg))
                            {
                                var bRef = em.GetComponentData<PrefabRef>(bldg);
                                var bPrefab = bRef.m_Prefab;
                                var r = tryRead(bPrefab, "ElectricityConsumer", new[] { "m_CurrentConsumption", "m_PowerUsage", "m_Consumption", "m_ElectricityConsumption" });
                                if (r.HasValue && double.IsNaN(elecConsumption)) elecConsumption = r.Value;
                                r = tryRead(bPrefab, "WaterConsumer", new[] { "m_CurrentConsumption", "m_WaterUsage", "m_Consumption", "m_WaterConsumption" });
                                if (r.HasValue && double.IsNaN(waterConsumption)) waterConsumption = r.Value;
                                r = tryRead(bPrefab, "GarbageProducer", new[] { "m_Accumulation", "m_GarbageAccumulation", "m_Amount" });
                                if (r.HasValue && double.IsNaN(garbageAccum)) garbageAccum = r.Value;
                                r = tryRead(bPrefab, "MailProducer", new[] { "m_Accumulation", "m_MailAccumulation" });
                                if (r.HasValue && double.IsNaN(mailAccum)) mailAccum = r.Value;
                                r = tryRead(bPrefab, "CrimeProducer", new[] { "m_Probability", "m_CrimeProbability" });
                                if (r.HasValue && double.IsNaN(crimeProb)) crimeProb = r.Value;
                            }
                        }
                    }
                    catch { }
                }
                catch { }

                // crime and garbage are negative contributors
                factorMap["crime"] = producesCrime ? -30f : 0f;
                factorMap["garbage"] = producesGarbage ? -15f : 0f;
                factorMap["mail"] = producesMail ? 5f : 0f;

                // Basic supply heuristics: if a building needs a service but we can't query
                // the full provider chain here, present a conservative negative value so
                // the UI shows an issue rather than blank. These are placeholders until
                // we can query dedicated service systems for precise supply metrics.
                // Keep conservative supply heuristics but publish authoritative numeric metrics when available
                factorMap["electricitySupply"] = needsElec ? -10f : 5f;
                factorMap["waterSupply"] = needsWater ? -10f : 5f;
                if (!double.IsNaN(elecConsumption)) factorMap["electricityConsumption"] = (float)elecConsumption;
                if (!double.IsNaN(waterConsumption)) factorMap["waterConsumption"] = (float)waterConsumption;
                if (!double.IsNaN(garbageAccum)) factorMap["garbageAccumulation"] = (float)garbageAccum;
                if (!double.IsNaN(mailAccum)) factorMap["mailAccumulation"] = (float)mailAccum;
                if (!double.IsNaN(crimeProb)) factorMap["crimeProbability"] = (float)crimeProb;

                // telecom: give small bonus to office/service companies
                if (em.HasComponent<PrefabRef>(companyEntity))
                {
                    try
                    {
                        var pref = em.GetComponentData<PrefabRef>(companyEntity).m_Prefab;
                        if (em.HasComponent<IndustrialProcessData>(pref)) factorMap["telecom"] = 0f;
                        else if (em.HasComponent<CommercialCompany>(companyEntity) || em.HasComponent<OfficeBuilding>(pref)) factorMap["telecom"] = 8f;
                    }
                    catch { }
                }

                // taxEffects: penalty if tax above 10
                int tax = 0;
                try
                {
                    var infoOpt = ReadCompanyInfo(em, companyEntity, "Unknown");
                    if (infoOpt.HasValue)
                    {
                        tax = infoOpt.Value.TaxRate;
                    }
                }
                catch { }

                factorMap["taxEffects"] = -(float)Math.Max(0, tax - 10) * 0.5f;

                // electricityFee / waterFee: small cost effect proportional to tax
                factorMap["electricityFee"] = needsElec ? -(float)(Math.Max(0, tax) * 0.05) : 0f;
                factorMap["waterFee"] = needsWater ? -(float)(Math.Max(0, tax) * 0.03) : 0f;

                // Build payload
                string key = companyEntity.Index + "," + companyEntity.Version;
                var entries = new List<string>();
                foreach (var kv in factorMap) entries.Add(string.Format(CultureInfo.InvariantCulture, "{0}:{1:0.##}", kv.Key, kv.Value));
                var payload = key + "|" + string.Join(",", entries);

                long ck = (((long)companyEntity.Index) << 32) | (uint)companyEntity.Version;
                _happinessCachePayload[ck] = payload;
                _happinessCacheTimestamp[ck] = DateTime.UtcNow;
                try { _companyHappinessData.Update(payload); } catch { }
            }
            catch (Exception ex)
            {
                Mod.log.Warn("ComputeCompanyHappiness failed: " + ex.Message);
            }
        }

        private string SerializeCompanies(List<CompanyInfo> companies)
        {
            if (companies.Count == 0) return "";

            // Format: entityIndex,entityVersion|name|zoneType|resourceKey|profit|tier|workers|maxWorkers|posX|posY|posZ|efficiency|input1|input2|taxRate|buildingLevel|efficiencyDetails|brandName|buildingAddress|happiness|g|c|m|e|w|eCons|wCons|gAccum|mAccum|cProb|district|theme|pack|kind|isSignature
            _sb.Clear();
            bool first = true;
            foreach (var c in companies)
            {
                if (!first) _sb.Append(';');
                first = false;

                _sb.Append(c.Entity.Index).Append(',').Append(c.Entity.Version).Append('|')
                   .Append(EscapePipe(c.Name ?? "Unknown")).Append('|')
                   .Append(c.ZoneType).Append('|')
                   .Append(c.ResourceKey ?? "").Append('|')
                   .Append(c.Profit).Append('|')
                   .Append(c.ProfitabilityTier).Append('|')
                   .Append(c.CurrentWorkers).Append('|')
                   .Append(c.MaxWorkers).Append('|')
                   .Append(((int)c.Position.x).ToString(CultureInfo.InvariantCulture)).Append('|')
                   .Append(((int)c.Position.y).ToString(CultureInfo.InvariantCulture)).Append('|')
                   .Append(((int)c.Position.z).ToString(CultureInfo.InvariantCulture)).Append('|')
                   .Append(c.Efficiency).Append('|')
                   .Append(c.InputResource1 ?? "").Append('|')
                   .Append(c.InputResource2 ?? "").Append('|')
                   .Append(c.TaxRate).Append('|')
                   .Append(c.BuildingLevel).Append('|')
                   .Append(c.EfficiencyDetails ?? "").Append('|')
                   .Append(EscapePipe(c.BrandName ?? "")).Append('|')
                   .Append(EscapePipe(c.BuildingAddress ?? "")).Append('|')
                   .Append(c.HappinessEstimate).Append('|')
                   .Append(c.ProducesGarbage ? 1 : 0).Append('|')
                   .Append(c.ProducesCrime ? 1 : 0).Append('|')
                   .Append(c.ProducesMail ? 1 : 0).Append('|')
                   .Append(c.NeedsElectricity ? 1 : 0).Append('|')
                   .Append(c.NeedsWater ? 1 : 0).Append('|')
                   .Append(c.ElectricityConsumption.ToString(CultureInfo.InvariantCulture)).Append('|')
                   .Append(c.WaterConsumption.ToString(CultureInfo.InvariantCulture)).Append('|')
                   .Append(c.GarbageAccumulation.ToString(CultureInfo.InvariantCulture)).Append('|')
                   .Append(c.MailAccumulation.ToString(CultureInfo.InvariantCulture)).Append('|')
                   .Append(c.CrimeProbability.ToString(CultureInfo.InvariantCulture)).Append('|')
                   .Append(EscapePipe(c.District ?? "City")).Append('|')
                   .Append(EscapePipe(c.Theme ?? "USA")).Append('|')
                   .Append(EscapePipe(c.AssetPack ?? "Base Game")).Append('|')
                   .Append(EscapePipe(c.CompanyKind ?? "")).Append('|')
                   .Append(c.IsSignature ? 1 : 0);
            }
            return _sb.ToString();
        }

        private void RefreshSignatureCache()
        {
            // CRITICAL: Internal query reflection is unstable.
            // Neutralized to prevent native crashes.
        }

        private static string EscapePipe(string s) { return s.Replace("|", " ").Replace(";", " "); }

        private static string GetResourceKey(Resource resource)
        {
            switch (resource)
            {
                case Resource.Grain: return "grain";
                case Resource.Vegetables: return "vegetables";
                case Resource.Cotton: return "cotton";
                case Resource.Livestock: return "livestock";
                case Resource.Fish: return "fish";
                case Resource.Wood: return "wood";
                case Resource.Ore: return "ore";
                case Resource.Stone: return "stone";
                case Resource.Coal: return "coal";
                case Resource.Oil: return "oil";
                case Resource.Food: return "food";
                case Resource.Beverages: return "beverages";
                case Resource.ConvenienceFood: return "conveniencefood";
                case Resource.Textiles: return "textiles";
                case Resource.Timber: return "timber";
                case Resource.Paper: return "paper";
                case Resource.Furniture: return "furniture";
                case Resource.Metals: return "metals";
                case Resource.Steel: return "steel";
                case Resource.Minerals: return "minerals";
                case Resource.Concrete: return "concrete";
                case Resource.Machinery: return "machinery";
                case Resource.Electronics: return "electronics";
                case Resource.Vehicles: return "vehicles";
                case Resource.Petrochemicals: return "petrochemicals";
                case Resource.Plastics: return "plastics";
                case Resource.Chemicals: return "chemicals";
                case Resource.Pharmaceuticals: return "pharmaceuticals";
                case Resource.Software: return "software";
                case Resource.Telecom: return "telecom";
                case Resource.Financial: return "financial";
                case Resource.Media: return "media";
                case Resource.Lodging: return "lodging";
                case Resource.Meals: return "meals";
                case Resource.Entertainment: return "entertainment";
                case Resource.Recreation: return "recreation";
                default: return "";
            }
        }

        private static bool IsRawResource(Resource resource)
        {
            switch (resource)
            {
                case Resource.Grain:
                case Resource.Vegetables:
                case Resource.Cotton:
                case Resource.Livestock:
                case Resource.Fish:
                case Resource.Wood:
                case Resource.Ore:
                case Resource.Stone:
                case Resource.Coal:
                case Resource.Oil:
                    return true;
                default:
                    return false;
            }
        }
    }
}