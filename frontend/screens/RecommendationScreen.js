import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Image, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { getPlantRecommendations } from '../services/geminiService';
import SiteConditions, { DEFAULT_SITE } from '../components/SiteConditions';
import { EvidenceLink, PlantFacts } from '../components/PlantEvidence';

const LOGO = require('../../assets/EcoLoco_logo.png');
const readable = (value) => Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '';

export function RecommendationCard({ item }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const suitability = readable(item.suitability) || readable(item.suitability_explanation);
  const benefit = item.why || item.benefit || item.impact || 'Review the growing requirements before planting.';
  const brief = benefit.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || benefit;
  return <View style={styles.card}>
    <View style={styles.cardTop}><Text style={styles.overline}>FLORIDA NATIVE</Text>{item.site_needs_confirmation && <Text style={styles.smallNote}>Site check needed</Text>}</View>
    <Text accessibilityRole="header" style={styles.plantName}>{item.plant_name || item.common_name || item.scientific_name}</Text>
    <Text style={styles.scientific}>{item.scientific_name}</Text>
    <Text style={styles.body}>{brief}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} aria-expanded={detailsOpen} onPress={() => setDetailsOpen(!detailsOpen)} style={styles.linkButton}><Text style={styles.link}>{detailsOpen ? 'Hide details −' : 'Growing details & sources +'}</Text></TouchableOpacity>
    {detailsOpen && <View style={styles.details}>
      <Text style={styles.body}>{benefit}</Text>
      {!!suitability && <Text style={styles.hint}>{suitability}</Text>}
      {!!item.site_requirements && <Text style={styles.hint}>{typeof item.site_requirements === 'string' ? item.site_requirements : Object.entries(item.site_requirements).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${readable(value)}`).join(' · ')}</Text>}
      {!!item.management_notes && <Text style={styles.hint}>{item.management_notes}</Text>}
      {!!item.action && <Text style={styles.hint}>{item.action}</Text>}
      <Text style={styles.hint}>{item.source || 'Florida plant catalog'}{item.verified_on ? ` · checked ${item.verified_on}` : ''}</Text>
      <EvidenceLink url={item.source_url}>Florida status</EvidenceLink>
      <EvidenceLink url={item.why_source_url}>Wildlife relationship</EvidenceLink>
      <EvidenceLink url={item.requirements_source_url}>Growing requirements</EvidenceLink>
      <PlantFacts plant={item} />
    </View>}
  </View>;
}

export default function RecommendationScreen({ navigation, route }) {
  const [zipCode, setZipCode] = useState(route?.params?.prefillZip || '');
  const [site, setSite] = useState({ ...DEFAULT_SITE, ...route?.params?.site });
  const [results, setResults] = useState(null);
  const [plantingsChecked, setPlantingsChecked] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const request = useRef({ sequence: 0, controller: null });
  const plants = route?.params?.plants || [];
  const [fontsLoaded] = useFonts({ Fraunces_700Bold, DMSans_400Regular, DMSans_700Bold });
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
    if (!/^[0-9]{5}$/.test(zipCode)) {
      setError('Enter a five-digit Florida ZIP code.');
      return;
    }
    cancel();
    const id = request.current.sequence;
    const controller = new AbortController();
    request.current.controller = controller;
    setLoading(true);
    setError(null);
    setResults(null);
    setPlantingsChecked(null);
    setExpanded(false);
    try {
      const data = await getPlantRecommendations(zipCode, { plants, site, signal: controller.signal });
      if (id === request.current.sequence) { setResults(data.result); setPlantingsChecked(data.plantings_checked); }
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
        <Text accessibilityRole="header" style={[styles.title, width < 360 && { fontSize: 28 }, fontsLoaded && { fontFamily: 'Fraunces_700Bold' }]}>Recommendations</Text>
        <Text style={styles.subtitle}>Native plants for your space.</Text>
        <Text style={styles.label}>Planting ZIP code</Text>
        <TextInput accessibilityLabel="Planting ZIP code" value={zipCode} onChangeText={changeZip} placeholder="e.g. 33431" placeholderTextColor="#777768" keyboardType="number-pad" maxLength={5} style={styles.input} />
        <Text style={styles.hint}>Planting options for Palm Beach County</Text>
        <SiteConditions site={site} onChange={changeSite} />
        {!!plants.length && <Text style={styles.hint}>Finding additions to your {plants.length} recorded plant{plants.length === 1 ? '' : 's'}.</Text>}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: loading }} aria-disabled={loading} disabled={loading} onPress={recommend} style={[styles.button, loading && styles.disabled]}>
          {loading ? <ActivityIndicator color="#fffdf8" /> : <Text style={styles.buttonText}>Find native plants</Text>}
        </TouchableOpacity>
        {loading && <View style={styles.notice}><Text accessibilityLiveRegion="polite" style={styles.hint}>Finding your plants…</Text><TouchableOpacity accessibilityRole="button" onPress={cancel} style={styles.linkButton}><Text style={styles.link}>Cancel</Text></TouchableOpacity></View>}
        {!!error && <View style={styles.errorBox}><Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={recommend} style={styles.linkButton}><Text style={styles.link}>Try again</Text></TouchableOpacity></View>}
        {Array.isArray(results) && <View style={styles.results}>
          <Text accessibilityRole="header" style={styles.resultsTitle}>{results.length ? 'A greener place to start' : 'No matches yet'}</Text>
          <Text style={styles.hint}>{results.length ? `${results.length} options for your site` : plantingsChecked === false ? 'Planting options currently cover Palm Beach County only.' : 'Check your site details or ask local extension staff for more options.'}</Text>
          {shown.map((item) => <RecommendationCard key={item.taxon_id || item.scientific_name} item={item} />)}
          {results.length > 3 && <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setExpanded(!expanded)} style={styles.secondaryButton}><Text style={styles.secondaryText}>{expanded ? 'Show less' : `Show ${results.length - 3} more ${results.length === 4 ? 'plant' : 'plants'}`}</Text></TouchableOpacity>}
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: aboutOpen }} aria-expanded={aboutOpen} onPress={() => setAboutOpen(!aboutOpen)} style={styles.linkButton}><Text style={styles.link}>{aboutOpen ? 'Hide how we choose −' : 'How we choose these plants +'}</Text></TouchableOpacity>
          {aboutOpen && <View style={styles.notice}><Text style={styles.hint}>Options use verified Florida records and your site conditions. Wildlife benefits describe documented relationships, not measured results at your school. Review growing requirements with your school before planting.</Text><EvidenceLink url="https://nativeplantfinder.nwf.org">Explore NWF Native Plant Finder</EvidenceLink></View>}
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('EcoScan', { sample: false })} style={styles.secondaryButton}><Text style={styles.secondaryText}>Start an EcoScan →</Text></TouchableOpacity>
        </View>}
      </View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' }, scrollContent: { alignItems: 'center' }, inner: { alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', padding: 24, paddingTop: 48, gap: 9, borderBottomWidth: 1, borderColor: '#d4cfc4' },
  logo: { width: 40, height: 40 }, brandName: { fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#1e3a1e' },
  content: { padding: 20, paddingBottom: 48, gap: 15 }, title: { fontSize: 32, fontWeight: '700', color: '#1e3a1e', marginTop: 10 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 23, color: '#646454', marginBottom: 8 }, label: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#1e3a1e', marginTop: 4 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#b9b5ab', backgroundColor: '#fffdf8', borderRadius: 10, padding: 13, fontFamily: 'DMSans_400Regular', fontSize: 16, color: '#1e3a1e' },
  hint: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#646454', lineHeight: 20 }, body: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#4a4a3a', lineHeight: 23 },
  button: { minHeight: 50, backgroundColor: '#1e3a1e', borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 14 },
  buttonText: { color: '#fffdf8', fontFamily: 'DMSans_700Bold', fontSize: 15 }, disabled: { opacity: 0.5 },
  secondaryButton: { padding: 14, minHeight: 48, borderWidth: 1, borderColor: '#1e3a1e', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#1e3a1e', fontSize: 14, fontFamily: 'DMSans_700Bold' },
  notice: { backgroundColor: '#eaeee6', borderRadius: 10, padding: 14, gap: 7 }, errorBox: { backgroundColor: '#fce9e2', borderRadius: 10, padding: 14 }, error: { color: '#85331d', fontSize: 14, lineHeight: 22 },
  linkButton: { minHeight: 44, justifyContent: 'center' }, link: { fontFamily: 'DMSans_700Bold', fontSize: 13, lineHeight: 21, color: '#2f6026' },
  results: { gap: 16, marginTop: 16 }, resultsTitle: { fontSize: 24, fontFamily: 'Fraunces_700Bold', color: '#1e3a1e' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  smallNote: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#6a705e' },
  details: { gap: 9, borderTopWidth: 1, borderTopColor: '#e0dfd4', paddingTop: 12 },
  card: { backgroundColor: '#fffdf8', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#d4cfc4', gap: 9 },
  overline: { fontSize: 10, fontFamily: 'DMSans_700Bold', color: '#4a7a3a', letterSpacing: 1.2 }, plantName: { fontSize: 23, fontFamily: 'Fraunces_700Bold', color: '#1e3a1e' }, scientific: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontStyle: 'italic', color: '#646454' },
});
