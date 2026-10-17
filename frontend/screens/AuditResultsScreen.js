import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, TextInput, Linking, Platform, Share, Modal } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { getScore, getPlantRecommendations, generateLetter } from '../services/geminiService';
import { loadAudit, patchAudit, subscribeAudit, buildAuditReport } from '../services/auditStorage';
import { AuditButton, AuditField, AuditNotice, AuditPage, auditStyles as s } from '../components/AuditUI';

const percent = value => value == null ? 'Not enough evidence' : `${Math.round(value * 10) / 10}%`;

export default function AuditResultsScreen({ navigation, route }) {
  const sample = Boolean(route.params?.sample);
  const [audit, setAudit] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [score, setScore] = useState(null);
  const [scoreError, setScoreError] = useState('');
  const [scoreLoading, setScoreLoading] = useState(false);
  const [recs, setRecs] = useState([]);
  const [recError, setRecError] = useState('');
  const [recsLoading, setRecsLoading] = useState(false);
  const [retryScore, setRetryScore] = useState(0);
  const [retryRecs, setRetryRecs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [letterError, setLetterError] = useState('');
  const [status, setStatus] = useState('');
  const [replaceVisible, setReplaceVisible] = useState(false);
  const letterRequest = useRef(null);
  const saveVersion = useRef(0);
  const alive = useRef(true);
  useFonts({ Fraunces_700Bold, DMSans_400Regular, DMSans_700Bold });

  useEffect(() => {
    let active = true;
    alive.current = true;
    const update = next => {
      if (!active || Boolean(next.sample) !== sample) return;
      if (route.params?.auditId && next.id !== route.params.auditId) {
        setLoadError('A new audit has replaced this one. Return to the audit to continue.');
        setAudit(null);
      } else setAudit(next);
    };
    const unsubscribe = subscribeAudit(update);
    loadAudit(sample).then(restored => {
      if (!active) return;
      if (restored) update(restored);
      else setLoadError('No saved audit was found. Open the campus audit to add observations.');
    }).catch(err => { if (active) setLoadError(err.message || 'Could not open the saved audit.'); });
    return () => { active = false; alive.current = false; unsubscribe(); letterRequest.current?.abort(); };
  }, [sample, route.params?.auditId]);

  const inventoryKey = audit ? JSON.stringify({ plants: audit.plants, zip_code: audit.zip_code }) : '';
  const siteKey = audit ? JSON.stringify(audit.site) : '';
  const additionsKey = audit ? JSON.stringify(audit.selected_species) : '';

  useEffect(() => {
    if (!audit) return;
    const controller = new AbortController();
    let active = true;
    setScoreLoading(true);
    setScoreError('');
    setScore(null);
    getScore(audit.plants, audit.zip_code, { additions: audit.selected_species, signal: controller.signal })
      .then(answer => { if (active) setScore(answer.result); })
      .catch(err => { if (active && err.name !== 'AbortError') setScoreError(err.message || 'Could not calculate the survey metrics.'); })
      .finally(() => { if (active) setScoreLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [inventoryKey, additionsKey, retryScore]);

  useEffect(() => {
    if (!audit) return;
    const controller = new AbortController();
    let active = true;
    setRecsLoading(true);
    setRecError('');
    setRecs([]);
    getPlantRecommendations(audit.zip_code, { plants: audit.plants, site: audit.site, signal: controller.signal })
      .then(answer => { if (active) setRecs(Array.isArray(answer.result) ? answer.result : []); })
      .catch(err => { if (active && err.name !== 'AbortError') setRecError(err.message || 'Could not load planting options.'); })
      .finally(() => { if (active) setRecsLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [inventoryKey, siteKey, retryRecs]);

  function edit(patch, stale = false) {
    const version = ++saveVersion.current;
    setSaving(true);
    setSaveError('');
    return patchAudit(audit.id, { ...patch, ...(stale && audit.letter ? { letter_stale: true } : {}) }, sample)
      .catch(err => { if (alive.current && version === saveVersion.current) setSaveError(err.message || 'Could not save edits. Export a copy before leaving.'); throw err; })
      .finally(() => { if (alive.current && version === saveVersion.current) setSaving(false); });
  }

  function change(patch, stale = false) { edit(patch, stale).catch(() => {}); }

  function toggleSpecies(name) {
    if (!audit.selected_species.includes(name) && audit.selected_species.length >= 40) {
      setLetterError('Select up to 40 species for one proposal. Remove a selection before adding another.');
      return;
    }
    const selected_species = audit.selected_species.includes(name) ? audit.selected_species.filter(item => item !== name) : [...audit.selected_species, name];
    setStatus('');
    change({ selected_species }, true);
  }

  function backToAudit() {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'EcoScan', params: { sample } });
  }

  function cancelLetter() {
    letterRequest.current?.abort();
    letterRequest.current = null;
    setGenerating(false);
  }

  async function createProposal() {
    setReplaceVisible(false);
    cancelLetter();
    const controller = new AbortController();
    letterRequest.current = controller;
    setGenerating(true);
    setLetterError('');
    setStatus('');
    try {
      const answer = await generateLetter({
        plants: audit.plants, plant_names: audit.selected_species, zip_code: audit.zip_code,
        site: audit.site, site_name: audit.site_name, survey_date: audit.survey_date,
        is_sample: Boolean(audit.sample),
        proposal: audit.proposal,
      }, { signal: controller.signal });
      if (letterRequest.current !== controller || controller.signal.aborted) return;
      const letter = typeof answer.result === 'string' ? answer.result : answer.result?.letter;
      if (!letter) throw new Error('The server returned an empty proposal. Please try again.');
      await edit({ letter, letter_stale: false });
      setStatus('Proposal generated and saved. Review the details before sharing.');
    } catch (err) {
      if (letterRequest.current === controller && err.name !== 'AbortError') setLetterError(err.message || 'Could not create the proposal. Your existing draft is preserved.');
    } finally {
      if (letterRequest.current === controller) { letterRequest.current = null; setGenerating(false); }
    }
  }

  async function copyProposal() {
    try { await Clipboard.setStringAsync(audit.letter); setStatus('Proposal copied to clipboard.'); }
    catch { setStatus('Clipboard access was unavailable. Select the draft text or export the report instead.'); }
  }

  async function exportReport() {
    const report = buildAuditReport(audit, score);
    try {
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${audit.sample ? 'sample-' : ''}ecoloco-audit-${audit.survey_date}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else await Share.share({ title: 'EcoLoco campus plant survey', message: report });
      setStatus(Platform.OS === 'web' ? 'Report exported with observations, sources and your proposal.' : 'Report opened in the share sheet.');
    } catch { setStatus('Could not export this report. Try again or copy your proposal.'); }
  }

  function openSource(url) {
    if (/^https?:\/\//i.test(url || '')) Linking.openURL(url).catch(() => setStatus('Could not open this source. Its URL is included in the exported report.'));
  }

  if (!audit) return <AuditPage><Text style={s.title}>Audit report</Text>{loadError ? <AuditNotice error>{loadError}</AuditNotice> : <ActivityIndicator accessibilityLabel="Opening audit report" color="#1e3a1e" />}<AuditButton secondary onPress={backToAudit}>Return to campus audit</AuditButton></AuditPage>;

  const unavailableSelections = audit.selected_species.filter(name => !recs.some(rec => rec.scientific_name === name));
  const canGenerate = audit.selected_species.length > 0 && !unavailableSelections.length && !recsLoading && !generating && !saving;
  const proposalFields = [
    ['location', 'Proposed planting location', 'West courtyard border'],
    ['quantity', 'Proposed quantities', '3 coonties and 5 native wildflowers'],
    ['budget', 'Budget and funding source', 'Estimate pending a nursery quote'],
    ['maintenance', 'Maintenance responsibility and schedule', 'Who will water during establishment and school breaks?'],
    ['student_name', 'Student or team name', 'Your name or club'],
    ['school_name', 'School name', 'Your school'],
    ['principal_name', 'Recipient name or role', 'Principal or facilities team'],
  ];

  return <AuditPage>
    <View style={s.row}><Text accessibilityRole="header" style={[s.title, { flex: 1 }]}>Survey to proposal</Text><AuditButton secondary onPress={backToAudit} disabled={generating}>Edit audit</AuditButton></View>
    <Text style={s.body}>{audit.site_name} · {audit.survey_date} · ZIP {audit.zip_code}</Text>
    {audit.sample && <AuditNotice><Text style={s.label}>Sample audit — fictional demonstration</Text><Text style={s.body}>These observations illustrate the workflow. They are not evidence of a real campus survey or ecological improvement.</Text></AuditNotice>}
    {saveError && <AuditNotice error><Text style={s.body}>{saveError}</Text><AuditButton secondary onPress={() => change({})}>Retry saving</AuditButton></AuditNotice>}
    {status && <AuditNotice>{status}</AuditNotice>}
    <Text accessibilityLiveRegion="polite" style={s.muted}>{saving ? 'Saving edits on this device…' : saveError ? 'Some edits have not saved.' : 'Audit, selected species and draft saved on this device.'}</Text>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>What your survey records</Text>
      {scoreLoading && <View style={s.row}><ActivityIndicator color="#1e3a1e" /><Text style={s.body}>Checking unique species and their sources…</Text></View>}
      {scoreError && <AuditNotice error><Text style={s.body}>{scoreError}</Text><AuditButton secondary onPress={() => setRetryScore(value => value + 1)}>Retry survey calculation</AuditButton></AuditNotice>}
      {score && <>
        <Text style={{ ...s.title, fontSize: 44 }}>{percent(score.native_share)}</Text>
        <Text style={s.label}>Native share of verified taxa</Text>
        <Text style={s.body}>{score.verified_species_count ? `${score.native_count} of ${score.verified_species_count} verified taxa are native.` : 'No plants currently have both a resolved identification and verified Florida status.'}</Text>
        <Text style={s.muted}>A taxon is a species or a variety whose Florida status differs. Each is counted once.</Text>
        <View style={s.row}>
          <Text style={s.body}>{score.native_count} native</Text><Text style={s.body}>· {score.non_native_count} nonnative</Text><Text style={s.body}>· {score.invasive_count} invasive</Text>
        </View>
        <Text style={s.body}>{score.observation_count} observations · {score.unresolved_count} unresolved observations outside the denominator</Text>
        <Text style={s.muted}>The three categories are separate; “nonnative” excludes invasive species here. Repeated photos or observations of one taxon count once.</Text>
        <AuditNotice>This describes the species sampled in this surveyed area. It does not measure the whole campus’s biodiversity, plant abundance, habitat quality or wildlife population.</AuditNotice>
        {score.summary && <Text style={s.body}>{score.summary}</Text>}
        {(Array.isArray(score.limitations) ? score.limitations : score.limitations ? [score.limitations] : []).map((limitation, index) => <Text key={index} style={s.muted}>• {limitation}</Text>)}
        {score.species?.map(plant => <View key={plant.taxon_id || plant.scientific_name} style={{ gap: 4, paddingTop: 9 }}>
          <Text style={s.label}>{plant.plant_name || plant.scientific_name} · {plant.invasive_status}</Text>
          <Text style={s.muted}>{plant.scientific_name} · {plant.observation_count} observation{plant.observation_count === 1 ? '' : 's'}</Text>
          {plant.source_url && <TouchableOpacity accessibilityRole="link" onPress={() => openSource(plant.source_url)}><Text style={{ ...s.muted, textDecorationLine: 'underline' }}>Florida status source: {plant.source || 'view source'}{plant.verified_on ? ` · checked ${plant.verified_on}` : ''}</Text></TouchableOpacity>}
        </View>)}
        {score.unresolved?.length > 0 && <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={s.label}>Needs review</Text>
          {score.unresolved.map((plant, index) => <Text key={index} style={s.body}>Observation {(plant.observation_index ?? index) + 1}: {plant.plant_name || plant.scientific_name || 'Unidentified plant'} — {plant.reason || 'Identification or status needs confirmation.'}</Text>)}
          <AuditButton secondary onPress={backToAudit}>Review unresolved observations</AuditButton>
        </View>}
        {score.invasive_count > 0 && <Text style={s.muted}>A verified invasive classification describes the species. Ask school staff and a qualified local professional to confirm identity and a management plan before changing established vegetation.</Text>}
      </>}
    </View>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>Choose additions for this site</Text>
      <Text style={s.body}>Options use your recorded species and site conditions: {Object.entries(audit.site).map(([key, value]) => `${key}: ${value}`).join(' · ')}.</Text>
      <Text style={s.muted}>Select species to include in your proposal. Benefits describe documented relationships, not wildlife measured at your school.</Text>
      {recsLoading && <View style={s.row}><ActivityIndicator color="#1e3a1e" /><Text style={s.body}>Checking native plants against this site…</Text></View>}
      {recError && <AuditNotice error><Text style={s.body}>{recError}</Text><AuditButton secondary onPress={() => setRetryRecs(value => value + 1)}>Retry planting options</AuditButton></AuditNotice>}
      {!recsLoading && !recError && !recs.length && <AuditNotice>No additional catalog species meet these conditions. Review site conditions or ask local extension staff about other verified species. Do not change accurate site details just to get more results.</AuditNotice>}
      {recs.map(rec => {
        const selected = audit.selected_species.includes(rec.scientific_name);
        return <View key={rec.taxon_id || rec.scientific_name} style={[s.card, { padding: 16, backgroundColor: selected ? '#eaf1e3' : '#fff' }]}>
          <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={`Include ${rec.plant_name} in proposal`} aria-checked={selected} aria-disabled={generating} accessibilityState={{ checked: selected, disabled: generating }} disabled={generating} onPress={() => toggleSpecies(rec.scientific_name)} style={s.row}>
            <Text style={{ fontSize: 24, color: '#1e3a1e' }}>{selected ? '☑' : '☐'}</Text><View style={{ flex: 1 }}><Text style={s.label}>{rec.plant_name}</Text><Text style={s.muted}>{rec.scientific_name}</Text></View>
          </TouchableOpacity>
          <Text style={s.body}>{rec.benefit || rec.why}</Text>
          {rec.suitability && <Text style={s.muted}>{rec.suitability}</Text>}
          {rec.site_needs_confirmation && <Text style={s.label}>Check the unknown site conditions before purchasing.</Text>}
          {rec.action && <Text style={s.muted}>{rec.action}</Text>}
          {rec.source_url && <TouchableOpacity accessibilityRole="link" onPress={() => openSource(rec.source_url)}><Text style={{ ...s.muted, textDecorationLine: 'underline' }}>{rec.source || 'Status source'}{rec.verified_on ? ` · checked ${rec.verified_on}` : ''}</Text></TouchableOpacity>}
          {rec.why_source_url && rec.why_source_url !== rec.source_url && <TouchableOpacity accessibilityRole="link" onPress={() => openSource(rec.why_source_url)}><Text style={{ ...s.muted, textDecorationLine: 'underline' }}>Wildlife benefit source</Text></TouchableOpacity>}
        </View>;
      })}
      {!recsLoading && unavailableSelections.length > 0 && <AuditNotice error>
        <Text style={s.body}>These saved selections are not among the current site options. Remove them or review the site before generating another proposal.</Text>
        {unavailableSelections.map(name => <AuditButton key={name} secondary disabled={generating} onPress={() => toggleSpecies(name)}>Remove {name} from proposal</AuditButton>)}
      </AuditNotice>}
      {score?.projected && audit.selected_species.length > 0 && <AuditNotice>
        <Text style={s.label}>Selected-species scenario</Text>
        <Text style={s.body}>{percent(score.native_share)} → {percent(score.projected.native_share)} native share, if the selected new species are established and recorded in the same surveyed area.</Text>
        <Text style={s.body}>{score.projected.native_count} of {score.projected.verified_species_count} unique verified taxa would be native.</Text>
        <Text style={s.muted}>This recalculates the species inventory. It is not a predicted biodiversity or wildlife increase. Planting more individuals of an already recorded species does not change this metric.</Text>
      </AuditNotice>}
    </View>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>Build a school proposal</Text>
      <Text style={s.body}>The draft requests permission and uses your survey facts. Fill in the practical details; leave anything unknown blank so it can be marked for review.</Text>
      <Text style={s.label}>Selected additions: {audit.selected_species.join(', ') || 'None yet'}</Text>
      {proposalFields.map(([key, label, placeholder]) => <AuditField key={key} label={label} placeholder={placeholder} value={audit.proposal[key] || ''} editable={!generating} maxLength={key === 'maintenance' ? 500 : 300} multiline={key === 'maintenance'} onChangeText={value => change({ proposal: { [key]: value } }, true)} />)}
      <AuditButton disabled={!canGenerate} onPress={() => audit.letter ? setReplaceVisible(true) : createProposal()}>{generating ? 'Creating source-linked proposal…' : audit.letter ? 'Regenerate proposal from current details' : 'Generate school proposal'}</AuditButton>
      {!audit.selected_species.length && <Text style={s.muted}>Choose at least one planting option above to generate the proposal.</Text>}
      {generating && <AuditButton secondary onPress={cancelLetter}>Cancel proposal request</AuditButton>}
      {letterError && <AuditNotice error>{letterError}</AuditNotice>}
      {audit.letter_stale && audit.letter && <AuditNotice error><Text style={s.body}>Survey details or selections changed after this draft was generated. Regenerate it, or revise and review the text before sharing.</Text><AuditButton secondary disabled={generating} onPress={() => change({ letter_stale: false })}>I reviewed and updated this draft</AuditButton></AuditNotice>}
      {audit.letter && <>
        <Text style={s.label}>Editable proposal</Text>
        <Text style={s.muted}>Edits save automatically on this device. Regeneration replaces your wording only after confirmation.</Text>
        <TextInput accessibilityLabel="Editable school proposal" multiline value={audit.letter} onChangeText={letter => change({ letter })} editable={!generating} style={[s.input, { minHeight: 520, textAlignVertical: 'top', lineHeight: 23 }]} />
        <AuditButton secondary onPress={copyProposal}>Copy proposal</AuditButton>
      </>}
    </View>
    <AuditButton onPress={exportReport}>Export / share complete report</AuditButton>
    <Text style={s.muted}>The portable text report includes recorded observations, source links, limitations and your editable proposal. Export a copy before starting a new audit. Nothing is sent to school staff automatically.</Text>
    <Modal visible={replaceVisible} transparent animationType="fade" onRequestClose={() => setReplaceVisible(false)}>
      <View style={s.modalShade}><View style={s.modal} accessibilityViewIsModal>
        <Text style={s.heading}>Replace the saved draft?</Text><Text style={s.body}>Regenerating uses the current survey and proposal fields and replaces your draft edits. Copy or export the existing text first if you want to retain it.</Text>
        <View style={s.row}><AuditButton secondary onPress={() => setReplaceVisible(false)}>Keep my draft</AuditButton><AuditButton onPress={createProposal}>Replace with new proposal</AuditButton></View>
      </View></View>
    </Modal>
  </AuditPage>;
}
