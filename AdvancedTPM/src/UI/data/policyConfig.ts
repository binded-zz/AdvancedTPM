export interface PolicyPrefab {
  entityKey: string;
  name: string;
  icon?: string;
  isCity?: boolean;
  isDistrict?: boolean;
  hasSlider?: boolean;
  sliderDefault?: number;
  sliderMin?: number;
  sliderMax?: number;
}

export interface ActivePolicy {
  k: string;
  adj: number;
}

export const POLICY_CONFLICT_GROUPS = [
  ["PP_ToleranceDelinquency","PP_LightCrimePermit","PP_PoliceState","PP_ZeroGraffiti"],
  ["PP_FastFines","PP_ToleranceDelinquency","PP_LightCrimePermit"],
  ["PP_NightWithoutCops","PP_PoliceState","PP_BigBrother"],
  ["PP_FriendlyCops","PP_PoliceState"],
  ["PP_FakeCameras","PP_BigBrother"],
  ["PP_StreetRacing","PP_ZeroGraffiti"],
  ["PP_TaxParadise","PP_OffshoreCrackdown"],
  ["PP_GhostSubsidies","PP_OffshoreCrackdown"],
  ["PP_MadeInLocal","PP_WildImports","PP_ImportEverything","PP_LocalCoupons"],
  ["PP_StartupOrNothing","PP_SlowLife"],
  ["PP_StartupOrNothing","PP_MandatoryUniversity"],
  ["PP_Hospitals247","PP_HealthOnBudget"],
  ["PP_PublicPlacebo","PP_Hospitals247","PP_SoftVaccineMandate"],
  ["PP_ForcedTelehealth","PP_Hospitals247"],
  ["PP_InfluencerDoctors","PP_Hospitals247"],
  ["PP_PaidER","PP_HealthOnBudget"],
  ["PP_MandatoryUniversity","PP_FourDaySchool","PP_NoHomework","PP_SchoolIsOverrated"],
  ["PP_Libraries247","PP_SchoolIsOverrated"],
  ["PP_StrictGreenCity","PP_PollutionProsperity","PP_ToxicFreezone"],
  ["PP_NightFactories","PP_SilentIndustry","PP_StrictGreenCity"],
  ["PP_BackyardOil","PP_QuarryMoratorium","PP_StrictGreenCity"],
  ["PP_TheaterZeroWaste","PP_PollutionProsperity"],
  ["PP_RightToRepair","PP_PollutionProsperity"],
  ["PP_ChaosFreeZone","PP_StrictGreenCity"],
  ["PP_AggressiveTourism","PP_AntiTourists"],
  ["PP_InfluencerVisa","PP_AntiTourists","PP_AntiAirbnb"],
  ["PP_ShareEconomy","PP_AntiAirbnb"],
  ["PP_MunicipalCasino","PP_AntiAirbnb","PP_SlowLife"],
  ["PP_PermanentFestival","PP_SlowLife","PP_AntiTourists"],
  ["PP_WhiteNight","PP_SlowLife"],
  ["PP_SoftApocalypse","PP_PermanentFestival"],
  ["PP_ProgressiveTax","PP_TaxParadise","PP_SymbolicTaxes"],
  ["PP_BasicIncome","PP_TaxParadise","PP_SymbolicTaxes"],
  ["PP_RentControl","PP_TaxParadise"],
  ["PP_ServiceBudgetBoost","PP_HealthOnBudget","PP_CityServiceImport"],
  ["PP_CityServiceImport","PP_Hospitals247"],
  ["PP_ConstructionSubsidy","PP_RepairCulture"],
  ["PP_EmissionZone","PP_PollutionProsperity","PP_HeavyIndustrySurge","PP_NightFactories"],
  ["PP_CarbonTax","PP_PollutionProsperity","PP_HeavyIndustrySurge","PP_ToxicFreezone"],
  ["PP_PlasticBan","PP_PollutionProsperity","PP_ToxicFreezone"],
  ["PP_ForestProtection","PP_BackyardOil","PP_HeavyIndustrySurge"],
  ["PP_HeavyIndustrySurge","PP_SilentIndustry","PP_StrictGreenCity"],
  ["PP_WorkWeek4Days","PP_NightFactories"],
  ["PP_FreeDayCare","PP_HealthOnBudget"],
  ["PP_CommunityTolerance","PP_PoliceState","PP_BigBrother","PP_ZeroGraffiti"],
  ["PP_LateNightBars","PP_ChaosFreeZone","PP_SlowLife"],
  ["PP_TouristTax","PP_AggressiveTourism"],
  ["PP_ElectronicsHub","PP_RightToRepair"],
  ["PP_FishingOptimization","PP_StrictGreenCity"],
  ["PP_FlatTax","PP_WealthTax","PP_LandValueTax","PP_ProgressiveTax"],
  ["PP_WealthTax","PP_TaxParadise","PP_SymbolicTaxes"],
  ["PP_FreeTradeZone","PP_Protectionism","PP_Reshoring","PP_MadeInLocal","PP_ImportEverything","PP_WildImports"],
  ["PP_AutomationPush","PP_RobotTax"],
  ["PP_GigWorkerRights","PP_ShareEconomy"],
  ["PP_RightToDisconnect","PP_StartupOrNothing"],
  ["PP_DrugDecriminalization","PP_WarOnDrugs"],
  ["PP_RestorativeJustice","PP_WarOnDrugs","PP_PrisonComfort"],
  ["PP_DronePolice","PP_NeighborhoodWatch","PP_BigBrother"],
  ["PP_PrivateSecurity","PP_NeighborhoodWatch"],
  ["PP_NightCurfew","PP_WhiteNight","PP_LateNightBars","PP_NightWithoutCops","PP_PermanentFestival"],
  ["PP_UniversalHealthcare","PP_PaidER","PP_HealthOnBudget"],
  ["PP_Austerity","PP_UniversalHealthcare","PP_FreeUniversity","PP_SocialHousing","PP_ServiceBudgetBoost"],
  ["PP_FreeUniversity","PP_VocationalSchools"],
  ["PP_VocationalSchools","PP_MandatoryUniversity"],
  ["PP_FiberForAll","PP_MegaNetwork5G"],
  ["PP_HeritageProtection","PP_ConstructionSubsidy"],
  ["PP_StreetArt","PP_ZeroGraffiti"]
];

export const getConflictingActivePolicies = (
  policyName: string,
  activePolicies: ActivePolicy[],
  policyPrefabs: PolicyPrefab[]
): string[] => {
  if (!policyName.startsWith('PP_')) return [];

  // Build a set of all active policy names in this district
  const activeNames = new Set(
    activePolicies
      .map(ap => {
        const pol = policyPrefabs.find(p => p.entityKey === ap.k);
        return pol ? pol.name : '';
      })
      .filter(Boolean)
  );

  // Find all conflicting names
  const conflicts: string[] = [];
  for (const group of POLICY_CONFLICT_GROUPS) {
    if (group.includes(policyName)) {
      for (const other of group) {
        if (other !== policyName && activeNames.has(other)) {
          conflicts.push(other);
        }
      }
    }
  }

  // Deduplicate and return
  return Array.from(new Set(conflicts));
};
