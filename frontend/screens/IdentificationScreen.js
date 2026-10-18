import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { identifyPlant, userMessage } from '../services/geminiService';
import { COLORS, STATUS_COLORS, FONTS, FONT_ASSETS } from '../theme';
import StatusBadge from '../components/StatusBadge';
import CandidatePicker, { NO_MATCH_TEXT, matchLabel } from '../components/CandidatePicker';
import SourceLine from '../components/SourceLine';
import AtlasButton from '../components/AtlasButton';
import OfflineNotice, { reportAi } from '../components/OfflineNotice';
import { useProgressText } from '../components/ProgressText';
import LocationPicker from '../components/LocationPicker';


const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const MAX_PHOTOS = 5;
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
  dot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.softGreen },
  text: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted },
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
    backgroundColor: COLORS.lightBg,
    alignItems: 'center', justifyContent: 'flex-end',
    overflow: 'hidden', paddingBottom: 6,
  },
  mountain1: {
    position: 'absolute', bottom: 4, left: 6,
    width: 0, height: 0,
    borderLeftWidth: 14, borderRightWidth: 14, borderBottomWidth: 22,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: COLORS.softGreen, opacity: 0.5,
  },
  mountain2: {
    position: 'absolute', bottom: 4, left: 18,
    width: 0, height: 0,
    borderLeftWidth: 18, borderRightWidth: 18, borderBottomWidth: 28,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: COLORS.softGreen, opacity: 0.7,
  },
  sun: {
    position: 'absolute', top: 8, right: 10,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.softGreen, opacity: 0.45,
  },
});

