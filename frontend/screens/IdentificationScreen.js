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
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { choosePlant, identifyPlant, userMessage } from '../services/geminiService';
import { COLORS, STATUS_COLORS, FONTS, FONT_ASSETS, TYPE, LINE } from '../theme';
import StatusBadge from '../components/StatusBadge';
import CandidatePicker, { AgreedStatus, CHOSEN_BY_NAME, NO_MATCH_TEXT, matchLabel } from '../components/CandidatePicker';
import NamePicker from '../components/NamePicker';
import PhotoStrip from '../components/PhotoStrip';
import ScreenHeader from '../components/ScreenHeader';
import ScanningLeaf from '../components/ScanningLeaf';
import { PHOTOS } from '../photos';
import { DURATION, EASE_OUT, useReduceMotion } from '../motion';
import SourceLine from '../components/SourceLine';
import AtlasButton from '../components/AtlasButton';
import OfflineNotice, { reportAi } from '../components/OfflineNotice';
import { useProgressText } from '../components/ProgressText';
import LocationPicker from '../components/LocationPicker';
import { rememberPlace } from '../lastPlace';


const MAX_PHOTOS = 5;
const PLANTNET_LOGO = require('../../assets/powered-by-plantnet-light.png');
const PLANTNET_URL = 'https://plantnet.org';

function LoadingLeaf({ message }) {
  return (
    <View style={ld.wrap}>
      <ScanningLeaf size={56} />
      <Text style={ld.text}>{message}</Text>
    </View>
  );
}

const ld = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  text: { fontSize: TYPE.body, fontFamily: FONTS.bodyMedium, color: COLORS.textMuted },
});

