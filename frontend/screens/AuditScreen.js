import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, ScrollView, ActivityIndicator, TouchableOpacity, Image, StyleSheet } from 'react-native';
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
import { AuditButton, AuditField, AuditNotice, auditStyles as s } from '../components/AuditUI';

const SAMPLE_SPECIES = ['Quercus virginiana', 'Zamia integrifolia', 'Schinus terebinthifolia'];
const zipIsSupported = value => /^[0-9]{5}$/.test(value);
const LOGO = require('../../assets/EcoLoco_logo.png');

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
  const [siteDetailsOpen, setSiteDetailsOpen] = useState(false);
  const [siteError, setSiteError] = useState('');
  const scrollRef = useRef(null);
  const siteDetailsY = useRef(0);
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
    setSiteDetailsOpen(false);
    setSiteError('');
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
      .catch(err => { if (alive.current && version === saveVersion.current) setSaveError(err.message || 'Could not save. Retry before leaving.'); throw err; })
      .finally(() => { if (alive.current && version === saveVersion.current) setSaving(false); });
  }

  function change(patch, changesEvidence = false) { edit(patch, changesEvidence).catch(() => {}); }

  function requireZIP() {
    if (!zipIsSupported(audit?.zip_code || '')) {
      setError('Enter a five-digit Florida ZIP code.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
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
      if (request.current === controller && err.name !== 'AbortError') setError(err.message || 'Could not complete the request. Try again.');
    } finally {
      if (request.current === controller) { request.current = null; setBusy(''); }
    }
  }

  function identify() {
    if (!requireZIP()) return;
    if (!photos.length) { setError('Take or upload a plant photo first.'); return; }
    run('Identifying…', async (signal, current) => {
      const answer = await identifyPlant(photos.map(photo => photo.base64), audit.zip_code, { signal });
      if (current()) setPreview(answer.result);
    });
  }

  function confirm(scientificName, observationId) {
    if (!requireZIP()) return;
    run('Checking plant records…', async (signal, current) => {
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
      setError('300 observations reached. Export this audit before starting another.');
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
    run('Opening plant catalog…', async (signal, current) => {
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
      setSiteDetailsOpen(false);
      setSiteError('');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (err) { setSaveError(err.message || 'The audit could not be reset. Please try again.'); setResetVisible(false); }
  }

  function revealSiteDetails(message) {
    setSiteError(message);
    setSiteDetailsOpen(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, siteDetailsY.current - 20), animated: true }));
  }

  async function finish() {
    if (!requireZIP()) return;
    if (!audit.site_name.trim()) { revealSiteDetails('Add an area name to finish your audit.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(audit.survey_date) || Number.isNaN(Date.parse(`${audit.survey_date}T12:00:00Z`)) || new Date(`${audit.survey_date}T12:00:00Z`).toISOString().slice(0, 10) !== audit.survey_date) {
      revealSiteDetails('Enter a valid date as YYYY-MM-DD.'); return;
    }
    if (!audit.plants.length) { setError('Add at least one observation before reviewing the audit.'); return; }
    try {
      await flushAudit();
      navigation.navigate('AuditResults', { auditId: audit.id, sample: sampleMode });
    } catch { setSaveError('The latest edits have not saved. Retry saving before opening the report.'); }
  }

  const catalogMatches = (catalog || []).filter(plant => matchesCatalogQuery(plant, search));

  return <ScrollView ref={scrollRef} style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image source={LOGO} style={styles.logo} accessibilityLabel="EcoLoco" />
        <Text style={styles.brandName}>EcoLoco</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: Boolean(busy) || loading }} aria-disabled={Boolean(busy) || loading} onPress={() => setResetVisible(true)} disabled={Boolean(busy) || loading} style={styles.textButton}>
        <Text style={styles.resetText}>New scan</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={[s.title, styles.title]}>EcoScan</Text>
      <Text style={[s.muted, styles.subtitle]}>Scan your campus. Plan its next native planting.</Text>
    </View>
    {sampleMode && <View style={styles.sampleRow}>
      <Text style={styles.sampleChip}>Sample · fictional observations</Text>
      <TouchableOpacity accessibilityRole="button" disabled={Boolean(busy)} aria-disabled={Boolean(busy)} onPress={() => setSampleMode(false)} style={styles.textButton}><Text style={styles.link}>Back to my audit</Text></TouchableOpacity>
    </View>}
    {error ? <AuditNotice error><Text style={s.body}>{error}</Text>{!audit && <AuditButton secondary onPress={() => setRetryLoad(value => value + 1)}>Try again</AuditButton>}</AuditNotice> : null}
    {saveError ? <AuditNotice error><Text style={s.body}>{saveError}</Text><AuditButton secondary onPress={() => edit({}).catch(() => {})}>Retry saving</AuditButton></AuditNotice> : null}
    {loading ? <ActivityIndicator accessibilityLabel="Opening saved audit" color="#1e3a1e" /> : audit && <>
      <View style={styles.zipRow}>
        <View style={styles.zipField}>
          <AuditField label="School ZIP" value={audit.zip_code} onChangeText={zip_code => { setPreview(null); setCatalog(null); setError(''); change({ zip_code: zip_code.replace(/\D/g, '').slice(0, 5) }, true); }} editable={!busy && !audit.plants.length} keyboardType="number-pad" maxLength={5} placeholder="33431" />
        </View>
        <View style={styles.zipContext}>
          <Text style={s.muted}>Florida ZIP code</Text>
          <Text accessibilityLiveRegion="polite" style={styles.saveText}>{saving ? 'Saving…' : saveError ? 'Not saved yet' : 'Saved on this device'}</Text>
          {audit.plants.length > 0 && <Text style={styles.saveText}>New scan to change ZIP</Text>}
        </View>
      </View>
      <View style={styles.scanSection}>
        <PhotoPicker photos={photos} onChange={next => { cancelRequest(); setPhotos(next); setPreview(null); setError(''); }} onError={setError} disabled={Boolean(busy)} />
        {photos.length > 0 && <AuditButton onPress={identify} disabled={Boolean(busy)}>{preview ? 'Identify again' : 'Identify plant'}</AuditButton>}
        {busy && <View style={styles.progressRow}>
          <ActivityIndicator color="#4a7a3a" />
          <Text style={[s.muted, { flex: 1 }]}>{busy}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={cancelRequest} style={styles.textButton}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
        </View>}
        {preview && <View style={styles.preview}>
          <PlantEvidence plant={preview} compact onConfirm={name => confirm(name)} onRetake={() => { cancelRequest(); setPreview(null); setPhotos([]); }} confirming={Boolean(busy)} />
          <AuditButton disabled={Boolean(busy)} onPress={addPreview}>{identificationNeedsConfirmation(preview) ? 'Save for review' : 'Add to audit'}</AuditButton>
        </View>}
        <TouchableOpacity accessibilityRole="button" disabled={Boolean(busy)} aria-disabled={Boolean(busy)} onPress={openCatalog} style={styles.catalogLink}>
          <Text style={styles.link}>Or select a known plant</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.detailsSection} onLayout={event => { siteDetailsY.current = event.nativeEvent.layout.y; }}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: siteDetailsOpen }} aria-expanded={siteDetailsOpen} onPress={() => setSiteDetailsOpen(value => !value)} style={styles.detailsToggle}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.label}>Site details</Text>
            <Text style={styles.saveText}>{audit.site_name || 'Area, survey date & planting conditions'}</Text>
          </View>
          <Text style={styles.chevron}>{siteDetailsOpen ? '−' : '+'}</Text>
        </TouchableOpacity>
        {siteDetailsOpen && <View style={styles.detailsBody}>
          {siteError ? <Text accessibilityLiveRegion="polite" style={styles.fieldError}>{siteError}</Text> : null}
          <View style={styles.siteFields}>
            <AuditField label="Surveyed area" value={audit.site_name} onChangeText={site_name => { setSiteError(''); change({ site_name }, true); }} editable={!busy} placeholder="North courtyard" maxLength={160} />
            <AuditField label="Survey date" value={audit.survey_date} onChangeText={survey_date => { setSiteError(''); change({ survey_date }, true); }} editable={!busy} placeholder="YYYY-MM-DD" maxLength={10} />
          </View>
          <SiteConditions site={audit.site} onChange={site => change({ site }, true)} disabled={Boolean(busy)} />
        </View>}
      </View>
      <View style={styles.listHeader}>
        <Text accessibilityRole="header" style={s.heading}>Your plants</Text>
        <Text style={styles.count}>{audit.plants.length}</Text>
      </View>
      {!audit.plants.length && <Text style={[s.muted, styles.emptyText]}>Your first plant will appear here.</Text>}
      {audit.plants.map((plant, index) => <View key={plant._id} style={styles.plantRow}>
        <View style={styles.plantContent}>
          <PlantEvidence plant={plant} compact onConfirm={name => confirm(name, plant._id)} confirming={Boolean(busy)}>
            <AuditField label={`Field note · plant ${index + 1}`} value={plant.note || ''} onChangeText={note => change({ plants: audit.plants.map(item => item._id === plant._id ? { ...item, note } : item) }, true)} editable={!busy} placeholder="Location or reviewer's note" maxLength={500} />
          </PlantEvidence>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${plant.plant_name || `plant ${index + 1}`}`} disabled={Boolean(busy)} aria-disabled={Boolean(busy)} onPress={() => change({ plants: audit.plants.filter(item => item._id !== plant._id) }, true)} style={styles.deleteButton}>
          <Text style={styles.deleteText}>×</Text>
        </TouchableOpacity>
      </View>)}
      {audit.plants.length > 0 && <AuditButton onPress={finish} disabled={Boolean(busy) || saving}>Finish audit →</AuditButton>}
      <Text style={styles.footerNote}>Saved on this device. Export your report to keep a copy. Photos are not saved.</Text>
    </>}
    <Modal visible={resetVisible} transparent animationType="fade" onRequestClose={() => setResetVisible(false)}>
      <View style={s.modalShade}><View style={s.modal} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={s.heading}>Start a new {sampleMode ? 'sample ' : ''}scan?</Text>
        <Text style={s.body}>This clears the current audit and proposal. Export your report first to keep a copy.</Text>
        <View style={s.row}><AuditButton secondary onPress={() => setResetVisible(false)}>Keep audit</AuditButton><AuditButton onPress={reset}>Clear & start new</AuditButton></View>
      </View></View>
    </Modal>
    <Modal visible={catalog !== null} transparent animationType="slide" onRequestClose={() => setCatalog(null)}>
      <View style={s.modalShade}><View style={s.modal} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={s.heading}>Choose a known plant</Text>
        <Text style={s.muted}>Select a plant you recognize. Its Florida status is checked against sources.</Text>
        <AuditField label="Search plants" value={search} onChangeText={setSearch} autoFocus placeholder="Common or scientific name" />
        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          {catalogMatches.slice(0, 80).map(plant => <TouchableOpacity accessibilityRole="button" key={plant.taxon_id || plant.scientific_name} onPress={() => selectCatalog(plant.scientific_name)} style={styles.catalogItem}>
            <Text style={s.label}>{plant.common_name || plant.plant_name || plant.scientific_name}</Text><Text style={s.muted}>{plant.scientific_name}</Text>
          </TouchableOpacity>)}
          {catalogMatches.length === 0 && <Text style={s.muted}>No matches. Try another name or a photo.</Text>}
          {catalogMatches.length > 80 && <Text style={s.muted}>80 matches shown. Keep typing to narrow them.</Text>}
        </ScrollView>
        <AuditButton secondary onPress={() => setCatalog(null)}>Close</AuditButton>
      </View></View>
    </Modal>
  </ScrollView>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#d4cfc4', paddingBottom: 15 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 38, height: 38, resizeMode: 'contain' },
  brandName: { fontFamily: 'Fraunces_700Bold', color: '#1e3a1e', fontSize: 20 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  resetText: { fontFamily: 'DMSans_400Regular', color: '#9c583b', fontSize: 12 },
  intro: { alignItems: 'center', paddingVertical: 8, gap: 6 },
  title: { fontSize: 34 },
  subtitle: { textAlign: 'center' },
  sampleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sampleChip: { color: '#4a6740', backgroundColor: '#e8efdf', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, fontFamily: 'DMSans_700Bold', fontSize: 11 },
  link: { fontFamily: 'DMSans_700Bold', color: '#4a7a3a', fontSize: 12 },
  zipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' },
  zipField: { flexGrow: 1, flexBasis: 140, maxWidth: 260 },
  zipContext: { gap: 3, paddingTop: 15 },
  saveText: { fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 17, color: '#727366' },
  scanSection: { gap: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  preview: { padding: 16, gap: 14, backgroundColor: '#fefcf8', borderWidth: 1, borderColor: '#d4cfc4', borderRadius: 14 },
  catalogLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  detailsSection: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#d4cfc4' },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  chevron: { fontSize: 23, color: '#4a7a3a', paddingHorizontal: 5 },
  detailsBody: { gap: 14, paddingBottom: 18 },
  siteFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  fieldError: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 20, color: '#943d28' },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  count: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: '#4a7a3a', backgroundColor: '#e8efdf', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  emptyText: { textAlign: 'center', paddingVertical: 12 },
  plantRow: { flexDirection: 'row', gap: 6, padding: 14, borderWidth: 1, borderColor: '#d4cfc4', borderRadius: 14, backgroundColor: '#fefcf8' },
  plantContent: { flex: 1, minWidth: 0 },
  deleteButton: { width: 38, minHeight: 44, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  deleteText: { color: '#9c583b', fontSize: 22, lineHeight: 24 },
  footerNote: { fontFamily: 'DMSans_400Regular', color: '#727366', fontSize: 11, lineHeight: 17, textAlign: 'center', paddingTop: 2 },
  catalogItem: { paddingVertical: 13, borderBottomWidth: 1, borderColor: '#d4cfc4', gap: 4 },
});
