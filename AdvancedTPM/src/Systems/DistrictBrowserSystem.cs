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
using Game.Agents;
using Game.Zones;
using Game.Objects;

namespace AdvancedTPM
{
    public partial class DistrictBrowserSystem : UISystemBase
    {
        public static bool IsSystemActive = false;
        private ValueBinding<string> _districtBrowserData;
        private ValueBinding<string> _districtPoliciesData;

        private EntityQuery _districtQuery;
        private EntityQuery _policyPrefabQuery;
        private EntityQuery _buildingQuery;
        private EntityQuery _citizenQuery;
        private EntityQuery _petQuery;
        private EntityQuery _householdQuery;
        private EntityQuery _economyParameterQuery;
        private EntityQuery _educationParameterQuery;

        private NameSystem _nameSystem;
        private PrefabSystem _prefabSystem;
        private CitySystem _citySystem;
        private SimulationSystem m_SimulationSystem;
        private TaxingProductionUISystem _taxingProductionUISystem;
        private TaxSystem _taxSystem;
        private CountHouseholdDataSystem _countHouseholdDataSystem;
        private CityConfigurationSystem _cityConfigurationSystem;
        private MapMetadataSystem _mapMetadataSystem;
        private Game.EndFrameBarrier _endFrameBarrier;
        private EntityArchetype _policyEventArchetype;

        // Frame-throttle accumulator: runs at most once every 10 simulation-seconds.
        private float m_TimeSinceLastUpdate = 0f;

        // Dirty flag: set to true whenever district data may have changed (city load, user
        // interaction, policy toggle). The 10-second gate only serializes strings when this
        // is true, making idle ticks completely free of string-construction work.
        private bool m_DataIsDirty = true;
        private bool m_WasPanelOpen = false;
        private string m_LastDistrictBrowserData = "[]";
        private string m_LastDistrictPoliciesData = "[]";

        // Pre-allocated string list buffers — cleared each update, never re-allocated mid-loop.
        private readonly List<string> _itemBuffer = new List<string>(64);
        private readonly List<string> _policyBuffer = new List<string>(16);
        private readonly List<string> _activePoliciesBuffer = new List<string>(8);

        private bool m_JobActive = false;
        private JobHandle m_ActiveJobHandle;
        private NativeParallelHashMap<Entity, DistrictStats> m_ActiveStatsMap;
        private NativeStream m_Stream1;
        private NativeStream m_Stream2;
        private NativeStream m_Stream3;
        private NativeStream m_Stream4;


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
            public int totalHappiness;
            public int citizenCount;
            public int residents;
            public int tourists;
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
            public double area;
            public int elemCapacity;
            public int elemEnrolled;
            public float elemEligible;
            public int hsCapacity;
            public int hsEnrolled;
            public float hsEligible;
            public int collegeCapacity;
            public int collegeEnrolled;
            public float collegeEligible;
            public int uniCapacity;
            public int uniEnrolled;
            public float uniEligible;
            public int workerUneducatedMax;
            public int workerPoorlyEducatedMax;
            public int workerEducatedMax;
            public int workerWellEducatedMax;
            public int workerHighlyEducatedMax;
            public int pets;
            public int deceased;
            public int students;
            public int movingAway;

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
                totalHappiness += other.totalHappiness;
                citizenCount += other.citizenCount;
                residents += other.residents;
                tourists += other.tourists;
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
                workerUneducatedMax += other.workerUneducatedMax;
                workerPoorlyEducatedMax += other.workerPoorlyEducatedMax;
                workerEducatedMax += other.workerEducatedMax;
                workerWellEducatedMax += other.workerWellEducatedMax;
                workerHighlyEducatedMax += other.workerHighlyEducatedMax;
                elemCapacity += other.elemCapacity;
                hsCapacity += other.hsCapacity;
                collegeCapacity += other.collegeCapacity;
                uniCapacity += other.uniCapacity;
                elemEnrolled += other.elemEnrolled;
                hsEnrolled += other.hsEnrolled;
                collegeEnrolled += other.collegeEnrolled;
                uniEnrolled += other.uniEnrolled;
                elemEligible += other.elemEligible;
                hsEligible += other.hsEligible;
                collegeEligible += other.collegeEligible;
                uniEligible += other.uniEligible;
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
                area += other.area;
                pets += other.pets;
                deceased += other.deceased;
                students += other.students;
                movingAway += other.movingAway;
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
            [ReadOnly] public ComponentLookup<Game.Net.LandValue> m_LandValueLookup;
            [ReadOnly] public ComponentLookup<Building> m_BuildingLookup;
            [ReadOnly] public ComponentLookup<WorkplaceData> m_WorkplaceDataLookup;
            [ReadOnly] public BufferLookup<Employee> m_EmployeeLookup;
            [ReadOnly] public ComponentLookup<Worker> m_WorkerLookup;
            [ReadOnly] public ComponentLookup<PrefabRef> m_PrefabRefLookup;
            [ReadOnly] public ComponentLookup<CommercialProperty> m_CommercialPropertyLookup;
            [ReadOnly] public ComponentLookup<OfficeProperty> m_OfficePropertyLookup;
            [ReadOnly] public ComponentLookup<IndustrialProperty> m_IndustrialPropertyLookup;
            [ReadOnly] public ComponentLookup<Game.Companies.StorageCompany> m_StorageCompanyLookup;
            [ReadOnly] public ComponentLookup<SpawnableBuildingData> m_SpawnableLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.ServiceUpgrade> m_ServiceUpgradeLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.Hospital> m_HospitalLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.School> m_SchoolLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.PoliceStation> m_PoliceStationLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.FireStation> m_FireStationLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.Park> m_ParkLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.DeathcareFacility> m_DeathcareFacilityLookup;
            [ReadOnly] public ComponentLookup<Game.Buildings.GarbageFacility> m_GarbageFacilityLookup;
            [ReadOnly] public ComponentLookup<Game.Prefabs.SchoolData> m_SchoolDataLookup;
            [ReadOnly] public BufferLookup<Game.Buildings.Student> m_StudentLookup;
            [ReadOnly] public ComponentLookup<Abandoned> m_AbandonedLookup;
            [ReadOnly] public ComponentLookup<Destroyed> m_DestroyedLookup;
            [ReadOnly] public ComponentLookup<UnderConstruction> m_UnderConstructionLookup;
            [ReadOnly] public BufferLookup<InstalledUpgrade> m_InstalledUpgradeLookup;
            [ReadOnly] public ComponentLookup<Geometry> m_GeometryLookup;
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
                    if (m_AbandonedLookup.HasComponent(bEnt) || m_DestroyedLookup.HasComponent(bEnt) || m_UnderConstructionLookup.HasComponent(bEnt) || m_ParkLookup.HasComponent(prEnt)) continue;

                    DistrictStats stats = default;

                    bool hasResidentialSlots = m_BuildingPropertyDataLookup.TryGetComponent(prEnt, out var resPropData) && resPropData.m_ResidentialProperties > 0;
                    bool isRes = m_ResidentialPropertyLookup.HasComponent(bEnt) || m_ResidentialPropertyLookup.HasComponent(prEnt) || hasResidentialSlots;

