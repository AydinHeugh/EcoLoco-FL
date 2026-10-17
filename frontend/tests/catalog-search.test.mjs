import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../utils/catalogSearch.js', import.meta.url), 'utf8');
const { matchesCatalogQuery } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const natives = JSON.parse(await readFile(new URL('../../backend/data/fl_natives.json', import.meta.url), 'utf8')).species;
const nonnatives = JSON.parse(await readFile(new URL('../../backend/data/fl_non_natives.json', import.meta.url), 'utf8')).species;

test('known scientific synonyms locate the canonical catalog record', () => {
  const matches = natives.filter(plant => matchesCatalogQuery(plant, '  sPoRoBoLuS bAkErI  '));
  assert.deepEqual(matches.map(plant => plant.scientific_name), ['Spartina bakeri']);
  assert.equal(matchesCatalogQuery(natives.find(plant => plant.scientific_name === 'Zamia integrifolia'), 'Zamia floridana'), true);
});

test('cultivar search retains the precise nonnative taxon instead of its invasive relative', () => {
  const matches = nonnatives.filter(plant => matchesCatalogQuery(plant, 'Green Island'));
  assert.deepEqual(matches.map(plant => plant.scientific_name), ['Ficus microcarpa subsp. fuyuensis']);
});

test('common and canonical names remain searchable without matching absent metadata', () => {
  const plant = { plant_name: 'Live oak', scientific_name: 'Quercus virginiana' };
  assert.equal(matchesCatalogQuery(plant, 'live OAK'), true);
  assert.equal(matchesCatalogQuery(plant, 'Quercus'), true);
  assert.equal(matchesCatalogQuery(plant, 'undefined'), false);
  assert.equal(matchesCatalogQuery(plant, ''), true);
});
