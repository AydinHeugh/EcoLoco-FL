import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Image, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { getPlantRecommendations } from '../services/geminiService';
import SiteConditions, { DEFAULT_SITE } from '../components/SiteConditions';
import { EvidenceLink } from '../components/PlantEvidence';

const LOGO = require('../../assets/EcoLoco_logo.png');
const readable = (value) => Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '';

export function RecommendationCard({ item }) {
  const suitability = readable(item.suitability) || readable(item.suitability_explanation);
  return <View style={styles.card}>
    <Text style={styles.overline}>VERIFIED FLORIDA NATIVE</Text>
    <Text accessibilityRole="header" style={styles.plantName}>{item.plant_name || item.common_name || item.scientific_name}</Text>
    <Text style={styles.scientific}>{item.scientific_name}</Text>
    <Text style={styles.label}>Why consider it</Text>
    <Text style={styles.body}>{item.why || item.benefit || item.impact || 'Review the linked plant record before planning a planting.'}</Text>
    {!!item.problem && <Text style={styles.hint}>{item.problem}</Text>}
    <Text style={styles.label}>Proposed step</Text>
    <Text style={styles.body}>{item.action || `Check the planting site with your school before choosing ${item.plant_name || item.scientific_name}.`}</Text>
    {!!suitability && <View style={styles.notice}><Text style={styles.body}>{suitability}</Text></View>}
    {!!item.site_requirements && <Text style={styles.hint}>{typeof item.site_requirements === 'string' ? item.site_requirements : Object.entries(item.site_requirements).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${readable(value)}`).join(' · ')}</Text>}
    {!!item.sun && <Text style={styles.hint}>Sun: {readable(item.sun)} · Moisture: {readable(item.moisture)}{item.min_space ? ` · Space: ${item.min_space}` : ''}{item.maintenance ? ` · Maintenance: ${item.maintenance}` : ''}</Text>}
    {!!item.management_notes && <Text style={styles.hint}>{item.management_notes}</Text>}
    <Text style={styles.hint}>Record: {item.source || 'Florida plant catalog'}{item.verified_on ? ` · checked ${item.verified_on}` : ''}</Text>
    <EvidenceLink url={item.source_url}>Plant status and growing guidance</EvidenceLink>
    <EvidenceLink url={item.why_source_url}>Wildlife relationship evidence</EvidenceLink>
    <EvidenceLink url={item.requirements_source_url}>Planting requirements source</EvidenceLink>
  </View>;
}

export default function RecommendationScreen({ navigation, route }) {
  const [zipCode, setZipCode] = useState(route?.params?.prefillZip || '');
  const [site, setSite] = useState({ ...DEFAULT_SITE, ...route?.params?.site });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const request = useRef({ sequence: 0, controller: null });
  const plants = route?.params?.plants || [];
  const [fontsLoaded] = useFonts({ Fraunces_700Bold });
  const { width } = useWindowDimensions();

  const cancel = useCallback(() => {
    request.current.sequence++;
    request.current.controller?.abort();
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => () => cancel(), [cancel]));
  useEffect(() => {
    cancel();
    if (route?.params?.prefillZip) setZipCode(route.params.prefillZip);
    if (route?.params?.site) setSite({ ...DEFAULT_SITE, ...route.params.site });
    setResults(null);
    setError(null);
  }, [route?.params, cancel]);
  function changeZip(value) {
    cancel();
    setZipCode(value.replace(/[^0-9]/g, '').slice(0, 5));
    setResults(null);
    setError(null);
  }
  function changeSite(value) {
    cancel();
    setSite(value);
    setResults(null);
    setError(null);
  }
  async function recommend() {
    if (!/^33[0-4]\d{2}$/.test(zipCode)) {
      setError('Enter a South Florida ZIP beginning 330–334. This pilot uses verified Florida plant records.');
      return;
    }
    cancel();
    const id = request.current.sequence;
    const controller = new AbortController();
    request.current.controller = controller;
    setLoading(true);
    setError(null);
    setResults(null);
    setExpanded(false);
    try {
      const data = await getPlantRecommendations(zipCode, { plants, site, signal: controller.signal });
      if (id === request.current.sequence) setResults(data.result);
    } catch (failure) {
      if (id === request.current.sequence && !controller.signal.aborted) setError(failure.message || 'Could not load plant suggestions. Your site choices are still here; try again.');
    } finally {
      if (id === request.current.sequence) setLoading(false);
    }
  }
  const shown = Array.isArray(results) ? expanded ? results : results.slice(0, 3) : [];

  return <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
    <View style={[styles.inner, { width: Math.min(width, 960) }]}>
      <View style={styles.brand}><Image source={LOGO} style={styles.logo} accessibilityLabel="EcoLoco" /><Text style={styles.brandName}>EcoLoco</Text></View>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, fontsLoaded && { fontFamily: 'Fraunces_700Bold' }]}>Plan a native planting.</Text>
        <Text style={styles.subtitle}>Choose from sourced Florida natives using your site conditions. Read each plant’s requirements before asking your school to approve a planting.</Text>
        <Text style={styles.label}>Planting ZIP code</Text>
        <TextInput accessibilityLabel="Planting ZIP code" value={zipCode} onChangeText={changeZip} placeholder="e.g. 33431" placeholderTextColor="#777768" keyboardType="number-pad" maxLength={5} style={styles.input} />
        <Text style={styles.hint}>South Florida pilot · ZIP prefixes 330–334. A ZIP defines our supported region; it does not reveal your soil or planting space.</Text>
        <SiteConditions site={site} onChange={changeSite} />
        {!!plants.length && <Text style={styles.hint}>Using {plants.length} recorded observation{plants.length === 1 ? '' : 's'} to look for suitable species additions.</Text>}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: loading }} aria-disabled={loading} disabled={loading} onPress={recommend} style={[styles.button, loading && styles.disabled]}>
          {loading ? <ActivityIndicator color="#fffdf8" /> : <Text style={styles.buttonText}>Find planting options</Text>}
        </TouchableOpacity>
        {loading && <View style={styles.notice}><Text accessibilityLiveRegion="polite" style={styles.hint}>Checking sourced plants against your site conditions…</Text><TouchableOpacity accessibilityRole="button" onPress={cancel} style={styles.linkButton}><Text style={styles.link}>Cancel request</Text></TouchableOpacity></View>}
        {!!error && <View style={styles.errorBox}><Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={recommend} style={styles.linkButton}><Text style={styles.link}>Try again</Text></TouchableOpacity></View>}
        {Array.isArray(results) && <View style={styles.results}>
          <Text accessibilityRole="header" style={styles.resultsTitle}>{results.length ? `${results.length} planting option${results.length === 1 ? '' : 's'}` : 'No catalog plants match these conditions yet'}</Text>
          <Text style={styles.hint}>{results.length ? 'Options are listed alphabetically after matching your filters. These planning suggestions do not predict wildlife numbers or rank measured ecological impact.' : 'Review the conditions you entered or consult a local extension specialist. The catalog is deliberately limited to checked species.'}</Text>
          {shown.map((item) => <RecommendationCard key={item.taxon_id || item.scientific_name} item={item} />)}
          {results.length > 3 && <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setExpanded(!expanded)} style={styles.secondaryButton}><Text style={styles.secondaryText}>{expanded ? 'Show first three options' : `Show all ${results.length} options`}</Text></TouchableOpacity>}
          <View style={styles.notice}><Text style={styles.hint}>For broader research, NWF lists documented host relationships by plant genus and region. Those numbers are not wildlife counts at your campus and should not be added across plants.</Text><EvidenceLink url="https://nativeplantfinder.nwf.org">Explore NWF Native Plant Finder</EvidenceLink></View>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('EcoScan', { sample: false })} style={styles.secondaryButton}><Text style={styles.secondaryText}>Build a campus audit and school proposal →</Text></TouchableOpacity>
        </View>}
      </View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' }, scrollContent: { alignItems: 'center' }, inner: { alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', padding: 24, paddingTop: 48, gap: 9, borderBottomWidth: 1, borderColor: '#d4cfc4' },
  logo: { width: 40, height: 40 }, brandName: { fontWeight: '700', fontSize: 20, color: '#1e3a1e' },
  content: { padding: 20, paddingBottom: 48, gap: 15 }, title: { fontSize: 32, fontWeight: '700', color: '#1e3a1e', marginTop: 10 },
  subtitle: { fontSize: 15, lineHeight: 23, color: '#646454', marginBottom: 8 }, label: { fontWeight: '700', fontSize: 14, color: '#1e3a1e', marginTop: 4 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#b9b5ab', backgroundColor: '#fffdf8', borderRadius: 10, padding: 13, fontSize: 16, color: '#1e3a1e' },
  hint: { fontSize: 13, color: '#646454', lineHeight: 20 }, body: { fontSize: 14, color: '#4a4a3a', lineHeight: 23 },
  button: { minHeight: 50, backgroundColor: '#1e3a1e', borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 14 },
  buttonText: { color: '#fffdf8', fontWeight: '700', fontSize: 15 }, disabled: { opacity: 0.5 },
  secondaryButton: { padding: 14, minHeight: 48, borderWidth: 1, borderColor: '#1e3a1e', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#1e3a1e', fontSize: 14, fontWeight: '600' },
  notice: { backgroundColor: '#eaeee6', borderRadius: 10, padding: 14, gap: 7 }, errorBox: { backgroundColor: '#fce9e2', borderRadius: 10, padding: 14 }, error: { color: '#85331d', fontSize: 14, lineHeight: 22 },
  linkButton: { minHeight: 44, justifyContent: 'center' }, link: { fontSize: 14, lineHeight: 21, textDecorationLine: 'underline', color: '#2f6026' },
  results: { gap: 16, marginTop: 16 }, resultsTitle: { fontSize: 24, fontWeight: '700', color: '#1e3a1e' },
  card: { backgroundColor: '#fffdf8', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#d4cfc4', gap: 9 },
  overline: { fontSize: 11, fontWeight: '700', color: '#4a7a3a', letterSpacing: 1.2 }, plantName: { fontSize: 23, fontWeight: '700', color: '#1e3a1e' }, scientific: { fontSize: 15, fontStyle: 'italic', color: '#646454' },
});