                    // Renter Fallback for mixed-use: If any renter is a Household, it's a residential/mixed building.
                    if (!isRes && m_RenterLookup.TryGetBuffer(bEnt, out var renterCheck))
                    {
                        for (int r = 0; r < renterCheck.Length; r++)
                        {
                            if (m_HouseholdLookup.HasComponent(renterCheck[r].m_Renter)) { isRes = true; break; }
                        }
                    }

                    bool isCom = m_CommercialPropertyLookup.HasComponent(bEnt) || m_CommercialPropertyLookup.HasComponent(prEnt);
                    bool isOff = m_OfficePropertyLookup.HasComponent(bEnt) || m_OfficePropertyLookup.HasComponent(prEnt);
                    bool isInd = m_IndustrialPropertyLookup.HasComponent(bEnt) || m_IndustrialPropertyLookup.HasComponent(prEnt);
                    bool isStor = m_StorageCompanyLookup.HasComponent(bEnt) || m_StorageCompanyLookup.HasComponent(prEnt);

                    // Check renters for storage companies
                    if (!isStor && m_RenterLookup.TryGetBuffer(bEnt, out var bRenters))
                    {
                        for (int r = 0; r < bRenters.Length; r++)
                        {
                            if (m_StorageCompanyLookup.HasComponent(bRenters[r].m_Renter))
                            {
                                isStor = true;
                                break;
                            }
                        }
                    }

                    bool isSvc = m_ServiceUpgradeLookup.HasComponent(bEnt) || m_HospitalLookup.HasComponent(bEnt) || m_SchoolLookup.HasComponent(bEnt) || m_PoliceStationLookup.HasComponent(bEnt) || m_FireStationLookup.HasComponent(bEnt) || m_ParkLookup.HasComponent(prEnt) || m_DeathcareFacilityLookup.HasComponent(bEnt) || m_GarbageFacilityLookup.HasComponent(bEnt);
                    
                    if (isSvc) stats.svc++;

                    if (isRes)
                    {
                        stats.res++;
                        if (m_BuildingPropertyDataLookup.TryGetComponent(prEnt, out var propData))
                        {
                            stats.householdCap += propData.m_ResidentialProperties;
                        }
                    }

                    // Count pure business properties only (exclude mixed-use residential buildings).
                    if (!isRes)
                    {
                        bool isBusinessProperty = false;
                        if (isStor)
                        {
                            stats.storProp++;
                            isBusinessProperty = true;
                        }
                        else if (isCom)
                        {
                            stats.comProp++;
                            isBusinessProperty = true;
                        }
                        else if (isOff)
                        {
                            stats.offProp++;
                            isBusinessProperty = true;
                        }
                        else if (isInd)
                        {
                            stats.indProp++;
                            isBusinessProperty = true;
                        }

                        if (isBusinessProperty && !isSvc) stats.biz++;
                    }

                    if (isRes)
                    {
                        if (isCom || isOff || isInd || isStor) stats.mixedProp++;
                        else stats.resProp++;
                    }

                    // Household processing moved to UpdateHouseholdStatsJob to fix the In-Transit gap

                    // SACRED EMPLOYEE LOGIC (DO NOT TOUCH)
                    NativeList<Entity> workplaceEntities = new NativeList<Entity>(16, Allocator.Temp);
                    if (m_WorkProviderLookup.HasComponent(bEnt)) workplaceEntities.Add(bEnt);
                    if (m_RenterLookup.TryGetBuffer(bEnt, out var workRenters))
                    {
                        for (int r = 0; r < workRenters.Length; r++)
                        {
                            if (m_WorkProviderLookup.HasComponent(workRenters[r].m_Renter)) workplaceEntities.Add(workRenters[r].m_Renter);
                        }
                    }
                    if (m_InstalledUpgradeLookup.TryGetBuffer(bEnt, out var upgrades))
                    {
                        for (int u = 0; u < upgrades.Length; u++)
                        {
                            Entity upgradeEnt = upgrades[u].m_Upgrade;
                            if (m_WorkProviderLookup.HasComponent(upgradeEnt)) workplaceEntities.Add(upgradeEnt);
                            if (m_RenterLookup.TryGetBuffer(upgradeEnt, out var upgRenters))
                            {
                                for (int r = 0; r < upgRenters.Length; r++)
                                {
                                    if (m_WorkProviderLookup.HasComponent(upgRenters[r].m_Renter)) workplaceEntities.Add(upgRenters[r].m_Renter);
                                }
                            }
                        }
                    }

                    for (int wIdx = 0; wIdx < workplaceEntities.Length; wIdx++)
                    {
                        Entity workEntity = workplaceEntities[wIdx];
                        Entity workPrefab = m_PrefabRefLookup.HasComponent(workEntity) ? m_PrefabRefLookup[workEntity].m_Prefab : Entity.Null;
                        bool hasWorkplaceData = workPrefab != Entity.Null && m_WorkplaceDataLookup.HasComponent(workPrefab);

                        if (m_WorkProviderLookup.TryGetComponent(workEntity, out var wp))
                        {
                            stats.maxWorkers += wp.m_MaxWorkers;

                            if (hasWorkplaceData)
                            {
                                var wpd = m_WorkplaceDataLookup[workPrefab];
                                int max = wp.m_MaxWorkers;
                                int buildingLevel = m_SpawnableLookup.HasComponent(prEnt) ? m_SpawnableLookup[prEnt].m_Level : 1;
                                var workplaces = EconomyUtils.CalculateNumberOfWorkplaces(max, wpd.m_Complexity, buildingLevel);
                                stats.workerUneducatedMax += workplaces.m_Uneducated;
                                stats.workerPoorlyEducatedMax += workplaces.m_PoorlyEducated;
                                stats.workerEducatedMax += workplaces.m_Educated;
                                stats.workerWellEducatedMax += workplaces.m_WellEducated;
                                stats.workerHighlyEducatedMax += workplaces.m_HighlyEducated;
                            }
                        }
                        
                        if (hasWorkplaceData && m_EmployeeLookup.TryGetBuffer(workEntity, out var employees))
                        {
                            stats.workers += employees.Length;
                            for (int e = 0; e < employees.Length; e++)
                            {
                                Entity workerEnt = employees[e].m_Worker;
                                int workerEdu = m_WorkerLookup.TryGetComponent(workerEnt, out var workerData) ? (int)workerData.m_Level : (m_CitizenLookup.TryGetComponent(workerEnt, out var workerCitizen) ? workerCitizen.GetEducationLevel() : 0);
                                switch (workerEdu)
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
                    workplaceEntities.Dispose();

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

                    if (m_SpawnableLookup.HasComponent(prEnt)) {
                        var sd = m_SpawnableLookup[prEnt];
                        stats.buildingLevelSum += sd.m_Level;
                        stats.buildingLevelSamples++;
                    }

                    if (m_SchoolLookup.HasComponent(bEnt) && m_SchoolDataLookup.TryGetComponent(prEnt, out var schoolData))
                    {
                        int level = (int)schoolData.m_EducationLevel;
                        if (m_InstalledUpgradeLookup.TryGetBuffer(bEnt, out var upgradesSchool))
                        {
                            UpgradeUtils.CombineStats(ref schoolData, upgradesSchool, ref m_PrefabRefLookup, ref m_SchoolDataLookup);
                        }
                        int cap = schoolData.m_StudentCapacity;
                        int enrolled = m_StudentLookup.HasBuffer(bEnt) ? m_StudentLookup[bEnt].Length : 0;
                        
                        switch (level)
                        {
                            case 1: stats.elemCapacity += cap; stats.elemEnrolled += enrolled; break;
                            case 2: stats.hsCapacity += cap; stats.hsEnrolled += enrolled; break;
                            case 3: stats.collegeCapacity += cap; stats.collegeEnrolled += enrolled; break;
                            case 4: stats.uniCapacity += cap; stats.uniEnrolled += enrolled; break;
                        }
                    }

                    // Area and Land Value
                    if (m_GeometryLookup.TryGetComponent(bEnt, out var geom)) stats.area += geom.m_SurfaceArea;
                    // Game.Net.LandValue is on the road edge entity, not the building itself.
                    if (m_BuildingLookup.TryGetComponent(bEnt, out var building) &&
                        building.m_RoadEdge != Entity.Null &&
                        m_LandValueLookup.TryGetComponent(building.m_RoadEdge, out var lv)) {
                        stats.totalLandValue += lv.m_LandValue;
                        stats.landValueSamples++;
                    }

                    if (stats.res != 0 || stats.biz != 0 || stats.svc != 0 || stats.households != 0 || stats.workers != 0 || stats.upkeep != 0)
                    {
                        m_Stream.Write(new DistrictDelta { district = district, stats = stats });
                    }
                }
                m_Stream.EndForEachIndex();
            }
        }

