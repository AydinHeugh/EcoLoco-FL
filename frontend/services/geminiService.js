const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function parseResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || `Server error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function post(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseResponse(res);
}

export async function identifyPlant(images, location) {
  return post('/identify', { images, location });
}

export async function searchNames(query) {
  return post('/names', { query });
}

export async function choosePlant(scientificName, location) {
  return post('/choose', { scientific_name: scientificName, location });
}

export async function getPlan(plants, location, skip = [], site = null, showAll = false, letterExtras = []) {
  return post('/plan', { plants, location, skip, site, show_all: showAll, letter_extras: letterExtras });
}

export async function getPlantRecommendations(location, site = null) {
  return post('/recommend', { location, site });
}

export async function generateLetter(plan, zipCode) {
  return post('/letter', { plan, zip_code: zipCode });
}

export async function locate(place) {
  return post('/locate', place);
}

export async function getNearby(lat, lon) {
  return post('/nearby', { lat, lon });
}

export function userMessage(err, fallback) {
  return err?.status === 400 ? err.message : fallback;
}
