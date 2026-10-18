// Shared HTTP client. Identification is the only operation that needs model services.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

const observationFields = ['id', 'scientific_name', 'plant_name', 'name', 'taxon_id', 'confidence',
  'needs_confirmation', 'needs_taxon_confirmation', 'user_confirmed', 'state', 'status_verified', 'invasive_status', 'wildlife_support', 'source', 'id_source'];

function observations(plants = []) {
  return plants.map(plant => Object.fromEntries(observationFields
    .filter(key => plant[key] !== undefined).map(key => [key, plant[key]])));
}

function aborted() {
  const error = new Error('Request cancelled.');
  error.name = 'AbortError';
  return error;
}

export function createApiClient({ baseUrl = API_URL, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  return async function request(path, payload, { signal, deadlineMs = timeoutMs } = {}) {
    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
      throw new Error('The app server is not configured. Set EXPO_PUBLIC_API_URL to the backend URL and restart the app.');
    }
    if (signal?.aborted) throw aborted();
    const controller = new AbortController();
    let timer;
    let onAbort;
    let timedOut = false;
    const interrupted = new Promise((_, reject) => {
      onAbort = () => { controller.abort(); reject(aborted()); };
      signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new Error('The server took too long to respond. Your saved work is unchanged. Please retry.'));
      }, deadlineMs);
    });
    try {
      const exchange = async () => {
        const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${path}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), signal: controller.signal,
        });
        let data;
        try { data = await res.json(); }
        catch { throw new Error(`The server returned an unreadable response (${res.status}). Please retry.`); }
        if (!res.ok) {
          const error = new Error(data?.error || `The server could not complete this request (${res.status}).`);
          error.code = data?.code;
          error.status = res.status;
          error.retryAfter = data?.retry_after;
          throw error;
        }
        if (!data || typeof data !== 'object' || !Object.prototype.hasOwnProperty.call(data, 'result')) {
          throw new Error('The server returned an incomplete response. Please retry.');
        }
        return data;
      };
      return await Promise.race([exchange(), interrupted]);
    } catch (error) {
      if (signal?.aborted) throw aborted();
      if (timedOut) throw new Error('The server took too long to respond. Your saved work is unchanged. Please retry.');
      if (error instanceof TypeError) throw new Error('Cannot reach the app server. Check your connection and retry; your saved audit is still available.');
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  };
}

const request = createApiClient();

export async function identifyPlant(images, location, options = {}) {
  return request('/identify', { images: Array.isArray(images) ? images : [images], location }, { deadlineMs: 60000, ...options });
}

export async function confirmPlant(scientificName, location, options = {}) {
  return request('/confirm', { scientific_name: scientificName, location }, options);
}

export async function getCatalog(location, options = {}) {
  return request('/catalog', { location }, options);
}

export async function getScore(plants, location, { additions = [], removals = [], ...options } = {}) {
  return request('/score', { plants: observations(plants), location, additions, removals }, options);
}

export async function getPlantRecommendations(location, { plants = [], site = {}, ...options } = {}) {
  return request('/recommend', { location, plants: observations(plants), site }, options);
}

export async function generateLetter(payload, options = {}) {
  const { plants = [], plant_names, zip_code, site, site_name, survey_date, proposal, is_sample = false } = payload;
  return request('/letter', { plants: observations(plants), plant_names, zip_code, site, site_name, survey_date, proposal, is_sample }, options);
}

export async function getPlan(plants, location, options = {}) {
  return request('/plan', { plants: observations(plants), location }, options);
}

function coordinates(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error('A valid latitude and longitude are required.');
  }
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}

export async function locate(place, options = {}) {
  const query = typeof place?.query === 'string' ? place.query.trim() : '';
  return request('/locate', query ? { query } : coordinates(place?.lat, place?.lon), options);
}

export async function getNearby(lat, lon, options = {}) {
  return request('/nearby', coordinates(lat, lon), options);
}