        [BurstCompile]
        private struct UpdateCitizenStatsJob : IJobChunk
        {
            [ReadOnly] public EntityTypeHandle m_EntityHandle;
            [ReadOnly] public ComponentTypeHandle<Citizen> m_CitizenHandle;
            [ReadOnly] public ComponentLookup<CurrentDistrict> m_CurrentDistrictLookup;
            [ReadOnly] public ComponentLookup<HouseholdMember> m_HouseholdMemberLookup;
            [ReadOnly] public ComponentLookup<Household> m_HouseholdLookup;
            [ReadOnly] public ComponentLookup<PropertyRenter> m_PropertyRenterLookup;
            [ReadOnly] public ComponentLookup<Deleted> m_DeletedLookup;
            [ReadOnly] public ComponentLookup<Destroyed> m_DestroyedLookup;
            [ReadOnly] public ComponentLookup<UnderConstruction> m_UnderConstructionLookup;
            [ReadOnly] public ComponentLookup<MovingAway> m_MovingAwayLookup;
            public NativeStream.Writer m_Stream;

            public void Execute(in ArchetypeChunk chunk, int unfilteredChunkIndex, bool useEnabledMask, in Unity.Burst.Intrinsics.v128 chunkEnabledMask)
            {
                var entities = chunk.GetNativeArray(m_EntityHandle);
                var citizens = chunk.GetNativeArray(ref m_CitizenHandle);
                m_Stream.BeginForEachIndex(unfilteredChunkIndex);

                for (int i = 0; i < entities.Length; i++)
                {
                    Entity cEnt = entities[i];
                    Citizen citizen = citizens[i];
                    Entity district = Entity.Null;
                    Entity household = m_HouseholdMemberLookup.TryGetComponent(cEnt, out var member) ? member.m_Household : Entity.Null;

                    if (household != Entity.Null && m_HouseholdLookup.TryGetComponent(household, out var hh) && !m_DeletedLookup.HasComponent(household))
                    {
                        bool buildingValid = true;
                        if (m_PropertyRenterLookup.TryGetComponent(household, out var pr)) 
                        {
                            if (m_CurrentDistrictLookup.TryGetComponent(pr.m_Property, out var cd)) district = cd.m_District;
                            if (m_DestroyedLookup.HasComponent(pr.m_Property) || m_UnderConstructionLookup.HasComponent(pr.m_Property)) buildingValid = false;
                        }
                        else if (m_CurrentDistrictLookup.TryGetComponent(cEnt, out var citizenCd)) district = citizenCd.m_District;

                        if (buildingValid) 
                        {
                            DistrictStats stats = default;
                            bool isMovingAway = m_MovingAwayLookup.HasComponent(cEnt) || m_MovingAwayLookup.HasComponent(household);
                            if (isMovingAway) stats.movingAway = 1;

                            if ((hh.m_Flags & HouseholdFlags.Tourist) != 0)
                            {
                                stats.tourists = 1;
                            }
                            else
                            {
                                stats.residents = 1;
                                stats.citizenCount = 1;
                                stats.totalHappiness = citizen.Happiness;
                                switch (citizen.GetAge())
                                {
                                    case CitizenAge.Child: stats.children = 1; break;
                                    case CitizenAge.Teen: stats.teens = 1; break;
                                    case CitizenAge.Adult: stats.adults = 1; break;
                                    case CitizenAge.Elderly: stats.seniors = 1; break;
                                }
                                switch (citizen.GetEducationLevel())
                                {
                                    case 0: stats.eduUneducated = 1; break;
                                    case 1: stats.eduPoorlyEducated = 1; break;
                                    case 2: stats.eduEducated = 1; break;
                                    case 3: stats.eduWellEducated = 1; break;
                                    case 4: stats.eduHighlyEducated = 1; break;
                                }
                            }
                            if (district != Entity.Null) m_Stream.Write(new DistrictDelta { district = district, stats = stats });
                        }
                    }
                    // Limbo Fallback: catch residents not yet assigned to a household (The Cherry Brook Fix)
                    else if (m_CurrentDistrictLookup.TryGetComponent(cEnt, out var citizenCd))
                    {
                        DistrictStats stats = default;
                        stats.residents = 1;
                        stats.adults = 1;
                        m_Stream.Write(new DistrictDelta { district = citizenCd.m_District, stats = stats });
                    }
                }
                m_Stream.EndForEachIndex();
            }
        }

        [BurstCompile]
        private struct UpdateHouseholdStatsJob : IJobChunk
        {
            [ReadOnly] public EntityTypeHandle m_EntityHandle;
            [ReadOnly] public ComponentTypeHandle<Household> m_HouseholdHandle;
            [ReadOnly] public ComponentLookup<PropertyRenter> m_PropertyRenterLookup;
            [ReadOnly] public ComponentLookup<CurrentDistrict> m_CurrentDistrictLookup;
            [ReadOnly] public ComponentLookup<Building> m_BuildingLookup;
            [ReadOnly] public ComponentLookup<Destroyed> m_DestroyedLookup;
            [ReadOnly] public ComponentLookup<UnderConstruction> m_UnderConstructionLookup;
            [ReadOnly] public ComponentLookup<ResidentialProperty> m_ResidentialPropertyLookup;
            [ReadOnly] public ComponentLookup<PrefabRef> m_PrefabRefLookup;
            [ReadOnly] public BufferLookup<Resources> m_ResourcesLookup;
            [ReadOnly] public BufferLookup<HouseholdCitizen> m_HouseholdCitizenLookup;
            [ReadOnly] public ComponentLookup<Worker> m_WorkerLookup;
            [ReadOnly] public ComponentLookup<Citizen> m_CitizenLookup;
            [ReadOnly] public ComponentLookup<HealthProblem> m_HealthProblemLookup;
            [ReadOnly] public EconomyParameterData m_EconomyParameters;
            [ReadOnly] public NativeArray<int> m_TaxRates;
            public NativeStream.Writer m_Stream;

