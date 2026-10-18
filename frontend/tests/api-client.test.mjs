import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../services/geminiService.js', import.meta.url), 'utf8');
const { createApiClient } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const response = (result) => ({ ok: true, status: 200, json: async () => ({ result }) });

test('valid requests use JSON, configured base URL, and cancellation signal', async () => {
  let sent;
  const request = createApiClient({ baseUrl: 'https://example.org/', fetchImpl: async (...args) => { sent = args; return response({ native_share: 50 }); } });
  assert.deepEqual(await request('/score', { plants: [] }), { result: { native_share: 50 } });
  assert.equal(sent[0], 'https://example.org/score');
  assert.deepEqual(JSON.parse(sent[1].body), { plants: [] });
  assert.equal(sent[1].method, 'POST');
  assert.ok(sent[1].signal instanceof AbortSignal);
});

test('deadline ends stalled requests even when fetch ignores abort', async () => {
  let signal;
  const request = createApiClient({ baseUrl: 'https://example.org', timeoutMs: 10, fetchImpl: async (_, options) => { signal = options.signal; return new Promise(() => {}); } });
  await assert.rejects(request('/score', {}), /too long/);
  assert.equal(signal.aborted, true);
});

test('navigation cancellation rejects promptly and cancels the underlying request', async () => {
  let signal;
  const controller = new AbortController();
  const request = createApiClient({ baseUrl: 'https://example.org', fetchImpl: async (_, options) => { signal = options.signal; return new Promise(() => {}); } });
  const pending = request('/identify', {}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(signal.aborted, true);
});

test('a pre-cancelled request never reaches the network', async () => {
  const controller = new AbortController(); controller.abort();
  const request = createApiClient({ baseUrl: 'https://example.org', fetchImpl: () => assert.fail('No network expected') });
  await assert.rejects(request('/score', {}, { signal: controller.signal }), { name: 'AbortError' });
});

test('rate limits preserve useful retry metadata and server message', async () => {
  const request = createApiClient({ baseUrl: 'https://example.org', fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: 'Try the catalog.', code: 'rate_limited', retry_after: 35 }) }) });
  await assert.rejects(request('/identify', {}), error => error.message === 'Try the catalog.' && error.status === 429 && error.retryAfter === 35);
});

test('HTML, incomplete JSON, and unreachable servers produce visible recovery messages', async () => {
  for (const [fetchImpl, expected] of [
    [async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError(); } }), /unreadable response/],
    [async () => ({ ok: true, status: 200, json: async () => ({}) }), /incomplete response/],
    [async () => { throw new TypeError('Failed to fetch'); }, /saved audit is still available/],
  ]) await assert.rejects(createApiClient({ baseUrl: 'https://example.org', fetchImpl })('/score', {}), expected);
});

test('unconfigured server fails before network access', async () => {
  await assert.rejects(createApiClient({ baseUrl: '', fetchImpl: () => assert.fail('No network expected') })('/score', {}), /not configured/);
});

test('production wrappers strip photographs and preserve sample labeling', async () => {
  const oldUrl = process.env.EXPO_PUBLIC_API_URL;
  const oldFetch = globalThis.fetch;
  const sent = [];
  process.env.EXPO_PUBLIC_API_URL = 'https://example.org';
  globalThis.fetch = async (_, options) => { sent.push(JSON.parse(options.body)); return response({}); };
  try {
    const api = await import(`data:text/javascript;base64,${Buffer.from(source + '\n// wrapper test instance').toString('base64')}`);
    const plants = [{ scientific_name: 'Zamia integrifolia', user_confirmed: true, photos: ['private photo'], photo: 'private photo', uri: 'file:///private', wildlife_support: 'documented' }];
    await api.getScore(plants, '33431');
    await api.generateLetter({ plants, plant_names: ['Muhlenbergia capillaris'], zip_code: '33431', is_sample: true });
    assert.equal(sent[1].is_sample, true);
    for (const body of sent) {
      assert.equal(body.plants[0].scientific_name, 'Zamia integrifolia');
      assert.equal(body.plants[0].photos, undefined);
      assert.equal(body.plants[0].uri, undefined);
      assert.equal(body.plants[0].photo, undefined);
    }
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = oldUrl;
  }
});

