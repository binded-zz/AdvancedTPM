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
    public partial class CompanyBrowserSystem : UISystemBase
    {
        private ValueBinding<string> _companyBrowserData;

        private PrefabSystem _prefabSystem;
        private TaxSystem _taxSystem;
        private NameSystem _nameSystem;
        private Game.UI.InGame.SignatureBuildingUISystem _signatureSystem;
        private FieldInfo _signatureQueryField;
        private readonly HashSet<int> _signaturePrefabIndices = new HashSet<int>();
        private DateTime _signatureCacheTimestamp = DateTime.MinValue;
        private readonly TimeSpan _signatureCacheTtl = TimeSpan.FromSeconds(10);
        private ValueBinding<string> _signaturePrefabsBinding;
        private int _updateCounter;

        // Queries
        private EntityQuery _industrialQuery;
        private EntityQuery _commercialQuery;

        // Aggregate per-resource profitability for auto-tax integration
        private readonly Dictionary<Resource, float> _avgProfitByResource = new Dictionary<Resource, float>();
        public IReadOnlyDictionary<Resource, float> AvgProfitByResource => _avgProfitByResource;

        protected override void OnCreate()
        {
            base.OnCreate();

            try { _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>(); } catch { }
            try { _taxSystem = World.GetOrCreateSystemManaged<TaxSystem>(); } catch { }
            try { _nameSystem = World.GetOrCreateSystemManaged<NameSystem>(); } catch { }
            try
            {
                _signatureSystem = World.GetOrCreateSystemManaged<Game.UI.InGame.SignatureBuildingUISystem>();
                if (_signatureSystem != null)
                {
                    _signatureQueryField = _signatureSystem.GetType().GetField("m_UnlockedSignatureBuildingQuery", BindingFlags.NonPublic | BindingFlags.Instance);
                }
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
                }
            });

            _commercialQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<CommercialCompany>(),
                    ComponentType.ReadOnly<PrefabRef>(),
                    ComponentType.ReadOnly<PropertyRenter>(),
                }
            });

            AddBinding(_companyBrowserData = new ValueBinding<string>("taxProduction", "companyBrowserData", ""));
            try { AddBinding(_signaturePrefabsBinding = new ValueBinding<string>("taxProduction", "signaturePrefabs", "")); } catch { }

            Mod.log.Info("CompanyBrowserSystem initialized (direct ECS)");
        }

        protected override void OnUpdate()
        {
            base.OnUpdate();

            _updateCounter++;
            if (_updateCounter < 480) return; // ~8 seconds between refreshes to reduce UI jumping
            _updateCounter = 0;

            try
            {
                var companies = CollectCompanyData();
                var serialized = SerializeCompanies(companies);
                _companyBrowserData.Update(serialized);
            }
            catch (Exception ex)
            {
                Mod.log.Warn("CompanyBrowserSystem update error: " + ex.Message);
            }
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
            public bool ProducesGarbage;
            public bool ProducesCrime;
            public bool ProducesMail;
            public bool NeedsElectricity;
            public bool NeedsWater;
            public bool IsSignature;
        }

        private List<CompanyInfo> CollectCompanyData()
        {
            var result = new List<CompanyInfo>();
            var resourceProfitSums = new Dictionary<Resource, (float sum, int count)>();

            int indCount = _industrialQuery.IsEmptyIgnoreFilter ? 0 : _industrialQuery.CalculateEntityCount();
            int comCount = _commercialQuery.IsEmptyIgnoreFilter ? 0 : _commercialQuery.CalculateEntityCount();

            CollectFromQuery(_industrialQuery, "Industrial", result, resourceProfitSums);
            CollectFromQuery(_commercialQuery, "Commercial", result, resourceProfitSums);

            // Compute average profit per resource for auto-tax integration
            _avgProfitByResource.Clear();
            foreach (var kvp in resourceProfitSums)
            {
                if (kvp.Value.count > 0)
                    _avgProfitByResource[kvp.Key] = kvp.Value.sum / kvp.Value.count;
            }

            return result;
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

                            // Determine zone: Office resources override default
                                if (outputRes == Resource.Software || outputRes == Resource.Telecom ||
                                    outputRes == Resource.Financial || outputRes == Resource.Media)
                                {
                                    info.ZoneType = "Office";
                                }
                            }
                        }
                        else
                        {
                            info.Name = "Company #" + entity.Index;
                        }

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
                            var factorParts = new List<string>();
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
                                        int result = Math.Max(1, (int)Math.Round(combined * 100f));
                                        // Send as "Factor:change:cumulative" e.g. "EmployeeHappiness:+14:114"
                                        factorParts.Add(fname + ":" + (percentageChange > 0 ? "+" : "") + percentageChange + ":" + result);
                                    }
                                    catch { }
                                }
                            }
                            info.Efficiency = Math.Max(0, Math.Min(999, (int)Math.Round(combined * 100f)));
                            if (factorParts.Count > 0)
                                info.EfficiencyDetails = string.Join(",", factorParts);
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
                                    // Check SpawnableBuildingData fields reflectively for building type / status
                                    try
                                    {
                            // First, check for explicit Signature component on the prefab or building entity
                            try
                            {
                                if (em.HasComponent<Game.Buildings.Signature>(bPrefab) || em.HasComponent<Game.Buildings.Signature>(bldg))
                                {
                                    sig = true;
                                }
                            }
                            catch { }

                            if (em.HasComponent<SpawnableBuildingData>(bPrefab))
                                        {
                                            var sbd = em.GetComponentData<SpawnableBuildingData>(bPrefab);
                                            var t = sbd.GetType();
                                            // Try common field names that may contain building type/status
                                            var typeField = t.GetField("m_BuildingType") ?? t.GetField("m_Type");
                                            if (typeField != null)
                                            {
                                                var raw = typeField.GetValue(sbd);
                                                if (raw != null)
                                                {
                                                    int iv = Convert.ToInt32(raw);
                                                    if (Enum.IsDefined(typeof(Game.Prefabs.BuildingType), iv))
                                                    {
                                                        var bt = (Game.Prefabs.BuildingType)iv;
                                                        if (bt == Game.Prefabs.BuildingType.SignatureCommercial || bt == Game.Prefabs.BuildingType.SignatureIndustrial || bt == Game.Prefabs.BuildingType.SignatureOffice || bt == Game.Prefabs.BuildingType.SignatureResidential)
                                                            sig = true;
                                                    }
                                                }
                                            }

                                            var statusField = t.GetField("m_BuildingStatus") ?? t.GetField("m_Status") ?? t.GetField("m_StatusFlags");
                                            if (!sig && statusField != null)
                                            {
                                                var raw = statusField.GetValue(sbd);
                                                if (raw != null)
                                                {
                                                    int sv = Convert.ToInt32(raw);
                                                    try
                                                    {
                                                        var st = (Game.Prefabs.BuildingStatusType)sv;
                                                        if (st.HasFlag(Game.Prefabs.BuildingStatusType.SignatureCommercial) || st.HasFlag(Game.Prefabs.BuildingStatusType.SignatureIndustrial) || st.HasFlag(Game.Prefabs.BuildingStatusType.SignatureOffice) || st.HasFlag(Game.Prefabs.BuildingStatusType.SignatureResidential))
                                                            sig = true;
                                                    }
                                                    catch { }
                                                }
                                            }
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
                            if ((DateTime.UtcNow - _signatureCacheTimestamp) > _signatureCacheTtl)
                                RefreshSignatureCache();
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
            try { AddBinding(_companyHappinessData = new ValueBinding<string>("taxProduction", "companyHappinessData", "")); } catch { }
            try { AddBinding(new TriggerBinding<string>("taxProduction", "requestCompanyHappiness", HandleCompanyHappinessRequest)); } catch { }
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
                    if (em.HasComponent<PropertyRenter>(companyEntity))
                    {
                        // try to read tax via company resource if available
                        // fallback to 0
                    }
                }
                catch { }
                factorMap["taxEffects"] = -(float)Math.Max(0, tax - 10) * 0.5f;

                // electricityFee / waterFee: small cost effect proportional to tax
                factorMap["electricityFee"] = needsElec ? (float)(Math.Max(0, tax) * 0.05) : 0f;
                factorMap["waterFee"] = needsWater ? (float)(Math.Max(0, tax) * 0.03) : 0f;

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

                // Format: entityIndex,entityVersion|name|zoneType|resourceKey|profit|tier|workers|maxWorkers|posX|posY|posZ|efficiency|input1|input2|taxRate|buildingLevel|efficiencyDetails|brandName|buildingAddress|happiness|g|c|m|e|w|isSignature
            var parts = new List<string>(companies.Count);
            foreach (var c in companies)
            {
                parts.Add(string.Format(CultureInfo.InvariantCulture,
                    "{0},{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}|{9:F0}|{10:F0}|{11:F0}|{12}|{13}|{14}|{15}|{16}|{17}|{18}|{19}|{20}|{21}|{22}|{23}|{24}|{25}|{26}",
                    c.Entity.Index, c.Entity.Version,
                    EscapePipe(c.Name ?? "Unknown"),
                    c.ZoneType,
                    c.ResourceKey ?? "",
                    c.Profit,
                    c.ProfitabilityTier,
                    c.CurrentWorkers,
                    c.MaxWorkers,
                    c.HasPosition ? c.Position.x : 0,
                    c.HasPosition ? c.Position.y : 0,
                    c.HasPosition ? c.Position.z : 0,
                    c.Efficiency,
                    c.InputResource1 ?? "",
                    c.InputResource2 ?? "",
                    c.TaxRate,
                    c.BuildingLevel,
                    c.EfficiencyDetails ?? "",
                    EscapePipe(c.BrandName ?? ""),
                    EscapePipe(c.BuildingAddress ?? ""),
                    c.HappinessEstimate,
                    c.ProducesGarbage ? 1 : 0,
                    c.ProducesCrime ? 1 : 0,
                    c.ProducesMail ? 1 : 0,
                    c.NeedsElectricity ? 1 : 0,
                    c.NeedsWater ? 1 : 0,
                    c.IsSignature ? 1 : 0));
            }
            return string.Join(";", parts);
        }

        private void RefreshSignatureCache()
        {
            try
            {
                _signaturePrefabIndices.Clear();
                _signatureCacheTimestamp = DateTime.UtcNow;
                if (_signatureSystem == null || _signatureQueryField == null) return;
                var qObj = _signatureQueryField.GetValue(_signatureSystem);
                if (qObj is EntityQuery q)
                {
                    if (q.IsEmptyIgnoreFilter) return;
                    var arr = q.ToEntityArray(Allocator.Temp);
                    try
                    {
                        var nameList = new List<string>();
                        for (int i = 0; i < arr.Length; i++)
                        {
                            _signaturePrefabIndices.Add(arr[i].Index);
                            try
                            {
                                if (_prefabSystem != null)
                                {
                                    var nm = _prefabSystem.GetPrefabName(arr[i]);
                                    if (!string.IsNullOrEmpty(nm)) nameList.Add(nm);
                                }
                            }
                            catch { }
                        }
                        // Publish debug binding with prefab names as JSON array
                        try
                        {
                            if (_signaturePrefabsBinding != null)
                            {
                                // simple JSON array serialization with escaping for quotes and backslashes
                                for (int i = 0; i < nameList.Count; i++)
                                {
                                    if (nameList[i] == null) nameList[i] = "";
                                    nameList[i] = nameList[i].Replace("\\", "\\\\").Replace("\"", "\\\"");
                                }
                                var json = "[" + string.Join(",", nameList.ConvertAll(n => "\"" + n + "\"").ToArray()) + "]";
                                _signaturePrefabsBinding.Update(json);
                            }
                        }
                        catch { }
                    }
                    finally { arr.Dispose(); }
                }
            }
            catch { }
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
    }
}