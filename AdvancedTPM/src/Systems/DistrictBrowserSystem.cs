using Colossal.UI.Binding;
using Game.Areas;
using Game.City;
using Game.Common;
using Game.Policies;
using Game.Prefabs;
using Game.Simulation;
using Game.UI;
using Game.UI.InGame;
using System;
using System.Collections.Generic;
using Unity.Collections;
using Unity.Entities;
using Game.Tools;
using Game.Buildings;
using Game.Companies;

namespace AdvancedTPM
{
    public partial class DistrictBrowserSystem : UISystemBase
    {
        private ValueBinding<string> _districtBrowserData;
        private ValueBinding<string> _districtPoliciesData;

        private EntityQuery _districtQuery;
        private EntityQuery _cityQuery;
        private EntityQuery _policyPrefabQuery;
        private EntityQuery _buildingQuery;

        private NameSystem _nameSystem;
        private PrefabSystem _prefabSystem;
        private PoliciesUISystem _policiesUISystem;
        private CitySystem _citySystem;
        private ImageSystem _imageSystem;

        private int _updateCounter;

        protected override void OnCreate()
        {
            base.OnCreate();

            _nameSystem = World.GetOrCreateSystemManaged<NameSystem>();
            _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
            _policiesUISystem = World.GetOrCreateSystemManaged<PoliciesUISystem>();
            _citySystem = World.GetOrCreateSystemManaged<CitySystem>();
            _imageSystem = World.GetOrCreateSystemManaged<ImageSystem>();

            _districtQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<Game.Areas.District>(),
                    ComponentType.ReadOnly<PrefabRef>()
                },
                None = new ComponentType[]
                {
                    ComponentType.ReadOnly<Deleted>(),
                    ComponentType.ReadOnly<Temp>()
                }
            });

            _buildingQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<Game.Buildings.Building>(),
                    ComponentType.ReadOnly<PrefabRef>()
                },
                Any = new ComponentType[]
                {
                    ComponentType.ReadOnly<Game.Areas.CurrentDistrict>()
                }
            });

            _cityQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<Game.City.City>(),
                }
            });

            _policyPrefabQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<PolicyData>(),
                    ComponentType.ReadOnly<PrefabData>()
                },
                Any = new ComponentType[]
                {
                    ComponentType.ReadOnly<DistrictOptionData>(),
                    ComponentType.ReadOnly<DistrictModifierData>()
                }
            });

            AddBinding(_districtBrowserData = new ValueBinding<string>("taxProduction", "districtBrowserData", "[]"));
            AddBinding(_districtPoliciesData = new ValueBinding<string>("taxProduction", "districtPoliciesData", "[]"));

            AddBinding(new TriggerBinding<string, string, bool>("taxProduction", "toggleDistrictPolicy", ToggleDistrictPolicy));
            AddBinding(new TriggerBinding<string, string>("taxProduction", "renameDistrict", RenameDistrict));

            Mod.log.Info("DistrictBrowserSystem initialized");
        }

        private void ToggleDistrictPolicy(string districtKey, string policyPrefabKey, bool active)
        {
            try
            {
                var districtEntity = ParseEntityKey(districtKey);
                var policyEntity = ParseEntityKey(policyPrefabKey);
                
                if (districtEntity != Entity.Null && policyEntity != Entity.Null && _policiesUISystem != null)
                {
                    _policiesUISystem.SetPolicy(districtEntity, policyEntity, active);
                    Mod.log.Info($"Set policy {policyPrefabKey} to {active} for district {districtKey}");
                    
                    // Force a quick update so UI reflects immediately
                    UpdateDistrictData();
                }
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"Error toggling policy: {ex.Message}");
            }
        }

        private void RenameDistrict(string districtKey, string newName)
        {
            try
            {
                var districtEntity = ParseEntityKey(districtKey);
                if (districtEntity != Entity.Null && _nameSystem != null)
                {
                    _nameSystem.SetCustomName(districtEntity, newName);
                    Mod.log.Info($"Renamed district {districtKey} to {newName}");
                    
                    UpdateDistrictData();
                }
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"Error renaming district: {ex.Message}");
            }
        }

        private Entity ParseEntityKey(string key)
        {
            if (string.IsNullOrEmpty(key)) return Entity.Null;
            var parts = key.Split(',');
            if (parts.Length == 2 && int.TryParse(parts[0], out int index) && int.TryParse(parts[1], out int version))
            {
                return new Entity { Index = index, Version = version };
            }
            return Entity.Null;
        }

        protected override void OnUpdate()
        {
            base.OnUpdate();

            _updateCounter++;
            if (_updateCounter < 240) return; // ~4 seconds
            _updateCounter = 0;

            try
            {
                UpdatePolicyPrefabs();
                UpdateDistrictData();
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"DistrictBrowserSystem Update error: {ex.Message}");
            }
        }

        private void UpdatePolicyPrefabs()
        {
            if (_policyPrefabQuery.IsEmptyIgnoreFilter) return;

            var entities = _policyPrefabQuery.ToEntityArray(Allocator.Temp);
            var items = new List<string>();

            try
            {
                for (int i = 0; i < entities.Length; i++)
                {
                    var entity = entities[i];
                    if (_prefabSystem.TryGetPrefab<PolicyPrefab>(entity, out var prefab))
                    {
                        var key = $"{entity.Index},{entity.Version}";
                        var name = EscapeJson(prefab.name);
                        var icon = "";
                        try
                        {
                            icon = ImageSystem.GetThumbnail(prefab) ?? "";
                            if (string.IsNullOrEmpty(icon)) icon = ImageSystem.GetIcon(prefab) ?? "";
                        }
                        catch { }

                        if (string.IsNullOrEmpty(icon) && prefab.Has<UIObject>())
                        {
                            var ui = prefab.GetComponent<UIObject>();
                            if (ui != null && !string.IsNullOrEmpty(ui.m_Icon)) icon = ui.m_Icon;
                        }
                        
                        icon = EscapeJson(icon);
                        
                        items.Add($"{{\"entityKey\":\"{key}\",\"name\":\"{name}\",\"icon\":\"{icon}\"}}");
                    }
                }
            }
            finally
            {
                entities.Dispose();
            }

            _districtPoliciesData.Update("[" + string.Join(",", items) + "]");
        }

        private void UpdateDistrictData()
        {
            var items = new List<string>();
            var em = EntityManager;

            // 0. Aggregate building counts, themes and packs
            var resCounts = new Dictionary<Entity, int>();
            var svcCounts = new Dictionary<Entity, int>();
            var bizCounts = new Dictionary<Entity, int>();
            var distThemes = new Dictionary<Entity, HashSet<string>>();
            var distPacks = new Dictionary<Entity, HashSet<string>>();
            int cityRes = 0, citySvc = 0, cityBiz = 0;

            if (!_buildingQuery.IsEmptyIgnoreFilter)
            {
                var buildings = _buildingQuery.ToEntityArray(Allocator.Temp);
                try
                {
                    for (int i = 0; i < buildings.Length; i++)
                    {
                        var bEnt = buildings[i];
                        Entity district = Entity.Null;
                        if (em.HasComponent<Game.Areas.CurrentDistrict>(bEnt)) district = em.GetComponentData<Game.Areas.CurrentDistrict>(bEnt).m_District;

                        var pr = em.GetComponentData<PrefabRef>(bEnt);
                        
                        // Check for Theme and Pack on the building prefab
                        string theme = "";
                        string pack = "";
                        if (_prefabSystem.TryGetPrefab<PrefabBase>(pr.m_Prefab, out var prefab))
                        {
                            if (prefab.Has<ThemeObject>())
                            {
                                var to = prefab.GetComponent<ThemeObject>();
                                if (to.m_Theme != null) theme = to.m_Theme.name;
                            }
                            // Packs are often part of the prefab metadata or naming in some mods, 
                            // but in vanilla they might be harder to find. We'll use a placeholder or try to find it.
                        }

                        bool isRes = em.HasComponent<Game.Buildings.ResidentialProperty>(bEnt) || em.HasComponent<Game.Prefabs.BuildingPropertyData>(pr.m_Prefab);
                        bool isSvc = em.HasComponent<Game.Buildings.ServiceUpgrade>(bEnt) || em.HasComponent<Game.Buildings.Hospital>(bEnt) || em.HasComponent<Game.Buildings.School>(bEnt) || em.HasComponent<Game.Buildings.PoliceStation>(bEnt) || em.HasComponent<Game.Buildings.FireStation>(bEnt) || em.HasComponent<Game.Buildings.Park>(bEnt) || em.HasComponent<Game.Buildings.DeathcareFacility>(bEnt) || em.HasComponent<Game.Buildings.GarbageFacility>(bEnt);
                        bool isBiz = em.HasComponent<Game.Buildings.PropertyRenter>(bEnt) || em.HasComponent<Game.Buildings.CommercialProperty>(bEnt) || em.HasComponent<Game.Buildings.IndustrialProperty>(bEnt);

                        if (district != Entity.Null)
                        {
                            if (isRes) resCounts[district] = resCounts.TryGetValue(district, out var c) ? c + 1 : 1;
                            if (isSvc) svcCounts[district] = svcCounts.TryGetValue(district, out var c) ? c + 1 : 1;
                            if (isBiz) bizCounts[district] = bizCounts.TryGetValue(district, out var c) ? c + 1 : 1;
                            
                            if (!string.IsNullOrEmpty(theme))
                            {
                                if (!distThemes.ContainsKey(district)) distThemes[district] = new HashSet<string>();
                                distThemes[district].Add(theme);
                            }
                        }
                        
                        if (isRes) cityRes++;
                        if (isSvc) citySvc++;
                        if (isBiz) cityBiz++;
                    }
                }
                finally { buildings.Dispose(); }
            }

            // 1. Get City Data
            if (_citySystem != null && _citySystem.City != Entity.Null)
            {
                var cityEntity = _citySystem.City;
                var key = $"{cityEntity.Index},{cityEntity.Version}";
                var activePolicies = new List<string>();
                var cityName = "City";
                if (_nameSystem != null)
                {
                    var rendered = _nameSystem.GetRenderedLabelName(cityEntity);
                    if (!string.IsNullOrEmpty(rendered)) cityName = rendered;
                }
                
                if (em.HasBuffer<Policy>(cityEntity))
                {
                    var policies = em.GetBuffer<Policy>(cityEntity, true);
                    for (int p = 0; p < policies.Length; p++)
                    {
                        var pref = policies[p].m_Policy;
                        activePolicies.Add($"\"{pref.Index},{pref.Version}\"");
                    }
                }

                var policiesJson = "[" + string.Join(",", activePolicies) + "]";
                items.Add($"{{\"entityKey\":\"{key}\",\"name\":\"City\",\"isCity\":true,\"cityName\":\"{EscapeJson(cityName)}\",\"policies\":{policiesJson},\"res\":{cityRes},\"svc\":{citySvc},\"biz\":{cityBiz},\"themes\":[],\"packs\":[]}}");
            }

            // 2. Get District Data
            if (!_districtQuery.IsEmptyIgnoreFilter)
            {
                var entities = _districtQuery.ToEntityArray(Allocator.Temp);
                try
                {
                    for (int i = 0; i < entities.Length; i++)
                    {
                        var entity = entities[i];
                        var name = "District";
                        
                        if (_nameSystem != null)
                        {
                            var rendered = _nameSystem.GetRenderedLabelName(entity);
                            if (!string.IsNullOrEmpty(rendered)) name = rendered;
                        }

                        var key = $"{entity.Index},{entity.Version}";
                        var activePolicies = new List<string>();

                        if (em.HasBuffer<Policy>(entity))
                        {
                            var policies = em.GetBuffer<Policy>(entity, true);
                            for (int p = 0; p < policies.Length; p++)
                            {
                                var pref = policies[p].m_Policy;
                                activePolicies.Add($"\"{pref.Index},{pref.Version}\"");
                            }
                        }

                        var policiesJson = "[" + string.Join(",", activePolicies) + "]";
                        name = EscapeJson(name);
                        
                        var rCount = resCounts.TryGetValue(entity, out var rc) ? rc : 0;
                        var sCount = svcCounts.TryGetValue(entity, out var sc) ? sc : 0;
                        var bCount = bizCounts.TryGetValue(entity, out var bc) ? bc : 0;
                        
                        var themesList = distThemes.TryGetValue(entity, out var th) ? new List<string>(th) : new List<string>();
                        var packsList = distPacks.TryGetValue(entity, out var pk) ? new List<string>(pk) : new List<string>();
                        
                        var themesJson = "[\"" + string.Join("\",\"", themesList) + "\"]";
                        if (themesList.Count == 0) themesJson = "[]";
                        var packsJson = "[\"" + string.Join("\",\"", packsList) + "\"]";
                        if (packsList.Count == 0) packsJson = "[]";
                        
                        items.Add($"{{\"entityKey\":\"{key}\",\"name\":\"{name}\",\"policies\":{policiesJson},\"res\":{rCount},\"svc\":{sCount},\"biz\":{bCount},\"themes\":{themesJson},\"packs\":{packsJson}}}");
                    }
                }
                finally
                {
                    entities.Dispose();
                }
            }

            _districtBrowserData.Update("[" + string.Join(",", items) + "]");
        }

        private string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }
    }
}
