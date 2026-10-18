import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, TextInput, Linking, Platform, Share, Modal, Image, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { getScore, getPlantRecommendations, generateLetter } from '../services/geminiService';
import { loadAudit, patchAudit, subscribeAudit, buildAuditReport } from '../services/auditStorage';
import { AuditButton, AuditField, AuditNotice, AuditPage, auditStyles as s } from '../components/AuditUI';
import { PlantFacts } from '../components/PlantEvidence';

const percent = value => value == null ? 'Not enough evidence' : `${Math.round(value * 10) / 10}%`;
const LOGO = require('../../assets/EcoLoco_logo.png');
const shortBenefit = value => typeof value === 'string' ? value.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || value : '';

function PlantOption({ item, selected, disabled, onSelect, onSource }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={[ui.option, selected && ui.selectedOption]}>
    <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={`Include ${item.plant_name} in letter`} accessibilityState={{ checked: selected, disabled }} aria-checked={selected} aria-disabled={disabled} disabled={disabled} onPress={onSelect} style={ui.optionHeading}>
      <View style={[ui.checkbox, selected && ui.checkboxSelected]}><Text style={ui.check}>{selected ? '✓' : ''}</Text></View>
      <View style={{ flex: 1, gap: 3 }}><Text style={ui.plantName}>{item.plant_name}</Text><Text style={s.muted}>{item.scientific_name}</Text></View>
    </TouchableOpacity>
    <Text style={s.body}>{shortBenefit(item.benefit || item.why)}</Text>
    {item.site_needs_confirmation && <Text style={ui.smallNote}>Site conditions need a check.</Text>}
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setExpanded(!expanded)} style={ui.disclosure}><Text style={ui.link}>{expanded ? 'Hide details −' : 'Details & sources +'}</Text></TouchableOpacity>
    {expanded && <View style={ui.details}>
      {!!(item.benefit || item.why) && <Text style={s.body}>{item.benefit || item.why}</Text>}
      {!!item.suitability && <Text style={s.muted}>{item.suitability}</Text>}
      {!!item.management_notes && <Text style={s.muted}>{item.management_notes}</Text>}
      {!!item.action && <Text style={s.muted}>{item.action}</Text>}
      <Text style={s.muted}>{item.source || 'Florida plant record'}{item.verified_on ? ` · checked ${item.verified_on}` : ''}</Text>
      {[[item.source_url, 'Florida status'], [item.why_source_url, 'Wildlife relationship'], [item.requirements_source_url, 'Growing requirements']].filter(([url]) => url).map(([url, label]) => <TouchableOpacity key={label} accessibilityRole="link" onPress={() => onSource(url)} style={ui.disclosure}><Text style={ui.link}>{label} ↗</Text></TouchableOpacity>)}
      <PlantFacts plant={item} />
    </View>}
  </View>;
}

