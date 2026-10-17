export function matchesCatalogQuery(plant, query = '') {
  const names = [plant?.common_name, plant?.plant_name, plant?.scientific_name,
    ...(Array.isArray(plant?.synonyms) ? plant.synonyms : [])];
  return names.filter(name => typeof name === 'string').join(' ').toLowerCase()
    .includes(query.trim().toLowerCase());
}
