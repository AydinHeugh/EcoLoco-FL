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
