export const localCategories = [
  { id: 'cars & trucks', label: 'Cars & Trucks' },
  { id: 'motorcycles', label: 'Motorcycles' },
  { id: 'watercraft', label: 'Watercraft' },
  { id: 'parts', label: 'Parts' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'tools', label: 'Tools' },
  { id: 'services', label: 'Services' },
];

export const localCategoryCards = localCategories.map(category => ({
  id: category.id,
  name: category.label,
}));