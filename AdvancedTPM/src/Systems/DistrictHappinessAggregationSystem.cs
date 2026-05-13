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
        private EntityQuery m_CitizenQuery;
        private CitySystem m_CitySystem;
        private SimulationSystem m_SimulationSystem;

        public NativeParallelHashMap<Entity, DistrictHappinessData> m_HappinessMap;

        protected override void OnCreate()
        {
            base.OnCreate();
            m_CitizenQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Citizen>() },
                None = new[] { ComponentType.ReadOnly<Deleted>(), ComponentType.ReadOnly<Temp>() }
            });

            m_HappinessMap = new NativeParallelHashMap<Entity, DistrictHappinessData>(100, Allocator.Persistent);
            RequireForUpdate(m_CitizenQuery);
        }

        protected override void OnDestroy()
        {
            if (m_HappinessMap.IsCreated) m_HappinessMap.Dispose();
            base.OnDestroy();
        }

        [BurstCompile]
        private struct AggregateHappinessJob : IJobChunk
        {
            [ReadOnly] public EntityTypeHandle m_EntityHandle;
            [ReadOnly] public ComponentTypeHandle<Citizen> m_CitizenHandle;
            [ReadOnly] public ComponentLookup<CurrentDistrict> m_CurrentDistrictLookup;
            [ReadOnly] public ComponentLookup<HouseholdMember> m_HouseholdMemberLookup;

            public NativeStream.Writer m_DeltaWriter;

            public void Execute(in ArchetypeChunk chunk, int unfilteredChunkIndex, bool useEnabledMask, in Unity.Burst.Intrinsics.v128 chunkEnabledMask)
            {
                var entities = chunk.GetNativeArray(m_EntityHandle);
                var citizens = chunk.GetNativeArray(ref m_CitizenHandle);

                m_DeltaWriter.BeginForEachIndex(unfilteredChunkIndex);

                for (int i = 0; i < entities.Length; i++)
                {
                    Entity cEnt = entities[i];
                    Entity district = Entity.Null;
                    if (m_CurrentDistrictLookup.TryGetComponent(cEnt, out var cd)) district = cd.m_District;

                    Citizen citizen = citizens[i];
                    DistrictHappinessData data = default;

                    // NOTE: Indices 0-25 map to CitizenHappinessSystem.HappinessFactor enum values.
                    // We do NOT write fake wellbeing/happiness totals here — they don't correspond
                    // to any factor index and caused wrong labels (e.g., wellbeing shown as "Reliable internet service").

                    /*
                    // Aggregate factors from household
                    if (m_HouseholdMemberLookup.TryGetComponent(cEnt, out var member))
                    {
                        if (m_HappinessFactorLookup.HasBuffer(member.m_Household))
                        {
                            var factors = m_HappinessFactorLookup[member.m_Household];
                            for (int f = 0; f < factors.Length; f++)
                            {
                                var factor = factors[f];
                                // We store factors starting at index 2 (0=wellbeing, 1=happiness)
                                int idx = (int)factor.m_Factor + 2;
                                if (idx < 30)
                                {
                                    data.Add(idx, new int2(1, factor.m_Value));
                                }
                            }
                        }
                    }
                    */

                    m_DeltaWriter.Write(new DistrictHappinessDelta { district = district, data = data });
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
                        if (m_HappinessMap.TryGetValue(delta.district, out var existing))
                        {
                            existing.Add(delta.data);
                            m_HappinessMap[delta.district] = existing;
                        }
                        else
                        {
                            m_HappinessMap.TryAdd(delta.district, delta.data);
                        }
                    }
                    m_DeltaReader.EndForEachIndex();
                }
            }
        }

        protected override void OnUpdate()
        {
            if (m_SimulationSystem == null) m_SimulationSystem = World.GetExistingSystemManaged<SimulationSystem>();
            if (m_CitySystem == null) m_CitySystem = World.GetExistingSystemManaged<CitySystem>();
            
            if (m_HappinessMap.IsCreated) m_HappinessMap.Clear();

            int chunkCount = m_CitizenQuery.CalculateChunkCount();
            if (chunkCount == 0) return;

            var nativeStream = new NativeStream(chunkCount, Allocator.TempJob);

            var job = new AggregateHappinessJob
            {
                m_EntityHandle = SystemAPI.GetEntityTypeHandle(),
                m_CitizenHandle = SystemAPI.GetComponentTypeHandle<Citizen>(true),
                m_CurrentDistrictLookup = SystemAPI.GetComponentLookup<CurrentDistrict>(true),
                m_HouseholdMemberLookup = SystemAPI.GetComponentLookup<HouseholdMember>(true),
                m_DeltaWriter = nativeStream.AsWriter()
            };

            var jobHandle = job.ScheduleParallel(m_CitizenQuery, Dependency);

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