            public void Execute(in ArchetypeChunk chunk, int unfilteredChunkIndex, bool useEnabledMask, in Unity.Burst.Intrinsics.v128 chunkEnabledMask)
            {
                var entities = chunk.GetNativeArray(m_EntityHandle);
                var households = chunk.GetNativeArray(ref m_HouseholdHandle);
                m_Stream.BeginForEachIndex(unfilteredChunkIndex);
                for (int i = 0; i < entities.Length; i++)
                {
                    Entity householdEnt = entities[i];
                    Household householdData = households[i];
                    
                    if (m_PropertyRenterLookup.TryGetComponent(householdEnt, out var occupiedProperty))
                    {
                        Entity rentedProperty = occupiedProperty.m_Property;
                        if (rentedProperty != Entity.Null && m_BuildingLookup.HasComponent(rentedProperty) && m_CurrentDistrictLookup.TryGetComponent(rentedProperty, out var cd))
                        {
                            if (m_DestroyedLookup.HasComponent(rentedProperty) || m_UnderConstructionLookup.HasComponent(rentedProperty)) continue;

                            DistrictStats stats = default;
                            
                            stats.households = 1;
                            
                            if (m_ResourcesLookup.TryGetBuffer(householdEnt, out var resources)) stats.totalWealth = EconomyUtils.GetHouseholdTotalWealth(householdData, resources);
                            if (m_HouseholdCitizenLookup.TryGetBuffer(householdEnt, out var hCitizens)) stats.totalIncome = EconomyUtils.GetHouseholdIncome(hCitizens, ref m_WorkerLookup, ref m_CitizenLookup, ref m_HealthProblemLookup, ref m_EconomyParameters, m_TaxRates);
                            stats.totalRent = occupiedProperty.m_Rent;
                            
                            m_Stream.Write(new DistrictDelta { district = cd.m_District, stats = stats });
                        }
                    }
                }
                m_Stream.EndForEachIndex();
            }
        }

        [BurstCompile]
        private struct UpdatePetStatsJob : IJobChunk
        {
            [ReadOnly] public EntityTypeHandle m_EntityHandle;
            [ReadOnly] public ComponentTypeHandle<HouseholdPet> m_PetHandle;
            [ReadOnly] public ComponentLookup<PropertyRenter> m_PropertyRenterLookup;
            [ReadOnly] public ComponentLookup<CurrentDistrict> m_CurrentDistrictLookup;
            public NativeStream.Writer m_Stream;

            public void Execute(in ArchetypeChunk chunk, int unfilteredChunkIndex, bool useEnabledMask, in Unity.Burst.Intrinsics.v128 chunkEnabledMask)
            {
                var entities = chunk.GetNativeArray(m_EntityHandle);
                var pets = chunk.GetNativeArray(ref m_PetHandle);
                m_Stream.BeginForEachIndex(unfilteredChunkIndex);
                for (int i = 0; i < pets.Length; i++)
                {
                    Entity household = pets[i].m_Household;
                    Entity district = Entity.Null;
                    if (household != Entity.Null && m_PropertyRenterLookup.TryGetComponent(household, out var pr) && m_CurrentDistrictLookup.TryGetComponent(pr.m_Property, out var cd)) district = cd.m_District;
                    else if (m_CurrentDistrictLookup.TryGetComponent(household, out var householdCd)) district = householdCd.m_District;

                    if (district != Entity.Null)
                    {
                        DistrictStats stats = default;
                        stats.pets = 1;
                        m_Stream.Write(new DistrictDelta { district = district, stats = stats });
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
                        if (m_StatsMap.TryGetValue(delta.district, out var existing)) { existing.Add(delta.stats); m_StatsMap[delta.district] = existing; }
                        else m_StatsMap.TryAdd(delta.district, delta.stats);
                    }
                    m_Stream.EndForEachIndex();
                }
            }
        }

        protected override void OnCreate()
        {
            base.OnCreate();
            _nameSystem = World.GetOrCreateSystemManaged<NameSystem>();
            _taxingProductionUISystem = World.GetOrCreateSystemManaged<TaxingProductionUISystem>();
            _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
            _citySystem = World.GetOrCreateSystemManaged<CitySystem>();
            _taxSystem = World.GetOrCreateSystemManaged<TaxSystem>();
            _countHouseholdDataSystem = World.GetOrCreateSystemManaged<CountHouseholdDataSystem>();
            _cityConfigurationSystem = World.GetOrCreateSystemManaged<CityConfigurationSystem>();
            _mapMetadataSystem = World.GetOrCreateSystemManaged<MapMetadataSystem>();
            _endFrameBarrier = World.GetOrCreateSystemManaged<Game.EndFrameBarrier>();
            _policyEventArchetype = EntityManager.CreateArchetype(ComponentType.ReadWrite<Game.Common.Event>(), ComponentType.ReadWrite<Game.Policies.Modify>());

            _districtQuery = GetEntityQuery(ComponentType.ReadOnly<District>(), ComponentType.ReadOnly<PrefabRef>(), ComponentType.Exclude<Deleted>());
            _buildingQuery = GetEntityQuery(ComponentType.ReadOnly<Building>(), ComponentType.ReadOnly<PrefabRef>(), ComponentType.ReadOnly<CurrentDistrict>(), ComponentType.Exclude<Deleted>());

            // Remove the hard HouseholdMember requirement to catch limbo citizens
            _citizenQuery = GetEntityQuery(ComponentType.ReadOnly<Citizen>(), ComponentType.Exclude<Deleted>());

            _petQuery = GetEntityQuery(ComponentType.ReadOnly<HouseholdPet>(), ComponentType.Exclude<Deleted>());
            _householdQuery = GetEntityQuery(ComponentType.ReadOnly<Household>(), ComponentType.ReadOnly<PropertyRenter>(), ComponentType.Exclude<Deleted>());
            _economyParameterQuery = GetEntityQuery(ComponentType.ReadOnly<EconomyParameterData>());
            _educationParameterQuery = GetEntityQuery(ComponentType.ReadOnly<EducationParameterData>());

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
        }

