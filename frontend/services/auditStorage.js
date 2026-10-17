import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'ecoloco.audit.v1';

export function createEmptyAudit(sample = false) {
  const date = new Date();
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return {
    version: 1,
    id: `${sample ? 'sample' : 'audit'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sample,
    site_name: '',
    survey_date: localDate,
    zip_code: '',
    site: { sun: 'unknown', moisture: 'unknown', space: 'unknown', maintenance: 'unknown' },
    plants: [],
    selected_species: [],
    proposal: { location: '', quantity: '', budget: '', maintenance: '', student_name: '', school_name: '', principal_name: '' },
    letter: '',
    letter_stale: false,
    updated_at: date.toISOString(),
  };
}

// Separate keys keep the demonstration from replacing a real campus survey.
// Serialize disk writes: a slow earlier write must never overwrite newer work.
export function createAuditStore(storage) {
  const cache = new Map();
  const listeners = new Set();
  let writes = Promise.resolve();
  const keyFor = sample => `${STORAGE_PREFIX}.${sample ? 'sample' : 'real'}`;
  const notify = audit => listeners.forEach(listener => listener(audit));
  const persist = audit => {
    const serialized = JSON.stringify(audit);
    const result = writes.catch(() => {}).then(() => storage.setItem(keyFor(audit.sample), serialized));
    writes = result;
    return result.then(() => audit);
  };
  return {
    async load(sample = false) {
      await writes.catch(() => {});
      if (cache.has(sample)) return cache.get(sample);
      const raw = await storage.getItem(keyFor(sample));
      if (!raw) return null;
      let audit;
      try { audit = JSON.parse(raw); }
      catch { throw new Error('This saved audit could not be read. Export any open report before starting a new audit.'); }
      const record = value => value && typeof value === 'object' && !Array.isArray(value);
      if (!record(audit) || audit.version !== 1 || !audit.id || !Array.isArray(audit.plants)
        || !audit.plants.every(record) || Boolean(audit.sample) !== sample || !record(audit.site)
        || !record(audit.proposal) || !Array.isArray(audit.selected_species)
        || !audit.selected_species.every(name => typeof name === 'string')
        || !['site_name', 'survey_date', 'zip_code', 'letter'].every(key => typeof audit[key] === 'string')) {
        throw new Error('This saved audit could not be read. Export any open report before starting a new audit.');
      }
      cache.set(sample, audit);
      return audit;
    },
    save(audit) {
      // Large photo payloads remain in the upload stage; audit storage contains facts.
      const clean = { ...audit, plants: audit.plants.map(({ base64, images, photos, photo_uri, ...plant }) => plant) };
      cache.set(Boolean(audit.sample), clean);
      notify(clean);
      return persist(clean);
    },
    patch(id, patch, sample = false) {
      const current = cache.get(sample);
      if (!current || current.id !== id) return Promise.reject(new Error('This audit has changed. Reopen it before editing.'));
      const next = {
        ...current,
        ...patch,
        site: patch.site ? { ...current.site, ...patch.site } : current.site,
        proposal: patch.proposal ? { ...current.proposal, ...patch.proposal } : current.proposal,
        id: current.id,
        sample: current.sample,
        updated_at: new Date().toISOString(),
      };
      cache.set(sample, next);
      notify(next);
      return persist(next);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flush() { return writes; },
  };
}

const auditStore = createAuditStore(AsyncStorage);
export const loadAudit = sample => auditStore.load(sample);
export const saveAudit = audit => auditStore.save(audit);
export const patchAudit = (id, patch, sample) => auditStore.patch(id, patch, sample);
export const subscribeAudit = listener => auditStore.subscribe(listener);
export const flushAudit = () => auditStore.flush();

export function buildAuditReport(audit, metric) {
  const share = metric?.native_share == null ? 'Not enough verified taxa' : `${metric.native_share}% (${metric.native_count}/${metric.verified_species_count} verified taxa)`;
  const observations = audit.plants.map((plant, index) => [
    `${index + 1}. ${plant.plant_name || 'Unidentified plant'} (${plant.scientific_name || 'identification unresolved'})`,
    `   Identification: ${plant.needs_confirmation && !plant.user_confirmed ? 'needs confirmation' : plant.user_confirmed ? 'selected by user' : plant.id_source || 'see evidence'}`,
    `   Recorded Florida status: ${plant.invasive_status || 'unverified'}${plant.status_verified ? ' — source verified' : ' — not verified'}`,
    plant.source_url ? `   Source: ${plant.source_url}` : '',
    plant.verified_on ? `   Source checked: ${plant.verified_on}` : '',
    plant.note ? `   Observation note: ${plant.note}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
  const currentRecords = (metric?.species || []).map(plant => `${plant.plant_name || plant.scientific_name} (${plant.scientific_name}): ${plant.invasive_status}. ${plant.source_url || plant.source || 'Source unavailable'}${plant.verified_on ? ` (checked ${plant.verified_on})` : ''}`).join('\n');
  const unresolved = (metric?.unresolved || []).map((plant, index) => `Observation ${(plant.observation_index ?? index) + 1}: ${plant.plant_name || plant.scientific_name || 'Unidentified plant'} — ${plant.reason}`).join('\n');
  return [
    audit.sample ? 'SAMPLE AUDIT — FICTIONAL DEMONSTRATION, NOT CAMPUS EVIDENCE' : 'ECOLOCO CAMPUS PLANT SURVEY',
    `Site: ${audit.site_name || 'Not specified'}`,
    `Survey date: ${audit.survey_date || 'Not specified'} | ZIP: ${audit.zip_code}`,
    `Audit ID: ${audit.id}`,
    `Site conditions: ${Object.entries(audit.site).map(([key, value]) => `${key}: ${value}`).join('; ')}`,
    '',
    `Native share of verified unique taxa: ${share}`,
    'A taxon is a species or a status-distinct variety. Each is counted once.',
    metric ? `Native: ${metric.native_count}; nonnative (excluding invasive): ${metric.non_native_count}; invasive: ${metric.invasive_count}; unresolved observations: ${metric.unresolved_count}; total observations: ${metric.observation_count}` : 'Metrics unavailable; reconnect and review the audit.',
    'This describes sampled species, not campus biodiversity, abundance, habitat quality or measured wildlife outcomes. Duplicate observations do not increase species counts.',
    '',
    'OBSERVATIONS AND SOURCES', observations || 'No observations recorded.',
    '', 'CURRENT VERIFIED TAXA', currentRecords || 'No current verified taxa available.',
    ...(unresolved ? ['', 'OBSERVATIONS REQUIRING REVIEW', unresolved] : []),
    '',
    `Proposed additions: ${audit.selected_species.join(', ') || 'None selected'}`,
    metric?.projected && audit.selected_species.length ? `Scenario native share after selected new species are established: ${metric.projected.native_share ?? 'not available'}% (${metric.projected.native_count}/${metric.projected.verified_species_count}). This is a species-inventory scenario, not a predicted ecological outcome.` : '',
    '',
    audit.letter_stale && audit.letter ? 'DRAFT OUTDATED: survey, site or proposed species changed after this draft was generated. Review or regenerate before sharing.' : '',
    audit.letter ? `EDITABLE PROPOSAL\n${audit.letter}` : 'No proposal generated.',
  ].filter(value => value !== undefined).join('\n');
}
