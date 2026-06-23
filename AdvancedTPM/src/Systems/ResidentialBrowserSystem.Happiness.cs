using Colossal.UI.Binding;
using Game.Buildings;
using Game.City;
using Game.Citizens;
using Game.Prefabs;
using Game.Simulation;
using Game.UI.InGame;
using Game.Net;
using Game.Objects;
using Game.Companies;
using Game.Economy;
using System;
using System.Collections.Generic;
using Unity.Collections;
using Unity.Entities;
using Unity.Mathematics;
using Unity.Jobs;

namespace AdvancedTPM
{
    public partial class ResidentialBrowserSystem
    {
        private EntityQuery m_CitizenHappinessParameterQuery;
        private EntityQuery m_GarbageParameterQuery;
        private EntityQuery m_HealthcareParameterQuery;
        private EntityQuery m_ParkParameterQuery;
        private EntityQuery m_EducationParameterQuery;
        private EntityQuery m_TelecomParameterQuery;
        private EntityQuery m_ServiceFeeParameterQuery;
        private EntityQuery m_HappinessFactorParameterQuery;
        
        private GroundPollutionSystem m_GroundPollutionSystem;
        private AirPollutionSystem m_AirPollutionSystem;
        private NoisePollutionSystem m_NoisePollutionSystem;
        private TelecomCoverageSystem m_TelecomCoverageSystem;
        private TaxSystem m_TaxSystem;
        private LocalEffectSystem m_LocalEffectSystem;
        
        private ComponentLookup<PrefabRef> m_PrefabRefLookup;
        private ComponentLookup<SpawnableBuildingData> m_SpawnableBuildingDataLookup;
        private ComponentLookup<BuildingPropertyData> m_BuildingPropertyDataLookup;
        private BufferLookup<CityModifier> m_CityModifierLookup;
        private ComponentLookup<Building> m_BuildingLookup;
        private ComponentLookup<ElectricityConsumer> m_ElectricityConsumerLookup;
        private ComponentLookup<WaterConsumer> m_WaterConsumerLookup;
        private BufferLookup<Game.Net.ServiceCoverage> m_ServiceCoverageLookup;
        private ComponentLookup<Locked> m_LockedLookup;
        private ComponentLookup<Game.Objects.Transform> m_TransformLookup;
        private ComponentLookup<GarbageProducer> m_GarbageProducerLookup;
        private ComponentLookup<CrimeProducer> m_CrimeProducerLookup;
        private ComponentLookup<MailProducer> m_MailProducerLookup;
        private BufferLookup<Renter> m_RenterLookup;
        private ComponentLookup<Citizen> m_CitizenLookup;
        private BufferLookup<HouseholdCitizen> m_HouseholdCitizenLookup;
        private ComponentLookup<BuildingData> m_BuildingDataLookup;

        private struct HappinessCalculationContext
        {
            public CitizenHappinessParameterData citizenParams;
            public GarbageParameterData garbageParams;
            public HealthcareParameterData healthParams;
            public ParkParameterData parkParams;
            public EducationParameterData eduParams;
            public TelecomParameterData telecomParams;
            public DynamicBuffer<HappinessFactorParameterData> factorParams;
            public NativeArray<GroundPollution> groundMap;
            public NativeArray<AirPollution> airMap;
            public NativeArray<NoisePollution> noiseMap;
            public CellMapData<TelecomCoverage> telecomMap;
            public NativeArray<int> taxRates;
            public float relElecFee;
            public float relWaterFee;
            public LocalEffectSystem.ReadData localEffectData;
        }

        private void InitializeHappinessDependencies()
        {
            m_CitizenHappinessParameterQuery = GetEntityQuery(ComponentType.ReadOnly<CitizenHappinessParameterData>());
            m_GarbageParameterQuery = GetEntityQuery(ComponentType.ReadOnly<GarbageParameterData>());
            m_HealthcareParameterQuery = GetEntityQuery(ComponentType.ReadOnly<HealthcareParameterData>());
            m_ParkParameterQuery = GetEntityQuery(ComponentType.ReadOnly<ParkParameterData>());
            m_EducationParameterQuery = GetEntityQuery(ComponentType.ReadOnly<EducationParameterData>());
            m_TelecomParameterQuery = GetEntityQuery(ComponentType.ReadOnly<TelecomParameterData>());
            m_ServiceFeeParameterQuery = GetEntityQuery(ComponentType.ReadOnly<ServiceFeeParameterData>());
            m_HappinessFactorParameterQuery = GetEntityQuery(ComponentType.ReadOnly<HappinessFactorParameterData>());

            m_GroundPollutionSystem = World.GetOrCreateSystemManaged<GroundPollutionSystem>();
            m_AirPollutionSystem = World.GetOrCreateSystemManaged<AirPollutionSystem>();
            m_NoisePollutionSystem = World.GetOrCreateSystemManaged<NoisePollutionSystem>();
            m_TelecomCoverageSystem = World.GetOrCreateSystemManaged<TelecomCoverageSystem>();
            m_TaxSystem = World.GetOrCreateSystemManaged<TaxSystem>();
            m_LocalEffectSystem = World.GetOrCreateSystemManaged<LocalEffectSystem>();

            m_PrefabRefLookup = GetComponentLookup<PrefabRef>(true);
            m_SpawnableBuildingDataLookup = GetComponentLookup<SpawnableBuildingData>(true);
            m_BuildingPropertyDataLookup = GetComponentLookup<BuildingPropertyData>(true);
            m_CityModifierLookup = GetBufferLookup<CityModifier>(true);
            m_BuildingLookup = GetComponentLookup<Building>(true);
            m_ElectricityConsumerLookup = GetComponentLookup<ElectricityConsumer>(true);
            m_WaterConsumerLookup = GetComponentLookup<WaterConsumer>(true);
            m_ServiceCoverageLookup = GetBufferLookup<Game.Net.ServiceCoverage>(true);
            m_LockedLookup = GetComponentLookup<Locked>(true);
            m_TransformLookup = GetComponentLookup<Game.Objects.Transform>(true);
            m_GarbageProducerLookup = GetComponentLookup<GarbageProducer>(true);
            m_CrimeProducerLookup = GetComponentLookup<CrimeProducer>(true);
            m_MailProducerLookup = GetComponentLookup<MailProducer>(true);
            m_RenterLookup = GetBufferLookup<Renter>(true);
            m_CitizenLookup = GetComponentLookup<Citizen>(true);
            m_HouseholdCitizenLookup = GetBufferLookup<HouseholdCitizen>(true);
            m_BuildingDataLookup = GetComponentLookup<BuildingData>(true);
        }

