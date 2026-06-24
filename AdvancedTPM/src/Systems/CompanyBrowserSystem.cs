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
using Newtonsoft.Json;
using AdvancedTPM.Systems;

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
        private ValueBinding<string> _companyBrowserSummary;

        // Cache component Types for service components to avoid scanning assemblies per-entity
        private readonly Dictionary<string, Type> _serviceComponentTypeCache = new Dictionary<string, Type>(StringComparer.OrdinalIgnoreCase);

        private PrefabSystem _prefabSystem;
        private TaxSystem _taxSystem;
        private NameSystem _nameSystem;
        private TaxingProductionUISystem _taxingProductionUISystem;
        private Game.UI.InGame.SignatureBuildingUISystem _signatureSystem;
        private CitySystem _citySystem;
        // Caching signature prefabs via unstable reflection is disabled.
        private DateTime _signatureCacheTimestamp = DateTime.MinValue;
        private readonly TimeSpan _signatureCacheTtl = TimeSpan.FromSeconds(10);
        private ValueBinding<string> _signaturePrefabsBinding;
        private ValueBinding<string> _signatureCompaniesBinding;
        private ValueBinding<string> _signatureCacheStatusBinding;
        private float m_UpdateTimer = 0f;
        private bool m_ForceFilterUpdate = false;  // true = re-sort existing buffer only, skip ECS scan
        private bool m_WasPanelOpen = false;
        private string m_LastViewMode = "";
        private string m_LastCompanyBrowserData = "";
        private string m_LastCompanyBrowserSummary = "";
        private string m_LastSignatureCompanies = "[]";
        private string m_LastSignatureCacheStatus = "{}";

        // ── Name cache: avoids calling GetRenderedLabelName on the same entity every 2s ──
        private readonly Dictionary<Entity, string> _nameCache = new Dictionary<Entity, string>();

        // --- Prefab Caches ---
        private struct CompanyPrefabMetadata
        {
            public string Name;
            public string ResourceKey;
            public Resource ResourceEnum;
            public string InputResource1;
            public string InputResource2;
            public string CompanyKind;
            public string ZoneTypeOverride;
        }

        private struct BuildingPrefabMetadata
        {
            public int Level;
            public bool IsSignature;
            public string Theme;
            public string ThemeIcon;
            public string AssetPack;
            public string AssetPackIcon;
            public string IconUrl;
            public string NativePackIcon;
            public string CityEffects;
            public string LocalEffects;
        }

        private readonly Dictionary<Entity, CompanyPrefabMetadata> _companyPrefabCache = new Dictionary<Entity, CompanyPrefabMetadata>();
        private readonly Dictionary<Entity, BuildingPrefabMetadata> _buildingPrefabCache = new Dictionary<Entity, BuildingPrefabMetadata>();

        // --- Active UI filters and sorting state ---
        private string m_FilterZone = "All";
        private string m_FilterResource = "All";
        private string m_FilterTier = "All";
        private string m_FilterPack = "All";
        private string m_FilterTheme = "All";
        private string m_FilterDistrict = "All";
        private string m_FilterKind = "All";
        private int m_FilterProfitMin = -100;

        private BufferLookup<Game.Prefabs.CityModifierData> _cityModifierDataLookup;
        private BufferLookup<Game.Prefabs.LocalModifierData> _localModifierDataLookup;
        private int m_FilterProfitMax = 100;
        private string m_FilterSearch = "";
        private string m_SortField = "profit";
        private string m_SortDir = "desc";

        // ── Pre-allocated reusable buffers (zero GC per update cycle) ──────────
        private readonly List<CompanyInfo> _companyBuffer = new List<CompanyInfo>(2048);
        private readonly List<CompanyInfo> _filteredBuffer = new List<CompanyInfo>(256);
        private readonly Dictionary<Resource, (float sum, int count)> _resourceProfitSums = new Dictionary<Resource, (float sum, int count)>();
        private readonly List<string> _sigKeyBuffer = new List<string>(64);
        private readonly List<string> _efficiencyFactorParts = new List<string>(16);
        private static readonly Resource[] _allResources = (Resource[])Enum.GetValues(typeof(Resource));

        // Queries
        private EntityQuery _industrialQuery;
        private EntityQuery _commercialQuery;
        private EntityQuery _storageQuery;
        private EntityQuery _extractorQuery;

        // Aggregate per-resource profitability for auto-tax integration
        private readonly Dictionary<Resource, float> _avgProfitByResource = new Dictionary<Resource, float>();
        public IReadOnlyDictionary<Resource, float> AvgProfitByResource => _avgProfitByResource;

        protected override void OnCreate()
        {
            base.OnCreate();

            try { _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>(); } catch (Exception e) { Mod.log.Error($"Failed to load PrefabSystem: {e.Message}"); }
            try { _taxSystem = World.GetOrCreateSystemManaged<TaxSystem>(); } catch (Exception e) { Mod.log.Error($"Failed to load TaxSystem: {e.Message}"); }
            try { _nameSystem = World.GetOrCreateSystemManaged<NameSystem>(); } catch (Exception e) { Mod.log.Error($"Failed to load NameSystem: {e.Message}"); }
            try { _taxingProductionUISystem = World.GetOrCreateSystemManaged<TaxingProductionUISystem>(); } catch (Exception e) { Mod.log.Error($"Failed to load TaxingProductionUISystem: {e.Message}"); }
            try { _citySystem = World.GetOrCreateSystemManaged<CitySystem>(); } catch (Exception e) { Mod.log.Error($"Failed to load CitySystem: {e.Message}"); }
            try
            {
                _signatureSystem = World.GetOrCreateSystemManaged<Game.UI.InGame.SignatureBuildingUISystem>();
            }
            catch (Exception e) { Mod.log.Error($"Failed to load SignatureBuildingUISystem: {e.Message}"); }

            _cityModifierDataLookup = GetBufferLookup<Game.Prefabs.CityModifierData>(true);
            _localModifierDataLookup = GetBufferLookup<Game.Prefabs.LocalModifierData>(true);

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
                None = new ComponentType[]
                {
                    ComponentType.ReadOnly<Game.Companies.StorageCompany>(),
                    ComponentType.ReadOnly<Game.Companies.ExtractorCompany>(),
                }
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

            _extractorQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<Game.Companies.ExtractorCompany>(),
                    ComponentType.ReadOnly<PrefabRef>(),
                    ComponentType.ReadOnly<PropertyRenter>(),
                }
            });

            AddBinding(_companyBrowserData = new ValueBinding<string>("taxProduction", "companyBrowserData", ""));
            try { AddBinding(_companyBrowserSummary = new ValueBinding<string>("taxProduction", "companyBrowserSummary", "{}")); } catch { }
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
            try { AddBinding(new TriggerBinding<string>("taxProduction", "updateCompanyFilters", HandleUpdateCompanyFilters)); } catch { }
            try { AddBinding(new TriggerBinding<string>("taxProduction", "refreshSignatureCache", (s) => { RefreshSignatureCache(); })); } catch { }

            m_Log = new PrefixedLogger(nameof(CompanyBrowserSystem));
            m_Log.Info("CompanyBrowserSystem initialized (direct ECS)");
        }



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
            if (_taxingProductionUISystem == null || !_taxingProductionUISystem.IsPanelOpen || (_taxingProductionUISystem.ActiveViewMode != "company" && _taxingProductionUISystem.ActiveViewMode != "signature"))
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

            m_UpdateTimer += World.Time.DeltaTime;

            // ── Fast-path: filter/sort only, no ECS re-scan ──────────────────────────
            // When the user changes a filter or sort, m_ForceFilterUpdate is set.
            // We skip the expensive CollectCompanyData scan and just re-filter the
            // existing _companyBuffer in the same frame (no timer needed).
            if (m_ForceFilterUpdate && _companyBuffer.Count > 0)
            {
                m_ForceFilterUpdate = false;
                try
                {
                    FilterAndSortCompanies();
                    var truncated = new List<CompanyInfo>(300);
                    for (int i = 0; i < _filteredBuffer.Count && i < 300; i++)
                        truncated.Add(_filteredBuffer[i]);
                    var serialized = SerializeCompanies(truncated);
                    if (serialized != m_LastCompanyBrowserData)
                    {
                        _companyBrowserData.Update(serialized);
                        m_LastCompanyBrowserData = serialized;
                    }
                }
                catch (Exception ex)
                {
                    Mod.log.Warn("CompanyBrowserSystem filter-only update error: " + ex.Message);
                }
                this.Dependency = Dependency;
                return;
            }
            m_ForceFilterUpdate = false; // clear if buffer was empty

            // ── 10-second throttle gate (reduced UI refresh churn and row jumping) ──
            if (m_UpdateTimer < 10.0f && !justOpened)
            {
                this.Dependency = Dependency;
                return;
            }
            m_UpdateTimer = 0f;

            _cityModifierDataLookup.Update(ref CheckedStateRef);
            _localModifierDataLookup.Update(ref CheckedStateRef);

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

                // Compute summary statistics and unique filter dropdown options from the unfiltered lists
                int totalCount = _companyBuffer.Count;
                int healthyCount = 0;
                int strugglingCount = 0;
                int bankruptCount = 0;

                var packs = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var themes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var districts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var resourceKinds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var c in _companyBuffer)
                {
                    if (c.ProfitabilityTier == "Bankrupt" || c.Profit <= -40) bankruptCount++;
                    else if (c.Profit <= 0) strugglingCount++;
                    else healthyCount++;

                    string p = c.AssetPack ?? "Base Game";
                    if (!packs.ContainsKey(p))
                        packs[p] = c.AssetPackIcon ?? "";

                    themes.Add(c.Theme ?? "USA");
                    districts.Add(c.District ?? "City");

                    if (!string.IsNullOrEmpty(c.ResourceKey))
                    {
                        resourceKinds.Add($"{c.ZoneType},{c.ResourceKey},{c.CompanyKind ?? c.ZoneType}");
                    }
                }

                var summaryDto = new CompanySummaryDTO
                {
                    total = totalCount,
                    healthy = healthyCount,
                    struggling = strugglingCount,
                    bankrupt = bankruptCount,
                    packs = new List<PackSummaryDTO>(),
                    themes = new List<string>(themes),
                    districts = new List<string>(districts),
                    resourceKinds = new List<ResourceKindDTO>()
                };

                foreach (var kvp in packs)
                {
                    summaryDto.packs.Add(new PackSummaryDTO { name = kvp.Key, icon = kvp.Value });
                }

                foreach (var rk in resourceKinds)
                {
                    var rkParts = rk.Split(',');
                    if (rkParts.Length >= 3)
                    {
                        summaryDto.resourceKinds.Add(new ResourceKindDTO
                        {
                            zone = rkParts[0],
                            resourceKey = rkParts[1],
                            companyKind = rkParts[2]
                        });
                    }
                }

                string summaryStr = JsonConvert.SerializeObject(summaryDto);
                if (summaryStr != m_LastCompanyBrowserSummary || justOpened)
                {
                    _companyBrowserSummary.Update(summaryStr);
                    m_LastCompanyBrowserSummary = summaryStr;
                }

                // Apply active UI filters and sort the results
                FilterAndSortCompanies();

                // Truncate to maximum of 300 rows before serializing
                var truncatedList = new List<CompanyInfo>(300);
                for (int i = 0; i < _filteredBuffer.Count && i < 300; i++)
                {
                    truncatedList.Add(_filteredBuffer[i]);
                }

                var serialized = SerializeCompanies(truncatedList);
                if (serialized != m_LastCompanyBrowserData || justOpened)
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
                        if (json != m_LastSignatureCompanies || justOpened)
                        {
                            _signatureCompaniesBinding.Update(json);
                            m_LastSignatureCompanies = json;
                        }
                    }
                    // Publish cache status for debug (timestamp + count of signature prefabs)
                    if (_signatureCacheStatusBinding != null)
                    {
                        var statusJson = "{\"timestamp\":\"" + DateTime.UtcNow.ToString("o") + "\",\"count\": 0}";
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

        private void FilterAndSortCompanies()
        {
            _filteredBuffer.Clear();

            // 1. Filtering
            foreach (var c in _companyBuffer)
            {
                // Zone filter
                if (m_FilterZone != "All" && c.ZoneType != m_FilterZone) continue;

                // Resource filter: match GetResourceIconName(c.ResourceKey)
                if (m_FilterResource != "All" && GetResourceIconName(c.ResourceKey) != m_FilterResource) continue;

                // Tier filter
                if (m_FilterTier != "All" && c.ProfitabilityTier != m_FilterTier) continue;

                // Pack filter
                string pack = c.AssetPack ?? "Base Game";
                if (m_FilterPack != "All" && pack.Trim() != m_FilterPack.Trim()) continue;

                // Theme filter
                string theme = c.Theme ?? "USA";
                if (m_FilterTheme != "All" && theme.Trim() != m_FilterTheme.Trim()) continue;

                // District filter
                string district = c.District ?? "City";
                if (m_FilterDistrict != "All" && district.Trim() != m_FilterDistrict.Trim()) continue;

                // Kind filter
                string kind = c.CompanyKind ?? "";
                if (m_FilterKind != "All" && kind.Trim() != m_FilterKind.Trim()) continue;

                // Profit range
                if (c.Profit < m_FilterProfitMin || c.Profit > m_FilterProfitMax) continue;

                // Search text
                if (!string.IsNullOrEmpty(m_FilterSearch))
                {
                    string searchLower = m_FilterSearch.ToLowerInvariant();
                    bool match = (c.Name ?? "").ToLowerInvariant().Contains(searchLower) ||
                                 (c.ResourceKey ?? "").ToLowerInvariant().Contains(searchLower) ||
                                 (c.ZoneType ?? "").ToLowerInvariant().Contains(searchLower);
                    if (!match) continue;
                }

                _filteredBuffer.Add(c);
            }

            // 2. Sorting
            int dir = m_SortDir == "asc" ? 1 : -1;
            _filteredBuffer.Sort((a, b) =>
            {
                switch (m_SortField)
                {
                    case "name":
                        return dir * string.Compare(a.Name ?? "", b.Name ?? "", StringComparison.OrdinalIgnoreCase);
                    case "zoneType":
                        return dir * string.Compare(a.ZoneType ?? "", b.ZoneType ?? "", StringComparison.OrdinalIgnoreCase);
                    case "resourceKey":
                        return dir * string.Compare(a.ResourceKey ?? "", b.ResourceKey ?? "", StringComparison.OrdinalIgnoreCase);
                    case "profit":
                        return dir * a.Profit.CompareTo(b.Profit);
                    case "tax":
                        return dir * a.TaxRate.CompareTo(b.TaxRate);
                    case "efficiency":
                        return dir * a.Efficiency.CompareTo(b.Efficiency);
                    case "profitabilityTier":
                        return dir * string.Compare(a.ProfitabilityTier ?? "", b.ProfitabilityTier ?? "", StringComparison.OrdinalIgnoreCase);
                    case "lv":
                        return dir * a.BuildingLevel.CompareTo(b.BuildingLevel);
                    default:
                        return dir * a.Profit.CompareTo(b.Profit);
                }
            });
        }

        private static string GetResourceIconName(string key)
        {
            if (string.IsNullOrEmpty(key)) return "";
            string cleanKey = key.StartsWith("c_") ? key.Substring(2) : key;
            
            switch (cleanKey.ToLowerInvariant())
            {
                case "grain": return "Grain";
                case "vegetables": return "Vegetables";
                case "cotton": return "Cotton";
                case "livestock": return "Livestock";
                case "fish": return "Fish";
                case "wood": return "Wood";
                case "ore": return "Ore";
                case "stone": return "Stone";
                case "coal": return "Coal";
                case "oil": return "Oil";
                case "food": return "Food";
                case "beverages": return "Beverages";
                case "conveniencefood": return "ConvenienceFood";
                case "textiles": return "Textiles";
                case "timber": return "Timber";
                case "paper": return "Paper";
                case "furniture": return "Furniture";
                case "metals": return "Metals";
                case "steel": return "Steel";
                case "minerals": return "Minerals";
                case "concrete": return "Concrete";
                case "machinery": return "Machinery";
                case "electronics": return "Electronics";
                case "vehicles": return "Vehicles";
                case "petrochemicals": return "Petrochemicals";
                case "plastics": return "Plastics";
                case "chemicals": return "Chemicals";
                case "pharmaceuticals": return "Pharmaceuticals";
                case "software": return "Software";
                case "telecom": return "Telecom";
                case "financial": return "Financial";
                case "media": return "Media";
                case "lodging": return "Lodging";
                case "meals": return "Meals";
                case "entertainment": return "Entertainment";
                case "recreation": return "Recreation";
                default:
                    if (cleanKey.Length > 0)
                        return char.ToUpperInvariant(cleanKey[0]) + cleanKey.Substring(1);
                    return cleanKey;
            }
        }

        private void HandleUpdateCompanyFilters(string payload)
        {
            if (string.IsNullOrEmpty(payload)) return;
            try
            {
                string[] parts = payload.Split('|');
                if (parts.Length >= 12)
                {
                    m_FilterZone = parts[0];
                    m_FilterResource = parts[1];
                    m_FilterTier = parts[2];
                    m_FilterPack = parts[3];
                    m_FilterTheme = parts[4];
                    m_FilterDistrict = parts[5];
                    m_FilterKind = parts[6];
                    m_FilterProfitMin = int.TryParse(parts[7], out var pMin) ? pMin : -100;
                    m_FilterProfitMax = int.TryParse(parts[8], out var pMax) ? pMax : 100;
                    m_FilterSearch = parts[9] ?? "";
                    m_SortField = parts[10];
                    m_SortDir = parts[11];

                    // Flag for fast re-sort of existing buffer — no ECS re-scan needed
                    m_ForceFilterUpdate = true;
                }
            }
            catch (Exception ex)
            {
                Mod.log.Warn("HandleUpdateCompanyFilters error: " + ex.Message);
            }
        }

        private struct CompanyInfo
        {
            public Entity Entity;
            public Entity BuildingEntity;
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
            public string ThemeIcon;
            public string AssetPack;
            public string AssetPackIcon;
            public int StorageAmount;
            public int StorageCapacity;
            public string CompanyKind;
            public string IconUrl;
            public string NativePackIcon;
            public string AllowedResources;
            public string CityEffects;
            public string LocalEffects;
            public int Attractiveness;
        }

        private void CollectCompanyData(List<CompanyInfo> result)
        {
            // Reuse pre-allocated buffers — zero heap allocations per update cycle
            result.Clear();
            _resourceProfitSums.Clear();

            CollectFromQuery(_industrialQuery, "Industrial", result, _resourceProfitSums);
            CollectFromQuery(_commercialQuery, "Commercial", result, _resourceProfitSums);
            CollectFromQuery(_storageQuery, "Storage", result, _resourceProfitSums);
            CollectFromQuery(_extractorQuery, "RawIndustrial", result, _resourceProfitSums);

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
            if (query.IsEmptyIgnoreFilter)
            {
                return;
            }

            var entities = query.ToEntityArray(Allocator.Temp);
            try
            {
                var em = EntityManager;
                int initialCount = result.Count;
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
                    IconUrl = "",
                    AllowedResources = "",
                };

                // --- Brand name via NameSystem (cached to avoid repeated expensive label resolution) ---
                if (_nameSystem != null && em.HasComponent<CompanyData>(entity))
                {
                    try
                    {
                        var companyData = em.GetComponentData<CompanyData>(entity);
                        Entity brandEntity = companyData.m_Brand;
                        if (!_nameCache.TryGetValue(brandEntity, out string cachedBrand))
                        {
                            cachedBrand = _nameSystem.GetRenderedLabelName(brandEntity);
                            _nameCache[brandEntity] = cachedBrand;
                        }
                        info.BrandName = cachedBrand;
                    }
                    catch { }
                }

                // --- Building address via NameSystem on the building entity (cached) ---
                if (_nameSystem != null && em.HasComponent<PropertyRenter>(entity))
                {
                    try
                    {
                        var renter = em.GetComponentData<PropertyRenter>(entity);
                        if (em.Exists(renter.m_Property))
                        {
                            Entity propEntity = renter.m_Property;
                            if (!_nameCache.TryGetValue(propEntity, out string cachedAddr))
                            {
                                cachedAddr = _nameSystem.GetRenderedLabelName(propEntity);
                                _nameCache[propEntity] = cachedAddr;
                            }
                            info.BuildingAddress = cachedAddr;
                        }
                    }
                    catch { }
                }

                // --- Prefab name and resource ---
                if (em.HasComponent<PrefabRef>(entity))
                {
                    var prefabRef = em.GetComponentData<PrefabRef>(entity);
                    Entity prefab = prefabRef.m_Prefab;

                    if (_companyPrefabCache.TryGetValue(prefab, out var cachedComp))
                    {
                        info.Name = cachedComp.Name;
                        info.ResourceEnum = cachedComp.ResourceEnum;
                        info.ResourceKey = cachedComp.ResourceKey;
                        info.InputResource1 = cachedComp.InputResource1;
                        info.InputResource2 = cachedComp.InputResource2;
                        info.CompanyKind = cachedComp.CompanyKind;
                        if (!string.IsNullOrEmpty(cachedComp.ZoneTypeOverride))
                            info.ZoneType = cachedComp.ZoneTypeOverride;
                    }
                    else
                    {
                        var newCached = new CompanyPrefabMetadata();
                        newCached.Name = "Company #" + entity.Index;

                        if (_prefabSystem != null)
                        {
                            try { newCached.Name = _prefabSystem.GetPrefabName(prefab); } catch { }
                        }

                        if (em.HasComponent<IndustrialProcessData>(prefab))
                        {
                            var processData = em.GetComponentData<IndustrialProcessData>(prefab);
                            Resource outputRes = processData.m_Output.m_Resource;
                            newCached.ResourceKey = GetResourceKey(outputRes);
                            newCached.ResourceEnum = outputRes;

                            if (processData.m_Input1.m_Resource != Resource.NoResource)
                                newCached.InputResource1 = GetResourceKey(processData.m_Input1.m_Resource);
                            if (processData.m_Input2.m_Resource != Resource.NoResource)
                                newCached.InputResource2 = GetResourceKey(processData.m_Input2.m_Resource);

                            if (defaultZone == "Industrial" || defaultZone == "RawIndustrial")
                            {
                                if (outputRes == Resource.Software || outputRes == Resource.Telecom ||
                                    outputRes == Resource.Financial || outputRes == Resource.Media)
                                {
                                    newCached.ZoneTypeOverride = "Office";
                                }
                                else if (IsRawResource(outputRes))
                                {
                                    newCached.ZoneTypeOverride = "RawIndustrial";
                                }
                            }
                        }
                        else if (em.HasComponent<Game.Prefabs.StorageCompanyData>(prefab))
                        {
                            var storageCompany = em.GetComponentData<Game.Prefabs.StorageCompanyData>(prefab);
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

                            newCached.ResourceKey = GetResourceKey(storedRes);
                            newCached.ResourceEnum = storedRes;
                            newCached.CompanyKind = "Storage";
                        }

                        _companyPrefabCache[prefab] = newCached;

                        info.Name = newCached.Name;
                        info.ResourceEnum = newCached.ResourceEnum;
                        info.ResourceKey = newCached.ResourceKey;
                        info.InputResource1 = newCached.InputResource1;
                        info.InputResource2 = newCached.InputResource2;
                        info.CompanyKind = newCached.CompanyKind;
                        if (!string.IsNullOrEmpty(newCached.ZoneTypeOverride))
                            info.ZoneType = newCached.ZoneTypeOverride;
                    }

                    if (em.HasComponent<CommercialCompany>(entity) && !string.IsNullOrEmpty(info.ResourceKey))
                    {
                        switch (info.ResourceEnum)
                        {
                            case Resource.Food: case Resource.Beverages: case Resource.ConvenienceFood:
                            case Resource.Textiles: case Resource.Timber: case Resource.Paper:
                            case Resource.Furniture: case Resource.Metals: case Resource.Steel:
                            case Resource.Minerals: case Resource.Concrete: case Resource.Machinery:
                            case Resource.Electronics: case Resource.Vehicles:
                            case Resource.Petrochemicals: case Resource.Plastics:
                            case Resource.Chemicals: case Resource.Pharmaceuticals:
                                if (!info.ResourceKey.StartsWith("c_"))
                                    info.ResourceKey = "c_" + info.ResourceKey;
                                break;
                        }
                    }
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

                // --- Profitability ---
                if (em.HasComponent<Profitability>(entity))
                {
                    var prof = em.GetComponentData<Profitability>(entity);
                    info.Profit = (int)Math.Round(((prof.m_Profitability - 127f) / 127.5f) * 100f);
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
                    info.BuildingEntity = buildingEntity;
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

                // --- Current employee count ---
                if (em.HasBuffer<Employee>(entity))
                {
                    var employees = em.GetBuffer<Employee>(entity);
                    info.CurrentWorkers = employees.Length;
                }

                // --- Building data ---
                if (em.HasComponent<PropertyRenter>(entity))
                {
                    var renter = em.GetComponentData<PropertyRenter>(entity);
                    Entity bldg = renter.m_Property;

                    if (em.Exists(bldg) && em.HasComponent<PrefabRef>(bldg))
                    {
                        var bldgPrefRef = em.GetComponentData<PrefabRef>(bldg);
                        Entity bldgPrefab = bldgPrefRef.m_Prefab;

                        if (_buildingPrefabCache.TryGetValue(bldgPrefab, out var cachedBldg))
                        {
                            info.BuildingLevel = cachedBldg.Level;
                            info.IsSignature = cachedBldg.IsSignature;
                            info.Theme = cachedBldg.Theme;
                            info.AssetPack = cachedBldg.AssetPack;
                            info.AssetPackIcon = cachedBldg.AssetPackIcon;
                            info.IconUrl = cachedBldg.IconUrl;
                            info.NativePackIcon = cachedBldg.NativePackIcon;
                        }
                        else
                        {
                            var newBldg = new BuildingPrefabMetadata
                            {
                                Level = 1,
                                IsSignature = false,
                                Theme = "USA",
                                AssetPack = "Base Game",
                                AssetPackIcon = "",
                                IconUrl = "",
                                NativePackIcon = ""
                            };

                            if (em.HasComponent<SpawnableBuildingData>(bldgPrefab))
                            {
                                var sbd = em.GetComponentData<SpawnableBuildingData>(bldgPrefab);
                                newBldg.Level = sbd.m_Level;
                            }

                            bool isSig = em.HasComponent<Game.Prefabs.SignatureBuildingData>(bldgPrefab) || em.HasComponent<Game.Prefabs.UniqueObjectData>(bldgPrefab);
                            if (!isSig)
                            {
                                try
                                {
                                    if (_prefabSystem != null)
                                    {
                                        var pb = _prefabSystem.GetPrefab<PrefabBase>(bldgPrefab);
                                        if (pb != null)
                                        {
                                            string pn = (pb.name ?? "").ToLowerInvariant();
                                            if (pn.Contains("signature") || pn.Contains("landmark") || pn.Contains("monument") || pn.Contains("unique"))
                                            {
                                                isSig = true;
                                            }
                                        }
                                    }
                                }
                                catch {}
                            }
                            if (isSig)
                            {
                                newBldg.IsSignature = true;
                            }

                            if (em.HasComponent<Game.Prefabs.UIObjectData>(bldgPrefab))
                            {
                                try
                                {
                                    if (_prefabSystem != null)
                                    {
                                        var pb = _prefabSystem.GetPrefab<PrefabBase>(bldgPrefab);
                                        if (pb != null && pb.TryGet<UIObject>(out var uiObj))
                                        {
                                            newBldg.IconUrl = uiObj.m_Icon ?? "";
                                        }
                                    }
                                }
                                catch { }
                            }

                            try
                            {
                                if (_prefabSystem != null)
                                {
                                    var pb = _prefabSystem.GetPrefab<PrefabBase>(bldgPrefab);
                                    if (pb != null)
                                    {
                                        var assetInfo = PackHelper.GetPrefabAssetInfo(pb);
                                        newBldg.Theme = assetInfo.Theme;
                                        newBldg.ThemeIcon = assetInfo.ThemeIcon;
                                        newBldg.AssetPack = assetInfo.AssetPack;
                                        newBldg.AssetPackIcon = assetInfo.PackThumbnails != null ? string.Join(",", assetInfo.PackThumbnails) : "";
                                        newBldg.NativePackIcon = assetInfo.NativePackIcon;
                                    }
                                }
                            }
                            catch { }



                            try
                            {
                                List<string> cEffects = new List<string>();
                                List<string> lEffects = new List<string>();
                                if (_cityModifierDataLookup.HasBuffer(bldgPrefab))
                                {
                                    foreach (var c in _cityModifierDataLookup[bldgPrefab])
                                    {
                                        string sMode = c.m_Mode == Game.Prefabs.ModifierValueMode.Relative ? "%" : "";
                                        cEffects.Add($"{c.m_Type} | {c.m_Range.min}{sMode} to {c.m_Range.max}{sMode}");
                                    }
                                }
                                if (_localModifierDataLookup.HasBuffer(bldgPrefab))
                                {
                                    foreach (var l in _localModifierDataLookup[bldgPrefab])
                                    {
                                        string sMode = l.m_Mode == Game.Prefabs.ModifierValueMode.Relative ? "%" : "";
                                        lEffects.Add($"{l.m_Type} | Delta: {l.m_Delta.min}{sMode} to {l.m_Delta.max}{sMode} | Reach: {l.m_Radius.max}");
                                    }
                                }
                                newBldg.CityEffects = string.Join("^", cEffects);
                                newBldg.LocalEffects = string.Join("^", lEffects);
                            }
                            catch { }

                            _buildingPrefabCache[bldgPrefab] = newBldg;

                            info.BuildingLevel = newBldg.Level;
                            info.IsSignature = newBldg.IsSignature;
                            info.Theme = newBldg.Theme;
                            info.ThemeIcon = newBldg.ThemeIcon;
                            info.AssetPack = newBldg.AssetPack;
                            info.AssetPackIcon = newBldg.AssetPackIcon;
                            info.IconUrl = newBldg.IconUrl;
                            info.NativePackIcon = newBldg.NativePackIcon;
                            info.CityEffects = newBldg.CityEffects;
                            info.LocalEffects = newBldg.LocalEffects;
                        }
                    }

                    if (!info.IsSignature && em.Exists(bldg))
                    {
                        if (em.HasComponent<Game.Buildings.Signature>(bldg) || em.HasComponent<Game.Objects.UniqueObject>(bldg))
                        {
                            info.IsSignature = true;
                        }
                    }

                    // Efficiency factors
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
                                if (eff == 0f) continue;

                                combined *= eff;
                                int percentageChange = (int)Math.Round(100f * eff) - 100;
                                if (percentageChange != 0)
                                {
                                    try
                                    {
                                        string fname = effBuf[e].m_Factor.ToString();
                                        int effCumulative = Math.Max(1, (int)Math.Round(combined * 100f));
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

                // --- Environmental/Service metrics & happiness ---
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

                    float elecConsumption = 0f;
                    float waterConsumption = 0f;
                    float garbageAccum = 0f;
                    float mailAccum = 0f;
                    float crimeProb = 0f;

                    if (prop != Entity.Null && em.Exists(prop))
                    {
                        if (em.HasComponent<ElectricityConsumer>(prop))
                            elecConsumption = em.GetComponentData<ElectricityConsumer>(prop).m_WantedConsumption;
                        if (em.HasComponent<WaterConsumer>(prop))
                            waterConsumption = em.GetComponentData<WaterConsumer>(prop).m_WantedConsumption;
                        if (em.HasComponent<GarbageProducer>(prop))
                            garbageAccum = em.GetComponentData<GarbageProducer>(prop).m_Garbage;
                        if (em.HasComponent<MailProducer>(prop))
                        {
                            var mail = em.GetComponentData<MailProducer>(prop);
                            mailAccum = (float)(mail.m_SendingMail + mail.m_ReceivingMail);
                        }
                        if (em.HasComponent<CrimeProducer>(prop))
                            crimeProb = em.GetComponentData<CrimeProducer>(prop).m_Crime;
                    }

                    info.ElectricityConsumption = elecConsumption;
                    info.WaterConsumption = waterConsumption;
                    info.GarbageAccumulation = garbageAccum;
                    info.MailAccumulation = mailAccum;
                    info.CrimeProbability = crimeProb;

                    var eff = Math.Max(0, info.Efficiency);
                    var profit = Math.Max(-100, Math.Min(100, info.Profit));
                    var staffPct = info.MaxWorkers > 0 ? (info.CurrentWorkers * 100f / info.MaxWorkers) : 100f;
                    var tax = info.TaxRate;
                    info.District = "City";
                    try
                    {
                        if (prop != Entity.Null && em.Exists(prop) && em.HasComponent<Game.Areas.CurrentDistrict>(prop))
                        {
                            var districtEntity = em.GetComponentData<Game.Areas.CurrentDistrict>(prop).m_District;
                            if (districtEntity != Entity.Null && _nameSystem != null)
                            {
                                string resolvedName = _nameSystem.GetRenderedLabelName(districtEntity);
                                if (!string.IsNullOrEmpty(resolvedName))
                                    info.District = resolvedName;
                            }
                        }
                    }
                    catch { }

                    // --- Resource Storage ---
                    // m_Amount in Game.Economy.Resources is stored in kg.
                    // Proved by game panel: Coal 0.231t = 231 units, Metals 5.221t = 5221 units, etc.
                    // Simply sum physical resource amounts (exclude Money, Software, etc.) and divide by 1000.
                    int totalStorageKg = 0;
                    int rawUnitSum = 0;
                    if (em.HasBuffer<Game.Economy.Resources>(entity))
                    {
                        var resBuffer = em.GetBuffer<Game.Economy.Resources>(entity);
                        for (int r = 0; r < resBuffer.Length; r++)
                        {
                            var res = resBuffer[r].m_Resource;
                            if (IsPhysicalResource(res))
                            {
                                int amt = resBuffer[r].m_Amount;
                                if (amt > 0)
                                {
                                    rawUnitSum += amt;
                                    totalStorageKg += amt; // already in kg
                                }
                            }
                        }
                    }
                    info.StorageAmount = (int)Math.Round(totalStorageKg / 1000f);
                    if (info.StorageAmount == 0 && rawUnitSum > 0) info.StorageAmount = 1; // Floor at 1t if physical goods exist

                    int storageCapacity = 0;
                    if (prop != Entity.Null && em.Exists(prop) && em.HasComponent<PrefabRef>(prop))
                    {
                        Entity propPrefab = em.GetComponentData<PrefabRef>(prop).m_Prefab;

                        if (em.HasComponent<Game.Companies.StorageLimitData>(propPrefab) &&
                            em.HasComponent<Game.Prefabs.SpawnableBuildingData>(propPrefab) &&
                            em.HasComponent<Game.Prefabs.BuildingData>(propPrefab))
                        {
                            var limitData = em.GetComponentData<Game.Companies.StorageLimitData>(propPrefab);
                            var spawnable = em.GetComponentData<Game.Prefabs.SpawnableBuildingData>(propPrefab);
                            var buildingData = em.GetComponentData<Game.Prefabs.BuildingData>(propPrefab);

                            // StorageLimitData is natively in kilograms. Convert to Tons.
                            int limitKg = limitData.GetAdjustedLimitForWarehouse(spawnable, buildingData);
                            storageCapacity = (int)Math.Round(limitKg / 1000f);
                        }
                    }
                    info.StorageCapacity = storageCapacity;

                    string allowedResources = "";
                    if (prop != Entity.Null && em.Exists(prop))
                    {
                        if (em.HasComponent<Game.Buildings.CommercialProperty>(prop))
                        {
                            allowedResources = em.GetComponentData<Game.Buildings.CommercialProperty>(prop).m_Resources.ToString();
                        }
                        else if (em.HasComponent<Game.Buildings.IndustrialProperty>(prop))
                        {
                            allowedResources = em.GetComponentData<Game.Buildings.IndustrialProperty>(prop).m_Resources.ToString();
                        }
                    }
                    info.AllowedResources = allowedResources;


                    if (string.IsNullOrEmpty(info.CompanyKind))
                    {
                        if (info.ZoneType == "RawIndustrial") info.CompanyKind = "Extraction";
                        else info.CompanyKind = info.ZoneType;
                    }

                    // --- Attractiveness ---
                    int attractiveness = 0;
                    if (prop != Entity.Null && em.Exists(prop) && em.HasComponent<PrefabRef>(prop))
                    {
                        Entity propPrefab = em.GetComponentData<PrefabRef>(prop).m_Prefab;
                        if (em.HasComponent<Game.Prefabs.AttractionData>(propPrefab))
                        {
                            if (Game.Prefabs.UpgradeUtils.TryGetCombinedComponent<Game.Prefabs.AttractionData>(em, prop, propPrefab, out var attrData))
                                attractiveness = attrData.m_Attractiveness;
                        }
                        if (em.HasComponent<Game.Buildings.AttractivenessProvider>(prop))
                        {
                            var attrProv = em.GetComponentData<Game.Buildings.AttractivenessProvider>(prop);
                            if (attrProv.m_Attractiveness > attractiveness) attractiveness = attrProv.m_Attractiveness;
                        }
                    }
                    info.Attractiveness = attractiveness;
                }
                catch { }

                return info;
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"ReadCompanyInfo exception on entity {entity.Index}:{entity.Version} - {ex.GetType().Name}: {ex.Message}\n{ex.StackTrace}");
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

            if (_citySystem == null)
            {
                try { _citySystem = World.GetOrCreateSystemManaged<CitySystem>(); } catch { }
            }

            try
            {
                // Re-acquire signature system if it wasn't available at OnCreate
                if (_signatureSystem == null)
                {
                    try { _signatureSystem = World.GetOrCreateSystemManaged<Game.UI.InGame.SignatureBuildingUISystem>(); } catch { _signatureSystem = null; }
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

                // Extract authoritative numeric values directly from available ECS components
                double elecConsumption = double.NaN, waterConsumption = double.NaN, garbageAccum = double.NaN, mailAccum = double.NaN, crimeProb = double.NaN;
                double mailSending = 0, mailReceiving = 0;

                if (property != Entity.Null && em.Exists(property))
                {
                    if (em.HasComponent<ElectricityConsumer>(property))
                        elecConsumption = em.GetComponentData<ElectricityConsumer>(property).m_WantedConsumption;
                    if (em.HasComponent<WaterConsumer>(property))
                        waterConsumption = em.GetComponentData<WaterConsumer>(property).m_WantedConsumption;
                    if (em.HasComponent<GarbageProducer>(property))
                        garbageAccum = em.GetComponentData<GarbageProducer>(property).m_Garbage;
                    if (em.HasComponent<MailProducer>(property))
                    {
                        var mail = em.GetComponentData<MailProducer>(property);
                        mailSending = mail.m_SendingMail;
                        mailReceiving = mail.m_ReceivingMail;
                        mailAccum = mail.m_SendingMail + mail.m_ReceivingMail;
                    }
                    if (em.HasComponent<CrimeProducer>(property))
                        crimeProb = em.GetComponentData<CrimeProducer>(property).m_Crime;
                }

                // Fall back to building prefab for static consumer values if missing on property instance
                if (double.IsNaN(elecConsumption) || double.IsNaN(waterConsumption) || double.IsNaN(garbageAccum))
                {
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
                                if (double.IsNaN(elecConsumption) && em.HasComponent<ElectricityConsumer>(bPrefab))
                                    elecConsumption = em.GetComponentData<ElectricityConsumer>(bPrefab).m_WantedConsumption;
                                if (double.IsNaN(waterConsumption) && em.HasComponent<WaterConsumer>(bPrefab))
                                    waterConsumption = em.GetComponentData<WaterConsumer>(bPrefab).m_WantedConsumption;
                                if (double.IsNaN(garbageAccum) && em.HasComponent<GarbageProducer>(bPrefab))
                                    garbageAccum = em.GetComponentData<GarbageProducer>(bPrefab).m_Garbage;
                            }
                        }
                    }
                    catch { }
                }

                // Calculate building condition and max condition via GetLevelingCost
                float buildingConditionVal = 0f;
                float maxConditionVal = 0f;
                if (property != Entity.Null && em.Exists(property))
                {
                    if (em.HasComponent<BuildingCondition>(property))
                    {
                        var cond = em.GetComponentData<BuildingCondition>(property);
                        buildingConditionVal = cond.m_Condition;

                        try
                        {
                            if (em.HasComponent<PrefabRef>(property))
                            {
                                var bRef = em.GetComponentData<PrefabRef>(property);
                                Entity bPrefab = bRef.m_Prefab;
                                if (em.HasComponent<SpawnableBuildingData>(bPrefab) && em.HasComponent<BuildingPropertyData>(bPrefab))
                                {
                                    var sData = em.GetComponentData<SpawnableBuildingData>(bPrefab);
                                    var pData = em.GetComponentData<BuildingPropertyData>(bPrefab);
                                    if (em.HasComponent<ZoneData>(sData.m_ZonePrefab))
                                    {
                                        var zData = em.GetComponentData<ZoneData>(sData.m_ZonePrefab);
                                        Entity cityEntity = _citySystem != null ? _citySystem.City : Entity.Null;
                                        if (cityEntity != Entity.Null && em.HasBuffer<Game.City.CityModifier>(cityEntity))
                                        {
                                            var cityEffects = em.GetBuffer<Game.City.CityModifier>(cityEntity, true);
                                            maxConditionVal = BuildingUtils.GetLevelingCost(zData.m_AreaType, pData, sData.m_Level, cityEffects);
                                        }
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            Mod.log.Warn("Error calculating building maxCondition via GetLevelingCost: " + ex.Message);
                        }
                    }
                }
                factorMap["buildingCondition"] = buildingConditionVal;
                factorMap["maxCondition"] = maxConditionVal;

                // crime and garbage are negative contributors
                factorMap["crime"] = producesCrime ? -30f : 0f;
                factorMap["garbage"] = producesGarbage ? -15f : 0f;
                factorMap["mail"] = producesMail ? 5f : 0f;

                if (!double.IsNaN(elecConsumption)) factorMap["electricityConsumption"] = (float)elecConsumption;
                if (!double.IsNaN(waterConsumption)) factorMap["waterConsumption"] = (float)waterConsumption;
                if (!double.IsNaN(garbageAccum)) factorMap["garbageAccumulation"] = (float)garbageAccum;
                if (!double.IsNaN(mailAccum)) factorMap["mailAccumulation"] = (float)mailAccum;
                if (!double.IsNaN(crimeProb)) factorMap["crimeProbability"] = (float)crimeProb;
                factorMap["mailSending"] = (float)mailSending;
                factorMap["mailReceiving"] = (float)mailReceiving;

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
                var happinessDto = new CompanyHappinessDTO
                {
                    entityKey = key,
                    factors = new Dictionary<string, float>(factorMap)
                };
                var payload = JsonConvert.SerializeObject(happinessDto);

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
            if (companies.Count == 0) return "[]";

            var dtoList = new List<CompanyDTO>(companies.Count);
            foreach (var c in companies)
            {
                dtoList.Add(new CompanyDTO
                {
                    entityKey = c.Entity.Index + "," + c.Entity.Version,
                    name = c.Name ?? "Unknown",
                    zoneType = c.ZoneType,
                    resourceKey = c.ResourceKey ?? "",
                    profit = c.Profit,
                    tier = c.ProfitabilityTier,
                    workers = c.CurrentWorkers,
                    maxWorkers = c.MaxWorkers,
                    px = (int)c.Position.x,
                    py = (int)c.Position.y,
                    pz = (int)c.Position.z,
                    eff = c.Efficiency,
                    in1 = c.InputResource1 ?? "",
                    in2 = c.InputResource2 ?? "",
                    taxR = c.TaxRate,
                    bLevel = c.BuildingLevel,
                    effDetails = c.EfficiencyDetails ?? "",
                    brandName = c.BrandName ?? "",
                    bldgAddr = c.BuildingAddress ?? "",
                    g = c.ProducesGarbage ? 1 : 0,
                    c = c.ProducesCrime ? 1 : 0,
                    m = c.ProducesMail ? 1 : 0,
                    e = c.NeedsElectricity ? 1 : 0,
                    w = c.NeedsWater ? 1 : 0,
                    eCons = c.ElectricityConsumption,
                    wCons = c.WaterConsumption,
                    gAccum = c.GarbageAccumulation,
                    mAccum = c.MailAccumulation,
                    cProb = c.CrimeProbability,
                    district = c.District ?? "City",
                    theme = c.Theme ?? "USA",
                    pack = c.AssetPack ?? "Base Game",
                    packIcon = c.AssetPackIcon ?? "",
                    kind = c.CompanyKind ?? "",
                    isSignature = c.IsSignature ? 1 : 0,
                    bldgKey = c.BuildingEntity.Index + "," + c.BuildingEntity.Version,
                    iconUrl = c.IconUrl ?? "",
                    nativePackIcon = c.NativePackIcon ?? "",
                    themeIcon = c.ThemeIcon ?? "",
                    storageAmount = c.StorageAmount,
                    storageCapacity = c.StorageCapacity,
                    allowedResources = c.AllowedResources ?? "",
                    cityEffects = c.CityEffects ?? "",
                    localEffects = c.LocalEffects ?? "",
                    attractiveness = c.Attractiveness
                });
            }

            return JsonConvert.SerializeObject(dtoList);
        }

        private void RefreshSignatureCache() { }

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

        private static bool IsPhysicalResource(Resource resource)
        {
            switch (resource)
            {
                case Resource.Money:
                case Resource.Software:
                case Resource.Telecom:
                case Resource.Financial:
                case Resource.Media:
                case Resource.Entertainment:
                case Resource.Recreation:
                case Resource.Lodging:
                case Resource.Meals:
                case Resource.NoResource:
                    return false;
                default:
                    return true;
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