        protected override void OnUpdate()
        {
            if (!IsSystemActive)
            {
                this.Dependency = Dependency;
                return;
            }

            base.OnUpdate();

            // ── Gate 1: UI Panel Visibility ──────────────────────────────────────────────
            // If the AdvancedTPM window is closed there is zero reason to accumulate,
            // schedule, or serialize anything. This is the cheapest possible check and
            // must remain the very first evaluation in this method. When the panel is
            // hidden the system consumes 0ms of main-thread budget per frame.
            if (_taxingProductionUISystem == null || !_taxingProductionUISystem.IsPanelOpen || _taxingProductionUISystem.ActiveViewMode != "district")
            {
                m_WasPanelOpen = false;
                this.Dependency = Dependency;
                return;
            }

            if (!m_WasPanelOpen)
            {
                m_DataIsDirty = true;
                m_WasPanelOpen = true;
            }

            if (m_SimulationSystem == null) m_SimulationSystem = World.GetExistingSystemManaged<SimulationSystem>();
            if (m_SimulationSystem == null || m_SimulationSystem.frameIndex < 1000)
            {
                // Propagate dependency cleanly on skipped frames — no jobs scheduled here.
                this.Dependency = Dependency;
                return;
            }

            // ── Async Job Completion Check ────────────────────────────────────────────
            // Instead of blocking with .Complete() on the main thread, we check IsCompleted
            // on every frame. When the background job completes, we deserialize its results.
            if (m_JobActive)
            {
                if (m_ActiveJobHandle.IsCompleted)
                {
                    try
                    {
                        m_ActiveJobHandle.Complete();
                        ProcessAndFormatDistrictData();
                    }
                    finally
                    {
                        CleanupActiveJobResources();
                        m_JobActive = false;
                        m_DataIsDirty = false;
                    }
                }
                else
                {
                    // Job is still running in background. Early exit and try again next frame.
                    this.Dependency = Dependency;
                    return;
                }
            }

            // ── Gate 2: Time Throttle ─────────────────────────────────────────────────
            m_TimeSinceLastUpdate += this.World.Time.DeltaTime;
            
            // Every 10 seconds, force a refresh even if no interaction occurred
            if (m_TimeSinceLastUpdate >= 10.0f)
            {
                m_DataIsDirty = true;
                m_TimeSinceLastUpdate = 0f;
            }

            // Only process if dirty AND panel is open
            if (m_DataIsDirty && _taxingProductionUISystem.IsPanelOpen)
            {
                UpdatePolicyPrefabs();
                StartDistrictDataJob();
                m_DataIsDirty = false;
            }
            else
            {
                this.Dependency = Dependency;
            }
        }

        protected override void OnDestroy()
        {
            if (m_JobActive)
            {
                m_ActiveJobHandle.Complete();
            }
            CleanupActiveJobResources();
            base.OnDestroy();
        }



