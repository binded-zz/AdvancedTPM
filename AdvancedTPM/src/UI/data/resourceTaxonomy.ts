export type ChainStage = 'RawResource' | 'Industrial' | 'Retail' | 'Immaterial' | 'Commercial';

export interface ResourceItem {
  key: string;
  label: string;
  stage: ChainStage;
  icon: string;   // PascalCase name matching Media/Game/Resources/{icon}.svg
}

export interface ResourceCategory {
  id: string;
  label: string;
  icon: string;
  resources: ResourceItem[];
}

export const resourceCategories: ResourceCategory[] = [
  {
    id: 'all',
    label: 'All Resources',
    icon: 'Money',
    resources: [
      // Raw Materials
      { key: 'grain', label: 'Grain', stage: 'RawResource', icon: 'Grain' },
      { key: 'vegetables', label: 'Vegetables', stage: 'RawResource', icon: 'Vegetables' },
      { key: 'cotton', label: 'Cotton', stage: 'RawResource', icon: 'Cotton' },
      { key: 'livestock', label: 'Livestock', stage: 'RawResource', icon: 'Livestock' },
      { key: 'fish', label: 'Fish', stage: 'RawResource', icon: 'Fish' },
      { key: 'wood', label: 'Wood', stage: 'RawResource', icon: 'Wood' },
      { key: 'ore', label: 'Ore', stage: 'RawResource', icon: 'Ore' },
      { key: 'stone', label: 'Stone', stage: 'RawResource', icon: 'Stone' },
      { key: 'coal', label: 'Coal', stage: 'RawResource', icon: 'Coal' },
      { key: 'oil', label: 'Crude Oil', stage: 'RawResource', icon: 'Oil' },
      // Processed Goods
      { key: 'food', label: 'Food', stage: 'Industrial', icon: 'Food' },
      { key: 'beverages', label: 'Beverages', stage: 'Industrial', icon: 'Beverages' },
      { key: 'conveniencefood', label: 'Convenience Food', stage: 'Industrial', icon: 'ConvenienceFood' },
      { key: 'textiles', label: 'Textiles', stage: 'Industrial', icon: 'Textiles' },
      { key: 'timber', label: 'Timber', stage: 'Industrial', icon: 'Timber' },
      { key: 'paper', label: 'Paper', stage: 'Industrial', icon: 'Paper' },
      { key: 'furniture', label: 'Furniture', stage: 'Industrial', icon: 'Furniture' },
      { key: 'metals', label: 'Metals', stage: 'Industrial', icon: 'Metals' },
      { key: 'steel', label: 'Steel', stage: 'Industrial', icon: 'Steel' },
      { key: 'minerals', label: 'Minerals', stage: 'Industrial', icon: 'Minerals' },
      { key: 'concrete', label: 'Concrete', stage: 'Industrial', icon: 'Concrete' },
      { key: 'machinery', label: 'Machinery', stage: 'Industrial', icon: 'Machinery' },
      { key: 'electronics', label: 'Electronics', stage: 'Industrial', icon: 'Electronics' },
      { key: 'vehicles', label: 'Vehicles', stage: 'Industrial', icon: 'Vehicles' },
      { key: 'petrochemicals', label: 'Petrochemicals', stage: 'Industrial', icon: 'Petrochemicals' },
      { key: 'plastics', label: 'Plastics', stage: 'Industrial', icon: 'Plastics' },
      { key: 'chemicals', label: 'Chemicals', stage: 'Industrial', icon: 'Chemicals' },
      { key: 'pharmaceuticals', label: 'Pharmaceuticals', stage: 'Industrial', icon: 'Pharmaceuticals' },
      // Immaterial Goods
      { key: 'software', label: 'Software', stage: 'Immaterial', icon: 'Software' },
      { key: 'telecom', label: 'Telecom', stage: 'Immaterial', icon: 'Telecom' },
      { key: 'financial', label: 'Financial', stage: 'Immaterial', icon: 'Financial' },
      { key: 'media', label: 'Media', stage: 'Immaterial', icon: 'Media' },
      { key: 'lodging', label: 'Lodging', stage: 'Retail', icon: 'Lodging' },
      { key: 'meals', label: 'Meals', stage: 'Retail', icon: 'Meals' },
      { key: 'entertainment', label: 'Entertainment', stage: 'Retail', icon: 'Entertainment' },
      { key: 'recreation', label: 'Recreation', stage: 'Retail', icon: 'Recreation' },
      // Commercial Retail
      { key: 'c_food', label: 'Food', stage: 'Commercial', icon: 'Food' },
      { key: 'c_beverages', label: 'Beverages', stage: 'Commercial', icon: 'Beverages' },
      { key: 'c_conveniencefood', label: 'Convenience Food', stage: 'Commercial', icon: 'ConvenienceFood' },
      { key: 'c_textiles', label: 'Textiles', stage: 'Commercial', icon: 'Textiles' },
      { key: 'c_timber', label: 'Timber', stage: 'Commercial', icon: 'Timber' },
      { key: 'c_paper', label: 'Paper', stage: 'Commercial', icon: 'Paper' },
      { key: 'c_furniture', label: 'Furniture', stage: 'Commercial', icon: 'Furniture' },
      { key: 'c_metals', label: 'Metals', stage: 'Commercial', icon: 'Metals' },
      { key: 'c_steel', label: 'Steel', stage: 'Commercial', icon: 'Steel' },
      { key: 'c_minerals', label: 'Minerals', stage: 'Commercial', icon: 'Minerals' },
      { key: 'c_concrete', label: 'Concrete', stage: 'Commercial', icon: 'Concrete' },
      { key: 'c_machinery', label: 'Machinery', stage: 'Commercial', icon: 'Machinery' },
      { key: 'c_electronics', label: 'Electronics', stage: 'Commercial', icon: 'Electronics' },
      { key: 'c_vehicles', label: 'Vehicles', stage: 'Commercial', icon: 'Vehicles' },
      { key: 'c_petrochemicals', label: 'Petrochemicals', stage: 'Commercial', icon: 'Petrochemicals' },
      { key: 'c_plastics', label: 'Plastics', stage: 'Commercial', icon: 'Plastics' },
      { key: 'c_chemicals', label: 'Chemicals', stage: 'Commercial', icon: 'Chemicals' },
      { key: 'c_pharmaceuticals', label: 'Pharmaceuticals', stage: 'Commercial', icon: 'Pharmaceuticals' },
    ],
  },
  {
    id: 'agriculture',
    label: 'Agriculture & Livestock',
    icon: 'Grain',
    resources: [
      { key: 'grain', label: 'Grain', stage: 'RawResource', icon: 'Grain' },
      { key: 'vegetables', label: 'Vegetables', stage: 'RawResource', icon: 'Vegetables' },
      { key: 'cotton', label: 'Cotton', stage: 'RawResource', icon: 'Cotton' },
      { key: 'livestock', label: 'Livestock', stage: 'RawResource', icon: 'Livestock' },
      { key: 'fish', label: 'Fish', stage: 'RawResource', icon: 'Fish' },
      { key: 'food', label: 'Food', stage: 'Industrial', icon: 'Food' },
      { key: 'beverages', label: 'Beverages', stage: 'Industrial', icon: 'Beverages' },
      { key: 'conveniencefood', label: 'Convenience Food', stage: 'Industrial', icon: 'ConvenienceFood' },
      { key: 'textiles', label: 'Textiles', stage: 'Industrial', icon: 'Textiles' },
    ],
  },
  {
    id: 'forestry',
    label: 'Forestry',
    icon: 'Wood',
    resources: [
      { key: 'wood', label: 'Wood', stage: 'RawResource', icon: 'Wood' },
      { key: 'timber', label: 'Timber', stage: 'Industrial', icon: 'Timber' },
      { key: 'paper', label: 'Paper', stage: 'Industrial', icon: 'Paper' },
      { key: 'furniture', label: 'Furniture', stage: 'Industrial', icon: 'Furniture' },
    ],
  },
  {
    id: 'mining',
    label: 'Mining & Ore',
    icon: 'Ore',
    resources: [
      { key: 'ore', label: 'Ore', stage: 'RawResource', icon: 'Ore' },
      { key: 'stone', label: 'Stone', stage: 'RawResource', icon: 'Stone' },
      { key: 'coal', label: 'Coal', stage: 'RawResource', icon: 'Coal' },
      { key: 'metals', label: 'Metals', stage: 'Industrial', icon: 'Metals' },
      { key: 'steel', label: 'Steel', stage: 'Industrial', icon: 'Steel' },
      { key: 'minerals', label: 'Minerals', stage: 'Industrial', icon: 'Minerals' },
      { key: 'concrete', label: 'Concrete', stage: 'Industrial', icon: 'Concrete' },
      { key: 'machinery', label: 'Machinery', stage: 'Industrial', icon: 'Machinery' },
      { key: 'electronics', label: 'Electronics', stage: 'Industrial', icon: 'Electronics' },
      { key: 'vehicles', label: 'Vehicles', stage: 'Industrial', icon: 'Vehicles' },
    ],
  },
  {
    id: 'oil',
    label: 'Oil Industry',
    icon: 'Oil',
    resources: [
      { key: 'oil', label: 'Crude Oil', stage: 'RawResource', icon: 'Oil' },
      { key: 'petrochemicals', label: 'Petrochemicals', stage: 'Industrial', icon: 'Petrochemicals' },
      { key: 'plastics', label: 'Plastics', stage: 'Industrial', icon: 'Plastics' },
      { key: 'chemicals', label: 'Chemicals', stage: 'Industrial', icon: 'Chemicals' },
      { key: 'pharmaceuticals', label: 'Pharmaceuticals', stage: 'Industrial', icon: 'Pharmaceuticals' },
    ],
  },
  {
    id: 'office',
    label: 'Office',
    icon: 'Software',
    resources: [
      { key: 'software', label: 'Software', stage: 'Immaterial', icon: 'Software' },
      { key: 'telecom', label: 'Telecom', stage: 'Immaterial', icon: 'Telecom' },
      { key: 'financial', label: 'Financial', stage: 'Immaterial', icon: 'Financial' },
      { key: 'media', label: 'Media', stage: 'Immaterial', icon: 'Media' },
    ],
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    icon: 'Entertainment',
    resources: [
      { key: 'lodging', label: 'Lodging', stage: 'Retail', icon: 'Lodging' },
      { key: 'meals', label: 'Meals', stage: 'Retail', icon: 'Meals' },
      { key: 'entertainment', label: 'Entertainment', stage: 'Retail', icon: 'Entertainment' },
      { key: 'recreation', label: 'Recreation', stage: 'Retail', icon: 'Recreation' },
    ],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    icon: 'Food',
    resources: [
      { key: 'c_food', label: 'Food', stage: 'Commercial', icon: 'Food' },
      { key: 'c_beverages', label: 'Beverages', stage: 'Commercial', icon: 'Beverages' },
      { key: 'c_conveniencefood', label: 'Convenience Food', stage: 'Commercial', icon: 'ConvenienceFood' },
      { key: 'c_textiles', label: 'Textiles', stage: 'Commercial', icon: 'Textiles' },
      { key: 'c_timber', label: 'Timber', stage: 'Commercial', icon: 'Timber' },
      { key: 'c_paper', label: 'Paper', stage: 'Commercial', icon: 'Paper' },
      { key: 'c_furniture', label: 'Furniture', stage: 'Commercial', icon: 'Furniture' },
      { key: 'c_metals', label: 'Metals', stage: 'Commercial', icon: 'Metals' },
      { key: 'c_steel', label: 'Steel', stage: 'Commercial', icon: 'Steel' },
      { key: 'c_minerals', label: 'Minerals', stage: 'Commercial', icon: 'Minerals' },
      { key: 'c_concrete', label: 'Concrete', stage: 'Commercial', icon: 'Concrete' },
      { key: 'c_machinery', label: 'Machinery', stage: 'Commercial', icon: 'Machinery' },
      { key: 'c_electronics', label: 'Electronics', stage: 'Commercial', icon: 'Electronics' },
      { key: 'c_vehicles', label: 'Vehicles', stage: 'Commercial', icon: 'Vehicles' },
      { key: 'c_petrochemicals', label: 'Petrochemicals', stage: 'Commercial', icon: 'Petrochemicals' },
      { key: 'c_plastics', label: 'Plastics', stage: 'Commercial', icon: 'Plastics' },
      { key: 'c_chemicals', label: 'Chemicals', stage: 'Commercial', icon: 'Chemicals' },
      { key: 'c_pharmaceuticals', label: 'Pharmaceuticals', stage: 'Commercial', icon: 'Pharmaceuticals' },
    ],
  },
];
