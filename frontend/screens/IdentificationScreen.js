import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
  useWindowDimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { DMSans_400Regular, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { identifyPlant } from '../services/geminiService';

const CREAM      = '#f5f0e8';
const DARK_GREEN = '#1e3a1e';
const SOFT_GREEN = '#4a7a3a';
const LIGHT_BG   = '#eaeee6';
const TEXT_BODY  = '#4a4a3a';
const TEXT_MUTED = '#7a7a6a';
const BORDER     = '#d4cfc4';

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const LOGO = require('../../assets/EcoLoco_logo.png');
const PLANTNET_LOGO = require('../../assets/powered-by-plantnet-light.png');
const PLANTNET_URL = 'https://plantnet.org';

// ─── Bouncing dots loader ────────────────────────────────────────────────────
function LoadingDots({ message }) {
  const d0 = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dot = (v, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: -9, duration: 280, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0,  duration: 280, easing: EASE_OUT, useNativeDriver: true }),
        Animated.delay(500),
      ])
    );
    Animated.parallel([dot(d0, 0), dot(d1, 160), dot(d2, 320)]).start();
  }, []);

  return (
    <View style={ld.wrap}>
      <View style={ld.dots}>
        {[d0, d1, d2].map((d, i) => (
          <Animated.View key={i} style={[ld.dot, { transform: [{ translateY: d }] }]} />
        ))}
      </View>
      <Text style={ld.text}>{message}</Text>
    </View>
  );
}

const ld = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 32, gap: 14 },
  dots: { flexDirection: 'row', gap: 8, height: 20, alignItems: 'flex-end' },
  dot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: SOFT_GREEN },
  text: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED },
});

// ─── Animated results wrapper ────────────────────────────────────────────────
function AnimatedResults({ children }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 520, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 520, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Placeholder icon inside upload box ──────────────────────────────────────
function ImagePlaceholderIcon() {
  return (
    <View style={icon.wrap}>
      <View style={icon.outer}>
        <View style={icon.mountain1} />
        <View style={icon.mountain2} />
        <View style={icon.sun} />
      </View>
    </View>
  );
}

const icon = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  outer: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: LIGHT_BG,
    alignItems: 'center', justifyContent: 'flex-end',
    overflow: 'hidden', paddingBottom: 6,
  },
  mountain1: {
    position: 'absolute', bottom: 4, left: 6,
    width: 0, height: 0,
    borderLeftWidth: 14, borderRightWidth: 14, borderBottomWidth: 22,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: SOFT_GREEN, opacity: 0.5,
  },
  mountain2: {
    position: 'absolute', bottom: 4, left: 18,
    width: 0, height: 0,
    borderLeftWidth: 18, borderRightWidth: 18, borderBottomWidth: 28,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: SOFT_GREEN, opacity: 0.7,
  },
  sun: {
    position: 'absolute', top: 8, right: 10,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: SOFT_GREEN, opacity: 0.45,
  },
});