let wrapperInstance = 0;
async function productionApi(fetchImpl) {
  const oldUrl = process.env.EXPO_PUBLIC_API_URL;
  const oldFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://example.org/';
  globalThis.fetch = fetchImpl;
  try {
    // Each production client captures its transport at import time. Restore the
    // process globals before exercising it so one test cannot affect another.
    return await import(`data:text/javascript;base64,${Buffer.from(source + `\n// helper instance ${++wrapperInstance}`).toString('base64')}`);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = oldUrl;
  }
}

test('plan requests send verified observation fields without photo or field-note contents', async () => {
  let sent;
  const api = await productionApi(async (url, options) => { sent = { url, options }; return response({ actions: [] }); });
  const plants = [{
    scientific_name: 'Zamia integrifolia', taxon_id: 'zamia-integrifolia', user_confirmed: true,
    status_verified: true, needs_confirmation: false, invasive_status: 'native',
    photos: ['private image'], base64: 'private encoded image', photo_uri: 'file:///private',
    note: 'Private student field notes', coordinates: { lat: 26.368716, lon: -80.128942 },
  }];
  const controller = new AbortController();
  assert.deepEqual(await api.getPlan(plants, '33431', { signal: controller.signal, deadlineMs: 300 }), { result: { actions: [] } });
  assert.equal(sent.url, 'https://example.org/plan');
  assert.equal(sent.options.method, 'POST');
  assert.deepEqual(JSON.parse(sent.options.body), {
    plants: [{ scientific_name: 'Zamia integrifolia', taxon_id: 'zamia-integrifolia', user_confirmed: true,
      status_verified: true, needs_confirmation: false, invasive_status: 'native' }],
    location: '33431',
  });
  assert.ok(sent.options.signal instanceof AbortSignal);
  assert.deepEqual(plants[0].photos, ['private image'], 'Request filtering must not remove the local photo.');
});

test('text location sends only the trimmed query, even when the place object also contains coordinates', async () => {
  const sent = [];
  const api = await productionApi(async (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return response({ zip_code: '33431' }); });
  const place = { query: '  Boca Raton, FL  ', lat: 26.368716, lon: -80.128942, accuracy: 5, altitude: 3, deviceId: 'private' };
  assert.deepEqual(await api.locate(place), { result: { zip_code: '33431' } });
  assert.deepEqual(sent, [{ url: 'https://example.org/locate', body: { query: 'Boca Raton, FL' } }]);
  assert.equal(place.query, '  Boca Raton, FL  ', 'Normalization must not modify the caller object.');
});

test('coordinate location and nearby queries discard metadata and send only rounded coordinates', async () => {
  const sent = [];
  const api = await productionApi(async (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return response([]); });
  const place = { query: '   ', lat: 26.368716, lon: -80.128942, accuracy: 4.5, heading: 2, timestamp: 1234 };
  await api.locate(place);
  await api.getNearby(place.lat, place.lon, { deadlineMs: 300, accuracy: 4.5 });
  assert.deepEqual(sent, [
    { url: 'https://example.org/locate', body: { lat: 26.37, lon: -80.13 } },
    { url: 'https://example.org/nearby', body: { lat: 26.37, lon: -80.13 } },
  ]);
  assert.equal(place.lat, 26.368716, 'The stored location must not be changed by request rounding.');
});

test('invalid or out-of-range coordinates fail before any location request', async () => {
  const api = await productionApi(() => assert.fail('Invalid coordinates must not reach the network'));
  for (const [lat, lon] of [[NaN, -80], [26, Infinity], [null, -80], ['26.37', -80], [91, 0], [-91, 0], [0, 181], [0, -181]]) {
    await assert.rejects(api.locate({ lat, lon }));
    await assert.rejects(api.getNearby(lat, lon));
  }
  await assert.rejects(api.locate({ query: '  ' }));
});

const newWrapperCalls = {
  getPlan: (api, options) => api.getPlan([], '33431', options),
  locate: (api, options) => api.locate({ query: 'Boca Raton, FL' }, options),
  getNearby: (api, options) => api.getNearby(26.368716, -80.128942, options),
};

test('all new helpers forward pre-cancellation without making a request', async () => {
  const api = await productionApi(() => assert.fail('Cancelled helper must not reach the network'));
  for (const call of Object.values(newWrapperCalls)) {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(call(api, { signal: controller.signal }), { name: 'AbortError' });
  }
});

test('navigation cancellation reaches the underlying plan, location, and nearby requests', async () => {
  for (const [name, call] of Object.entries(newWrapperCalls)) {
    let requestSignal;
    const api = await productionApi(async (_, options) => { requestSignal = options.signal; return new Promise(() => {}); });
    const controller = new AbortController();
    const pending = call(api, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' }, name);
    assert.equal(requestSignal.aborted, true, name);
  }
});

test('new helpers preserve bounded deadlines when the transport stalls', async () => {
  for (const [name, call] of Object.entries(newWrapperCalls)) {
    let requestSignal;
    const api = await productionApi(async (_, options) => { requestSignal = options.signal; return new Promise(() => {}); });
    await assert.rejects(call(api, { deadlineMs: 10 }), /too long/, name);
    assert.equal(requestSignal.aborted, true, name);
  }
});
