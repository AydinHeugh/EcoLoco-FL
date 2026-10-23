import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDITS_KEY, createAuditStore } from '../frontend/services/savedAuditStore.js';
import { clearAudit, currentAudit, forgetScannedPlant, rememberAudit } from '../frontend/auditDraft.js';

function memoryStorage() {
  const values = new Map();
  return {
    values,
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
  };
}

function audit(name = 'North campus') {
  return {
    name, zipCode: '33431',
    request: {
      plants: [{ _id: 'plant-1', plant_name: 'Coontie', scientific_name: 'Zamia integrifolia', status: 'native', photo_uri: 'blob:temporary' }],
      skip: ['Quercus virginiana'], site: { light: 'sun' }, showAll: true, extras: ['Hamelia patens'],
    },
    plan: { summary: { percent_native: 100 }, add: [], remove: [] },
    nearby: [{ plant_name: 'Coontie' }], letter: 'Our campus needs more native plants.',
    lat: 26.37, lon: -80.1,
  };
}

test('multiple campuses survive a new store instance with choices and letter intact', async () => {
  const storage = memoryStorage();
  const store = createAuditStore(storage);
  const first = await store.save(audit());
  const second = await store.save(audit('South campus'));
  assert.notEqual(first.id, second.id);
  const reopened = await createAuditStore(storage).list();
  assert.equal(reopened.length, 2);
  const north = reopened.find(a => a.id === first.id);
  assert.deepEqual(north.request.skip, ['Quercus virginiana']);
  assert.deepEqual(north.request.site, { light: 'sun' });
  assert.deepEqual(north.request.extras, ['Hamelia patens']);
  assert.equal(north.request.showAll, true);
  assert.equal(north.letter, audit().letter);
  assert.equal(north.plan.summary.percent_native, 100);
  assert.equal('lat' in north, false);
  assert.equal('lon' in north, false);
  assert.equal('photo_uri' in north.request.plants[0], false);
});

test('saving changes updates the same audit and preserves its creation date', async () => {
  const store = createAuditStore(memoryStorage());
  const saved = await store.save(audit());
  const updated = await store.save({ ...saved, name: '  North garden  ', letter: 'Edited letter' });
  assert.equal(updated.id, saved.id);
  assert.equal(updated.createdAt, saved.createdAt);
  assert.equal(updated.name, 'North garden');
  assert.equal((await store.list()).length, 1);
  assert.equal((await store.list())[0].letter, 'Edited letter');
});

test('concurrent saves retain both campuses and deleting one preserves the other', async () => {
  const store = createAuditStore(memoryStorage());
  const [north, south] = await Promise.all([store.save(audit()), store.save(audit('South campus'))]);
  assert.equal((await store.list()).length, 2);
  await store.remove(north.id);
  assert.deepEqual((await store.list()).map(a => a.id), [south.id]);
});

test('a failed write never reports success or erases existing audits and a retry works', async () => {
  const storage = memoryStorage();
  const store = createAuditStore(storage);
  const north = await store.save(audit());
  const write = storage.setItem;
  storage.setItem = async () => { throw new Error('Storage full'); };
  await assert.rejects(store.save(audit('South campus')), /Storage full/);
  await assert.rejects(store.remove(north.id), /Storage full/);
  assert.equal((await store.list()).length, 1);
  storage.setItem = write;
  await store.save(audit('South campus'));
  assert.equal((await store.list()).length, 2);
});

test('unreadable storage is left untouched by save and delete', async () => {
  const storage = memoryStorage();
  storage.values.set(AUDITS_KEY, '{broken');
  const store = createAuditStore(storage);
  await assert.rejects(store.list());
  await assert.rejects(store.save(audit()));
  await assert.rejects(store.remove('anything'));
  assert.equal(storage.values.get(AUDITS_KEY), '{broken');
});

test('empty names and empty audits cannot replace a saved audit', async () => {
  const store = createAuditStore(memoryStorage());
  const saved = await store.save(audit());
  await assert.rejects(store.save({ ...saved, name: '   ' }));
  await assert.rejects(store.save({ ...saved, request: { ...saved.request, plants: [] } }));
  assert.equal((await store.list())[0].name, saved.name);
});

test('starting another audit and removing active plants leave saved audits intact', async () => {
  const store = createAuditStore(memoryStorage());
  const saved = await store.save(audit());
  rememberAudit([{ _id: 'plant-1' }, { _id: 'plant-2' }], { zip: '33496' });
  forgetScannedPlant('plant-1');
  assert.deepEqual(currentAudit().plants, [{ _id: 'plant-2' }]);
  assert.equal((await store.list())[0].request.plants.length, 1);
  clearAudit();
  assert.deepEqual(currentAudit(), { plants: [], place: null });
  assert.equal((await store.list())[0].id, saved.id);
});