// ─── Status badge (native / non-native / invasive) ────────────────────────────
function NativeBadge({ invasiveStatus, isNative }) {
  const status = invasiveStatus?.toLowerCase() ?? (isNative ? 'native' : 'non-native');
  const cfg = {
    native:       { bg: LIGHT_BG,    color: SOFT_GREEN,  label: 'Native' },
    'non-native': { bg: '#faf3e0',   color: '#c49a3a',   label: 'Non-Native' },
    invasive:     { bg: '#fdf0ec',   color: '#C97D5D',   label: '⚠ Invasive' },
  };
  const c = cfg[status] ?? cfg['non-native'];
  return (
    <View style={[badge.wrap, { backgroundColor: c.bg }]}>
      <Text style={[badge.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  text: { fontSize: 12, fontFamily: 'DMSans_400Regular' },
});

export default function IdentificationScreen({ navigation }) {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [photo, setPhoto]       = useState(null);
  const [zipCode, setZipCode]   = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = document.getElementById('plant-drop-zone');
    if (!el) return;

    const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const onDragLeave = (e) => { e.stopPropagation(); setIsDragging(false); };
    const onDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(',')[1];
        setPhoto({ uri: dataUrl, base64 });
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, []);

  const { width } = useWindowDimensions();
  const maxWidth = Math.min(width, 960);

  const [fontsLoaded] = useFonts({
    Fraunces_700Bold,
    Fraunces_400Regular_Italic,
    DMSans_400Regular,
    DMSans_700Bold,
  });

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setError('Camera permission is required.'); return; }
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
    if (!res.canceled) { setPhoto(res.assets[0]); setResult(null); setError(null); }
  }

  async function handleUploadPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Photo library permission is required.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });
    if (!res.canceled) { setPhoto(res.assets[0]); setResult(null); setError(null); }
  }

  async function handleIdentify() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await identifyPlant(photo.base64, zipCode);
      setResult(data.result);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const canIdentify = !!photo && zipCode.length === 5 && !loading;

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.inner, { width: maxWidth }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image source={LOGO} style={styles.logoImg} />
            <Text style={styles.logoText}>EcoLoco</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Title ── */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Identification</Text>
          <Text style={styles.pageSubtitle}>upload or photograph a plant to learn more about it.</Text>
        </View>

        {/* ── Upload box ── */}
        <View
          nativeID="plant-drop-zone"
          style={[styles.uploadBox, isDragging && styles.uploadBoxDragging]}
        >
          {photo
            ? <Image source={{ uri: photo.uri }} style={styles.uploadPreview} resizeMode="cover" />
            : (
              <View style={styles.uploadPlaceholder}>
                <ImagePlaceholderIcon />
                <Text style={styles.uploadPlaceholderText}>
                  {isDragging ? 'Drop image here' : 'Insert image here'}
                </Text>
                <Text style={styles.uploadDragHint}>or drag and drop</Text>
              </View>
            )
          }
          <View style={styles.uploadBtns}>
            <TouchableOpacity style={styles.btnOutlined} onPress={handleTakePhoto}>
              <Text style={styles.btnOutlinedText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnFilled} onPress={handleUploadPhoto}>
              <Text style={styles.btnFilledText}>Upload Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── ZIP code ── */}
        <View style={styles.zipRow}>
          <TextInput
            style={styles.zipInput}
            value={zipCode}
            onChangeText={(t) => setZipCode(t.replace(/[^0-9]/g, '').slice(0, 5))}
            placeholder="Enter ZIP code for your location"
            placeholderTextColor={TEXT_MUTED}
            keyboardType="numeric"
            maxLength={5}
          />
        </View>

        {/* ── Identify button ── */}
        <TouchableOpacity
          style={[styles.identifyBtn, !canIdentify && styles.identifyBtnDisabled]}
          onPress={handleIdentify}
          disabled={!canIdentify}
        >
          {loading
            ? <ActivityIndicator color={CREAM} size="small" />
            : <Text style={styles.identifyBtnText}>Identify Plant</Text>
          }
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {loading && <LoadingDots message="Analyzing your plant…" />}

        {/* ── Results ── */}
        {result && (
          <AnimatedResults>
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Results</Text>
              <Text style={styles.confidenceText}>
                Confidence:{' '}
                <Text style={styles.confidenceValue}>{Math.round(result.confidence * 100)}%</Text>
              </Text>
            </View>

            {/* Result card */}
            <View style={styles.resultCard}>
              {photo && (
                <Image source={{ uri: photo.uri }} style={styles.resultThumb} resizeMode="cover" />
              )}
              <View style={styles.resultInfo}>
                <Text style={styles.plantName}>{result.plant_name}</Text>
                <NativeBadge invasiveStatus={result.invasive_status} isNative={result.is_native} />
              </View>
            </View>

            {result.confidence < 0.80 && (
              <View style={styles.expertBanner}>
                <Text style={styles.expertBannerText}>
                  ⚠ Confidence below 80% — identification may be inaccurate. Consult a botanist or field guide before taking action.
                </Text>
              </View>
            )}

            {result.inat_note && (
              <View style={styles.inatBanner}>
                <Text style={styles.inatBannerText}>
                  ◎ iNaturalist: {result.inat_note}
                </Text>
              </View>
            )}

            {/* Actions */}
            {result.actions?.length > 0 && (
              <View style={styles.actionsSection}>
                <Text style={styles.actionsLabel}>RECOMMENDED ACTIONS</Text>
                {result.actions.map((item, i) => (
                  <View key={i} style={styles.actionCard}>
                    <Text style={styles.actionText}>{item.action}</Text>
                    <View style={styles.actionDivider} />
                    <Text style={styles.impactText}>{item.impact}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Navigate to full recommendations */}
            {zipCode?.length === 5 && (
              <TouchableOpacity
                style={styles.recBtn}
                onPress={() => navigation.navigate('Recommend', { prefillZip: zipCode })}
              >
                <Text style={styles.recBtnText}>Get native plant recommendations for {zipCode}  →</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.credit}
              accessibilityRole="link"
              onPress={() => Linking.openURL(PLANTNET_URL).catch(() => {})}
            >
              <Image source={PLANTNET_LOGO} style={styles.creditLogo} resizeMode="contain" accessibilityLabel="Pl@ntNet logo" />
              <Text style={styles.creditText}>Plant identification powered by Pl@ntNet</Text>
            </TouchableOpacity>
          </View>
          </AnimatedResults>
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  scrollContent: { alignItems: 'center' },
  inner: { alignSelf: 'center' },

  // ── Header ──
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 52, paddingBottom: 16,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 40, height: 40, resizeMode: 'contain' },
  logoText: { fontSize: 20, fontFamily: 'Fraunces_700Bold', color: DARK_GREEN, letterSpacing: 0.3 },
  divider: { height: 1, backgroundColor: BORDER },

  // ── Title ──
  titleSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24 },
  pageTitle: { fontSize: 34, fontFamily: 'Fraunces_700Bold', color: DARK_GREEN, marginBottom: 6 },
  pageSubtitle: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED, textAlign: 'center' },

  // ── Upload box ──
  uploadBox: {
    marginHorizontal: 20, borderWidth: 1.5, borderColor: BORDER,
    borderStyle: 'dashed', borderRadius: 16, overflow: 'hidden',
    marginBottom: 16,
  },
  uploadPlaceholder: {
    paddingTop: 36, paddingBottom: 24, alignItems: 'center', justifyContent: 'center',
  },
  uploadBoxDragging: { borderColor: DARK_GREEN, backgroundColor: LIGHT_BG },
  uploadPlaceholderText: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED },
  uploadDragHint: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: BORDER, marginTop: 2 },
  uploadPreview: { width: '100%', height: 220 },
  uploadBtns: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: CREAM,
  },
  btnOutlined: {
    flex: 1, borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', borderWidth: 1.5, borderColor: DARK_GREEN,
  },
  btnOutlinedText: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: DARK_GREEN },
  btnFilled: {
    flex: 1, borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', backgroundColor: DARK_GREEN,
  },
  btnFilledText: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: CREAM },

  // ── ZIP ──
  zipRow: { marginHorizontal: 20, marginBottom: 14 },
  zipInput: {
    backgroundColor: '#fff', color: TEXT_BODY,
    borderRadius: 10, padding: 13, fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    borderWidth: 1, borderColor: BORDER,
  },

  // ── Identify button ──
  identifyBtn: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: DARK_GREEN, borderRadius: 10,
    paddingVertical: 15, alignItems: 'center',
  },
  identifyBtnDisabled: { opacity: 0.4 },
  identifyBtnText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: CREAM },

  errorText: { color: '#c0392b', fontSize: 13, fontFamily: 'DMSans_400Regular', marginHorizontal: 20, marginTop: 8 },

  // ── Results ──
  resultsSection: { marginTop: 28, paddingHorizontal: 20, paddingBottom: 48 },
  resultsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: 14,
  },
  resultsTitle: { fontSize: 26, fontFamily: 'Fraunces_700Bold', color: DARK_GREEN },
  confidenceText: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED },
  confidenceValue: { fontFamily: 'DMSans_700Bold', color: DARK_GREEN },

  resultCard: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 16,
  },
  resultThumb: { width: 120, height: 120 },
  resultInfo: { flex: 1, padding: 16, justifyContent: 'center', gap: 10 },
  plantName: { fontSize: 22, fontFamily: 'Fraunces_700Bold', color: DARK_GREEN, lineHeight: 28 },

  // ── Actions ──
  actionsSection: { gap: 10 },
  actionsLabel: {
    fontSize: 11, fontFamily: 'DMSans_700Bold',
    color: SOFT_GREEN, letterSpacing: 1.5, marginBottom: 4,
  },
  actionCard: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, padding: 16, gap: 4,
  },
  actionDivider: { height: 1, backgroundColor: BORDER, marginVertical: 6 },
  actionText: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: DARK_GREEN },
  impactText: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_BODY, lineHeight: 19 },
  recBtn: {
    marginTop: 16, backgroundColor: '#1e3a1e', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  recBtnText: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: '#f5f0e8' },

  credit: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, marginTop: 18, paddingVertical: 6 },
  creditLogo: { width: 102, height: 24 },
  creditText: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED },
  expertBanner: {
    backgroundColor: '#fdf0ec', borderRadius: 10, borderWidth: 1,
    borderColor: '#C97D5D', padding: 12, marginTop: 10,
  },
  expertBannerText: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#C97D5D', lineHeight: 18 },
  inatBanner: {
    backgroundColor: '#faf3e0', borderRadius: 10, borderWidth: 1,
    borderColor: '#c49a3a', padding: 12, marginTop: 8,
  },
  inatBannerText: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#c49a3a', lineHeight: 18 },
});
