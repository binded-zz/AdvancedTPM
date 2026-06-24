using System.Collections.Generic;

namespace AdvancedTPM.Systems
{
    public class CompanyDTO
    {
        public string entityKey { get; set; }
        public string name { get; set; }
        public string zoneType { get; set; }
        public string resourceKey { get; set; }
        public int profit { get; set; }
        public string tier { get; set; }
        public int workers { get; set; }
        public int maxWorkers { get; set; }
        public int px { get; set; }
        public int py { get; set; }
        public int pz { get; set; }
        public int eff { get; set; }
        public string in1 { get; set; }
        public string in2 { get; set; }
        public int taxR { get; set; }
        public int bLevel { get; set; }
        public string effDetails { get; set; }
        public string brandName { get; set; }
        public string bldgAddr { get; set; }
        public int g { get; set; }
        public int c { get; set; }
        public int m { get; set; }
        public int e { get; set; }
        public int w { get; set; }
        public float eCons { get; set; }
        public float wCons { get; set; }
        public float gAccum { get; set; }
        public float mAccum { get; set; }
        public float cProb { get; set; }
        public string district { get; set; }
        public string theme { get; set; }
        public string pack { get; set; }
        public string packIcon { get; set; }
        public string kind { get; set; }
        public int isSignature { get; set; }
        public string bldgKey { get; set; }
        public string iconUrl { get; set; }
        public string nativePackIcon { get; set; }
        public string themeIcon { get; set; }
        public int storageAmount { get; set; }
        public int storageCapacity { get; set; }
        public string allowedResources { get; set; }
        public string cityEffects { get; set; }
        public string localEffects { get; set; }
        public int attractiveness { get; set; }
    }

    public class PackSummaryDTO
    {
        public string name { get; set; }
        public string icon { get; set; }
    }

    public class ResourceKindDTO
    {
        public string zone { get; set; }
        public string resourceKey { get; set; }
        public string companyKind { get; set; }
    }

    public class CompanySummaryDTO
    {
        public int total { get; set; }
        public int healthy { get; set; }
        public int struggling { get; set; }
        public int bankrupt { get; set; }
        public List<PackSummaryDTO> packs { get; set; }
        public List<string> themes { get; set; }
        public List<string> districts { get; set; }
        public List<ResourceKindDTO> resourceKinds { get; set; }
    }

    public class CompanyHappinessDTO
    {
        public string entityKey { get; set; }
        public Dictionary<string, float> factors { get; set; }
    }

    public class DistrictPolicyDTO
    {
        public string k { get; set; }
        public float adj { get; set; }
    }

