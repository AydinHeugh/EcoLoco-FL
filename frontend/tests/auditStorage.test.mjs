import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Inject the native adapter so the persistence logic is tested without a device.
const source = (await readFile(new URL('../services/auditStorage.js', import.meta.url), 'utf8')).replace("import AsyncStorage from '@react-native-async-storage/async-storage';", 'const AsyncStorage = {};');
const { createAuditStore, createEmptyAudit, buildAuditReport } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function memoryStorage() {
  const disk = new Map();
  return { disk, getItem: async key => disk.get(key) ?? null, setItem: async (key, value) => { disk.set(key, value); } };
}

test('audit and edited proposal survive a fresh store without photo payloads', async () => {
  const disk = memoryStorage();
  const store = createAuditStore(disk);
  const audit = createEmptyAudit();
  audit.plants = [{ scientific_name: 'Quercus virginiana', base64: 'large-upload', photos: ['large'], photo_uri: 'temporary' }];
  await store.save(audit);
  await store.patch(audit.id, { site_name: 'North courtyard', proposal: { budget: '$50' }, letter: 'Edited by the team.' });
  const restored = await createAuditStore(disk).load();
  assert.equal(restored.site_name, 'North courtyard');
  assert.equal(restored.proposal.budget, '$50');
  assert.equal(restored.proposal.student_name, '');
  assert.equal(restored.letter, 'Edited by the team.');
  assert.deepEqual(restored.plants, [{ scientific_name: 'Quercus virginiana' }]);
});

test('queued writes cannot overwrite a later draft and patches merge unrelated fields', async () => {
  const disk = memoryStorage();
  let release;
  const store = createAuditStore({
    getItem: disk.getItem,
    setItem: async (key, value) => {
      if (JSON.parse(value).letter === 'First draft') await new Promise(resolve => { release = resolve; });
      await disk.setItem(key, value);
    },
  });
  const audit = createEmptyAudit();
  await store.save(audit);
  const first = store.patch(audit.id, { letter: 'First draft' });
  await new Promise(resolve => setTimeout(resolve, 0));
  const second = store.patch(audit.id, { letter: 'Latest draft', proposal: { quantity: '3' } });
  const third = store.patch(audit.id, { proposal: { maintenance: 'Eco club' } });
  release();
  await Promise.all([first, second, third]);
  const restored = await createAuditStore(disk).load();
  assert.equal(restored.letter, 'Latest draft');
  assert.equal(restored.proposal.quantity, '3');
  assert.equal(restored.proposal.maintenance, 'Eco club');
});

test('sample audit and resets never replace the real survey', async () => {
  const disk = memoryStorage();
  const store = createAuditStore(disk);
  const real = { ...createEmptyAudit(), site_name: 'Our real campus' };
  await store.save(real);
  await store.save({ ...createEmptyAudit(true), site_name: 'Fictional sample' });
  await store.save(createEmptyAudit(true));
  assert.equal((await createAuditStore(disk).load(false)).site_name, 'Our real campus');
  assert.equal((await createAuditStore(disk).load(true)).sample, true);
});

test('storage failure is reported and a later retry persists the latest in-memory work', async () => {
  const disk = memoryStorage();
  let fail = false;
  const store = createAuditStore({ getItem: disk.getItem, setItem: async (...args) => {
    if (fail) throw new Error('Storage full');
    return disk.setItem(...args);
  } });
  const audit = createEmptyAudit();
  await store.save(audit);
  fail = true;
  await assert.rejects(store.patch(audit.id, { letter: 'Do not lose this' }), /Storage full/);
  await assert.rejects(store.flush(), /Storage full/);
  fail = false;
  await store.patch(audit.id, {});
  assert.equal((await createAuditStore(disk).load()).letter, 'Do not lose this');
});

test('old screen cannot write into a newly reset audit', async () => {
  const store = createAuditStore(memoryStorage());
  const old = createEmptyAudit();
  await store.save(old);
  await store.save(createEmptyAudit());
  await assert.rejects(store.patch(old.id, { letter: 'Stale reply' }), /audit has changed/);
});

test('corrupt saved data is reported without silently replacing the user survey', async () => {
  const disk = memoryStorage();
  const store = createAuditStore(disk);
  await store.save(createEmptyAudit());
  const key = [...disk.disk.keys()][0];
  disk.disk.set(key, JSON.stringify({ ...createEmptyAudit(), plants: [null] }));
  await assert.rejects(createAuditStore(disk).load(), /saved audit could not be read/);
  assert.equal(JSON.parse(disk.disk.get(key)).plants[0], null);
  const recovered = createAuditStore(disk);
  await recovered.save(createEmptyAudit());
  assert.deepEqual((await createAuditStore(disk).load()).plants, []);
});

test('sample export retains provenance, limitations and stale draft warning', () => {
  const audit = {
    ...createEmptyAudit(true), site_name: 'Fictional garden', zip_code: '33431',
    plants: [{ plant_name: 'Live oak', scientific_name: 'Quercus virginiana', user_confirmed: true, status_verified: true, invasive_status: 'native', source_url: 'https://example.org/oak', verified_on: '2026-10-17' }],
    selected_species: ['Zamia integrifolia'], letter: 'Please consider this plan.', letter_stale: true,
  };
  const report = buildAuditReport(audit, { native_share: 100, native_count: 1, verified_species_count: 1, non_native_count: 0, invasive_count: 0, unresolved_count: 0, observation_count: 1, projected: { native_share: 100, native_count: 2, verified_species_count: 2 } });
  assert.match(report, /FICTIONAL DEMONSTRATION/);
  assert.match(report, /https:\/\/example.org\/oak/);
  assert.match(report, /DRAFT OUTDATED/);
  assert.match(report, /not campus biodiversity/);
  assert.match(report, /100% \(1\/1 verified taxa\)/);
});
