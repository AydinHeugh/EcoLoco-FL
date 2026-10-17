import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, TextInput, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { identifyPlant, confirmPlant, getCatalog } from '../services/geminiService';
import PhotoPicker from '../components/PhotoPicker';
import PlantEvidence from '../components/PlantEvidence';
import { matchesCatalogQuery } from '../utils/catalogSearch';

const LOGO = require('../../assets/EcoLoco_logo.png');
const supportedZip = (value) => /^33[0-4]\d{2}$/.test(value);

export default function IdentificationScreen({ navigation }) {
  const [photos, setPhotos] = useState([]);
  const [zipCode, setZipCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const request = useRef({ sequence: 0, controller: null });
  const catalogRequest = useRef({ sequence: 0, controller: null });
  const { width } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ Fraunces_700Bold });

  const cancelRequest = useCallback(() => {
    request.current.sequence++;
    request.current.controller?.abort();
    setLoading(false);
    setConfirming(false);
  }, []);
  const cancelCatalog = useCallback(() => {
    catalogRequest.current.sequence++;
    catalogRequest.current.controller?.abort();
    setCatalogLoading(false);
  }, []);
  useFocusEffect(useCallback(() => () => { cancelRequest(); cancelCatalog(); }, [cancelRequest, cancelCatalog]));
  useEffect(() => () => { request.current.controller?.abort(); catalogRequest.current.controller?.abort(); }, []);

  function changePhotos(next) {
    cancelRequest();
    setPhotos(next);
    setResult(null);
    setError(null);
  }
  function changeZip(value) {
    cancelRequest();
    cancelCatalog();
    setZipCode(value.replace(/[^0-9]/g, '').slice(0, 5));
    setResult(null);
    setCatalog(null);
    setError(null);
  }
  function validateZip() {
    if (!supportedZip(zipCode)) {
      setError('Enter a South Florida ZIP beginning 330–334. This pilot uses Florida records and does not cover other regions.');
      return false;
    }
    return true;
  }
  async function identify() {
    if (!validateZip()) return;
    if (!photos.length) { setError('Add at least one clear photo of the plant.'); return; }
    cancelRequest();
    const id = request.current.sequence;
    const controller = new AbortController();
    request.current.controller = controller;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await identifyPlant(photos.map((photo) => photo.base64), zipCode, { signal: controller.signal });
      if (id === request.current.sequence) setResult(data.result);
    } catch (failure) {
      if (id === request.current.sequence && !controller.signal.aborted) setError(failure.message || 'Could not identify this plant. Your photos are still here; try again.');
    } finally {
      if (id === request.current.sequence) setLoading(false);
    }
  }
  async function confirm(scientificName) {
    if (!validateZip()) return;
    cancelRequest();
    cancelCatalog();
    const id = request.current.sequence;
    const controller = new AbortController();
    request.current.controller = controller;
    setConfirming(true);
    setError(null);
    try {
      const data = await confirmPlant(scientificName, zipCode, { signal: controller.signal });
      if (id === request.current.sequence) { setResult(data.result); setCatalog(null); }
    } catch (failure) {
      if (id === request.current.sequence && !controller.signal.aborted) setError(failure.message || 'Could not check the selected plant. Try again.');
    } finally {
      if (id === request.current.sequence) setConfirming(false);
    }
  }
  async function browseCatalog() {
    if (!validateZip()) return;
    cancelCatalog();
    const id = catalogRequest.current.sequence;
    const controller = new AbortController();
    catalogRequest.current.controller = controller;
    setCatalogLoading(true);
    setError(null);
    try {
      const data = await getCatalog(zipCode, { signal: controller.signal });
      if (id === catalogRequest.current.sequence) setCatalog(Array.isArray(data.result) ? data.result : data.result?.plants || []);
    } catch (failure) {
      if (id === catalogRequest.current.sequence && !controller.signal.aborted) setError(failure.message || 'The plant catalog could not be loaded.');
    } finally {
      if (id === catalogRequest.current.sequence) setCatalogLoading(false);
    }
  }
  const matches = (catalog || []).filter(item => matchesCatalogQuery(item, catalogSearch));

  return <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
    <View style={[styles.inner, { width: Math.min(width, 960) }]}>
      <View style={styles.brand}><Image source={LOGO} style={styles.logo} accessibilityLabel="EcoLoco" /><Text style={styles.brandName}>EcoLoco</Text></View>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, fontsLoaded && { fontFamily: 'Fraunces_700Bold' }]}>Know what is growing.</Text>
        <Text style={styles.subtitle}>Identify one plant, compare its Florida records, and understand what the evidence says.</Text>
        <PhotoPicker photos={photos} onChange={changePhotos} onError={setError} disabled={loading || confirming} />
        <Text style={styles.label}>Survey ZIP code</Text>
        <TextInput accessibilityLabel="Survey ZIP code" style={styles.input} value={zipCode} onChangeText={changeZip} placeholder="e.g. 33431" placeholderTextColor="#777768" keyboardType="number-pad" maxLength={5} />
        <Text style={styles.hint}>South Florida pilot · ZIP prefixes 330–334. Status evidence is statewide; planting suitability needs a site check.</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={loading ? 'Identifying plant' : 'Identify plant'} disabled={loading || confirming} accessibilityState={{ disabled: loading || confirming }} aria-disabled={loading || confirming} onPress={identify} style={[styles.button, (loading || confirming) && styles.disabled]}>
          {loading ? <ActivityIndicator color="#fffdf8" /> : <Text style={styles.buttonText}>Identify plant</Text>}
        </TouchableOpacity>
        {loading && <View style={styles.notice}><Text accessibilityLiveRegion="polite" style={styles.hint}>Comparing your photos and checking plant records. This can take about a minute.</Text><TouchableOpacity accessibilityRole="button" onPress={cancelRequest} style={styles.linkButton}><Text style={styles.link}>Cancel request</Text></TouchableOpacity></View>}
        {!!error && <View style={styles.errorBox}><Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text>{!!photos.length && !loading && <TouchableOpacity accessibilityRole="button" onPress={identify} style={styles.linkButton}><Text style={styles.link}>Retry identification</Text></TouchableOpacity>}</View>}
        {!!result && <PlantEvidence plant={result} onConfirm={confirm} onRetake={() => changePhotos([])} confirming={confirming} />}
        <TouchableOpacity accessibilityRole="button" disabled={catalogLoading || confirming} accessibilityState={{ disabled: catalogLoading || confirming }} aria-disabled={catalogLoading || confirming} onPress={browseCatalog} style={styles.secondaryButton}>
          {catalogLoading ? <ActivityIndicator color="#1e3a1e" /> : <Text style={styles.secondaryText}>I know the plant · browse verified records</Text>}
        </TouchableOpacity>
        {!!catalog && <View style={styles.catalog}>
          <Text style={styles.label}>Choose only a plant you have identified independently</Text>
          <Text style={styles.hint}>A selection records your identification; it does not prove that a photo matches. The Florida evidence is checked again when you choose.</Text>
          <TextInput accessibilityLabel="Search plant catalog" value={catalogSearch} onChangeText={setCatalogSearch} placeholder="Search common or scientific name" style={styles.input} />
          {matches.slice(0, 15).map((plant) => <TouchableOpacity key={plant.taxon_id || plant.scientific_name} accessibilityRole="button" accessibilityLabel={`Select ${plant.scientific_name}`} disabled={confirming} onPress={() => confirm(plant.scientific_name)} style={styles.catalogItem}><Text style={styles.secondaryText}>{plant.common_name || plant.plant_name || plant.scientific_name}</Text><Text style={styles.hint}>{plant.scientific_name}</Text></TouchableOpacity>)}
          {!matches.length && <Text style={styles.hint}>No matching record. Try a scientific name or keep the observation unresolved.</Text>}
          {matches.length > 15 && <Text style={styles.hint}>Showing 15 of {matches.length} matches. Search to narrow the list.</Text>}
          <TouchableOpacity accessibilityRole="button" onPress={() => setCatalog(null)} style={styles.linkButton}><Text style={styles.link}>Close catalog</Text></TouchableOpacity>
        </View>}
        {result && supportedZip(zipCode) && <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Recommend', { prefillZip: zipCode, plants: [result] })} style={styles.secondaryButton}><Text style={styles.secondaryText}>Find native additions for this site →</Text></TouchableOpacity>}
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('EcoScan', { sample: false })} style={styles.linkButton}><Text style={styles.link}>Survey several plants in a campus audit →</Text></TouchableOpacity>
      </View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' }, scrollContent: { alignItems: 'center' }, inner: { alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', padding: 24, paddingTop: 48, gap: 9, borderBottomWidth: 1, borderColor: '#d4cfc4' },
  logo: { width: 40, height: 40 }, brandName: { fontWeight: '700', fontSize: 20, color: '#1e3a1e' },
  content: { padding: 20, paddingBottom: 48, gap: 15 }, title: { fontSize: 32, fontWeight: '700', color: '#1e3a1e', marginTop: 10 },
  subtitle: { fontSize: 15, lineHeight: 23, color: '#646454', marginBottom: 8 }, label: { fontWeight: '700', fontSize: 14, color: '#1e3a1e' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#b9b5ab', backgroundColor: '#fffdf8', borderRadius: 10, padding: 13, fontSize: 16, color: '#1e3a1e' },
  hint: { fontSize: 13, color: '#646454', lineHeight: 20 }, button: { minHeight: 50, backgroundColor: '#1e3a1e', borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 14 },
  buttonText: { color: '#fffdf8', fontWeight: '700', fontSize: 15 }, disabled: { opacity: 0.5 },
  secondaryButton: { padding: 14, minHeight: 48, borderWidth: 1, borderColor: '#1e3a1e', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#1e3a1e', fontSize: 14, fontWeight: '600' },
  notice: { backgroundColor: '#eaeee6', borderRadius: 10, padding: 14 }, errorBox: { backgroundColor: '#fce9e2', borderRadius: 10, padding: 14 }, error: { color: '#85331d', fontSize: 14, lineHeight: 22 },
  linkButton: { minHeight: 44, justifyContent: 'center' }, link: { fontSize: 14, lineHeight: 21, textDecorationLine: 'underline', color: '#2f6026' },
  catalog: { padding: 16, backgroundColor: '#eaeee6', borderRadius: 12, gap: 12 }, catalogItem: { minHeight: 48, backgroundColor: '#fffdf8', padding: 12, borderRadius: 9, gap: 4 },
});
