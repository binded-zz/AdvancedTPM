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

                return info;
            }
            catch
            {
                return null;
            }
        }

        private string SerializeCompanies(List<CompanyInfo> companies)
        {
            if (companies.Count == 0) return "";

            // Format: entityIndex,entityVersion|name|zoneType|resourceKey|profit|tier|workers|maxWorkers|posX|posY|posZ|efficiency|input1|input2|taxRate|buildingLevel|efficiencyDetails|brandName|buildingAddress
            var parts = new List<string>(companies.Count);
            foreach (var c in companies)
            {
                parts.Add(string.Format(CultureInfo.InvariantCulture,
                    "{0},{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}|{9:F0}|{10:F0}|{11:F0}|{12}|{13}|{14}|{15}|{16}|{17}|{18}|{19}",
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
                    EscapePipe(c.BuildingAddress ?? "")));
            }
            return string.Join(";", parts);
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