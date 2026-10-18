import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = async (path) => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(path, import.meta.url), 'utf8')).toString('base64')}`);
const evidence = await load('../utils/plantEvidence.js');
const photos = await load('../utils/photoInput.js');

test('missing status never becomes nonnative, and evidence flags are required', () => {
  for (const input of [{}, { invasive_status: 'unknown' }, { is_native: false }, { is_native: true, status_verified: false }]) {
    assert.equal(evidence.taxonomyStatus(input).tone, 'unknown');
  }
});

test('positively verified native, nonnative and invasive remain classified during outages', () => {
  assert.equal(evidence.taxonomyStatus({ status_verified: true, is_native: true, ai_unavailable: true }).tone, 'native');
  assert.equal(evidence.taxonomyStatus({ status_verified: true, is_native: false }).tone, 'nonnative');
  assert.equal(evidence.taxonomyStatus({ status_verified: true, invasive_status: 'invasive' }).tone, 'invasive');
});

test('close candidates require review even with a high confidence number', () => {
  assert.equal(evidence.identificationNeedsConfirmation({ scientific_name: 'Species alpha', confidence: 0.97, needs_confirmation: true }), true);
  assert.equal(evidence.identificationNeedsConfirmation({ scientific_name: 'Species alpha', confidence: 0.97, needs_confirmation: false }), false);
  assert.equal(evidence.identificationNeedsConfirmation({ scientific_name: 'Species alpha', confidence: null }), true);
});

test('explicit confirmation state keeps a high-score close call in review', () => {
  assert.equal(evidence.identificationNeedsConfirmation({ state: 'confirm', scientific_name: 'Species alpha', confidence: 0.93 }), true);
  assert.equal(evidence.identificationNeedsConfirmation({ state: 'identified', scientific_name: 'Species alpha', confidence: 0.93 }), false);
});

test('an unidentified response never exposes a leftover candidate as a selectable match', () => {
  const result = { state: 'unidentified', scientific_name: 'Species alpha', confidence: 0.99, user_confirmed: true, suggested: 1, candidates: [{ scientific_name: 'Species beta', confidence: 0.8 }] };
  assert.equal(evidence.identificationNeedsConfirmation(result), true);
  assert.deepEqual(evidence.confirmationCandidates(result), []);
  assert.equal(evidence.suggestedCandidateName(result), '');
});

test('manual identification does not resolve a consequential variety distinction', () => {
  assert.equal(evidence.identificationNeedsConfirmation({ user_confirmed: true, scientific_name: 'Hamelia patens', needs_taxon_confirmation: true }), true);
  assert.equal(evidence.identificationNeedsConfirmation({ user_confirmed: true, scientific_name: 'Zamia integrifolia', confidence: null }), false);
});

test('candidate choices preserve distinct taxa and omit duplicate names', () => {
  const result = evidence.confirmationCandidates({ scientific_name: 'Hamelia patens', candidates: [{ scientific_name: 'HAMELIA PATENS' }, { scientific_name: 'Hamelia patens var. glabra' }, null, {}] });
  assert.deepEqual(result.map((item) => item.scientific_name), ['Hamelia patens', 'Hamelia patens var. glabra']);
});

test('suggested index refers to original provider order even when displayed choices deduplicate', () => {
  const result = { scientific_name: 'Species alpha', confidence: 0.93, suggested: 2, candidates: [{ scientific_name: 'SPECIES ALPHA', confidence: 0.91 }, { scientific_name: 'Species beta', confidence: 0.85 }] };
  const before = JSON.stringify(result);
  assert.deepEqual(evidence.confirmationCandidates(result).map(item => item.scientific_name), ['Species alpha', 'Species beta']);
  assert.equal(evidence.suggestedCandidateName(result), 'species beta');
  assert.equal(evidence.candidateMatchText(result.candidates[1], 'openai_adjudicated'), 'Pl@ntNet · 85% match');
  assert.equal(evidence.candidateMatchText(result, 'openai_fallback'), 'Image review · 93% match');
  assert.equal(JSON.stringify(result), before);
  for (const suggested of [-1, 50, 0.5, null]) assert.equal(evidence.suggestedCandidateName({ ...result, suggested }), '');
  for (const confidence of [-1, 2, null, NaN, '0.9']) assert.equal(evidence.candidateMatchText({ confidence }, 'plantnet'), '');
});

test('Atlas links require explicit verification and a secure URL', () => {
  const atlas_url = 'https://florida.plantatlas.usf.edu/plant/species/2105';
  assert.equal(evidence.verifiedAtlasUrl({ atlas_url }), null);
  assert.equal(evidence.verifiedAtlasUrl({ atlas_url, atlas_verified: false }), null);
  assert.equal(evidence.verifiedAtlasUrl({ atlas_url, atlas_verified: true }), atlas_url);
  assert.equal(evidence.verifiedAtlasUrl({ atlas_url: 'javascript:alert(1)', atlas_verified: true }), null);
});

test('expanded plant facts retain sourced buying, caution and growing information', () => {
  const source = { name: 'Plant reference', url: 'https://example.org/plant' };
  const rows = evidence.plantExtraFacts({
    sun: ['full', 'part'], sun_description: 'Full sun to light shade', mature_size: '1–4 feet', growing_source: source,
    buying: { ask_for: 'Zamia integrifolia', avoid: 'Ask for the Florida kind.', source },
    watch_out: [{ text: 'Seeds are toxic to pets.', source }],
    removal_safety: { text: 'Ask grounds staff to confirm safe removal.', source },
  });
  assert.deepEqual(rows.map(row => row.title), ['Growing', 'Buying', 'Before planting', 'Removal guidance']);
  assert.match(rows[0].text, /Full sun to light shade.*1–4 feet/);
  assert.match(rows[1].text, /Zamia integrifolia.*Florida kind/);
  assert.ok(rows.every(row => row.source_url === source.url && row.source_name === source.name));
  assert.deepEqual(evidence.plantExtraFacts({ buying: null, watch_out: [null, {}, 'bad'], removal_safety: {}, sun_description: {} }), []);
  assert.equal(evidence.plantExtraFacts({ watch_out: [{ text: 'Check first.', source: { url: 'file:///secret' } }] })[0].source_url, null);
});

test('source links cannot open script, local-file or insecure schemes', () => {
  for (const value of ['javascript:alert(1)', 'file:///tmp/test', 'data:text/html,bad', 'http://example.com', '']) assert.equal(evidence.safeEvidenceUrl(value), null);
  assert.equal(evidence.safeEvidenceUrl('https://plants.ifas.ufl.edu/'), 'https://plants.ifas.ufl.edu/');
});

test('provider attribution distinguishes PlantNet, adjudication and fallback', () => {
  assert.match(evidence.identificationProvider('plantnet'), /Pl@ntNet/);
  assert.match(evidence.identificationProvider('openai_adjudicated'), /candidates/);
  assert.match(evidence.identificationProvider('openai_fallback'), /unavailable/);
  assert.equal(evidence.identificationProvider('manual_confirmation'), 'Selected by you');
});

test('browser uploads reject unsupported, empty and oversized files before decoding', () => {
  const jpeg = { type: 'image/jpeg', size: 1024 };
  assert.equal(photos.validatePhotoFiles([jpeg, { type: 'image/png', size: 15 }]).length, 2);
  for (const file of [{ type: 'image/svg+xml', size: 50 }, { type: 'image/heic', size: 100 }, { type: 'image/jpeg', size: 0 }, { type: 'image/jpeg', size: photos.MAX_UPLOAD_BYTES + 1 }]) assert.throws(() => photos.validatePhotoFiles([file]));
  assert.throws(() => photos.validatePhotoFiles(Array(6).fill(jpeg)), /five/);
  assert.throws(() => photos.validatePhotoFiles([jpeg, jpeg], 4), /five/);
});

test('decoded photo size calculation handles padding and data prefixes', () => {
  assert.equal(photos.base64ByteLength('YQ=='), 1);
  assert.equal(photos.base64ByteLength('YWI='), 2);
  assert.equal(photos.base64ByteLength('YWJj'), 3);
  assert.equal(photos.base64ByteLength('data:image/jpeg;base64,YWI='), 2);
});

test('FISC zones render identically from actual API strings and arrays', () => {
  assert.equal(evidence.evidenceText('N, C, S'), 'N, C, S');
  assert.equal(evidence.evidenceText(['N', 'C', 'S']), 'N, C, S');
  assert.equal(evidence.evidenceText(' S '), 'S');
});

test('optional evidence metadata tolerates missing and malformed saved values', () => {
  for (const value of [null, undefined, {}, true, Infinity]) assert.equal(evidence.evidenceText(value), '');
  assert.equal(evidence.evidenceText(['N', null, {}, 'C', ['S']]), 'N, C, S');
  assert.equal(evidence.evidenceText(2), '2');
  assert.deepEqual(evidence.confirmationCandidates({ candidates: [{ scientific_name: {} }, { scientific_name: ['Zamia integrifolia'] }, null] }), []);
});