// ─── Animated results wrapper ────────────────────────────────────────────────
function AnimatedResults({ children }) {
  const reduce = useReduceMotion();
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: reduce ? 0 : DURATION, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: reduce ? 0 : DURATION, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
  }, [reduce]);

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
  const [pickingOne, setPickingOne] = useState(false);
  const [naming, setNaming]     = useState(false);
  const [checkingName, setCheckingName] = useState(false);
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
    if (!res.canceled) { setPhotos(prev => [...prev, res.assets[0]].slice(0, MAX_PHOTOS)); setResult(null); setPicked(null); setError(null); }
  }

  async function handleUploadPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Photo library permission is required.'); return; }
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      base64: true, quality: 0.8, allowsMultipleSelection: room > 1, selectionLimit: room,
    });
    if (!res.canceled) { setPhotos(prev => [...prev, ...res.assets].slice(0, MAX_PHOTOS)); setResult(null); setPicked(null); setError(null); }
  }

  async function handleIdentify() {
    setLoading(true);
    setResult(null); setPicked(null); setPickingOne(false);
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

  async function handleChooseName(plant) {
    setCheckingName(true);
    setResult(null); setPicked(null); setPickingOne(false);
    setError(null);
    try {
      const data = await choosePlant(plant.scientific_name, zipCode);
      setResult(data.result);
      setPicked(0);
      setNaming(false);
    } catch (err) {
      setError(userMessage(err, 'Could not check that plant. Check your connection and try again.'));
    } finally {
      setCheckingName(false);
    }
  }

  const photo = photos[0];
  const narrow = width < 420;
  const canIdentify = photos.length > 0 && zipCode.length === 5 && !loading;
  const noMatch  = result && (result.state === 'unidentified' || picked === -1);
  const agreed   = result && result.state === 'confirm' && picked === null && result.agreed_status && !pickingOne;
  const choosing = result && result.state === 'confirm' && picked === null && !agreed;
  const shown    = result && !noMatch && picked !== null ? result.options[picked] : null;

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.inner, { width: maxWidth }]}>

        <ScreenHeader
          photo={PHOTOS.identify}
          photoLabel="A native plant garden"
          title="Identification"
          subtitle="upload or photograph a plant to learn more about it."
        />
        <OfflineNotice />
        <View style={styles.headerGap} />

        {/* ── Upload box ── */}
        <View
          nativeID="plant-drop-zone"
          style={[styles.uploadBox, isDragging && styles.uploadBoxDragging]}
        >
          {photo
            ? (
              <View>
                <Image source={{ uri: photo.uri }} style={styles.uploadPreview} resizeMode="cover" />
                <View style={styles.thumbs}>
                  <PhotoStrip
                    photos={photos}
                    onRemove={index => { setPhotos(prev => prev.filter((_, i) => i !== index)); setResult(null); setPicked(null); }}
                  />
                </View>
                <Text style={styles.photoCount}>
                  Photos of this one plant: {photos.length} of {MAX_PHOTOS}. Add a leaf up close or a flower for a surer match.
                </Text>
                <TouchableOpacity onPress={() => { setPhotos([]); setResult(null); setPicked(null); }} style={styles.clearPhotos}>
                  <Text style={styles.clearPhotosText}>Clear photos</Text>
                </TouchableOpacity>
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
          <LocationPicker place={place} onChange={found => { setPlace(found); rememberPlace(found); }} />
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

        {zipCode.length === 5 && !naming && (
          <TouchableOpacity style={styles.byName} onPress={() => setNaming(true)}>
            <Text style={styles.byNameText}>Know its name? Choose by name</Text>
          </TouchableOpacity>
        )}
        {naming && (
          <View style={styles.namingBox}>
            <NamePicker onChoose={handleChooseName} onClose={() => setNaming(false)} busy={checkingName} />
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {loading && <LoadingLeaf message={progress} />}

        {/* ── Results ── */}
        {result && (
          <AnimatedResults>
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Results</Text>
              {shown && (
                <Text style={styles.confidenceText}>
                  {result.id_source === 'by_name' ? CHOSEN_BY_NAME : <>{matchLabel(result.id_source)} match:{' '}
                  <Text style={styles.confidenceValue}>{Math.round(shown.confidence * 100)}%</Text></>}
                </Text>
              )}
            </View>

            {noMatch && (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{NO_MATCH_TEXT}</Text>
              </View>
            )}

            {agreed && (
              <View style={styles.agreedBox}>
                <AgreedStatus options={result.options} onPickOne={() => setPickingOne(true)} />
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
                  <StatusBadge key={shown.scientific_name} pop status={shown.status} label={shown.status_label} />
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
                onPress={() => navigation.navigate('Recommend', { prefillZip: zipCode, at: Date.now() })}
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

  headerGap: { height: 18 },

  // ── Upload box ──
  uploadBox: {
    marginHorizontal: 20, borderWidth: 1.5, borderColor: COLORS.softGreen,
    borderStyle: 'dashed', borderRadius: 22, overflow: 'hidden',
    marginBottom: 16,
  },
  uploadPlaceholder: {
    paddingTop: 36, paddingBottom: 24, alignItems: 'center', justifyContent: 'center',
  },
  uploadBoxDragging: { borderColor: COLORS.darkGreen, backgroundColor: COLORS.lightBg },
  uploadPlaceholderText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted },
  uploadDragHint: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 2 },
  uploadPreview: { width: '100%', height: 220 },
  uploadBtns: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  btnOutlined: {
    flex: 1, borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg,
  },
  btnOutlinedText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  btnFilled: {
    flex: 1, borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', backgroundColor: COLORS.darkGreen,
  },
  btnFilledText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.onDark },

  // ── ZIP ──
  zipRow: { marginHorizontal: 20, marginBottom: 14 },

  // ── Identify button ──
  identifyBtn: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: COLORS.accent, borderRadius: 14,
    paddingVertical: 17, alignItems: 'center',
  },
  identifyBtnDisabled: { opacity: 0.4 },
  identifyBtnText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.white },

  facts: { marginTop: 18, gap: 16, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: COLORS.border },
  fact: { gap: 2 },
  factLabel: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.seaGrape },
  factText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: LINE.body },
  noData: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 6 },
  errorText: { color: COLORS.error, fontSize: TYPE.body, fontFamily: FONTS.body, marginHorizontal: 20, marginTop: 8 },

  // ── Results ──
  resultsSection: { marginTop: 28, paddingHorizontal: 20, paddingBottom: 48 },
  resultsHeader: {
    flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: 14,
  },
  resultsTitle: { fontSize: TYPE.h2, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  byName: { alignSelf: 'center', paddingVertical: 8 },
  byNameText: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, textDecorationLine: 'underline' },
  namingBox: {
    marginHorizontal: 20, marginTop: 8, padding: 18, borderRadius: 20,
    backgroundColor: COLORS.cardBg,
  },
  confidenceText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted },
  confidenceValue: { fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },

  resultCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 22,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 16,
  },
  resultCardNarrow: { flexDirection: 'column' },
  resultThumb: { width: 120, height: 120 },
  resultThumbNarrow: { width: '100%', height: 180 },
  thumbs: { paddingHorizontal: 16, paddingTop: 12 },
  clearPhotos: { alignSelf: 'center', paddingVertical: 4 },
  clearPhotosText: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.accent, textDecorationLine: 'underline' },
  photoCount: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', marginTop: 6 },
  retakeTip: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, marginTop: 8 },
  resultInfo: { flex: 1, padding: 16, justifyContent: 'center', gap: 10 },
  plantName: { fontSize: TYPE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen, lineHeight: LINE.h3 },
  recBtn: {
    marginTop: 20, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.darkGreen,
    paddingVertical: 15, paddingHorizontal: 12, alignItems: 'center',
  },
  recBtnText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, textAlign: 'center' },

  credit: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, marginTop: 18, paddingVertical: 6 },
  creditLogo: { width: 102, height: 24 },
  creditText: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted },
  agreedBox: {
    backgroundColor: COLORS.cardBg, borderRadius: 20, padding: 18,
  },
  notice: {
    backgroundColor: STATUS_COLORS.invasive.bg, borderRadius: 12, padding: 14, marginTop: 10,
  },
  noticeText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: STATUS_COLORS.invasive.color, lineHeight: LINE.body },
});
