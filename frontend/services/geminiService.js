const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function parseResponse(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
}

export async function identifyPlant(imageData, location) {
  const res = await fetch(`${API_URL}/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData, location }),
  });
  return parseResponse(res);
}

export async function getSummary(plants) {
  const res = await fetch(`${API_URL}/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plants }),
  });
  return parseResponse(res);
}

export async function getPlantRecommendations(location) {
  const res = await fetch(`${API_URL}/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location }),
  });
  return parseResponse(res);
}

export async function generateLetter(plantNames, summary, zipCode) {
  const res = await fetch(`${API_URL}/letter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_names: plantNames, summary, zip_code: zipCode }),
  });
  return parseResponse(res);
}