export default function AuditResultsScreen({ navigation, route }) {
  const sample = Boolean(route.params?.sample);
  const [audit, setAudit] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [score, setScore] = useState(null);
  const [scoreKey, setScoreKey] = useState('');
  const [scoreError, setScoreError] = useState('');
  const [scoreLoading, setScoreLoading] = useState(false);
  const [recs, setRecs] = useState([]);
  const [plantingsChecked, setPlantingsChecked] = useState(null);
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
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [allOptions, setAllOptions] = useState(false);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const letterRequest = useRef(null);
  const saveVersion = useRef(0);
  const alive = useRef(true);
  const scoreInventory = useRef('');
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
  const currentScoreKey = `${inventoryKey}|${additionsKey}`;
  const scoreIsCurrent = Boolean(score) && scoreKey === currentScoreKey;

  useEffect(() => {
    if (!audit) return;
    const controller = new AbortController();
    let active = true;
    setScoreLoading(true);
    setScoreError('');
    if (scoreInventory.current !== inventoryKey) setScore(null);
    scoreInventory.current = inventoryKey;
    getScore(audit.plants, audit.zip_code, { additions: audit.selected_species, signal: controller.signal })
      .then(answer => { if (active) { setScore(answer.result); setScoreKey(currentScoreKey); } })
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
    setPlantingsChecked(null);
    setAllOptions(false);
    getPlantRecommendations(audit.zip_code, { plants: audit.plants, site: audit.site, signal: controller.signal })
      .then(answer => { if (active) { setRecs(Array.isArray(answer.result) ? answer.result : []); setPlantingsChecked(answer.plantings_checked); } })
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

  if (!audit) return <AuditPage><Text style={s.title}>EcoScan results</Text>{loadError ? <AuditNotice error>{loadError}</AuditNotice> : <ActivityIndicator accessibilityLabel="Opening audit report" color="#1e3a1e" />}<AuditButton secondary onPress={backToAudit}>Back to EcoScan</AuditButton></AuditPage>;

  const unavailableSelections = audit.selected_species.filter(name => !recs.some(rec => rec.scientific_name === name));
  const canGenerate = audit.selected_species.length > 0 && !unavailableSelections.length && !recError && !recsLoading && !generating && !saving && scoreIsCurrent && !scoreError;
  const shownRecs = allOptions ? recs : recs.slice(0, 3);
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
    <View style={ui.brand}><Image source={LOGO} style={ui.logo} accessibilityLabel="EcoLoco" /><Text style={ui.brandName}>EcoLoco</Text></View>
    <View style={s.row}><Text accessibilityRole="header" style={[s.title, { flex: 1 }]}>EcoScan results</Text><TouchableOpacity accessibilityRole="button" onPress={backToAudit} disabled={generating} style={ui.disclosure}><Text style={ui.link}>Edit scan</Text></TouchableOpacity></View>
    <Text style={s.muted}>{audit.site_name} · {audit.survey_date}{audit.sample ? ' · Sample audit' : ''}</Text>
    {audit.sample && <Text style={ui.smallNote}>Fictional observations for demonstration.</Text>}
    {saveError && <AuditNotice error><Text style={s.body}>{saveError}</Text><AuditButton secondary onPress={() => change({})}>Retry saving</AuditButton></AuditNotice>}
    {status && <AuditNotice>{status}</AuditNotice>}
    <View style={ui.dashboard}>
      {!score && scoreLoading && <ActivityIndicator accessibilityLabel="Calculating native species" color="#1e3a1e" />}
      {score && <>
        <Text style={ui.overline}>YOUR PLANT SURVEY</Text>
        <Text style={ui.percentage}>{score.native_share == null ? '—' : percent(score.native_share)}</Text>
        <Text style={ui.metricName}>Native species</Text>
        <Text style={s.muted}>{score.verified_species_count ? `${score.native_count} of ${score.verified_species_count} verified species or varieties` : 'Add a verified observation to calculate your share.'}</Text>
        <View style={ui.meter} accessibilityRole="progressbar" accessibilityLabel="Native share of verified species" accessibilityValue={score.native_share == null ? { text: 'Not enough evidence' } : { min: 0, max: 100, now: score.native_share }}><View style={[ui.meterFill, { width: `${score.native_share ?? 0}%` }]} /></View>
        <View style={ui.counts}>
          {[[score.native_count, 'Native', '#3f6f36'], [score.non_native_count, 'Nonnative', '#a87926'], [score.invasive_count, 'Invasive', '#a34c32']].map(([count, label, color]) => <View key={label} style={ui.count}><Text style={[ui.countValue, { color }]}>{count}</Text><Text style={s.muted}>{label}</Text></View>)}
        </View>
        <Text style={ui.smallNote}>{score.observation_count} observations{score.unresolved_count ? ` · ${score.unresolved_count} need review` : ''} · Each verified taxon counted once</Text>
        {score.unresolved_count > 0 && <TouchableOpacity accessibilityRole="button" onPress={backToAudit} style={ui.disclosure}><Text style={ui.link}>Review uncertain plants →</Text></TouchableOpacity>}
        {audit.selected_species.length > 0 && score.projected && <View style={[ui.scenario, !scoreIsCurrent && ui.pending]}>
          <View style={ui.scenarioValue}><Text style={s.muted}>Before</Text><Text style={ui.scenarioNumber}>{score.native_share == null ? '—' : percent(score.native_share)}</Text></View>
          <Text style={ui.scenarioArrow}>→</Text>
          <View style={ui.scenarioValue}><Text style={s.muted}>{scoreIsCurrent ? 'After planting' : 'Last calculation'}</Text><Text style={[ui.scenarioNumber, { color: '#4a7a3a' }]}>{score.projected.native_share == null ? '—' : percent(score.projected.native_share)}</Text></View>
        </View>}
        {audit.selected_species.length > 0 && <Text style={ui.smallNote}>{scoreIsCurrent ? 'If selected new species establish. This is a species inventory, not a wildlife forecast.' : scoreError ? 'The latest selection has not been calculated.' : 'Updating your selection…'}</Text>}
      </>}
      {scoreError && <AuditNotice error><Text style={s.body}>{scoreError}</Text><AuditButton secondary onPress={() => setRetryScore(value => value + 1)}>Retry calculation</AuditButton></AuditNotice>}
    </View>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: evidenceOpen }} aria-expanded={evidenceOpen} onPress={() => setEvidenceOpen(!evidenceOpen)} style={ui.disclosure}><Text style={ui.link}>{evidenceOpen ? 'Hide sources & survey details −' : 'Sources & survey details +'}</Text></TouchableOpacity>
    {evidenceOpen && score && <View style={s.card}>
      <Text style={s.body}>Native share counts unique verified species and varieties in this survey. Unresolved observations stay outside the percentage.</Text>
      <Text style={s.muted}>It does not measure whole-campus biodiversity, abundance, habitat quality or wildlife populations.</Text>
      {(Array.isArray(score.limitations) ? score.limitations : score.limitations ? [score.limitations] : []).map((limitation, index) => <Text key={index} style={s.muted}>• {limitation}</Text>)}
      {score.species?.map(plant => <View key={plant.taxon_id || plant.scientific_name} style={ui.details}>
        <Text style={s.label}>{plant.plant_name || plant.scientific_name} · {plant.invasive_status}</Text>
        <Text style={s.muted}>{plant.scientific_name} · {plant.observation_count} observation{plant.observation_count === 1 ? '' : 's'}</Text>
        {plant.source_url && <TouchableOpacity accessibilityRole="link" onPress={() => openSource(plant.source_url)} style={ui.disclosure}><Text style={ui.link}>{plant.source || 'Florida status source'}{plant.verified_on ? ` · ${plant.verified_on}` : ''} ↗</Text></TouchableOpacity>}
      </View>)}
      {score.unresolved?.map((plant, index) => <Text key={index} style={s.muted}>Observation {(plant.observation_index ?? index) + 1}: {plant.plant_name || plant.scientific_name || 'Unidentified plant'} — {plant.reason}</Text>)}
      {score.invasive_count > 0 && <Text style={s.muted}>Ask school grounds staff to confirm identification and a management plan before removing established plants.</Text>}
    </View>}
    <View style={ui.section}>
      <View style={s.row}><Text accessibilityRole="header" style={[s.heading, { flex: 1 }]}>Grow your impact</Text><Text style={ui.selectionCount}>{audit.selected_species.length} selected</Text></View>
      <Text style={s.muted}>Choose native additions for your letter.</Text>
      {recsLoading && <ActivityIndicator accessibilityLabel="Finding native additions" color="#1e3a1e" />}
      {recError && <AuditNotice error><Text style={s.body}>{recError}</Text><AuditButton secondary onPress={() => setRetryRecs(value => value + 1)}>Try again</AuditButton></AuditNotice>}
      {!recsLoading && !recError && !recs.length && <AuditNotice>{plantingsChecked === false ? 'Planting options currently cover Palm Beach County only.' : 'No new catalog plants match this site. Check your site details or ask local extension staff.'}</AuditNotice>}
      {shownRecs.map(rec => <PlantOption key={rec.taxon_id || rec.scientific_name} item={rec} selected={audit.selected_species.includes(rec.scientific_name)} disabled={generating} onSelect={() => toggleSpecies(rec.scientific_name)} onSource={openSource} />)}
      {recs.length > 3 && <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: allOptions }} aria-expanded={allOptions} onPress={() => setAllOptions(!allOptions)} style={ui.disclosure}><Text style={ui.link}>{allOptions ? 'Show less −' : `Show ${recs.length - 3} more ${recs.length === 4 ? 'option' : 'options'} +`}</Text></TouchableOpacity>}
      {!recsLoading && !recError && unavailableSelections.length > 0 && <AuditNotice error><Text style={s.body}>Some saved choices no longer match this site.</Text>{unavailableSelections.map(name => <AuditButton key={name} secondary disabled={generating} onPress={() => toggleSpecies(name)}>Remove {name}</AuditButton>)}</AuditNotice>}
    </View>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>Make it happen</Text>
      <Text style={s.muted}>Turn your scan and selected plants into a school letter.</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: personalizeOpen }} aria-expanded={personalizeOpen} onPress={() => setPersonalizeOpen(!personalizeOpen)} style={ui.disclosure}><Text style={ui.link}>{personalizeOpen ? 'Hide personal details −' : 'Personalize letter +'} <Text style={s.muted}>(optional)</Text></Text></TouchableOpacity>
      {personalizeOpen && <View style={ui.details}>{proposalFields.map(([key, label, placeholder]) => <AuditField key={key} label={label} placeholder={placeholder} value={audit.proposal[key] || ''} editable={!generating} maxLength={key === 'maintenance' ? 500 : 300} multiline={key === 'maintenance'} onChangeText={value => change({ proposal: { [key]: value } }, true)} />)}<Text style={s.muted}>Blank details become placeholders you can fill in later.</Text></View>}
      <AuditButton disabled={!canGenerate} onPress={() => audit.letter ? setReplaceVisible(true) : createProposal()}>{generating ? 'Creating your letter…' : audit.letter ? 'Regenerate letter' : 'Generate letter'}</AuditButton>
      {!audit.selected_species.length && <Text style={ui.smallNote}>Select at least one plant above.</Text>}
      {generating && <AuditButton secondary onPress={cancelLetter}>Cancel</AuditButton>}
      {letterError && <AuditNotice error>{letterError}</AuditNotice>}
      {audit.letter_stale && audit.letter && <AuditNotice error><Text style={s.body}>Your survey or choices changed. Update this draft before sharing.</Text><AuditButton secondary disabled={generating} onPress={() => change({ letter_stale: false })}>I've reviewed this draft</AuditButton></AuditNotice>}
      {audit.letter && <>
        <Text style={s.label}>Your letter</Text><Text style={s.muted}>Edit below. Changes save automatically.</Text>
        <TextInput accessibilityLabel="Editable school proposal" multiline value={audit.letter} onChangeText={letter => change({ letter })} editable={!generating} style={[s.input, { minHeight: 360, textAlignVertical: 'top', lineHeight: 23 }]} />
        <AuditButton secondary onPress={copyProposal}>Copy letter</AuditButton>
      </>}
      <Text accessibilityLiveRegion="polite" style={ui.smallNote}>{saving ? 'Saving…' : saveError ? 'Some edits have not saved.' : 'Saved on this device.'}</Text>
    </View>
    <View style={ui.footerActions}><AuditButton onPress={backToAudit}>Scan more plants</AuditButton><AuditButton secondary onPress={exportReport} disabled={!scoreIsCurrent || saving}>Export complete report</AuditButton></View>
    <Text style={ui.smallNote}>Your report includes observations, sources and your letter. Nothing is sent automatically.</Text>
    <Modal visible={replaceVisible} transparent animationType="fade" onRequestClose={() => setReplaceVisible(false)}>
      <View style={s.modalShade}><View style={s.modal} accessibilityViewIsModal>
        <Text style={s.heading}>Replace your letter?</Text><Text style={s.body}>This creates a new draft from your current scan and choices. Copy the existing letter first to keep your edits.</Text>
        <View style={s.row}><AuditButton secondary onPress={() => setReplaceVisible(false)}>Keep my draft</AuditButton><AuditButton onPress={createProposal}>Replace letter</AuditButton></View>
      </View></View>
    </Modal>
  </AuditPage>;
}

