import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { identifyPlant, confirmPlant, getCatalog } from '../services/geminiService';
import { createEmptyAudit, loadAudit, saveAudit, patchAudit, subscribeAudit, flushAudit } from '../services/auditStorage';
import PlantEvidence from '../components/PlantEvidence';
import PhotoPicker from '../components/PhotoPicker';
import SiteConditions from '../components/SiteConditions';
import { identificationNeedsConfirmation } from '../utils/plantEvidence';
import { matchesCatalogQuery } from '../utils/catalogSearch';
import { AuditButton, AuditField, AuditNotice, AuditPage, auditStyles as s } from '../components/AuditUI';

const SAMPLE_SPECIES = ['Quercus virginiana', 'Zamia integrifolia', 'Schinus terebinthifolia'];
const zipIsSupported = value => /^(330|331|332|333|334)\d{2}$/.test(value);

export default function AuditScreen({ navigation, route }) {
  const [loadedAudit, setAudit] = useState(null);
  const [sampleMode, setSampleMode] = useState(Boolean(route.params?.sample));
  // A mode change can render before its load effect runs. Never expose an audit
  // from the other storage slot under the new mode's label or controls.
  const audit = loadedAudit && Boolean(loadedAudit.sample) === sampleMode ? loadedAudit : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [photos, setPhotos] = useState([]);
  const [preview, setPreview] = useState(null);
  const [resetVisible, setResetVisible] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [search, setSearch] = useState('');
  const [retryLoad, setRetryLoad] = useState(0);
  const request = useRef(null);
  const saveVersion = useRef(0);
  const alive = useRef(true);
  useFonts({ Fraunces_700Bold, DMSans_400Regular, DMSans_700Bold });

  function cancelRequest() {
    request.current?.abort();
    request.current = null;
    setBusy('');
  }

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; request.current?.abort(); };
  }, []);

  useEffect(() => navigation.addListener('blur', cancelRequest), [navigation]);

  useEffect(() => {
    if (typeof route.params?.sample === 'boolean') {
      setSampleMode(route.params.sample);
      navigation.setParams({ sample: undefined });
    }
  }, [route.params?.sample, navigation]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    cancelRequest();
    saveVersion.current++;
    setAudit(null);
    setLoading(true);
    setError('');
    setSaveError('');
    setSaving(false);
    setPhotos([]);
    setPreview(null);
    setCatalog(null);
    setSearch('');
    setResetVisible(false);
    const unsubscribe = subscribeAudit(next => {
      if (active && Boolean(next.sample) === sampleMode) setAudit(next);
    });
    (async () => {
      try {
        let restored = await loadAudit(sampleMode);
        if (!active) return;
        if (!restored) {
          restored = createEmptyAudit(sampleMode);
          if (sampleMode) {
            const answers = await Promise.all(SAMPLE_SPECIES.map(name => confirmPlant(name, '33431', { signal: controller.signal })));
            if (!active) return;
            restored = {
              ...restored, site_name: 'Sample courtyard (fictional)', zip_code: '33431',
              site: { sun: 'full', moisture: 'average', space: 'medium', maintenance: 'low' },
              plants: answers.map((answer, index) => ({ ...answer.result, _id: `sample-${index}`, note: 'Fictional demonstration observation; not a real campus finding.' })),
            };
          }
          await saveAudit(restored);
        }
        if (active) setAudit(restored);
      } catch (err) {
        if (active && err.name !== 'AbortError') setError(err.message || 'The saved audit could not be opened. Try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); unsubscribe(); };
  }, [sampleMode, retryLoad]);

  function edit(patch, changesEvidence = false) {
    if (!audit) return Promise.resolve();
    const version = ++saveVersion.current;
    setSaving(true);
    setSaveError('');
    return patchAudit(audit.id, { ...patch, ...(changesEvidence && audit.letter ? { letter_stale: true } : {}) }, sampleMode)
      .catch(err => { if (alive.current && version === saveVersion.current) setSaveError(err.message || 'Could not save on this device. Export your report before leaving.'); throw err; })
      .finally(() => { if (alive.current && version === saveVersion.current) setSaving(false); });
  }

  function change(patch, changesEvidence = false) { edit(patch, changesEvidence).catch(() => {}); }

  function requireZIP() {
    if (!zipIsSupported(audit?.zip_code || '')) {
      setError('Enter a supported South Florida ZIP: five digits beginning 330, 331, 332, 333 or 334.');
      return false;
    }
    return true;
  }

  async function run(label, work) {
    cancelRequest();
    const controller = new AbortController();
    request.current = controller;
    setBusy(label);
    setError('');
    try {
      await work(controller.signal, () => request.current === controller && !controller.signal.aborted);
    } catch (err) {
      if (request.current === controller && err.name !== 'AbortError') setError(err.message || 'The request failed. Your observations are saved; try again.');
    } finally {
      if (request.current === controller) { request.current = null; setBusy(''); }
    }
  }

  function identify() {
    if (!requireZIP()) return;
    if (!photos.length) { setError('Add at least one clear photograph of the same plant.'); return; }
    run('Identifying your plant…', async (signal, current) => {
      const answer = await identifyPlant(photos.map(photo => photo.base64), audit.zip_code, { signal });
      if (current()) setPreview(answer.result);
    });
  }

  function confirm(scientificName, observationId) {
    if (!requireZIP()) return;
    run('Checking the selected species and its sources…', async (signal, current) => {
      const answer = await confirmPlant(scientificName, audit.zip_code, { signal });
      if (!current()) return;
      if (observationId) {
        await edit({ plants: audit.plants.map(plant => plant._id === observationId ? { ...answer.result, _id: plant._id, note: plant.note } : plant) }, true);
      } else setPreview(answer.result);
    });
  }

  async function addPreview() {
    if (!preview || busy) return;
    if (audit.plants.length >= 300) {
      setError('This audit has reached 300 observations. Export the report and start another audit for the next surveyed area.');
      return;
    }
    const observation = { ...preview, _id: `plant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, note: '' };
    // The store publishes the observation immediately, even if disk saving fails.
    // Clear the stage now so a retry cannot accidentally add it twice.
    setPhotos([]);
    setPreview(null);
    try {
      await edit({ plants: [...audit.plants, observation] }, true);
    } catch { /* The persistent save message includes recovery guidance. */ }
  }

  function openCatalog() {
    if (!requireZIP()) return;
    run('Opening the verified plant catalog…', async (signal, current) => {
      const answer = await getCatalog(audit.zip_code, { signal });
      if (current()) { setCatalog(Array.isArray(answer.result) ? answer.result : answer.result?.species || []); setSearch(''); }
    });
  }

  function selectCatalog(name) {
    setCatalog(null);
    setPhotos([]);
    confirm(name);
  }

  async function reset() {
    cancelRequest();
    try {
      setSaveError('');
      const next = createEmptyAudit(sampleMode);
      if (sampleMode) { next.site_name = 'Sample survey (fictional)'; next.zip_code = '33431'; }
      await saveAudit(next);
      setAudit(next);
      setPhotos([]);
      setPreview(null);
      setError('');
      setResetVisible(false);
    } catch (err) { setSaveError(err.message || 'The audit could not be reset. Please try again.'); setResetVisible(false); }
  }

  async function finish() {
    if (!requireZIP()) return;
    if (!audit.site_name.trim()) { setError('Name the surveyed area so the report has a clear scope, such as “North courtyard.”'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(audit.survey_date) || Number.isNaN(Date.parse(`${audit.survey_date}T12:00:00Z`)) || new Date(`${audit.survey_date}T12:00:00Z`).toISOString().slice(0, 10) !== audit.survey_date) {
      setError('Enter a real survey date in YYYY-MM-DD format.'); return;
    }
    if (!audit.plants.length) { setError('Add at least one observation before reviewing the audit.'); return; }
    try {
      await flushAudit();
      navigation.navigate('AuditResults', { auditId: audit.id, sample: sampleMode });
    } catch { setSaveError('The latest edits have not saved. Retry saving before opening the report.'); }
  }

  const catalogMatches = (catalog || []).filter(plant => matchesCatalogQuery(plant, search));

  return <AuditPage>
    <View style={s.row}>
      <Text accessibilityRole="header" style={[s.title, { flex: 1 }]}>Campus plant audit</Text>
      <AuditButton secondary onPress={() => setResetVisible(true)} disabled={Boolean(busy) || loading}>New audit</AuditButton>
    </View>
    <Text style={s.body}>Survey a defined area, review the plant evidence, and prepare a practical planting proposal. The report measures the native share of verified species you record.</Text>
    <Text style={s.muted}>South Florida pilot: ZIP codes beginning 330–334. Statewide status evidence does not establish suitability for every planting site.</Text>
    {sampleMode && <AuditNotice>
      <Text style={s.label}>Sample audit — fictional demonstration</Text>
      <Text style={s.body}>These are illustrative observations, not measured campus findings. Your real survey stays saved separately.</Text>
      <AuditButton secondary disabled={Boolean(busy)} onPress={() => setSampleMode(false)}>Return to my real audit</AuditButton>
    </AuditNotice>}
    {error ? <AuditNotice error><Text style={s.body}>{error}</Text>{!audit && <AuditButton secondary onPress={() => setRetryLoad(value => value + 1)}>Try opening audit again</AuditButton>}</AuditNotice> : null}
    {saveError ? <AuditNotice error><Text style={s.body}>{saveError}</Text><AuditButton secondary onPress={() => edit({}).catch(() => {})}>Retry saving</AuditButton></AuditNotice> : null}
    {loading ? <ActivityIndicator accessibilityLabel="Opening saved audit" color="#1e3a1e" /> : audit && <>
      <Text accessibilityLiveRegion="polite" style={s.muted}>{saving ? 'Saving on this device…' : saveError ? 'Changes are not safely saved yet.' : `Saved on this device · ${audit.plants.length} observation${audit.plants.length === 1 ? '' : 's'}`}</Text>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>1. Define the surveyed area</Text>
        <AuditField label="Surveyed area name" value={audit.site_name} onChangeText={site_name => change({ site_name }, true)} editable={!busy} placeholder="North courtyard at your school" maxLength={160} />
        <View style={s.row}>
          <AuditField label="Survey date (YYYY-MM-DD)" value={audit.survey_date} onChangeText={survey_date => change({ survey_date }, true)} editable={!busy} maxLength={10} />
          <AuditField label="School ZIP code" value={audit.zip_code} onChangeText={zip_code => { setPreview(null); setCatalog(null); change({ zip_code: zip_code.replace(/\D/g, '').slice(0, 5) }, true); }} editable={!busy && !audit.plants.length} keyboardType="number-pad" maxLength={5} placeholder="33431" />
        </View>
        {audit.plants.length > 0 && <Text style={s.muted}>ZIP stays fixed for this survey. Start a new audit to survey another location.</Text>}
        <SiteConditions site={audit.site} onChange={site => change({ site }, true)} disabled={Boolean(busy)} />
      </View>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>2. Add an observation</Text>
        <Text style={s.body}>Use up to five photos of the same plant: the whole plant, a leaf, and flowers or fruit. Each observation can be reviewed before adding it.</Text>
        <PhotoPicker photos={photos} onChange={next => { cancelRequest(); setPhotos(next); setPreview(null); setError(''); }} onError={setError} disabled={Boolean(busy)} />
        <View style={s.row}>
          <AuditButton onPress={identify} disabled={Boolean(busy)}>{preview ? 'Identify photos again' : 'Identify these photos'}</AuditButton>
          <AuditButton secondary onPress={openCatalog} disabled={Boolean(busy)}>Select a known species</AuditButton>
        </View>
        {busy && <AuditNotice><View style={s.row}><ActivityIndicator color="#1e3a1e" /><Text style={s.body}>{busy}</Text></View><AuditButton secondary onPress={cancelRequest}>Cancel request</AuditButton></AuditNotice>}
        {preview && <View style={{ gap: 14 }}>
          <PlantEvidence plant={preview} onConfirm={name => confirm(name)} onRetake={() => { cancelRequest(); setPreview(null); setPhotos([]); }} confirming={Boolean(busy)} />
          <AuditButton disabled={Boolean(busy)} onPress={addPreview}>{identificationNeedsConfirmation(preview) ? 'Keep as an unresolved observation' : 'Add this observation'}</AuditButton>
        </View>}
      </View>
      <Text accessibilityRole="header" style={s.heading}>Recorded observations ({audit.plants.length})</Text>
      {!audit.plants.length && <AuditNotice>No observations yet. Add photos, or select a species you can already identify from the sourced catalog.</AuditNotice>}
      {audit.plants.map((plant, index) => <View key={plant._id} style={s.card}>
        <Text style={s.label}>Observation {index + 1}</Text>
        <PlantEvidence plant={plant} onConfirm={name => confirm(name, plant._id)} confirming={Boolean(busy)} />
        <AuditField label={`Location or field note for observation ${index + 1}`} value={plant.note || ''} onChangeText={note => change({ plants: audit.plants.map(item => item._id === plant._id ? { ...item, note } : item) }, true)} editable={!busy} placeholder="Beside the west gate; identification checked by…" maxLength={500} />
        <AuditButton secondary accessibilityLabel={`Delete observation ${index + 1}`} disabled={Boolean(busy)} onPress={() => change({ plants: audit.plants.filter(item => item._id !== plant._id) }, true)}>Delete observation</AuditButton>
      </View>)}
      <AuditButton onPress={finish} disabled={Boolean(busy) || saving}>Review audit and build a proposal →</AuditButton>
      <Text style={s.muted}>Observations and draft text save on this device. Photographs are used for identification and are not saved in the audit. Export your report for a portable copy; clearing browser/app storage removes the local copy.</Text>
    </>}
    <Modal visible={resetVisible} transparent animationType="fade" onRequestClose={() => setResetVisible(false)}>
      <View style={s.modalShade}><View style={s.modal} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={s.heading}>Start a new {sampleMode ? 'sample ' : ''}audit?</Text>
        <Text style={s.body}>This clears this audit’s observations, selections and proposal on this device. Export the current report first if you want to keep it.</Text>
        <View style={s.row}><AuditButton secondary onPress={() => setResetVisible(false)}>Keep current audit</AuditButton><AuditButton onPress={reset}>Clear and start new audit</AuditButton></View>
      </View></View>
    </Modal>
    <Modal visible={catalog !== null} transparent animationType="slide" onRequestClose={() => setCatalog(null)}>
      <View style={s.modalShade}><View style={s.modal} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={s.heading}>Select a species you recognize</Text>
        <Text style={s.muted}>This records your identification choice, then checks its status against sources. A catalog match does not confirm what your plant looks like.</Text>
        <AuditField label="Search catalog by common or scientific name" value={search} onChangeText={setSearch} autoFocus />
        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          {catalogMatches.slice(0, 80).map(plant => <TouchableOpacity accessibilityRole="button" key={plant.taxon_id || plant.scientific_name} onPress={() => selectCatalog(plant.scientific_name)} style={{ paddingVertical: 13, borderBottomWidth: 1, borderColor: '#d4cfc4', gap: 4 }}>
            <Text style={s.label}>{plant.common_name || plant.plant_name || plant.scientific_name}</Text><Text style={s.muted}>{plant.scientific_name}</Text>
          </TouchableOpacity>)}
          {catalogMatches.length === 0 && <Text style={s.body}>No catalog matches. Use photographs or retain an unresolved observation.</Text>}
          {catalogMatches.length > 80 && <Text style={s.muted}>Showing the first 80 matches. Type more of the name to narrow the list.</Text>}
        </ScrollView>
        <AuditButton secondary onPress={() => setCatalog(null)}>Close catalog</AuditButton>
      </View></View>
    </Modal>
  </AuditPage>;
}
