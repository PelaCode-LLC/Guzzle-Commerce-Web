export const localCategories = [
  { id: 'cars & trucks', name: 'Cars & Trucks', label: 'Cars & Trucks' },
  { id: 'motorcycles', name: 'Motorcycles', label: 'Motorcycles' },
  { id: 'watercraft', name: 'Watercraft', label: 'Watercraft' },
  { id: 'parts', name: 'Parts', label: 'Parts' },
  { id: 'electronics', name: 'Electronics', label: 'Electronics' },
  { id: 'tools', name: 'Tools', label: 'Tools' },
  { id: 'services', name: 'Services', label: 'Services' },
];

export const localCategoryCards = localCategories.map(category => ({
  id: category.id,
  name: category.name,
}));