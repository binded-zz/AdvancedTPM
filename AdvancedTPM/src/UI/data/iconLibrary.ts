export const ICONS = {
  // Theme Icons
  THEME_EUROPEAN: 'Media/Game/Themes/European.svg',
  THEME_NORTH_AMERICAN: 'Media/Game/Themes/North American.svg',

  // Pack Fallback Icons
  PACK_PARADOX_STAR: 'coui://ui-game/Media/Menu/Paradox/ParadoxLogoNoText.svg',

  // Zone Icons
  ZONE_RESIDENTIAL: 'Media/Game/Icons/ZoneResidential.svg',
  ZONE_COMMERCIAL: 'Media/Game/Icons/ZoneCommercial.svg',
  ZONE_INDUSTRIAL: 'Media/Game/Icons/ZoneIndustrial.svg',
  ZONE_OFFICE: 'Media/Game/Icons/ZoneOffice.svg',
  ZONE_EXTRACTORS: 'Media/Game/Icons/ZoneExtractors.svg',

  // Service Icons
  SERVICE_POLICE: 'Media/Game/Icons/Police.svg',
  SERVICE_FIRE: 'Media/Game/Icons/FireSafety.svg',
  SERVICE_HEALTH: 'Media/Game/Icons/Healthcare.svg',
  SERVICE_DEATH: 'Media/Game/Icons/Deathcare.svg',
  SERVICE_EDUCATION: 'Media/Game/Icons/Education.svg',
  SERVICE_ELECTRICITY: 'Media/Game/Icons/Electricity.svg',
  SERVICE_WATER: 'Media/Game/Icons/Water.svg',
  SERVICE_GARBAGE: 'Media/Game/Icons/Garbage.svg',
  SERVICE_SERVICES: 'Media/Game/Icons/Services.svg',
  SERVICE_TELECOM: 'Media/Game/Resources/Telecom.svg',
  SERVICE_POST: 'Media/Game/Icons/PostService.svg',
  SERVICE_TRANSPORTATION: 'Media/Game/Icons/Transportation.svg',
  SERVICE_TRAIN: 'Media/Game/Icons/Train.svg',
  SERVICE_AIRPORT: 'Media/Game/Icons/Airplane.svg',
  SERVICE_HARBOR: 'Media/Game/Icons/Ship.svg',
  SERVICE_ROADS: 'Media/Game/Icons/Roads.svg',
  
  // Generic / Notification Icons
  NOTIFICATION: 'Media/Game/Icons/Notifications.svg',
  WORKERS: 'Media/Game/Icons/Workers.svg',
  TRAFFIC: 'Media/Game/Icons/Traffic.svg',
  WEALTH: 'Media/Game/Icons/CitizenWealth.svg',
  PARKS_AND_RECREATION: 'Media/Game/Icons/ParksAndRecreation.svg',
  WELLBEING: 'Media/Game/Icons/Wellbeing.svg',
  FIRE_AND_RESCUE: 'Media/Game/Icons/FireSafety.svg',
  POLICE_AND_ADMIN: 'Media/Game/Icons/Police.svg',
  COMMUNICATIONS: 'Media/Game/Icons/Communications.svg',
  POLLUTION: 'Media/Game/Icons/Pollution.svg',
  ECONOMY: 'Media/Game/Icons/Economy.svg',
};

export const EFF_FACTOR_LABELS: Record<string, string> = {
  EmployeeHappiness: 'Employee Happiness',
  ElectricitySupply: 'Electricity Supply',
  ElectricityFee: 'Electricity Fee',
  WaterSupply: 'Water Supply',
  DirtyWater: 'Dirty Water',
  SewageHandling: 'Sewage',
  WaterFee: 'Water Fee',
  NoisePollution: 'Noise Pollution',
  GroundPollution: 'Ground Pollution',
  AirPollution: 'Air Pollution',
  TrafficPenalty: 'Traffic Penalty',
  DeathPenalty: 'Death Penalty',
  Healthcare: 'Healthcare',
  Entertainment: 'Entertainment',
  Education: 'Education',
  Mail: 'Mail',
  Welfare: 'Welfare',
  Leisure: 'Leisure',
  Tax: 'Tax',
  Buildings: 'Buildings',
  Consumption: 'Consumption',
  Homelessness: 'Homelessness',
  Telecom: 'Telecom',
  Crime: 'Crime',
  Apartment: 'Apartment',
};

// Map helper to build default theme maps
export const getThemeIconMap = (safePrefix: boolean = false): Map<string, string> => {
  const prefix = safePrefix ? 'coui://ui-game/' : '';
  const map = new Map<string, string>();
  map.set('European', `${prefix}${ICONS.THEME_EUROPEAN}`);
  map.set('NorthAmerican', `${prefix}${ICONS.THEME_NORTH_AMERICAN}`);
  map.set('North American', `${prefix}${ICONS.THEME_NORTH_AMERICAN}`);
  map.set('EU', `${prefix}${ICONS.THEME_EUROPEAN}`);
  map.set('USA', `${prefix}${ICONS.THEME_NORTH_AMERICAN}`);
  return map;
};

export const getEfficiencyFactorIcon = (factorName: string): string => {
  if (!factorName) return ICONS.NOTIFICATION;
  const n = factorName.toLowerCase();
  if (n.includes('worker') || n.includes('employee') || n.includes('staff')) return ICONS.WORKERS;
  if (n.includes('electric') || n.includes('power')) return ICONS.SERVICE_ELECTRICITY;
  if (n.includes('water') || n.includes('sewage')) return ICONS.SERVICE_WATER;
  if (n.includes('garbage') || n.includes('waste')) return ICONS.SERVICE_GARBAGE;
  if (n.includes('mail')) return ICONS.SERVICE_POST;
  if (n.includes('crime')) return ICONS.SERVICE_POLICE;
  if (n.includes('transport') || n.includes('access') || n.includes('traffic')) return ICONS.TRAFFIC;
  if (n.includes('road') || n.includes('network')) return ICONS.SERVICE_ROADS;
  if (n.includes('healthcare') || n.includes('hospital') || n.includes('sick')) return ICONS.SERVICE_HEALTH;
  if (n.includes('education') || n.includes('school') || n.includes('university') || n.includes('college')) return ICONS.SERVICE_EDUCATION;
  if (n.includes('wealth')) return ICONS.WEALTH;
  if (n.includes('park') || n.includes('entertainment') || n.includes('attraction') || n.includes('leisure') || n.includes('apartment') || n.includes('building')) return ICONS.PARKS_AND_RECREATION;
  if (n.includes('welfare') || n.includes('wellbeing')) return ICONS.WELLBEING;
  if (n.includes('fire')) return ICONS.FIRE_AND_RESCUE;
  if (n.includes('deathcare') || n.includes('death') || n.includes('cemetery') || n.includes('crematorium')) return ICONS.SERVICE_DEATH;
  if (n.includes('police')) return ICONS.POLICE_AND_ADMIN;
  if (n.includes('telecom') || n.includes('network')) return ICONS.COMMUNICATIONS;
  if (n.includes('pollution') || n.includes('noise')) return ICONS.POLLUTION;
  if (n.includes('tax') || n.includes('consumption')) return ICONS.ECONOMY;
  return ICONS.NOTIFICATION;
};