const ui = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#d4cfc4' },
  logo: { width: 32, height: 32 }, brandName: { fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#1e3a1e' },
  dashboard: { padding: 26, borderRadius: 22, backgroundColor: '#e8eddf', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#d3dcc6' },
  overline: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 1.8, color: '#5b6b50' },
  percentage: { fontFamily: 'Fraunces_700Bold', fontSize: 64, lineHeight: 76, color: '#1e3a1e' },
  metricName: { fontFamily: 'DMSans_700Bold', fontSize: 18, color: '#1e3a1e' },
  meter: { height: 8, width: '100%', maxWidth: 330, borderRadius: 8, backgroundColor: '#d4ddcb', overflow: 'hidden', marginVertical: 8 },
  meterFill: { height: '100%', backgroundColor: '#4a7a3a', borderRadius: 8 },
  counts: { flexDirection: 'row', width: '100%', maxWidth: 430, justifyContent: 'space-around', gap: 14, paddingVertical: 8 },
  count: { alignItems: 'center', gap: 3 }, countValue: { fontFamily: 'Fraunces_700Bold', fontSize: 28 },
  smallNote: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18, color: '#5b6356' },
  scenario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 25, width: '100%', borderTopWidth: 1, borderTopColor: '#cdd7c2', paddingTop: 18, marginTop: 8 },
  scenarioValue: { alignItems: 'center', gap: 5 }, scenarioNumber: { fontFamily: 'Fraunces_700Bold', fontSize: 30, color: '#1e3a1e' }, scenarioArrow: { fontSize: 24, color: '#718766' }, pending: { opacity: 0.55 },
  section: { gap: 13 }, option: { padding: 18, gap: 8, borderRadius: 15, borderWidth: 1, borderColor: '#d4cfc4', backgroundColor: '#fefcf8' }, selectedOption: { borderColor: '#709362', backgroundColor: '#f0f4e9' },
  optionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }, checkbox: { width: 25, height: 25, borderRadius: 7, borderWidth: 1.5, borderColor: '#829176', alignItems: 'center', justifyContent: 'center' }, checkboxSelected: { backgroundColor: '#1e3a1e', borderColor: '#1e3a1e' }, check: { color: '#fff', fontSize: 17, fontWeight: '700' },
  plantName: { fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#1e3a1e' }, selectionCount: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#4a7a3a' },
  disclosure: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }, link: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#31582a', lineHeight: 20 }, details: { gap: 10, borderTopWidth: 1, borderTopColor: '#e0dfd4', paddingTop: 12 },
  footerActions: { gap: 10 },
});
