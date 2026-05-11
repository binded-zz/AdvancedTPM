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
using Game.Economy;
using Game.Citizens;
using Unity.Jobs;
using Unity.Burst;
using Unity.Mathematics;
using Game.Triggers;

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
        private EntityQuery _economyParameterQuery;

        private NameSystem _nameSystem;
        private PrefabSystem _prefabSystem;
        private PoliciesUISystem _policiesUISystem;
        private CitySystem _citySystem;
        private Game.EndFrameBarrier _endFrameBarrier;
        private EntityArchetype _policyEventArchetype;

        private int _updateCounter;

        public struct DistrictStats
        {
            public int res;
            public int svc;
            public int biz;
            public int households;
            public int householdCap;
            public int workers;
            public int maxWorkers;
            public long totalWealth;
            public long totalIncome;
            public long totalRent;
            public int householdsWithWealth;
            public int householdsWithIncome;
            public int householdsWithRent;
            public long totalHappiness;
            public int citizenCount;
            public int residents;
            public int children;
            public int teens;
            public int adults;
            public int seniors;
            public int eduUneducated;
            public int eduPoorlyEducated;
            public int eduEducated;
            public int eduWellEducated;
            public int eduHighlyEducated;
            public int localServices;
            public int serviceMask;
            public int workerUneducated;
            public int workerPoorlyEducated;
            public int workerEducated;
            public int workerWellEducated;
            public int workerHighlyEducated;
            public int propertyCount;
            public int resProp;
            public int comProp;
            public int indProp;
            public int offProp;
            public int storProp;
            public int mixedProp;
            public int buildingLevelSum;
            public int buildingLevelSamples;
            public double totalLandValue;
            public int landValueSamples;
            public int homeless;
            public long upkeep;
            public long resources;
            public long fees;

            public void Add(DistrictStats other)
            {
                res += other.res;
                svc += other.svc;
                biz += other.biz;
                households += other.households;
                householdCap += other.householdCap;
                workers += other.workers;
                maxWorkers += other.maxWorkers;
                totalWealth += other.totalWealth;
                totalIncome += other.totalIncome;
                totalRent += other.totalRent;
                householdsWithWealth += other.householdsWithWealth;
                householdsWithIncome += other.householdsWithIncome;
                householdsWithRent += other.householdsWithRent;
                totalHappiness += other.totalHappiness;
                citizenCount += other.citizenCount;
                residents += other.residents;
                children += other.children;
                teens += other.teens;
                adults += other.adults;
                seniors += other.seniors;
                eduUneducated += other.eduUneducated;
                eduPoorlyEducated += other.eduPoorlyEducated;
                eduEducated += other.eduEducated;
                eduWellEducated += other.eduWellEducated;
                eduHighlyEducated += other.eduHighlyEducated;
                localServices += other.localServices;
                serviceMask |= other.serviceMask;
                workerUneducated += other.workerUneducated;
                workerPoorlyEducated += other.workerPoorlyEducated;
                workerEducated += other.workerEducated;
                workerWellEducated += other.workerWellEducated;
                workerHighlyEducated += other.workerHighlyEducated;
                propertyCount += other.propertyCount;
                resProp += other.resProp;
                comProp += other.comProp;
                indProp += other.indProp;
                offProp += other.offProp;
                storProp += other.storProp;
                mixedProp += other.mixedProp;
                buildingLevelSum += other.buildingLevelSum;
                buildingLevelSamples += other.buildingLevelSamples;
                totalLandValue += other.totalLandValue;
                landValueSamples += other.landValueSamples;
                homeless += other.homeless;
                upkeep += other.upkeep;
                resources += other.resources;
                fees += other.fees;
            }
        }

        public struct DistrictDelta
        {
            public Entity district;
            public DistrictStats stats;
        }

        [BurstCompile]
        private struct UpdateDistrictDataJob : IJobChunk
        {
            [ReadOnly] public EntityTypeHandle m_EntityHandle;
            [ReadOnly] public ComponentTypeHandle<PrefabRef> m_PrefabRefHandle;
            [ReadOnly] public ComponentTypeHandle<CurrentDistrict> m_CurrentDistrictHandle;

            [ReadOnly] public ComponentLookup<ResidentialProperty> m_ResidentialPropertyLookup;
            [ReadOnly] public ComponentLookup<BuildingPropertyData> m_BuildingPropertyDataLookup;
            [ReadOnly] public BufferLookup<Renter> m_RenterLookup;
            [ReadOnly] public ComponentLookup<Household> m_HouseholdLookup;
            [ReadOnly] public BufferLookup<HouseholdCitizen> m_HouseholdCitizenLookup;
            [ReadOnly] public ComponentLookup<Citizen> m_CitizenLookup;
            [ReadOnly] public ComponentLookup<HealthProblem> m_HealthProblemLookup;
            [ReadOnly] public BufferLookup<Resources> m_ResourcesLookup;
            [ReadOnly] public ComponentLookup<PropertyRenter> m_PropertyRenterLookup;
            [ReadOnly] public ComponentLookup<WorkProvider> m_WorkProviderLookup;
            [ReadOnly] public BufferLookup<Employee> m_EmployeeLookup;
            [ReadOnly] public ComponentLookup<Worker> m_WorkerLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.CommercialProperty> m_CommercialPropertyLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.OfficeProperty> m_OfficePropertyLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.IndustrialProperty> m_IndustrialPropertyLookup;
            [ReadOnly] public ComponentLookup<Game.Companies.StorageCompany> m_StorageCompanyLookup;
            [ReadOnly] public ComponentLookup<SpawnableBuildingData> m_SpawnableLookup;
            [ReadOnly] public ComponentLookup<Game.Net.LandValue> m_LandValueLookup;

            [ReadOnly] public ComponentLookup<Game.Buildings.ServiceUpgrade> m_ServiceUpgradeLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.Hospital> m_HospitalLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.School> m_SchoolLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.PoliceStation> m_PoliceStationLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.FireStation> m_FireStationLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.Park> m_ParkLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.DeathcareFacility> m_DeathcareFacilityLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.GarbageFacility> m_GarbageFacilityLookup;
            [ReadOnly] public BufferLookup<Game.Areas.ServiceDistrict> m_ServiceDistrictLookup;
            
            [ReadOnly] public EconomyParameterData m_EconomyParameters;
            [ReadOnly] public NativeArray<int> m_TaxRates;

            public NativeStream.Writer m_Stream;

            public void Execute(in ArchetypeChunk chunk, int unfilteredChunkIndex, bool useEnabledMask, in Unity.Burst.Intrinsics.v128 chunkEnabledMask)
            {
                var entities = chunk.GetNativeArray(m_EntityHandle);
                var prefabs = chunk.GetNativeArray(ref m_PrefabRefHandle);
                var districts = chunk.GetNativeArray(ref m_CurrentDistrictHandle);

                m_Stream.BeginForEachIndex(unfilteredChunkIndex);

                for (int i = 0; i < entities.Length; i++)
                {
                    Entity bEnt = entities[i];
                    Entity prEnt = prefabs[i].m_Prefab;
                    Entity district = districts[i].m_District; 

                    DistrictStats stats = default;

                    bool isRes = m_ResidentialPropertyLookup.HasComponent(bEnt) || m_ResidentialPropertyLookup.HasComponent(prEnt);
                    bool isCom = m_CommercialPropertyLookup.HasComponent(bEnt) || m_CommercialPropertyLookup.HasComponent(prEnt);
                    bool isOff = m_OfficePropertyLookup.HasComponent(bEnt) || m_OfficePropertyLookup.HasComponent(prEnt);
                    bool isInd = m_IndustrialPropertyLookup.HasComponent(bEnt) || m_IndustrialPropertyLookup.HasComponent(prEnt);
                    bool isStor = m_StorageCompanyLookup.HasComponent(bEnt) || m_StorageCompanyLookup.HasComponent(prEnt);
                    bool isSvc = m_ServiceUpgradeLookup.HasComponent(bEnt) || m_HospitalLookup.HasComponent(bEnt) || m_SchoolLookup.HasComponent(bEnt) || m_PoliceStationLookup.HasComponent(bEnt) || m_FireStationLookup.HasComponent(bEnt) || m_ParkLookup.HasComponent(bEnt) || m_DeathcareFacilityLookup.HasComponent(bEnt) || m_GarbageFacilityLookup.HasComponent(bEnt);
                    
                    if (isSvc) stats.svc++;
                    
                    if (isRes)
                    {
                        stats.res++;
                        if (m_BuildingPropertyDataLookup.TryGetComponent(prEnt, out var propData))
                        {
                            stats.householdCap += propData.m_ResidentialProperties;
                        }
                        if (m_RenterLookup.TryGetBuffer(bEnt, out var renters))
                        {
                            for (int r = 0; r < renters.Length; r++)
                            {
                                Entity household = renters[r].m_Renter;
                                if (m_HouseholdLookup.TryGetComponent(household, out var householdData))
                                {
                                    stats.households++;
                                    
                                    if (m_ResourcesLookup.TryGetBuffer(household, out var resources))
                                    {
                                        int wealth = EconomyUtils.GetHouseholdTotalWealth(householdData, resources);
                                        stats.totalWealth += wealth;
                                        stats.householdsWithWealth++;
                                    }

                                    if (m_HouseholdCitizenLookup.TryGetBuffer(household, out var citizens))
                                    {
                                        int income = EconomyUtils.GetHouseholdIncome(citizens, ref m_WorkerLookup, ref m_CitizenLookup, ref m_HealthProblemLookup, ref m_EconomyParameters, m_TaxRates);
                                        stats.totalIncome += income;
                                        stats.householdsWithIncome++;
                                        
                                        for (int c = 0; c < citizens.Length; c++)
                                        {
                                            if (m_CitizenLookup.TryGetComponent(citizens[c].m_Citizen, out var citizen))
                                            {
                                                if (!CitizenUtils.IsDead(citizens[c].m_Citizen, ref m_HealthProblemLookup))
                                                {
                                                    stats.totalHappiness += citizen.Happiness;
                                                    stats.citizenCount++;
                                                    stats.residents++;
                                                    var age = citizen.GetAge();
                                                    switch (age)
                                                    {
                                                        case CitizenAge.Child: stats.children++; break;
                                                        case CitizenAge.Teen: stats.teens++; break;
                                                        case CitizenAge.Adult: stats.adults++; break;
                                                        case CitizenAge.Elderly: stats.seniors++; break;
                                                    }
                                                    var edu = citizen.GetEducationLevel();
                                                    switch (edu)
                                                    {
                                                        case 0: stats.eduUneducated++; break;
                                                        case 1: stats.eduPoorlyEducated++; break;
                                                        case 2: stats.eduEducated++; break;
                                                        case 3: stats.eduWellEducated++; break;
                                                        case 4: stats.eduHighlyEducated++; break;
                                                    }
                                                }
                                            }
                                        }
                                    }

                                if (m_PropertyRenterLookup.TryGetComponent(household, out var propertyRenter))
                                    {
                                        stats.totalRent += propertyRenter.m_Rent;
                                        stats.householdsWithRent++;
                                    }
                                else
                                {
                                    stats.homeless++;
                                }
                                }
                            }
                        }
                    }

                    Entity workEntity = bEnt;
                    bool hasWork = false;
                    if (m_WorkProviderLookup.HasComponent(bEnt))
                    {
                        hasWork = true;
                    }
                    else if (m_RenterLookup.TryGetBuffer(bEnt, out var renters))
                    {
                        for (int r = 0; r < renters.Length; r++)
                        {
                            if (m_WorkProviderLookup.HasComponent(renters[r].m_Renter))
                            {
                                workEntity = renters[r].m_Renter;
                                hasWork = true;
                                break;
                            }
                        }
                    }

                    if (hasWork && m_WorkProviderLookup.TryGetComponent(workEntity, out var wp))
                    {
                        if (!isRes && !isSvc) stats.biz++; 
                        stats.maxWorkers += wp.m_MaxWorkers;
                        if (m_EmployeeLookup.TryGetBuffer(workEntity, out var employees))
                        {
                            stats.workers += employees.Length;
                            for (int e = 0; e < employees.Length; e++)
                            {
                                Entity workerEnt = employees[e].m_Worker;
                                if (m_CitizenLookup.TryGetComponent(workerEnt, out var workerCitizen))
                                {
                                    switch (workerCitizen.GetEducationLevel())
                                    {
                                        case 0: stats.workerUneducated++; break;
                                        case 1: stats.workerPoorlyEducated++; break;
                                        case 2: stats.workerEducated++; break;
                                        case 3: stats.workerWellEducated++; break;
                                        case 4: stats.workerHighlyEducated++; break;
                                    }
                                }
                            }
                        }
                    }

                    // Compute service type mask for this building
                    if (isSvc)
                    {
                        int mask = 0;
                        if (m_HospitalLookup.HasComponent(bEnt)) mask |= (1 << 0);
                        if (m_SchoolLookup.HasComponent(bEnt)) mask |= (1 << 1);
                        if (m_PoliceStationLookup.HasComponent(bEnt)) mask |= (1 << 2);
                        if (m_FireStationLookup.HasComponent(bEnt)) mask |= (1 << 3);
                        if (m_ParkLookup.HasComponent(bEnt)) mask |= (1 << 4);
                        if (m_DeathcareFacilityLookup.HasComponent(bEnt)) mask |= (1 << 5);
                        if (m_GarbageFacilityLookup.HasComponent(bEnt)) mask |= (1 << 6);
                        stats.serviceMask |= mask;
                    }

                    // Property type bookkeeping (clean, no double-counting)
                    if (isCom) stats.comProp++;
                    if (isOff) stats.offProp++;
                    if (isInd) stats.indProp++;
                    if (isStor) stats.storProp++;
                    bool isMixed = isRes && (isCom || isOff || isInd || isStor);
                    if (isMixed)           { stats.mixedProp++; stats.propertyCount++; }
                    else if (isRes)        { stats.resProp++;   stats.propertyCount++; }
                    else if (!isSvc && (isCom || isOff || isInd || isStor)) { stats.propertyCount++; }

                    if (m_SpawnableLookup.HasComponent(prEnt)) {
                        var sd = m_SpawnableLookup[prEnt];
                        stats.buildingLevelSum += sd.m_Level;
                        stats.buildingLevelSamples++;
                        stats.upkeep += sd.m_Level * 8;
                    }

                    if (m_LandValueLookup.HasComponent(bEnt)) {
                        stats.totalLandValue += m_LandValueLookup[bEnt].m_LandValue;
                        stats.landValueSamples++;
                    }

                    if (stats.res != 0 || stats.biz != 0 || stats.svc != 0 || stats.households != 0 || stats.workers != 0)
                    {
                        m_Stream.Write(new DistrictDelta { district = district, stats = stats });
                    }

                    if (isSvc && m_ServiceDistrictLookup.TryGetBuffer(bEnt, out var opDistricts))
                    {
                        // Compute service mask for cross-district contribution
                        int svcMask = 0;
                        if (m_HospitalLookup.HasComponent(bEnt)) svcMask |= (1 << 0);
                        if (m_SchoolLookup.HasComponent(bEnt)) svcMask |= (1 << 1);
                        if (m_PoliceStationLookup.HasComponent(bEnt)) svcMask |= (1 << 2);
                        if (m_FireStationLookup.HasComponent(bEnt)) svcMask |= (1 << 3);
                        if (m_ParkLookup.HasComponent(bEnt)) svcMask |= (1 << 4);
                        if (m_DeathcareFacilityLookup.HasComponent(bEnt)) svcMask |= (1 << 5);
                        if (m_GarbageFacilityLookup.HasComponent(bEnt)) svcMask |= (1 << 6);
                        for (int j = 0; j < opDistricts.Length; j++)
                        {
                            DistrictStats opStats = default;
                            opStats.localServices = 1;
                            opStats.serviceMask = svcMask;
                            m_Stream.Write(new DistrictDelta { district = opDistricts[j].m_District, stats = opStats });
                        }
                    }
                }

                m_Stream.EndForEachIndex();
            }
        }

        [BurstCompile]
        private struct AggregateStatsJob : IJob
        {
            [ReadOnly] public NativeStream.Reader m_Stream;
            public NativeParallelHashMap<Entity, DistrictStats> m_StatsMap;

            public void Execute()
            {
                for (int i = 0; i < m_Stream.ForEachCount; i++)
                {
                    m_Stream.BeginForEachIndex(i);
                    while (m_Stream.RemainingItemCount > 0)
                    {
                        var delta = m_Stream.Read<DistrictDelta>();
                        if (m_StatsMap.TryGetValue(delta.district, out var existing))
                        {
                            existing.Add(delta.stats);
                            m_StatsMap[delta.district] = existing;
                        }
                        else
                        {
                            m_StatsMap.TryAdd(delta.district, delta.stats);
                        }
                    }
                    m_Stream.EndForEachIndex();
                }
            }
        }

        protected override void OnCreate()
        {
            base.OnCreate();

            _nameSystem = World.GetOrCreateSystemManaged<NameSystem>();
            _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
            _policiesUISystem = World.GetOrCreateSystemManaged<PoliciesUISystem>();
            _citySystem = World.GetOrCreateSystemManaged<CitySystem>();
            _endFrameBarrier = World.GetOrCreateSystemManaged<Game.EndFrameBarrier>();
            _policyEventArchetype = EntityManager.CreateArchetype(ComponentType.ReadWrite<Game.Common.Event>(), ComponentType.ReadWrite<Game.Policies.Modify>());

            _districtQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<District>(),
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
                    ComponentType.ReadOnly<Building>(),
                    ComponentType.ReadOnly<PrefabRef>(),
                    ComponentType.ReadOnly<CurrentDistrict>()
                },
                None = new ComponentType[]
                {
                    ComponentType.ReadOnly<Deleted>(),
                    ComponentType.ReadOnly<Temp>()
                }
            });

            _economyParameterQuery = GetEntityQuery(ComponentType.ReadOnly<EconomyParameterData>());

            _cityQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<City>(),
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
                    ComponentType.ReadOnly<DistrictModifierData>(),
                    ComponentType.ReadOnly<CityOptionData>(),
                    ComponentType.ReadOnly<CityModifierData>()
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
                Entity districtEntity = Entity.Null;
                if (districtKey == "city")
                {
                    districtEntity = _citySystem.City;
                }
                else
                {
                    districtEntity = ParseEntityKey(districtKey);
                }
                
                var policyEntity = ParseEntityKey(policyPrefabKey);
                
                if (districtEntity != Entity.Null && policyEntity != Entity.Null)
                {
                    // Read current adjustment value from the policy buffer
                    float adjustment = 0f;
                    bool foundInBuffer = false;
                    if (EntityManager.HasBuffer<Game.Policies.Policy>(districtEntity))
                    {
                        var policies = EntityManager.GetBuffer<Game.Policies.Policy>(districtEntity, true);
                        for (int i = 0; i < policies.Length; i++)
                        {
                            if (policies[i].m_Policy == policyEntity)
                            {
                                adjustment = policies[i].m_Adjustment;
                                foundInBuffer = true;
                                break;
                            }
                        }
                    }

                    Mod.log.Info($"TogglePolicy DIRECT: entity={policyPrefabKey} target={districtKey} active={active} adj={adjustment} found={foundInBuffer}");

                    // Create the policy modification event DIRECTLY, bypassing PoliciesUISystem
                    // This matches exactly how the game's ModifyPolicy creates the event
                    var ecb = _endFrameBarrier.CreateCommandBuffer();
                    Entity evt = ecb.CreateEntity(_policyEventArchetype);
                    ecb.SetComponent(evt, new Game.Policies.Modify(districtEntity, policyEntity, active, adjustment));
                    
                    Mod.log.Info($"TogglePolicy DIRECT: event created successfully");
                    UpdateDistrictData();
                }
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"Error toggling policy: {ex.Message}\n{ex.StackTrace}");
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
            if (_updateCounter++ % 30 == 0)
            {
                try
                {
                    Mod.log.Info($"DistrictBrowserSystem OnUpdate tick {_updateCounter}");
                    UpdatePolicyPrefabs();
                    UpdateDistrictData();
                }
                catch (Exception ex)
                {
                    Mod.log.Warn($"DistrictBrowserSystem Update error: {ex.Message}\n{ex.StackTrace}");
                }
            }
        }

        private string GetHappinessFactorsJson(Entity district)
        {
            try
            {
                var happinessSystem = World.GetExistingSystemManaged<AdvancedTPM.Systems.DistrictHappinessAggregationSystem>();
                if (happinessSystem != null && happinessSystem.m_HappinessMap.IsCreated)
                {
                    if (happinessSystem.m_HappinessMap.TryGetValue(district, out var data))
                    {
                        var factors = new List<string>();
                        for (int i = 0; i < 30; i++)
                        {
                            var val = data.Get(i);
                            if (val.x > 0)
                            {
                                factors.Add($"[{i},{val.x},{val.y}]");
                            }
                        }
                        return "[" + string.Join(",", factors) + "]";
                    }
                }
            }
            catch (Exception ex)
            {
                Mod.log.Warn($"Error getting happiness factors: {ex.Message}");
            }
            return "[]";
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
                        bool isCityPolicy = _prefabSystem.EntityManager.HasComponent<CityOptionData>(entity) || _prefabSystem.EntityManager.HasComponent<CityModifierData>(entity);
                        bool isDistrictPolicy = _prefabSystem.EntityManager.HasComponent<DistrictOptionData>(entity) || _prefabSystem.EntityManager.HasComponent<DistrictModifierData>(entity);
                        
                        items.Add($"{{\"entityKey\":\"{key}\",\"name\":\"{name}\",\"icon\":\"{EscapeJson(icon)}\",\"isCity\":{isCityPolicy.ToString().ToLower()},\"isDistrict\":{isDistrictPolicy.ToString().ToLower()}}}");
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

            if (!_economyParameterQuery.TryGetSingleton<EconomyParameterData>(out var economyParameters)) return;
            var taxSystem = World.GetOrCreateSystemManaged<TaxSystem>();
            if (taxSystem == null) return;
            var taxRates = taxSystem.GetTaxRates();

            var statsMap = new NativeParallelHashMap<Entity, DistrictStats>(100, Allocator.TempJob);
            var stream = new NativeStream(_buildingQuery.CalculateChunkCount(), Allocator.TempJob);
            
            var updateJob = new UpdateDistrictDataJob
            {
                m_EntityHandle = SystemAPI.GetEntityTypeHandle(),
                m_PrefabRefHandle = SystemAPI.GetComponentTypeHandle<PrefabRef>(true),
                m_CurrentDistrictHandle = SystemAPI.GetComponentTypeHandle<CurrentDistrict>(true),
                m_ResidentialPropertyLookup = SystemAPI.GetComponentLookup<ResidentialProperty>(true),
                m_BuildingPropertyDataLookup = SystemAPI.GetComponentLookup<BuildingPropertyData>(true),
                m_RenterLookup = SystemAPI.GetBufferLookup<Renter>(true),
                m_HouseholdLookup = SystemAPI.GetComponentLookup<Household>(true),
                m_HouseholdCitizenLookup = SystemAPI.GetBufferLookup<HouseholdCitizen>(true),
                m_CitizenLookup = SystemAPI.GetComponentLookup<Citizen>(true),
                m_HealthProblemLookup = SystemAPI.GetComponentLookup<HealthProblem>(true),
                m_ResourcesLookup = SystemAPI.GetBufferLookup<Resources>(true),
                m_PropertyRenterLookup = SystemAPI.GetComponentLookup<PropertyRenter>(true),
                m_WorkProviderLookup = SystemAPI.GetComponentLookup<WorkProvider>(true),
                m_EmployeeLookup = SystemAPI.GetBufferLookup<Employee>(true),
                m_WorkerLookup = SystemAPI.GetComponentLookup<Worker>(true),
                m_ServiceUpgradeLookup = SystemAPI.GetComponentLookup<Game.Buildings.ServiceUpgrade>(true),
                m_HospitalLookup = SystemAPI.GetComponentLookup<Game.Buildings.Hospital>(true),
                m_SchoolLookup = SystemAPI.GetComponentLookup<Game.Buildings.School>(true),
                m_PoliceStationLookup = SystemAPI.GetComponentLookup<Game.Buildings.PoliceStation>(true),
                m_FireStationLookup = SystemAPI.GetComponentLookup<Game.Buildings.FireStation>(true),
                m_ParkLookup = SystemAPI.GetComponentLookup<Game.Buildings.Park>(true),
                m_DeathcareFacilityLookup = SystemAPI.GetComponentLookup<Game.Buildings.DeathcareFacility>(true),
                m_GarbageFacilityLookup = SystemAPI.GetComponentLookup<Game.Buildings.GarbageFacility>(true),
                m_ServiceDistrictLookup = SystemAPI.GetBufferLookup<Game.Areas.ServiceDistrict>(true),
                m_EconomyParameters = economyParameters,
                m_TaxRates = taxRates,
                m_CommercialPropertyLookup = SystemAPI.GetComponentLookup<Game.Buildings.CommercialProperty>(true),
                m_OfficePropertyLookup = SystemAPI.GetComponentLookup<Game.Buildings.OfficeProperty>(true),
                m_IndustrialPropertyLookup = SystemAPI.GetComponentLookup<Game.Buildings.IndustrialProperty>(true),
                m_StorageCompanyLookup = SystemAPI.GetComponentLookup<Game.Companies.StorageCompany>(true),
                m_SpawnableLookup = SystemAPI.GetComponentLookup<SpawnableBuildingData>(true),
                m_LandValueLookup = SystemAPI.GetComponentLookup<Game.Net.LandValue>(true),
                m_Stream = stream.AsWriter()
            };

            var aggregateJob = new AggregateStatsJob
            {
                m_Stream = stream.AsReader(),
                m_StatsMap = statsMap
            };

            var handle = JobChunkExtensions.ScheduleParallel(updateJob, _buildingQuery, base.Dependency);
            handle = aggregateJob.Schedule(handle);
            handle.Complete();

            // Aggregate city-wide (buildings with no district are keyed under Entity.Null)
            DistrictStats cityStats = statsMap.TryGetValue(Entity.Null, out var cs) ? cs : default;
            
            // Add all other districts' stats to city stats to get total city data
            using (var kvp = statsMap.GetKeyValueArrays(Allocator.Temp))
            {
                for (int i = 0; i < kvp.Keys.Length; i++)
                {
                    if (kvp.Keys[i] != Entity.Null)
                    {
                        cityStats.Add(kvp.Values[i]);
                    }
                }
            }
            // For city, localServices = 0 so display shows: svc Local / svc Total (no double-counting)
            cityStats.localServices = 0;

            // 1. Get City Row
            if (_citySystem.City != Entity.Null)
            {
                var cityEntity = _citySystem.City;
                var key = "city";
                var activePolicies = new List<string>();
                string cityName = "City";
                
                try {
                    var config = World.GetOrCreateSystemManaged<CityConfigurationSystem>();
                    var mapMetadata = World.GetOrCreateSystemManaged<MapMetadataSystem>();
                    cityName = config.cityName;
                    if (string.IsNullOrEmpty(cityName)) cityName = mapMetadata.mapName;
                    if (string.IsNullOrEmpty(cityName)) cityName = _nameSystem.GetRenderedLabelName(cityEntity);
                } catch {}

                if (em.HasBuffer<Game.Policies.Policy>(cityEntity))
                {
                    var policies = em.GetBuffer<Game.Policies.Policy>(cityEntity, true);
                    foreach (var p in policies)
                    {
                        if ((p.m_Flags & Game.Policies.PolicyFlags.Active) != 0)
                        {
                            activePolicies.Add($"\"{p.m_Policy.Index},{p.m_Policy.Version}\"");
                        }
                    }
                }

                double avgWealth = cityStats.householdsWithWealth > 0 ? (double)cityStats.totalWealth / cityStats.householdsWithWealth : 0;
                double avgIncome = cityStats.householdsWithIncome > 0 ? (double)cityStats.totalIncome / cityStats.householdsWithIncome : 0;
                double avgRent = cityStats.householdsWithRent > 0 ? (double)cityStats.totalRent / cityStats.householdsWithRent : 0;
                int avgHappiness = cityStats.citizenCount > 0 ? (int)(cityStats.totalHappiness / cityStats.citizenCount) : 0;

                var avgBuildingLevelCity = cityStats.buildingLevelSamples > 0 ? (double)cityStats.buildingLevelSum / cityStats.buildingLevelSamples : 0;
                string happinessFactorsJson = GetHappinessFactorsJson(Entity.Null);
                items.Add($"{{\"entityKey\":\"{key}\",\"name\":\"City\",\"isCity\":true,\"cityName\":\"{EscapeJson(cityName)}\",\"policies\":[{string.Join(",", activePolicies)}],\"res\":{cityStats.res},\"svc\":{cityStats.svc},\"biz\":{cityStats.biz},\"households\":{cityStats.households},\"householdCap\":{cityStats.householdCap},\"workers\":{cityStats.workers},\"maxWorkers\":{cityStats.maxWorkers},\"avgWealth\":{avgWealth},\"avgIncome\":{avgIncome},\"avgRent\":{avgRent},\"avgHappiness\":{avgHappiness},\"residents\":{cityStats.residents},\"children\":{cityStats.children},\"teens\":{cityStats.teens},\"adults\":{cityStats.adults},\"seniors\":{cityStats.seniors},\"eduUneducated\":{cityStats.eduUneducated},\"eduPoorlyEducated\":{cityStats.eduPoorlyEducated},\"eduEducated\":{cityStats.eduEducated},\"eduWellEducated\":{cityStats.eduWellEducated},\"eduHighlyEducated\":{cityStats.eduHighlyEducated},\"workerUneducated\":{cityStats.workerUneducated},\"workerPoorlyEducated\":{cityStats.workerPoorlyEducated},\"workerEducated\":{cityStats.workerEducated},\"workerWellEducated\":{cityStats.workerWellEducated},\"workerHighlyEducated\":{cityStats.workerHighlyEducated},\"localServices\":{cityStats.localServices},\"serviceMask\":{cityStats.serviceMask},\"propertyCount\":{cityStats.propertyCount},\"resProp\":{cityStats.resProp},\"comProp\":{cityStats.comProp},\"indProp\":{cityStats.indProp},\"offProp\":{cityStats.offProp},\"storProp\":{cityStats.storProp},\"mixedProp\":{cityStats.mixedProp},\"avgBuildingLevel\":{avgBuildingLevelCity},\"buildingLevelSamples\":{cityStats.buildingLevelSamples},\"totalLandValue\":{cityStats.totalLandValue},\"landValueSamples\":{cityStats.landValueSamples},\"homeless\":{cityStats.homeless},\"upkeep\":{cityStats.upkeep},\"resourceCost\":{cityStats.resources},\"feesPaid\":{cityStats.fees},\"happinessFactors\":{happinessFactorsJson}}}");
            }

            // 2. Get District Rows
            if (!_districtQuery.IsEmptyIgnoreFilter)
            {
                var entities = _districtQuery.ToEntityArray(Allocator.Temp);
                try
                {
                    foreach (var entity in entities)
                    {
                        var name = _nameSystem.GetRenderedLabelName(entity) ?? "District";
                        var key = $"{entity.Index},{entity.Version}";
                        var activePolicies = new List<string>();

                        if (em.HasBuffer<Game.Policies.Policy>(entity))
                        {
                            var policies = em.GetBuffer<Game.Policies.Policy>(entity, true);
                            foreach (var p in policies)
                            {
                                if ((p.m_Flags & Game.Policies.PolicyFlags.Active) != 0)
                                {
                                    activePolicies.Add($"\"{p.m_Policy.Index},{p.m_Policy.Version}\"");
                                }
                            }
                        }

                        var stats = statsMap.TryGetValue(entity, out var s) ? s : default;
                        
                        double avgWealth = stats.householdsWithWealth > 0 ? (double)stats.totalWealth / stats.householdsWithWealth : 0;
                        double avgIncome = stats.householdsWithIncome > 0 ? (double)stats.totalIncome / stats.householdsWithIncome : 0;
                        double avgRent = stats.householdsWithRent > 0 ? (double)stats.totalRent / stats.householdsWithRent : 0;
                        int avgHappiness = stats.citizenCount > 0 ? (int)(stats.totalHappiness / stats.citizenCount) : 0;
                        
                        var avgBuildingLevel = stats.buildingLevelSamples > 0 ? (double)stats.buildingLevelSum / stats.buildingLevelSamples : 0;
                        string happinessFactorsJson = GetHappinessFactorsJson(entity);
                        items.Add($"{{\"entityKey\":\"{key}\",\"name\":\"{EscapeJson(name)}\",\"policies\":[{string.Join(",", activePolicies)}],\"res\":{stats.res},\"svc\":{stats.svc},\"biz\":{stats.biz},\"households\":{stats.households},\"householdCap\":{stats.householdCap},\"workers\":{stats.workers},\"maxWorkers\":{stats.maxWorkers},\"avgWealth\":{avgWealth},\"avgIncome\":{avgIncome},\"avgRent\":{avgRent},\"avgHappiness\":{avgHappiness},\"residents\":{stats.residents},\"children\":{stats.children},\"teens\":{stats.teens},\"adults\":{stats.adults},\"seniors\":{stats.seniors},\"eduUneducated\":{stats.eduUneducated},\"eduPoorlyEducated\":{stats.eduPoorlyEducated},\"eduEducated\":{stats.eduEducated},\"eduWellEducated\":{stats.eduWellEducated},\"eduHighlyEducated\":{stats.eduHighlyEducated},\"workerUneducated\":{stats.workerUneducated},\"workerPoorlyEducated\":{stats.workerPoorlyEducated},\"workerEducated\":{stats.workerEducated},\"workerWellEducated\":{stats.workerWellEducated},\"workerHighlyEducated\":{stats.workerHighlyEducated},\"localServices\":{stats.localServices},\"serviceMask\":{stats.serviceMask},\"propertyCount\":{stats.propertyCount},\"resProp\":{stats.resProp},\"comProp\":{stats.comProp},\"indProp\":{stats.indProp},\"offProp\":{stats.offProp},\"storProp\":{stats.storProp},\"mixedProp\":{stats.mixedProp},\"avgBuildingLevel\":{avgBuildingLevel},\"buildingLevelSamples\":{stats.buildingLevelSamples},\"totalLandValue\":{stats.totalLandValue},\"landValueSamples\":{stats.landValueSamples},\"homeless\":{stats.homeless},\"upkeep\":{stats.upkeep},\"resourceCost\":{stats.resources},\"feesPaid\":{stats.fees},\"happinessFactors\":{happinessFactorsJson}}}");
                    }
                }
                finally { entities.Dispose(); }
            }

            stream.Dispose();
            statsMap.Dispose();
            var payload = "[" + string.Join(",", items) + "]";
            _districtBrowserData.Update(payload);
            // Debug: persist district browser payload so we can compare against in-game values
            try {
                var modsData = AdvancedTPM.Utilities.FilePaths.GetModsDataFolder();
                if (!string.IsNullOrEmpty(modsData)) {
                    System.IO.Directory.CreateDirectory(modsData);
                    var path = System.IO.Path.Combine(modsData, "district_browser_payload.json");
                    System.IO.File.WriteAllText(path, payload);
                    Mod.log.Info($"Wrote district browser payload ({items.Count} items) to {path}");
                }
            } catch (System.Exception ex) { Mod.log.Info("Failed to write district browser payload: " + ex.Message); }
        }

        private string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }
    }
}
