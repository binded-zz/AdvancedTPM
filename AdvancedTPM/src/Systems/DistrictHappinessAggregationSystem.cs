using Game;
using Game.Areas;
using Game.Buildings;
using Game.Citizens;
using Game.City;
using Game.Common;
using Game.Prefabs;
using Game.Simulation;
using Game.Tools;
using Unity.Burst;
using Unity.Collections;
using Unity.Entities;
using Unity.Jobs;
using Unity.Mathematics;

namespace AdvancedTPM.Systems
{
    public struct DistrictHappinessData : IComponentData
    {
        public int2 f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14, f15, f16, f17, f18, f19, f20, f21, f22, f23, f24, f25, f26, f27, f28, f29;

        public void Add(int index, int2 val)
        {
            switch (index)
            {
                case 0: f0 += val; break;
                case 1: f1 += val; break;
                case 2: f2 += val; break;
                case 3: f3 += val; break;
                case 4: f4 += val; break;
                case 5: f5 += val; break;
                case 6: f6 += val; break;
                case 7: f7 += val; break;
                case 8: f8 += val; break;
                case 9: f9 += val; break;
                case 10: f10 += val; break;
                case 11: f11 += val; break;
                case 12: f12 += val; break;
                case 13: f13 += val; break;
                case 14: f14 += val; break;
                case 15: f15 += val; break;
                case 16: f16 += val; break;
                case 17: f17 += val; break;
                case 18: f18 += val; break;
                case 19: f19 += val; break;
                case 20: f20 += val; break;
                case 21: f21 += val; break;
                case 22: f22 += val; break;
                case 23: f23 += val; break;
                case 24: f24 += val; break;
                case 25: f25 += val; break;
                case 26: f26 += val; break;
                case 27: f27 += val; break;
                case 28: f28 += val; break;
                case 29: f29 += val; break;
            }
        }

        public int2 Get(int index)
        {
            switch (index)
            {
                case 0: return f0;
                case 1: return f1;
                case 2: return f2;
                case 3: return f3;
                case 4: return f4;
                case 5: return f5;
                case 6: return f6;
                case 7: return f7;
                case 8: return f8;
                case 9: return f9;
                case 10: return f10;
                case 11: return f11;
                case 12: return f12;
                case 13: return f13;
                case 14: return f14;
                case 15: return f15;
                case 16: return f16;
                case 17: return f17;
                case 18: return f18;
                case 19: return f19;
                case 20: return f20;
                case 21: return f21;
                case 22: return f22;
                case 23: return f23;
                case 24: return f24;
                case 25: return f25;
                case 26: return f26;
                case 27: return f27;
                case 28: return f28;
                case 29: return f29;
                default: return default;
            }
        }
        
        public void Add(DistrictHappinessData other)
        {
            for (int i = 0; i < 30; i++)
            {
                Add(i, other.Get(i));
            }
        }
    }

    public struct DistrictHappinessDelta
    {
        public Entity district;
        public DistrictHappinessData data;
    }

    [UpdateAfter(typeof(CitizenHappinessSystem))]
    public partial class DistrictHappinessAggregationSystem : GameSystemBase
    {
        private EntityQuery m_BuildingQuery;
        private CitySystem m_CitySystem;
        private SimulationSystem m_SimulationSystem;

        public NativeParallelHashMap<Entity, DistrictHappinessData> m_HappinessMap;

