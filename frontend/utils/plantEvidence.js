export function identificationNeedsConfirmation(plant = {}) {
  if (plant.state === 'unidentified') return true;
  if (plant.needs_taxon_confirmation === true) return true;
  if (plant.user_confirmed === true) return false;
  if (plant.needs_confirmation === true || plant.state === 'confirm') return true;
  return !plant.scientific_name || !Number.isFinite(plant.confidence) || plant.confidence < 0.8;
}

export function taxonomyStatus(plant = {}) {
  if (plant.status_verified !== true) return { label: 'Status unverified', tone: 'unknown' };
  if (plant.invasive === true || plant.invasive_status === 'invasive') return { label: 'Invasive in Florida', tone: 'invasive' };
  if (plant.native === true || plant.is_native === true || plant.invasive_status === 'native') return { label: 'Florida native', tone: 'native' };
  if (plant.native === false || plant.is_native === false || plant.invasive_status === 'non-native') return { label: 'Nonnative in Florida', tone: 'nonnative' };
  return { label: 'Status unverified', tone: 'unknown' };
}

export function identificationProvider(source) {
  return ({
    plantnet: 'Pl@ntNet',
    openai_adjudicated: 'Pl@ntNet candidates, compared with image reasoning',
    openai_fallback: 'Image reasoning fallback (Pl@ntNet unavailable)',
    user: 'Selected by you',
    manual: 'Selected by you',
    manual_confirmation: 'Selected by you',
    user_confirmed: 'Selected by you',
    catalog: 'Selected from the reference catalog',
    sample: 'Illustrative sample observation',
    none: 'Identification unavailable',
  })[source] || 'Identification source not provided';
}

export function safeEvidenceUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

export function evidenceText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return value.map(evidenceText).filter(Boolean).join(', ');
  return '';
}

export function confirmationCandidates(plant = {}) {
  if (plant.state === 'unidentified') return [];
  const seen = new Set();
  return [plant, ...(Array.isArray(plant.candidates) ? plant.candidates : [])].filter((item) => {
    const key = typeof item?.scientific_name === 'string' ? item.scientific_name.trim().toLowerCase() : '';
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function suggestedCandidateName(plant = {}) {
  if (plant.state === 'unidentified' || !Number.isInteger(plant.suggested) || plant.suggested < 0) return '';
  const candidate = [plant, ...(Array.isArray(plant.candidates) ? plant.candidates : [])][plant.suggested];
  return typeof candidate?.scientific_name === 'string' ? candidate.scientific_name.trim().toLowerCase() : '';
}

export function candidateMatchText(candidate, provider) {
  if (!Number.isFinite(candidate?.confidence) || candidate.confidence < 0 || candidate.confidence > 1) return '';
  const label = ({ plantnet: 'Pl@ntNet', openai_adjudicated: 'Pl@ntNet', openai_fallback: 'Image review' })[provider];
  return label ? `${label} · ${Math.round(candidate.confidence * 100)}% match` : '';
}

export function verifiedAtlasUrl(plant = {}) {
  return plant.atlas_verified === true ? safeEvidenceUrl(plant.atlas_url) : null;
}

export function plantExtraFacts(plant = {}) {
  const rows = [];
  const add = (title, text, source) => {
    const value = evidenceText(text);
    if (value) rows.push({ title, text: value, source_name: evidenceText(source?.name), source_url: safeEvidenceUrl(source?.url) });
  };
  add('Growing', [evidenceText(plant.sun_description), evidenceText(plant.mature_size)].filter(Boolean).join(' · '), plant.growing_source);
  const buying = plant.buying;
  if (buying && typeof buying === 'object') {
    const askFor = evidenceText(buying.ask_for);
    add('Buying', [askFor ? `Ask for ${askFor}.` : '', evidenceText(buying.avoid)].filter(Boolean).join(' '), buying.source);
  }
  for (const caution of Array.isArray(plant.watch_out) ? plant.watch_out : []) add('Before planting', caution?.text, caution?.source);
  add('Removal guidance', plant.removal_safety?.text, plant.removal_safety?.source);
  return rows;
}