        private void UpdatePolicyPrefabs()
        {
            if (_policyPrefabQuery.IsEmptyIgnoreFilter) return;

            // Reuse pre-allocated buffer — avoids heap allocation of a new List every tick.
            _policyBuffer.Clear();

            var entities = _policyPrefabQuery.ToEntityArray(Allocator.Temp);
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

                        bool isCityPolicy = _prefabSystem.EntityManager.HasComponent<CityOptionData>(entity) ||
                                            _prefabSystem.EntityManager.HasComponent<CityModifierData>(entity);
                        bool isDistrictPolicy = _prefabSystem.EntityManager.HasComponent<DistrictOptionData>(entity) ||
                                                _prefabSystem.EntityManager.HasComponent<DistrictModifierData>(entity);

                        _policyBuffer.Add($"{{\"entityKey\":\"{key}\",\"name\":\"{name}\",\"icon\":\"{EscapeJson(icon)}\",\"isCity\":{isCityPolicy.ToString().ToLower()},\"isDistrict\":{isDistrictPolicy.ToString().ToLower()}}}");
                    }
                }
            }
            finally
            {
                entities.Dispose();
            }

            string newPoliciesData = "[" + string.Join(",", _policyBuffer) + "]";
            if (newPoliciesData != m_LastDistrictPoliciesData)
            {
                _districtPoliciesData.Update(newPoliciesData);
                m_LastDistrictPoliciesData = newPoliciesData;
            }
        }

        private void StartDistrictDataJob()
        {
            if (m_JobActive) return;

            if (!_economyParameterQuery.TryGetSingleton<EconomyParameterData>(out var economyParameters)) return;
            var taxRates = _taxSystem.GetTaxRates();

            // Allocate persistent collections for background job
            m_ActiveStatsMap = new NativeParallelHashMap<Entity, DistrictStats>(100, Allocator.Persistent);
            m_Stream1 = new NativeStream(_buildingQuery.CalculateChunkCount(), Allocator.Persistent);
            m_Stream2 = new NativeStream(_citizenQuery.CalculateChunkCount(), Allocator.Persistent);
            m_Stream3 = new NativeStream(_petQuery.CalculateChunkCount(), Allocator.Persistent);
            m_Stream4 = new NativeStream(_householdQuery.CalculateChunkCount(), Allocator.Persistent);

            bool scheduled = false;
            try
            {
                var bJob = new UpdateDistrictDataJob
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
                    m_LandValueLookup = SystemAPI.GetComponentLookup<Game.Net.LandValue>(true),
                    m_BuildingLookup = SystemAPI.GetComponentLookup<Building>(true),
                    m_WorkplaceDataLookup = SystemAPI.GetComponentLookup<WorkplaceData>(true),
                    m_EmployeeLookup = SystemAPI.GetBufferLookup<Employee>(true),
                    m_WorkerLookup = SystemAPI.GetComponentLookup<Worker>(true),
                    m_PrefabRefLookup = SystemAPI.GetComponentLookup<PrefabRef>(true),
                    m_CommercialPropertyLookup = SystemAPI.GetComponentLookup<CommercialProperty>(true),
                    m_OfficePropertyLookup = SystemAPI.GetComponentLookup<OfficeProperty>(true),
                    m_IndustrialPropertyLookup = SystemAPI.GetComponentLookup<IndustrialProperty>(true),
                    m_StorageCompanyLookup = SystemAPI.GetComponentLookup<Game.Companies.StorageCompany>(true),
                    m_SpawnableLookup = SystemAPI.GetComponentLookup<SpawnableBuildingData>(true),
                    m_ServiceUpgradeLookup = SystemAPI.GetComponentLookup<Game.Buildings.ServiceUpgrade>(true),
                    m_HospitalLookup = SystemAPI.GetComponentLookup<Game.Buildings.Hospital>(true),
                    m_SchoolLookup = SystemAPI.GetComponentLookup<Game.Buildings.School>(true),
                    m_PoliceStationLookup = SystemAPI.GetComponentLookup<Game.Buildings.PoliceStation>(true),
                    m_FireStationLookup = SystemAPI.GetComponentLookup<Game.Buildings.FireStation>(true),
                    m_ParkLookup = SystemAPI.GetComponentLookup<Game.Buildings.Park>(true),
                    m_DeathcareFacilityLookup = SystemAPI.GetComponentLookup<Game.Buildings.DeathcareFacility>(true),
                    m_GarbageFacilityLookup = SystemAPI.GetComponentLookup<Game.Buildings.GarbageFacility>(true),
                    m_SchoolDataLookup = SystemAPI.GetComponentLookup<SchoolData>(true),
                    m_StudentLookup = SystemAPI.GetBufferLookup<Game.Buildings.Student>(true),
                    m_AbandonedLookup = SystemAPI.GetComponentLookup<Abandoned>(true),
                    m_DestroyedLookup = SystemAPI.GetComponentLookup<Destroyed>(true),
                    m_UnderConstructionLookup = SystemAPI.GetComponentLookup<UnderConstruction>(true),
                    m_InstalledUpgradeLookup = SystemAPI.GetBufferLookup<InstalledUpgrade>(true),
                    m_GeometryLookup = SystemAPI.GetComponentLookup<Geometry>(true),
                    m_EconomyParameters = economyParameters,
                    m_TaxRates = taxRates,
                    m_Stream = m_Stream1.AsWriter()
                };
                var cJob = new UpdateCitizenStatsJob { m_EntityHandle = SystemAPI.GetEntityTypeHandle(), m_CitizenHandle = SystemAPI.GetComponentTypeHandle<Citizen>(true), m_CurrentDistrictLookup = SystemAPI.GetComponentLookup<CurrentDistrict>(true), m_HouseholdMemberLookup = SystemAPI.GetComponentLookup<HouseholdMember>(true), m_HouseholdLookup = SystemAPI.GetComponentLookup<Household>(true), m_PropertyRenterLookup = SystemAPI.GetComponentLookup<PropertyRenter>(true), m_DeletedLookup = SystemAPI.GetComponentLookup<Deleted>(true), m_DestroyedLookup = SystemAPI.GetComponentLookup<Destroyed>(true), m_UnderConstructionLookup = SystemAPI.GetComponentLookup<UnderConstruction>(true), m_MovingAwayLookup = SystemAPI.GetComponentLookup<MovingAway>(true), m_Stream = m_Stream2.AsWriter() };
                var pJob = new UpdatePetStatsJob { m_EntityHandle = SystemAPI.GetEntityTypeHandle(), m_PetHandle = SystemAPI.GetComponentTypeHandle<HouseholdPet>(true), m_PropertyRenterLookup = SystemAPI.GetComponentLookup<PropertyRenter>(true), m_CurrentDistrictLookup = SystemAPI.GetComponentLookup<CurrentDistrict>(true), m_Stream = m_Stream3.AsWriter() };
                var hhJob = new UpdateHouseholdStatsJob { m_EntityHandle = SystemAPI.GetEntityTypeHandle(), m_HouseholdHandle = SystemAPI.GetComponentTypeHandle<Household>(true), m_PropertyRenterLookup = SystemAPI.GetComponentLookup<PropertyRenter>(true), m_CurrentDistrictLookup = SystemAPI.GetComponentLookup<CurrentDistrict>(true), m_BuildingLookup = SystemAPI.GetComponentLookup<Building>(true), m_DestroyedLookup = SystemAPI.GetComponentLookup<Destroyed>(true), m_UnderConstructionLookup = SystemAPI.GetComponentLookup<UnderConstruction>(true), m_ResidentialPropertyLookup = SystemAPI.GetComponentLookup<ResidentialProperty>(true), m_PrefabRefLookup = SystemAPI.GetComponentLookup<PrefabRef>(true), m_ResourcesLookup = SystemAPI.GetBufferLookup<Resources>(true), m_HouseholdCitizenLookup = SystemAPI.GetBufferLookup<HouseholdCitizen>(true), m_WorkerLookup = SystemAPI.GetComponentLookup<Worker>(true), m_CitizenLookup = SystemAPI.GetComponentLookup<Citizen>(true), m_HealthProblemLookup = SystemAPI.GetComponentLookup<HealthProblem>(true), m_EconomyParameters = economyParameters, m_TaxRates = taxRates, m_Stream = m_Stream4.AsWriter() };

                var h1 = JobHandle.CombineDependencies(bJob.ScheduleParallel(_buildingQuery, Dependency), cJob.ScheduleParallel(_citizenQuery, Dependency));
                var h2 = JobHandle.CombineDependencies(pJob.ScheduleParallel(_petQuery, Dependency), hhJob.ScheduleParallel(_householdQuery, Dependency));
                var h = JobHandle.CombineDependencies(h1, h2);

                m_ActiveJobHandle = new AggregateStatsJob { m_Stream = m_Stream4.AsReader(), m_StatsMap = m_ActiveStatsMap }
                    .Schedule(new AggregateStatsJob { m_Stream = m_Stream3.AsReader(), m_StatsMap = m_ActiveStatsMap }
                    .Schedule(new AggregateStatsJob { m_Stream = m_Stream2.AsReader(), m_StatsMap = m_ActiveStatsMap }
                    .Schedule(new AggregateStatsJob { m_Stream = m_Stream1.AsReader(), m_StatsMap = m_ActiveStatsMap }
                    .Schedule(h))));

                scheduled = true;
                m_JobActive = true;
                this.Dependency = m_ActiveJobHandle;
            }
            catch (Exception ex)
            {
                Mod.log?.Error($"Failed to schedule District browser jobs: {ex}");
                throw;
            }
            finally
            {
                if (!scheduled)
                {
                    CleanupActiveJobResources();
                    m_JobActive = false;
                }
            }
        }

        private void CleanupActiveJobResources()
        {
            if (m_ActiveStatsMap.IsCreated) m_ActiveStatsMap.Dispose();
            if (m_Stream1.IsCreated) m_Stream1.Dispose();
            if (m_Stream2.IsCreated) m_Stream2.Dispose();
            if (m_Stream3.IsCreated) m_Stream3.Dispose();
            if (m_Stream4.IsCreated) m_Stream4.Dispose();
        }

        private void ForceRefreshData()
        {
            m_DataIsDirty = true;
            m_TimeSinceLastUpdate = 10.0f; // Force ticker to trigger next update frame
        }

        private void ProcessAndFormatDistrictData()
        {
            // Reuse pre-allocated item buffer — no heap allocation of a new List per update.
            _itemBuffer.Clear();

            DistrictStats cityStats = default;
            using (var kvp = m_ActiveStatsMap.GetKeyValueArrays(Allocator.Temp)) { for (int i = 0; i < kvp.Keys.Length; i++) cityStats.Add(kvp.Values[i]); }

            if (!_countHouseholdDataSystem.IsCountDataNotReady())
            {
                var cd = _countHouseholdDataSystem.GetHouseholdCountData();
                // Override demographic counts using the global counter
                cityStats.children = cd.m_ChildrenCount;
                cityStats.teens = cd.m_TeenCount;
                cityStats.adults = cd.m_AdultCount;
                cityStats.seniors = cd.m_SeniorCount;
                cityStats.eduUneducated = cd.m_UneducatedCount;
                cityStats.eduPoorlyEducated = cd.m_PoorlyEducatedCount;
                cityStats.eduEducated = cd.m_EducatedCount;
                cityStats.eduWellEducated = cd.m_WellEducatedCount;
                cityStats.eduHighlyEducated = cd.m_HighlyEducatedCount;
                cityStats.tourists = cd.m_TouristCitizenCount;
                cityStats.students = cd.m_StudentCount;
                cityStats.homeless = cd.m_HomelessCitizenCount;
            }

            // RESTORE FULL PAYLOAD FOR CITY
            
            // Reuse pre-allocated active-policies buffer — avoids per-district heap allocation.
            _activePoliciesBuffer.Clear();
            var cityPolicies = _activePoliciesBuffer;
            if (_citySystem.City != Entity.Null && EntityManager.HasBuffer<Game.Policies.Policy>(_citySystem.City))
            {
                var policies = EntityManager.GetBuffer<Game.Policies.Policy>(_citySystem.City, true);
                for (int i = 0; i < policies.Length; i++)
                {
                    if ((policies[i].m_Flags & Game.Policies.PolicyFlags.Active) != 0)
                        cityPolicies.Add($"\"{policies[i].m_Policy.Index},{policies[i].m_Policy.Version}\"");
                }
            }
            string cityDisplayName = _cityConfigurationSystem?.cityName;
            if (string.IsNullOrEmpty(cityDisplayName)) cityDisplayName = _mapMetadataSystem?.mapName;
            if (string.IsNullOrEmpty(cityDisplayName)) cityDisplayName = "City";

            double cityAvgWealth = cityStats.households > 0 ? (double)cityStats.totalWealth / cityStats.households : 0;
            double cityAvgIncome = cityStats.households > 0 ? (double)cityStats.totalIncome / cityStats.households : 0;
            double cityAvgRent = cityStats.households > 0 ? (double)cityStats.totalRent / cityStats.households : 0;
            int cityAvgHappiness = cityStats.citizenCount > 0 ? (int)(cityStats.totalHappiness / cityStats.citizenCount) : 0;
            int cityPureBusiness = cityStats.comProp + cityStats.offProp + cityStats.indProp + cityStats.storProp;
            double avgBuildingLevelCity = cityStats.buildingLevelSamples > 0 ? (double)cityStats.buildingLevelSum / cityStats.buildingLevelSamples : 0;

            int gameAllCitizens = 0;
            int gameCommuters = 0;
            int gameMovingAwayHouseholds = 0;
            int cityResidentsLive = cityStats.residents;

            if (_countHouseholdDataSystem != null && !_countHouseholdDataSystem.IsCountDataNotReady())
            {
                var cd = _countHouseholdDataSystem.GetHouseholdCountData();
                cityResidentsLive = cd.m_MovedInCitizenCount;
                gameCommuters = cd.m_CommuterHouseholdCount;
                gameMovingAwayHouseholds = cd.m_MovingAwayHouseholdCount;
                gameAllCitizens = cd.m_MovedInCitizenCount + cd.m_TouristCitizenCount + cd.m_CommuterHouseholdCount + cd.m_MovingAwayHouseholdCount;
            }
            cityStats.residents = cityResidentsLive;
            int cityPureRes = math.max(0, cityStats.res - cityStats.mixedProp);

            _itemBuffer.Add($"{{\"entityKey\":\"city\",\"name\":\"City\",\"isCity\":true,\"cityName\":\"{EscapeJson(cityDisplayName)}\",\"policies\":[{string.Join(",", cityPolicies)}],\"res\":{cityStats.res},\"svc\":{cityStats.svc},\"biz\":{cityPureBusiness},\"households\":{cityStats.households},\"householdCap\":{cityStats.householdCap},\"workers\":{cityStats.workers},\"maxWorkers\":{cityStats.maxWorkers},\"avgWealth\":{cityAvgWealth},\"avgIncome\":{cityAvgIncome},\"avgRent\":{cityAvgRent},\"avgHappiness\":{cityAvgHappiness},\"residents\":{cityStats.residents},\"tourists\":{cityStats.tourists},\"children\":{cityStats.children},\"teens\":{cityStats.teens},\"adults\":{cityStats.adults},\"seniors\":{cityStats.seniors},\"eduUneducated\":{cityStats.eduUneducated},\"eduPoorlyEducated\":{cityStats.eduPoorlyEducated},\"eduEducated\":{cityStats.eduEducated},\"eduWellEducated\":{cityStats.eduWellEducated},\"eduHighlyEducated\":{cityStats.eduHighlyEducated},\"workerUneducated\":{cityStats.workerUneducated},\"workerPoorlyEducated\":{cityStats.workerPoorlyEducated},\"workerEducated\":{cityStats.workerEducated},\"workerWellEducated\":{cityStats.workerWellEducated},\"workerHighlyEducated\":{cityStats.workerHighlyEducated},\"workerUneducatedMax\":{cityStats.workerUneducatedMax},\"workerPoorlyEducatedMax\":{cityStats.workerPoorlyEducatedMax},\"workerEducatedMax\":{cityStats.workerEducatedMax},\"workerWellEducatedMax\":{cityStats.workerWellEducatedMax},\"workerHighlyEducatedMax\":{cityStats.workerHighlyEducatedMax},\"elemCapacity\":{cityStats.elemCapacity},\"hsCapacity\":{cityStats.hsCapacity},\"collegeCapacity\":{cityStats.collegeCapacity},\"uniCapacity\":{cityStats.uniCapacity},\"elemEnrolled\":{cityStats.elemEnrolled},\"hsEnrolled\":{cityStats.hsEnrolled},\"collegeEnrolled\":{cityStats.collegeEnrolled},\"uniEnrolled\":{cityStats.uniEnrolled},\"elemEligible\":{(int)math.ceil(cityStats.elemEligible)},\"hsEligible\":{(int)math.ceil(cityStats.hsEligible)},\"collegeEligible\":{(int)math.ceil(cityStats.collegeEligible)},\"uniEligible\":{(int)math.ceil(cityStats.uniEligible)},\"localServices\":{cityStats.localServices},\"serviceMask\":{cityStats.serviceMask},\"propertyCount\":{cityStats.propertyCount},\"resProp\":{cityPureRes},\"comProp\":{cityStats.comProp},\"indProp\":{cityStats.indProp},\"offProp\":{cityStats.offProp},\"storProp\":{cityStats.storProp},\"mixedProp\":{cityStats.mixedProp},\"pets\":{cityStats.pets},\"deceased\":{cityStats.deceased},\"students\":{cityStats.students},\"movingAway\":{gameMovingAwayHouseholds},\"avgBuildingLevel\":{avgBuildingLevelCity},\"buildingLevelSamples\":{cityStats.buildingLevelSamples},\"totalLandValue\":{cityStats.totalLandValue},\"landValueSamples\":{cityStats.landValueSamples},\"homeless\":{cityStats.homeless},\"upkeep\":{cityStats.upkeep},\"resourceCost\":{cityStats.resources},\"feesPaid\":{cityStats.fees},\"area\":{cityStats.area},\"happinessFactors\":[],\"gameAllCitizens\":{gameAllCitizens},\"gameTourists\":{cityStats.tourists},\"gameCommuters\":{gameCommuters},\"gameMovingAway\":{gameMovingAwayHouseholds},\"gameEmployees\":{cityStats.workers}}}");

            // RESTORE FULL PAYLOAD FOR DISTRICTS
            // Reuse the pre-allocated per-district active-policies buffer — cleared per district,
            // never allocated fresh inside the loop, eliminating the previous per-district GC churn.
            var districtActivePolicies = _policyBuffer; // _policyBuffer is done being used above.

            var districtEntities = _districtQuery.ToEntityArray(Allocator.Temp);
            try
            {
                for (int di = 0; di < districtEntities.Length; di++)
                {
                    var e = districtEntities[di];
                    var s = m_ActiveStatsMap.TryGetValue(e, out var st) ? st : default;
                    double dAvgWealth = s.households > 0 ? (double)s.totalWealth / s.households : 0;
                    double dAvgIncome = s.households > 0 ? (double)s.totalIncome / s.households : 0;
                    double dAvgRent = s.households > 0 ? (double)s.totalRent / s.households : 0;
                    int dAvgHappiness = s.citizenCount > 0 ? (int)(s.totalHappiness / s.citizenCount) : 0;
                    double dAvgBuildingLevel = s.buildingLevelSamples > 0 ? (double)s.buildingLevelSum / s.buildingLevelSamples : 0;
                    int dBiz = s.comProp + s.offProp + s.indProp + s.storProp;
                    int dPureRes = math.max(0, s.res - s.mixedProp);

                    var key = $"{e.Index},{e.Version}";

                    // Clear the shared buffer — no new List<string> allocation per district.
                    districtActivePolicies.Clear();
                    if (EntityManager.HasBuffer<Game.Policies.Policy>(e))
                    {
                        var policies = EntityManager.GetBuffer<Game.Policies.Policy>(e, true);
                        for (int i = 0; i < policies.Length; i++)
                        {
                            if ((policies[i].m_Flags & Game.Policies.PolicyFlags.Active) != 0)
                                districtActivePolicies.Add($"\"{policies[i].m_Policy.Index},{policies[i].m_Policy.Version}\"");
                        }
                    }
                    _itemBuffer.Add($"{{\"entityKey\":\"{key}\",\"name\":\"{EscapeJson(_nameSystem.GetRenderedLabelName(e))}\",\"policies\":[{string.Join(",", districtActivePolicies)}],\"res\":{s.res},\"svc\":{s.svc},\"biz\":{dBiz},\"households\":{s.households},\"householdCap\":{s.householdCap},\"workers\":{s.workers},\"maxWorkers\":{s.maxWorkers},\"avgWealth\":{dAvgWealth},\"avgIncome\":{dAvgIncome},\"avgRent\":{dAvgRent},\"avgHappiness\":{dAvgHappiness},\"residents\":{s.residents},\"tourists\":{s.tourists},\"children\":{s.children},\"teens\":{s.teens},\"adults\":{s.adults},\"seniors\":{s.seniors},\"eduUneducated\":{s.eduUneducated},\"eduPoorlyEducated\":{s.eduPoorlyEducated},\"eduEducated\":{s.eduEducated},\"eduWellEducated\":{s.eduWellEducated},\"eduHighlyEducated\":{s.eduHighlyEducated},\"workerUneducated\":{s.workerUneducated},\"workerPoorlyEducated\":{s.workerPoorlyEducated},\"workerEducated\":{s.workerEducated},\"workerWellEducated\":{s.workerWellEducated},\"workerHighlyEducated\":{s.workerHighlyEducated},\"workerUneducatedMax\":{s.workerUneducatedMax},\"workerPoorlyEducatedMax\":{s.workerPoorlyEducatedMax},\"workerEducatedMax\":{s.workerEducatedMax},\"workerWellEducatedMax\":{s.workerWellEducatedMax},\"workerHighlyEducatedMax\":{s.workerHighlyEducatedMax},\"elemCapacity\":{s.elemCapacity},\"hsCapacity\":{s.hsCapacity},\"collegeCapacity\":{s.collegeCapacity},\"uniCapacity\":{s.uniCapacity},\"elemEnrolled\":{s.elemEnrolled},\"hsEnrolled\":{s.hsEnrolled},\"collegeEnrolled\":{s.collegeEnrolled},\"uniEnrolled\":{s.uniEnrolled},\"elemEligible\":{(int)math.ceil(s.elemEligible)},\"hsEligible\":{(int)math.ceil(s.hsEligible)},\"collegeEligible\":{(int)math.ceil(s.collegeEligible)},\"uniEligible\":{(int)math.ceil(s.uniEligible)},\"localServices\":{s.localServices},\"serviceMask\":{s.serviceMask},\"propertyCount\":{s.propertyCount},\"resProp\":{dPureRes},\"comProp\":{s.comProp},\"indProp\":{s.indProp},\"offProp\":{s.offProp},\"storProp\":{s.storProp},\"mixedProp\":{s.mixedProp},\"pets\":{s.pets},\"deceased\":{s.deceased},\"students\":{s.students},\"movingAway\":{s.movingAway},\"avgBuildingLevel\":{dAvgBuildingLevel},\"buildingLevelSamples\":{s.buildingLevelSamples},\"totalLandValue\":{s.totalLandValue},\"landValueSamples\":{s.landValueSamples},\"homeless\":{s.homeless},\"upkeep\":{s.upkeep},\"resourceCost\":{s.resources},\"feesPaid\":{s.fees},\"area\":{s.area},\"happinessFactors\":[]}}");
                }
            }
            finally
            {
                districtEntities.Dispose();
            }

            string newBrowserData = "[" + string.Join(",", _itemBuffer) + "]";
            if (newBrowserData != m_LastDistrictBrowserData)
            {
                _districtBrowserData.Update(newBrowserData);
                m_LastDistrictBrowserData = newBrowserData;
            }
        }

        private void ToggleDistrictPolicy(string districtKey, string policyPrefabKey, bool active)
        {
            try
            {
                Entity districtEntity = districtKey == "city" ? _citySystem.City : ParseEntityKey(districtKey);
                Entity policyEntity = ParseEntityKey(policyPrefabKey);
                if (districtEntity == Entity.Null || policyEntity == Entity.Null) return;

                float adjustment = 0f;
                if (EntityManager.HasBuffer<Game.Policies.Policy>(districtEntity))
                {
                    var policies = EntityManager.GetBuffer<Game.Policies.Policy>(districtEntity, true);
                    for (int i = 0; i < policies.Length; i++)
                    {
                        if (policies[i].m_Policy == policyEntity)
                        {
                            adjustment = policies[i].m_Adjustment;
                            break;
                        }
                    }
                }

                var ecb = _endFrameBarrier.CreateCommandBuffer();
                Entity evt = ecb.CreateEntity(_policyEventArchetype);
                ecb.SetComponent(evt, new Game.Policies.Modify(districtEntity, policyEntity, active, adjustment));
                ForceRefreshData();
            }
            catch (Exception ex)
            {
                Mod.log?.Warn($"Error toggling policy: {ex.Message}\n{ex.StackTrace}");
            }
        }

        private void RenameDistrict(string districtKey, string newName)
        {
            try
            {
                Entity districtEntity = ParseEntityKey(districtKey);
                if (districtEntity == Entity.Null || _nameSystem == null) return;
                _nameSystem.SetCustomName(districtEntity, newName);
                ForceRefreshData();
            }
            catch (Exception ex)
            {
                Mod.log?.Warn($"Error renaming district: {ex.Message}");
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

        private string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }
    }
}