        protected override void OnCreate()
        {
            Mod.log.Info("DistrictHappinessAggregationSystem.OnCreate");
            base.OnCreate();

            m_BuildingQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Building>(), ComponentType.ReadOnly<PrefabRef>(), ComponentType.ReadOnly<CurrentDistrict>() },
                None = new[] { ComponentType.ReadOnly<Deleted>(), ComponentType.ReadOnly<Temp>() }
            });

            m_HappinessMap = new NativeParallelHashMap<Entity, DistrictHappinessData>(100, Allocator.Persistent);

            RequireForUpdate(m_BuildingQuery);
        }

        protected override void OnDestroy()
        {
            if (m_HappinessMap.IsCreated) m_HappinessMap.Dispose();
            base.OnDestroy();
        }

        /// <summary>
        /// Lightweight job that aggregates citizen wellbeing per district.
        /// Only reads Renter buffers, HouseholdCitizen buffers, and Citizen components.
        /// No pollution, parameter, or singleton data needed.
        /// </summary>
        private struct AggregateHappinessJob : IJobChunk
        {
            public EntityTypeHandle m_EntityHandle;
            [ReadOnly] public ComponentTypeHandle<CurrentDistrict> m_CurrentDistrictHandle;

            [ReadOnly] public BufferLookup<Renter> m_RenterFromEntity;
            [ReadOnly] public ComponentLookup<Citizen> m_CitizenFromEntity;
            [ReadOnly] public BufferLookup<HouseholdCitizen> m_HouseholdCitizenFromEntity;

            public Entity m_City;

            public NativeStream.Writer m_DeltaWriter;

            public void Execute(in ArchetypeChunk chunk, int unfilteredChunkIndex, bool useEnabledMask, in Unity.Burst.Intrinsics.v128 chunkEnabledMask)
            {
                if (m_City == Entity.Null) return;

                var entities = chunk.GetNativeArray(m_EntityHandle);
                var currentDistricts = chunk.GetNativeArray(ref m_CurrentDistrictHandle);
                bool hasDistrict = currentDistricts.Length > 0;

                m_DeltaWriter.BeginForEachIndex(unfilteredChunkIndex);

                for (int i = 0; i < entities.Length; i++)
                {
                    Entity entity = entities[i];
                    Entity district = hasDistrict ? currentDistricts[i].m_District : Entity.Null;

                    // Aggregate wellbeing and happiness
                    int totalWellbeing = 0;
                    int totalHappiness = 0;
                    int citizenCount = 0;
                    if (m_RenterFromEntity.HasBuffer(entity))
                    {
                        var renters = m_RenterFromEntity[entity];
                        for (int r = 0; r < renters.Length; r++)
                        {
                            if (m_HouseholdCitizenFromEntity.HasBuffer(renters[r].m_Renter))
                            {
                                var citizens = m_HouseholdCitizenFromEntity[renters[r].m_Renter];
                                for (int c = 0; c < citizens.Length; c++)
                                {
                                    if (m_CitizenFromEntity.HasComponent(citizens[c].m_Citizen))
                                    {
                                        var citData = m_CitizenFromEntity[citizens[c].m_Citizen];
                                        totalWellbeing += citData.m_WellBeing;
                                        totalHappiness += citData.Happiness;
                                        citizenCount++;
                                    }
                                }
                            }
                        }
                    }
                    
                    if (citizenCount > 0)
                    {
                        DistrictHappinessData delta = default;
                        delta.Add(0, new int2(citizenCount, totalWellbeing)); // Index 0: Wellbeing
                        delta.Add(1, new int2(citizenCount, totalHappiness)); // Index 1: Happiness
                        m_DeltaWriter.Write(new DistrictHappinessDelta { district = district, data = delta });
                    }
                }
                m_DeltaWriter.EndForEachIndex();
            }
        }

        private struct AccumulateHappinessJob : IJob
        {
            public NativeStream.Reader m_DeltaReader;
            public NativeParallelHashMap<Entity, DistrictHappinessData> m_HappinessMap;

            public void Execute()
            {
                for (int i = 0; i < m_DeltaReader.ForEachCount; i++)
                {
                    m_DeltaReader.BeginForEachIndex(i);
                    while (m_DeltaReader.RemainingItemCount > 0)
                    {
                        var delta = m_DeltaReader.Read<DistrictHappinessDelta>();
                        var key = delta.district;
                        if (m_HappinessMap.TryGetValue(key, out var existing))
                        {
                            existing.Add(delta.data);
                            m_HappinessMap[key] = existing;
                        }
                        else
                        {
                            m_HappinessMap.TryAdd(key, delta.data);
                        }
                    }
                    m_DeltaReader.EndForEachIndex();
                }
            }
        }

        private int m_FrameCounter = 0;
        protected override void OnUpdate()
        {
            // Wait for simulation to stabilize before running
            if (m_SimulationSystem == null) m_SimulationSystem = World.GetExistingSystemManaged<SimulationSystem>();
            if (m_SimulationSystem == null || m_SimulationSystem.frameIndex < 1000) return;
            if (m_FrameCounter++ % 600 == 0) Mod.log.Info("DistrictHappinessAggregationSystem Heartbeat");

            if (m_CitySystem == null) m_CitySystem = World.GetExistingSystemManaged<CitySystem>();
            if (m_CitySystem == null || m_CitySystem.City == Entity.Null) return;

            if (m_HappinessMap.IsCreated) m_HappinessMap.Clear();

            int chunkCount = m_BuildingQuery.CalculateChunkCount();
            if (chunkCount == 0) return;

            var nativeStream = new NativeStream(chunkCount, Allocator.TempJob);

            var job = new AggregateHappinessJob
            {
                m_EntityHandle = GetEntityTypeHandle(),
                m_CurrentDistrictHandle = GetComponentTypeHandle<CurrentDistrict>(true),
                m_RenterFromEntity = GetBufferLookup<Renter>(true),
                m_CitizenFromEntity = GetComponentLookup<Citizen>(true),
                m_HouseholdCitizenFromEntity = GetBufferLookup<HouseholdCitizen>(true),
                m_City = m_CitySystem.City,
                m_DeltaWriter = nativeStream.AsWriter()
            };

            var jobHandle = job.Schedule(m_BuildingQuery, Dependency);

            var accumJob = new AccumulateHappinessJob
            {
                m_DeltaReader = nativeStream.AsReader(),
                m_HappinessMap = m_HappinessMap
            };
            
            Dependency = accumJob.Schedule(jobHandle);
            nativeStream.Dispose(Dependency);
        }
    }
}
