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
using Unity.Collections;
using Unity.Entities;

namespace AdvancedTPM
{
    public partial class ResidentialBrowserSystem : UISystemBase
    {
        private ValueBinding<string> _residentialBrowserData;
        private ValueBinding<string> _residentialBuildingsData;
        private CountResidentialPropertySystem _countResidentialPropertySystem;
        private CountHouseholdDataSystem _countHouseholdDataSystem;
        private CitySystem _citySystem;
        private NameSystem _nameSystem;
        private EntityQuery _residentialBuildingQuery;
        private int _updateCounter;

        protected override void OnCreate()
        {
            base.OnCreate();
            Mod.log.Info("ResidentialBrowserSystem OnCreate started");
            try { _countResidentialPropertySystem = World.GetOrCreateSystemManaged<CountResidentialPropertySystem>(); } catch { }
            try { _countHouseholdDataSystem = World.GetOrCreateSystemManaged<CountHouseholdDataSystem>(); } catch { }
            try { _citySystem = World.GetOrCreateSystemManaged<CitySystem>(); } catch { }
            try { _nameSystem = World.GetOrCreateSystemManaged<NameSystem>(); } catch { }

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
            catch (Exception ex) { Mod.log.Warn($"ResidentialBrowserSystem Query Error: {ex.Message}"); }

            AddBinding(_residentialBrowserData = new ValueBinding<string>("taxProduction", "residentialBrowserData", ""));
            AddBinding(_residentialBuildingsData = new ValueBinding<string>("taxProduction", "residentialBuildingsData", ""));
            Mod.log.Info("ResidentialBrowserSystem OnCreate finished");
        }

        protected override void OnUpdate()
        {
            base.OnUpdate();

            _updateCounter++;
            if (_updateCounter < 480) return; // ~8 seconds
            _updateCounter = 0;
            
            Mod.log.Info("ResidentialBrowserSystem OnUpdate triggered");
            try
            {
                UpdateResidentialData();
            }
            catch (Exception ex) { Mod.log.Warn($"ResidentialBrowserSystem UpdateResidentialData Error: {ex.Message}"); }
        }

        private void UpdateResidentialData()
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

            _residentialBrowserData.Update(payload);
            try { Mod.log.Info($"ResidentialBrowserSystem: summary payload len={payload?.Length ?? 0} totalUnits={lowTotal+medTotal+highTotal} occupied={lowOccupied+medOccupied+highOccupied}"); } catch { }
            // Dump payload to ModsData for easy capture when debugging
            try
            {
                var md = AdvancedTPM.Utilities.FilePaths.GetModsDataFolder();
                if (!string.IsNullOrEmpty(md))
                {
                    // GetModsDataFolder already returns ModsData/AdvancedTPM, write files directly there.
                    if (!System.IO.Directory.Exists(md)) System.IO.Directory.CreateDirectory(md);
                    var outp = System.IO.Path.Combine(md, "residential_summary_payload.json");
                    System.IO.File.WriteAllText(outp, payload ?? "", System.Text.Encoding.UTF8);
                    try { Mod.log.Info($"Wrote residential summary payload to {outp}"); } catch { }
                }
            }
            catch (Exception ex) { try { Mod.log.Warn($"Failed to write residential summary payload: {ex.Message}"); } catch { } }

            // Per-building data: entityKey|address|density|level|occupied|capacity
            UpdatePerBuildingData();
        }

        private void UpdatePerBuildingData()
        {
            if (_residentialBuildingsData == null || _residentialBuildingQuery == null) return;
            if (_residentialBuildingQuery.IsEmptyIgnoreFilter) { _residentialBuildingsData.Update(""); return; }

            var em = EntityManager;
            var parts = new List<string>(256);
            var entities = _residentialBuildingQuery.ToEntityArray(Allocator.Temp);
            try
            {
                for (int i = 0; i < entities.Length && parts.Count < 500; i++)
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

                        // Capacity and level from prefab
                        int capacity = 0;
                        int level = 1;
                        string density = "Residential";
                        try
                        {
                            if (em.HasComponent<PrefabRef>(ent))
                            {
                                var pr = em.GetComponentData<PrefabRef>(ent);
                                var prefab = pr.m_Prefab;
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
                            }
                        }
                        catch { }

                        // Determine density from unit count (heuristic — zone component is on lot entity, not building)
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

                        parts.Add(string.Format(CultureInfo.InvariantCulture,
                            "{0},{1}|{2}|{3}|{4}|{5}|{6}",
                            ent.Index, ent.Version, address, density, level, occupied, capacity));
                    }
                    catch { }
                }
            }
            finally { entities.Dispose(); }

            _residentialBuildingsData.Update(string.Join(";", parts));
            try { Mod.log.Info($"ResidentialBrowserSystem: buildings payload count={parts.Count} payloadLen={(_residentialBuildingsData != null ? (string.Join(";", parts)).Length : 0)}"); } catch { }
            try
            {
                var md = AdvancedTPM.Utilities.FilePaths.GetModsDataFolder();
                if (!string.IsNullOrEmpty(md))
                {
                    if (!System.IO.Directory.Exists(md)) System.IO.Directory.CreateDirectory(md);
                    var outp = System.IO.Path.Combine(md, "residential_buildings_payload.txt");
                    System.IO.File.WriteAllText(outp, string.Join(";", parts), System.Text.Encoding.UTF8);
                    try { Mod.log.Info($"Wrote residential buildings payload to {outp}"); } catch { }
                }
            }
            catch (Exception ex) { try { Mod.log.Warn($"Failed to write residential buildings payload: {ex.Message}"); } catch { } }
        }
    }
}
