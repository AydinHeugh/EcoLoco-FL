import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, TextInput, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import Ionicons from '@expo/vector-icons/Ionicons';
import { identifyPlant, confirmPlant, getCatalog } from '../services/geminiService';
import PhotoPicker from '../components/PhotoPicker';
import PlantEvidence from '../components/PlantEvidence';
import { matchesCatalogQuery } from '../utils/catalogSearch';

const LOGO = require('../../assets/EcoLoco_logo.png');
const supportedZip = (value) => /^33[0-4]\d{2}$/.test(value);

export default function IdentificationScreen({ navigation }) {
  const [photos, setPhotos] = useState([]);
  const [photoSession, setPhotoSession] = useState(0);
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
  const scroll = useRef(null);
  const { width } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ Fraunces_700Bold, DMSans_400Regular, DMSans_700Bold });

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
  function scanAnotherPlant() {
    cancelRequest();
    cancelCatalog();
    setPhotos([]);
    setPhotoSession(value => value + 1);
    setResult(null);
    setCatalog(null);
    setCatalogSearch('');
    setError(null);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }
  function validateZip() {
    if (!supportedZip(zipCode)) {
      setError('Enter a South Florida ZIP beginning 330–334.');
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
  const identifyDisabled = loading || confirming || !photos.length || !supportedZip(zipCode);

  return <ScrollView ref={scroll} style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
    <View style={[styles.inner, { width: Math.min(width, 960) }]}>
      <View style={styles.brand}><Image source={LOGO} style={styles.logo} accessibilityLabel="EcoLoco" /><Text style={[styles.brandName, fontsLoaded && styles.serif]}>EcoLoco</Text></View>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[styles.title, fontsLoaded && styles.serif]}>Identification</Text>
          <Text style={[styles.subtitle, fontsLoaded && styles.sans]}>Discover the plants around you.</Text>
        </View>
        <PhotoPicker key={photoSession} photos={photos} onChange={changePhotos} onError={setError} disabled={loading || confirming} />
        <View style={styles.zipSection}>
          <Text style={[styles.label, fontsLoaded && styles.sansBold]}>ZIP code</Text>
          <TextInput accessibilityLabel="Survey ZIP code" style={[styles.input, fontsLoaded && styles.sans]} value={zipCode} onChangeText={changeZip} placeholder="e.g. 33431" placeholderTextColor="#777768" keyboardType="number-pad" maxLength={5} />
          <Text style={[styles.hint, fontsLoaded && styles.sans]}>South Florida · ZIP 330–334</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={loading ? 'Identifying plant' : 'Identify plant'} disabled={identifyDisabled} accessibilityState={{ disabled: identifyDisabled }} aria-disabled={identifyDisabled} onPress={identify} style={[styles.button, identifyDisabled && styles.disabled]}>
          {loading ? <ActivityIndicator color="#fffdf8" /> : <><Ionicons name="scan-outline" size={19} color="#fffdf8" /><Text style={[styles.buttonText, fontsLoaded && styles.sansBold]}>Identify plant</Text></>}
        </TouchableOpacity>
        {loading && <View style={styles.notice}><Text accessibilityLiveRegion="polite" style={[styles.hint, fontsLoaded && styles.sans]}>Checking plant records…</Text><TouchableOpacity accessibilityRole="button" onPress={cancelRequest} style={styles.linkButton}><Text style={[styles.link, fontsLoaded && styles.sans]}>Cancel</Text></TouchableOpacity></View>}
        {!!error && <View style={styles.errorBox}><Text accessibilityLiveRegion="assertive" style={[styles.error, fontsLoaded && styles.sans]}>{error}</Text>{!identifyDisabled && <TouchableOpacity accessibilityRole="button" onPress={identify} style={styles.linkButton}><Text style={[styles.link, fontsLoaded && styles.sans]}>Try again</Text></TouchableOpacity>}</View>}
        {!!result && <View style={styles.result}>
          <PlantEvidence plant={result} onConfirm={confirm} onRetake={scanAnotherPlant} confirming={confirming} />
          <TouchableOpacity accessibilityRole="button" onPress={scanAnotherPlant} style={styles.secondaryButton}><Ionicons name="camera-outline" size={19} color="#1e3a1e" /><Text style={[styles.secondaryText, fontsLoaded && styles.sansBold]}>Scan another plant</Text></TouchableOpacity>
          {supportedZip(zipCode) && <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Recommend', { prefillZip: zipCode, plants: [result] })} style={styles.linkButton}><Text style={[styles.link, fontsLoaded && styles.sans]}>Find native plants →</Text></TouchableOpacity>}
        </View>}
        <TouchableOpacity accessibilityRole="button" disabled={catalogLoading || confirming} accessibilityState={{ disabled: catalogLoading || confirming }} aria-disabled={catalogLoading || confirming} onPress={browseCatalog} style={styles.catalogButton}>
          {catalogLoading ? <ActivityIndicator color="#1e3a1e" /> : <Text style={[styles.link, fontsLoaded && styles.sans]}>Know its name? Browse the catalog</Text>}
        </TouchableOpacity>
        {!!catalog && <View style={styles.catalog}>
          <Text style={[styles.hint, fontsLoaded && styles.sans]}>Choose a plant you already recognize.</Text>
          <TextInput accessibilityLabel="Search plant catalog" value={catalogSearch} onChangeText={setCatalogSearch} placeholder="Common or scientific name" style={[styles.input, fontsLoaded && styles.sans]} />
          {matches.slice(0, 15).map((plant) => <TouchableOpacity key={plant.taxon_id || plant.scientific_name} accessibilityRole="button" accessibilityLabel={`Select ${plant.scientific_name}`} disabled={confirming} onPress={() => confirm(plant.scientific_name)} style={styles.catalogItem}><Text style={[styles.secondaryText, fontsLoaded && styles.sansBold]}>{plant.common_name || plant.plant_name || plant.scientific_name}</Text><Text style={[styles.hint, fontsLoaded && styles.sans]}>{plant.scientific_name}</Text></TouchableOpacity>)}
          {!matches.length && <Text style={[styles.hint, fontsLoaded && styles.sans]}>No match. Try a scientific name.</Text>}
          {matches.length > 15 && <Text style={[styles.hint, fontsLoaded && styles.sans]}>15 of {matches.length} matches · search to narrow</Text>}
          <TouchableOpacity accessibilityRole="button" onPress={() => setCatalog(null)} style={styles.linkButton}><Text style={[styles.link, fontsLoaded && styles.sans]}>Close catalog</Text></TouchableOpacity>
        </View>}
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('EcoScan', { sample: false })} style={styles.auditButton}><Text style={[styles.link, fontsLoaded && styles.sans]}>Start an EcoScan audit →</Text></TouchableOpacity>
      </View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' }, scrollContent: { alignItems: 'center' }, inner: { alignSelf: 'center' },
  serif: { fontFamily: 'Fraunces_700Bold' }, sans: { fontFamily: 'DMSans_400Regular' }, sansBold: { fontFamily: 'DMSans_700Bold' },
  brand: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, paddingTop: 48, gap: 9, borderBottomWidth: 1, borderColor: '#d4cfc4' },
  logo: { width: 40, height: 40 }, brandName: { fontSize: 20, color: '#1e3a1e' },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 20, paddingBottom: 48, gap: 16 }, heading: { alignItems: 'center', paddingTop: 12, paddingBottom: 10, gap: 10 }, title: { fontSize: 34, color: '#1e3a1e' },
  subtitle: { fontSize: 14, lineHeight: 22, color: '#646454', textAlign: 'center' }, label: { fontSize: 13, color: '#1e3a1e' }, zipSection: { gap: 7 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#b9b5ab', backgroundColor: '#fffdf8', borderRadius: 10, padding: 13, fontSize: 16, color: '#1e3a1e' },
  hint: { fontSize: 12, color: '#646454', lineHeight: 19 }, button: { minHeight: 50, backgroundColor: '#1e3a1e', borderRadius: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 14 },
  buttonText: { color: '#fffdf8', fontWeight: '700', fontSize: 15 }, disabled: { opacity: 0.5 },
  secondaryButton: { padding: 14, minHeight: 48, borderWidth: 1, borderColor: '#1e3a1e', borderRadius: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#1e3a1e', fontSize: 14, fontWeight: '600' },
  notice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, errorBox: { backgroundColor: '#fce9e2', borderRadius: 10, padding: 14 }, error: { color: '#85331d', fontSize: 14, lineHeight: 22 }, result: { gap: 12 },
  linkButton: { minHeight: 44, justifyContent: 'center' }, link: { fontSize: 14, lineHeight: 21, textDecorationLine: 'underline', color: '#2f6026' },
  catalogButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, auditButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderColor: '#d4cfc4', paddingTop: 16 },
  catalog: { padding: 16, backgroundColor: '#eaeee6', borderRadius: 12, gap: 12 }, catalogItem: { minHeight: 48, backgroundColor: '#fffdf8', padding: 12, borderRadius: 9, gap: 4 },
});