    public class DistrictDTO
    {
        public string entityKey { get; set; }
        public string name { get; set; }
        public List<DistrictPolicyDTO> policies { get; set; }
        public int res { get; set; }
        public int svc { get; set; }
        public int biz { get; set; }
        public int households { get; set; }
        public int householdCap { get; set; }
        public int workers { get; set; }
        public int maxWorkers { get; set; }
        public double avgWealth { get; set; }
        public double avgIncome { get; set; }
        public double avgRent { get; set; }
        public int avgHappiness { get; set; }
        public int residents { get; set; }
        public int tourists { get; set; }
        public int children { get; set; }
        public int teens { get; set; }
        public int adults { get; set; }
        public int seniors { get; set; }
        public int eduUneducated { get; set; }
        public int eduPoorlyEducated { get; set; }
        public int eduEducated { get; set; }
        public int eduWellEducated { get; set; }
        public int eduHighlyEducated { get; set; }
        public int workerUneducated { get; set; }
        public int workerPoorlyEducated { get; set; }
        public int workerEducated { get; set; }
        public int workerWellEducated { get; set; }
        public int workerHighlyEducated { get; set; }
        public int workerUneducatedMax { get; set; }
        public int workerPoorlyEducatedMax { get; set; }
        public int workerEducatedMax { get; set; }
        public int workerWellEducatedMax { get; set; }
        public int workerHighlyEducatedMax { get; set; }
        public int elemCapacity { get; set; }
        public int hsCapacity { get; set; }
        public int collegeCapacity { get; set; }
        public int uniCapacity { get; set; }
        public int elemEnrolled { get; set; }
        public int hsEnrolled { get; set; }
        public int collegeEnrolled { get; set; }
        public int uniEnrolled { get; set; }
        public int elemEligible { get; set; }
        public int hsEligible { get; set; }
        public int collegeEligible { get; set; }
        public int uniEligible { get; set; }
        public int localServices { get; set; }
        public uint serviceMask { get; set; }
        public int propertyCount { get; set; }
        public int resProp { get; set; }
        public int comProp { get; set; }
        public int indProp { get; set; }
        public int offProp { get; set; }
        public int storProp { get; set; }
        public int mixedProp { get; set; }
        public int pets { get; set; }
        public int deceased { get; set; }
        public int students { get; set; }
        public int movingAway { get; set; }
        public double avgBuildingLevel { get; set; }
        public int buildingLevelSamples { get; set; }
        public float totalLandValue { get; set; }
        public int landValueSamples { get; set; }
        public int homeless { get; set; }
        public float totalCrime { get; set; }
        public float upkeep { get; set; }
        public float resourceCost { get; set; }
        public float feesPaid { get; set; }
        public float area { get; set; }
        public List<string> happinessFactors { get; set; }
        public int unemployed { get; set; }
        public bool? isCity { get; set; }
        public string cityName { get; set; }
        public int? gameAllCitizens { get; set; }
        public int? gameTourists { get; set; }
        public int? gameCommuters { get; set; }
        public int? gameMovingAway { get; set; }
        public int? gameEmployees { get; set; }
    }

    public class DistrictPolicyMetaDTO
    {
        public string entityKey { get; set; }
        public string name { get; set; }
        public string icon { get; set; }
        public bool isCity { get; set; }
        public bool isDistrict { get; set; }
        public bool hasSlider { get; set; }
        public float? sliderDefault { get; set; }
        public float? sliderMin { get; set; }
        public float? sliderMax { get; set; }
    }

    public class ResidentialSummaryDTO
    {
        public int lowTotal { get; set; }
        public int medTotal { get; set; }
        public int highTotal { get; set; }
        public int lowFree { get; set; }
        public int medFree { get; set; }
        public int highFree { get; set; }
        public int lowOccupied { get; set; }
        public int medOccupied { get; set; }
        public int highOccupied { get; set; }
        public float avgHappiness { get; set; }
        public float unemploymentRate { get; set; }
        public int homelessHouseholds { get; set; }
        public int movedInHouseholds { get; set; }
        public int lowPlaced { get; set; }
        public int medPlaced { get; set; }
        public int highPlaced { get; set; }
        public int lowUsa { get; set; }
        public int medUsa { get; set; }
        public int highUsa { get; set; }
        public int lowEu { get; set; }
        public int medEu { get; set; }
        public int highEu { get; set; }
        public Dictionary<string, int> lowPacks { get; set; }
        public Dictionary<string, int> medPacks { get; set; }
        public Dictionary<string, int> highPacks { get; set; }
    }

    public class ResidentialBuildingDTO
    {
        public string entityKey { get; set; }
        public string address { get; set; }
        public string district { get; set; }
        public string density { get; set; }
        public int level { get; set; }
        public int occupied { get; set; }
        public int capacity { get; set; }
        public string theme { get; set; }
        public string pack { get; set; }
        public int isSignature { get; set; }
        public string packIcon { get; set; }
        public string themeIcon { get; set; }
        public string cityEffects { get; set; }
        public string localEffects { get; set; }
        public int attractiveness { get; set; }
        public string attractivenessFactors { get; set; }
        public string happinessFactors { get; set; }
    }
}