        private void UpdateHappinessDependencies()
        {
            m_PrefabRefLookup.Update(this);
            m_SpawnableBuildingDataLookup.Update(this);
            m_BuildingPropertyDataLookup.Update(this);
            m_CityModifierLookup.Update(this);
            m_BuildingLookup.Update(this);
            m_ElectricityConsumerLookup.Update(this);
            m_WaterConsumerLookup.Update(this);
            m_ServiceCoverageLookup.Update(this);
            m_LockedLookup.Update(this);
            m_TransformLookup.Update(this);
            m_GarbageProducerLookup.Update(this);
            m_CrimeProducerLookup.Update(this);
            m_MailProducerLookup.Update(this);
            m_RenterLookup.Update(this);
            m_CitizenLookup.Update(this);
            m_HouseholdCitizenLookup.Update(this);
            m_BuildingDataLookup.Update(this);
        }

        private string GetHappinessFactorsString(Entity property, in HappinessCalculationContext ctx)
        {
            try
            {
                NativeArray<int2> factors = new NativeArray<int2>(28, Allocator.Temp);
                var localEffectData = ctx.localEffectData;
                try
                {
                    BuildingHappiness.GetResidentialBuildingHappinessFactors(
                        _citySystem.City,
                        ctx.taxRates,
                        property,
                        factors,
                        ref m_PrefabRefLookup,
                        ref m_SpawnableBuildingDataLookup,
                        ref m_BuildingPropertyDataLookup,
                        ref m_CityModifierLookup,
                        ref m_BuildingLookup,
                        ref m_ElectricityConsumerLookup,
                        ref m_WaterConsumerLookup,
                        ref m_ServiceCoverageLookup,
                        ref m_LockedLookup,
                        ref m_TransformLookup,
                        ref m_GarbageProducerLookup,
                        ref m_CrimeProducerLookup,
                        ref m_MailProducerLookup,
                        ref m_RenterLookup,
                        ref m_CitizenLookup,
                        ref m_HouseholdCitizenLookup,
                        ref m_BuildingDataLookup,
                        ref localEffectData,
                        ctx.citizenParams,
                        ctx.garbageParams,
                        ctx.healthParams,
                        ctx.parkParams,
                        ctx.eduParams,
                        ctx.telecomParams,
                        ctx.factorParams,
                        ctx.groundMap,
                        ctx.noiseMap,
                        ctx.airMap,
                        ctx.telecomMap,
                        ctx.relElecFee,
                        ctx.relWaterFee
                    );

                    int totalHappiness = 0;
                    int citizenCount = 0;
                    if (m_RenterLookup.HasBuffer(property))
                    {
                        DynamicBuffer<Renter> renters = m_RenterLookup[property];
                        for (int i = 0; i < renters.Length; i++)
                        {
                            Entity renterEntity = renters[i].m_Renter;
                            if (m_HouseholdCitizenLookup.HasBuffer(renterEntity))
                            {
                                DynamicBuffer<HouseholdCitizen> householdCitizens = m_HouseholdCitizenLookup[renterEntity];
                                for (int j = 0; j < householdCitizens.Length; j++)
                                {
                                    Entity citizenEntity = householdCitizens[j].m_Citizen;
                                    if (m_CitizenLookup.HasComponent(citizenEntity))
                                    {
                                        totalHappiness += m_CitizenLookup[citizenEntity].Happiness;
                                        citizenCount++;
                                    }
                                }
                            }
                        }
                    }
                    
                    int trueAvgHappiness = 50;
                    if (citizenCount > 0)
                    {
                        trueAvgHappiness = (int)math.round((float)totalHappiness / citizenCount);
                    }

                    List<string> parts = new List<string>();
                    for (int i = 0; i < (int)Game.Simulation.CitizenHappinessSystem.HappinessFactor.Count; i++)
                    {
                        int weight = factors[i].x;
                        int happiness = factors[i].y;
                        if (happiness != 0)
                        {
                            string factorName = ((Game.Simulation.CitizenHappinessSystem.HappinessFactor)i).ToString();
                            parts.Add(factorName + ":" + happiness.ToString());
                        }
                    }
                    
                    return trueAvgHappiness.ToString() + "^" + string.Join("^", parts);
                }
                finally
                {
                    factors.Dispose();
                }
            }
            catch (Exception ex)
            {
                UnityEngine.Debug.LogWarning($"[AdvancedTPM] GetHappinessFactorsString failed: {ex}");
                return "";
            }
        }
    }
}
