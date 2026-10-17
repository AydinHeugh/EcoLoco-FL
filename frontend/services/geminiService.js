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

export async function getPlan(plants, location) {
  return post('/plan', { plants, location });
}

export async function getPlantRecommendations(location) {
  return post('/recommend', { location });
}

export async function generateLetter(plan, zipCode) {
  return post('/letter', { plan, zip_code: zipCode });
}

export function userMessage(err, fallback) {
  return err?.status === 400 ? err.message : fallback;
}