export default function IdentificationScreen({ navigation }) {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [picked, setPicked]     = useState(null);
  const [error, setError]       = useState(null);
  const [photos, setPhotos]     = useState([]);
  const [place, setPlace]       = useState(null);
  const zipCode = place?.zip ?? '';
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
      const files = [...(e.dataTransfer?.files ?? [])].filter(f => f.type.startsWith('image/')).slice(0, MAX_PHOTOS);
      if (files.length === 0) return;
      Promise.all(files.map(file => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve({ uri: reader.result, base64: reader.result.split(',')[1] });
        reader.readAsDataURL(file);
      }))).then(read => {
        setPhotos(read);
        setResult(null); setPicked(null);
        setError(null);
      });
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

  const [fontsLoaded] = useFonts(FONT_ASSETS);
  const progress = useProgressText(loading);

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setError('Camera permission is required.'); return; }
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
    if (!res.canceled) { setPhotos([res.assets[0]]); setResult(null); setPicked(null); setError(null); }
  }

  async function handleUploadPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Photo library permission is required.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      base64: true, quality: 0.8, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS,
    });
    if (!res.canceled) { setPhotos(res.assets.slice(0, MAX_PHOTOS)); setResult(null); setPicked(null); setError(null); }
  }

  async function handleIdentify() {
    setLoading(true);
    setResult(null); setPicked(null);
    setError(null);
    try {
      const data = await identifyPlant(photos.map(p => p.base64), zipCode);
      setResult(data.result);
      reportAi(data.result.ai_unavailable);
      setPicked(data.result.state === 'identified' ? 0 : null);
    } catch (err) {
      setError(userMessage(err, 'Could not identify this plant. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  }

  const photo = photos[0];
  const narrow = width < 420;
  const canIdentify = photos.length > 0 && zipCode.length === 5 && !loading;
  const noMatch  = result && (result.state === 'unidentified' || picked === -1);
  const choosing = result && result.state === 'confirm' && picked === null;
  const shown    = result && !noMatch && picked !== null ? result.options[picked] : null;

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
        <OfflineNotice />

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
            ? (
              <View>
                <Image source={{ uri: photo.uri }} style={styles.uploadPreview} resizeMode="cover" />
                <Text style={styles.photoCount}>
                  {photos.length > 1 ? `${photos.length} photos of this plant` : 'Tip: add up to 5 photos of the same plant (leaf, flower, bark) for a surer match.'}
                </Text>
              </View>
            )
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
          <LocationPicker place={place} onChange={setPlace} />
        </View>

        {/* ── Identify button ── */}
        <TouchableOpacity
          style={[styles.identifyBtn, !canIdentify && styles.identifyBtnDisabled]}
          onPress={handleIdentify}
          disabled={!canIdentify}
        >
          {loading
            ? <ActivityIndicator color={COLORS.cream} size="small" />
            : <Text style={styles.identifyBtnText}>Identify Plant</Text>
          }
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {loading && <LoadingDots message={progress} />}

        {/* ── Results ── */}
        {result && (
          <AnimatedResults>
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Results</Text>
              {shown && (
                <Text style={styles.confidenceText}>
                  {matchLabel(result.id_source)} match:{' '}
                  <Text style={styles.confidenceValue}>{Math.round(shown.confidence * 100)}%</Text>
                </Text>
              )}
            </View>

            {noMatch && (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{NO_MATCH_TEXT}</Text>
              </View>
            )}

            {choosing && (
              <CandidatePicker
                options={result.options}
                suggested={result.suggested}
                idSource={result.id_source}
                onPick={setPicked}
                onNone={() => setPicked(-1)}
              />
            )}

            {choosing && (
              <Text style={styles.retakeTip}>For a surer match, add a photo of a leaf up close or a flower.</Text>
            )}

            {shown && (
              <View style={[styles.resultCard, narrow && styles.resultCardNarrow]}>
                {photo && (
                  <Image source={{ uri: photo.uri }} style={[styles.resultThumb, narrow && styles.resultThumbNarrow]} resizeMode="cover" />
                )}
                <View style={styles.resultInfo}>
                  <Text style={styles.plantName}>{shown.plant_name}</Text>
                  <StatusBadge status={shown.status} label={shown.status_label} />
                  {!shown.why && !shown.helps && <Text style={styles.noData}>We don't have wildlife info for this plant yet</Text>}
                  <AtlasButton url={shown.atlas_url} />
                </View>
              </View>
            )}

            {shown && (shown.why || shown.helps || shown.watch_out || shown.removal_safety) && (
              <View style={styles.facts}>
                {[
                  shown.why && { label: 'Why it matters', text: shown.why, source: { name: shown.source_label } },
                  shown.helps && { label: 'Helps', text: shown.helps.text, source: shown.helps.source },
                  ...(shown.watch_out ?? []).map(w => ({ label: 'Watch out', text: w.text, source: w.source })),
                  shown.removal_safety && { label: 'Removing it safely', text: shown.removal_safety.text, source: shown.removal_safety.source },
                ].filter(Boolean).map((fact, i) => (
                  <View key={i} style={styles.fact}>
                    <Text style={styles.factLabel}>{fact.label}</Text>
                    <Text style={styles.factText}>{fact.text}</Text>
                    <SourceLine source={fact.source} />
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
  container: { flex: 1, backgroundColor: COLORS.cream },
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
  logoText: { fontSize: 20, fontFamily: FONTS.heading, color: COLORS.darkGreen, letterSpacing: 0.3 },
  divider: { height: 1, backgroundColor: COLORS.border },

  // ── Title ──
  titleSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24 },
  pageTitle: { fontSize: 34, fontFamily: FONTS.heading, color: COLORS.darkGreen, marginBottom: 6 },
  pageSubtitle: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },

  // ── Upload box ──
  uploadBox: {
    marginHorizontal: 20, borderWidth: 1.5, borderColor: COLORS.border,
    borderStyle: 'dashed', borderRadius: 16, overflow: 'hidden',
    marginBottom: 16,
  },
  uploadPlaceholder: {
    paddingTop: 36, paddingBottom: 24, alignItems: 'center', justifyContent: 'center',
  },
  uploadBoxDragging: { borderColor: COLORS.darkGreen, backgroundColor: COLORS.lightBg },
  uploadPlaceholderText: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted },
  uploadDragHint: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.border, marginTop: 2 },
  uploadPreview: { width: '100%', height: 220 },
  uploadBtns: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: COLORS.cream,
  },
  btnOutlined: {
    flex: 1, borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.darkGreen,
  },
  btnOutlinedText: { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  btnFilled: {
    flex: 1, borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', backgroundColor: COLORS.darkGreen,
  },
  btnFilledText: { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.cream },

  // ── ZIP ──
  zipRow: { marginHorizontal: 20, marginBottom: 14 },

  // ── Identify button ──
  identifyBtn: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: COLORS.darkGreen, borderRadius: 10,
    paddingVertical: 15, alignItems: 'center',
  },
  identifyBtnDisabled: { opacity: 0.4 },
  identifyBtnText: { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.cream },

  facts: { marginTop: 14, gap: 12 },
  fact: { gap: 2 },
  factLabel: { fontSize: 11, fontFamily: FONTS.bodyBold, color: COLORS.textMuted, letterSpacing: 0.5 },
  factText: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: 20 },
  noData: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 6 },
  errorText: { color: COLORS.error, fontSize: 13, fontFamily: FONTS.body, marginHorizontal: 20, marginTop: 8 },

  // ── Results ──
  resultsSection: { marginTop: 28, paddingHorizontal: 20, paddingBottom: 48 },
  resultsHeader: {
    flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: 14,
  },
  resultsTitle: { fontSize: 26, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  confidenceText: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted },
  confidenceValue: { fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },

  resultCard: {
    backgroundColor: COLORS.white, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 16,
  },
  resultCardNarrow: { flexDirection: 'column' },
  resultThumb: { width: 120, height: 120 },
  resultThumbNarrow: { width: '100%', height: 180 },
  photoCount: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', marginTop: 6 },
  retakeTip: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textBody, marginTop: 8 },
  resultInfo: { flex: 1, padding: 16, justifyContent: 'center', gap: 10 },
  plantName: { fontSize: 22, fontFamily: FONTS.heading, color: COLORS.darkGreen, lineHeight: 28 },
  recBtn: {
    marginTop: 16, backgroundColor: COLORS.darkGreen, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  recBtnText: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.cream },

  credit: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, marginTop: 18, paddingVertical: 6 },
  creditLogo: { width: 102, height: 24 },
  creditText: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted },
  notice: {
    backgroundColor: STATUS_COLORS.invasive.bg, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.terracotta, padding: 12, marginTop: 10,
  },
  noticeText: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.terracotta, lineHeight: 18 },
});
