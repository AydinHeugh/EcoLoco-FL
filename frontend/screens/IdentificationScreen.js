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
import PressScale from '../components/PressScale';
import PlantPhoto, { PhotoCredit } from '../components/PlantPhoto';
import Reveal from '../components/Reveal';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
      <MaterialCommunityIcons name="leaf" size={30} color={COLORS.softGreen} />
    </View>
  );
}

const icon = StyleSheet.create({
  wrap: { width: 62, height: 62, borderRadius: 31, backgroundColor: COLORS.lightBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
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
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.inner, { width: maxWidth }]}>

        <ScreenHeader
          photo={PHOTOS.identify}
          photoLabel="A native plant garden"
          title="Identify a plant"
          subtitle="Discover what's growing around you, and what it means for Florida wildlife."
        />
        <OfflineNotice />
        <View style={[styles.workspace, width >= 760 && styles.workspaceWide]}>

        {/* ── Upload box ── */}
        <View style={[styles.photoSection, width >= 760 && styles.workspaceColumn]}>
        <Text style={styles.sectionLabel}>1. Add photos</Text>
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
                <TouchableOpacity accessibilityRole="button" onPress={() => { setPhotos([]); setResult(null); setPicked(null); }} style={styles.clearPhotos}>
                  <Text style={styles.clearPhotosText}>Clear photos</Text>
                </TouchableOpacity>
              </View>
            )
            : (
              <View style={styles.uploadPlaceholder}>
                <ImagePlaceholderIcon />
                <Text style={styles.uploadPlaceholderText}>
                  {isDragging ? 'Drop your photos here' : 'A closer look at your plant'}
                </Text>
                <Text style={styles.uploadDragHint}>Add up to 5 photos of the same plant.</Text>
                <Text style={styles.uploadTip}>A leaf close-up or flower helps us find a match.</Text>
                {Platform.OS === 'web' && <Text style={styles.dropHint}>You can also drag and drop photos here</Text>}
              </View>
            )
          }
          <View style={styles.uploadBtns}>
            <TouchableOpacity accessibilityRole="button" style={styles.btnOutlined} onPress={handleTakePhoto}>
              <MaterialCommunityIcons name="camera-outline" size={19} color={COLORS.darkGreen} />
              <Text style={styles.btnOutlinedText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.btnFilled} onPress={handleUploadPhoto}>
              <MaterialCommunityIcons name="image-plus" size={19} color={COLORS.darkGreen} />
              <Text style={styles.btnFilledText}>Upload photos</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>

        {/* ── ZIP code ── */}
        <View style={[styles.checkSection, width >= 760 && styles.workspaceColumn]}>
        <Text style={styles.sectionLabel}>2. Choose your location</Text>
        <View style={styles.zipRow}>
          <LocationPicker place={place} onChange={found => { setPlace(found); rememberPlace(found); }} />
        </View>

        {/* ── Identify button ── */}
        <PressScale
          style={[styles.identifyBtn, !canIdentify && styles.identifyBtnDisabled]}
          onPress={handleIdentify}
          disabled={!canIdentify}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canIdentify, busy: loading }}
        >
          {loading
            ? <ActivityIndicator color={COLORS.cream} size="small" />
            : <><MaterialCommunityIcons name="line-scan" size={20} color={COLORS.onDark} /><Text style={styles.identifyBtnText}>Identify plant</Text></>
          }
        </PressScale>

        {zipCode.length === 5 && !naming && (
          <TouchableOpacity accessibilityRole="button" style={styles.byName} onPress={() => setNaming(true)}>
            <Text style={styles.byNameText}>Know its name? Choose by name</Text>
          </TouchableOpacity>
        )}
        {naming && (
          <View style={styles.namingBox}>
            <NamePicker onChoose={handleChooseName} onClose={() => setNaming(false)} busy={checkingName} />
          </View>
        )}

        {error && <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{error}</Text>}

        {loading && <LoadingLeaf message={progress} />}
        </View>
        </View>

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
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={[styles.resultThumb, narrow && styles.resultThumbNarrow]} resizeMode="cover" />
                ) : shown.photo ? (
                  <PlantPhoto photo={shown.photo} radius={0} label={shown.plant_name} style={[styles.resultThumb, narrow && styles.resultThumbNarrow]} />
                ) : null}
                <View style={styles.resultInfo}>
                  <Text style={styles.plantName}>{shown.plant_name}</Text>
                  <StatusBadge key={shown.scientific_name} pop status={shown.status} label={shown.status_label} />
                  {!shown.why && !shown.helps && <Text style={styles.noData}>We don't have wildlife info for this plant yet</Text>}
                  {photo && shown.photo && (
                    <View style={styles.compare}>
                      <PlantPhoto photo={shown.photo} size={56} radius={12} label={shown.plant_name} />
                      <Text style={styles.compareText}>What {shown.plant_name.toLowerCase()} looks like</Text>
                    </View>
                  )}
                  <AtlasButton url={shown.atlas_url} />
                  <PhotoCredit photo={shown.photo} />
                </View>
              </View>
            )}

            {shown && (shown.why || shown.helps || shown.watch_out || shown.removal_safety) && (
              <View style={styles.facts}>
                {[
                  shown.why && { label: 'Why it matters', icon: 'leaf', text: shown.why, source: { name: shown.source_label } },
                  shown.helps && { label: 'Helps', icon: 'butterfly-outline', text: shown.helps.text, source: shown.helps.source },
                  ...(shown.watch_out ?? []).map(w => ({ label: 'Watch out', icon: 'alert-outline', text: w.text, source: w.source })),
                  shown.removal_safety && { label: 'Removing it safely', icon: 'hand-back-right-outline', text: shown.removal_safety.text, source: shown.removal_safety.source },
                ].filter(Boolean).map((fact, i) => (
                  <Reveal key={`${shown.scientific_name}-${i}`} index={i} style={styles.fact}>
                    <View style={styles.factIcon}>
                      <MaterialCommunityIcons name={fact.icon} size={18} color={COLORS.seaGrape} />
                    </View>
                    <View style={styles.factBody}>
                      <Text style={styles.factLabel}>{fact.label}</Text>
                      <Text style={styles.factText}>{fact.text}</Text>
                      <SourceLine source={fact.source} />
                    </View>
                  </Reveal>
                ))}
              </View>
            )}

            {/* Navigate to full recommendations */}
            {zipCode?.length === 5 && (
              <TouchableOpacity
                accessibilityRole="button"
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

  workspace: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 24 },
  workspaceWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  workspaceColumn: { flex: 1, minWidth: 0 },
  photoSection: { gap: 10 },
  checkSection: { gap: 10 },
  sectionLabel: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },

  // ── Upload box ──
  uploadBox: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg,
    borderRadius: 18, overflow: 'hidden',
  },
  uploadPlaceholder: {
    paddingTop: 28, paddingBottom: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
  },
  uploadBoxDragging: { borderColor: COLORS.darkGreen, backgroundColor: COLORS.lightBg },
  uploadPlaceholderText: { fontSize: TYPE.h3, lineHeight: 28, fontFamily: FONTS.heading, color: COLORS.darkGreen, textAlign: 'center' },
  uploadDragHint: { fontSize: TYPE.caption, lineHeight: LINE.caption, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
  uploadTip: { fontSize: TYPE.caption, lineHeight: LINE.caption, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', maxWidth: 280 },
  dropHint: { fontSize: TYPE.fine, lineHeight: 17, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', marginTop: 12 },
  uploadPreview: { width: '100%', height: 220 },
  uploadBtns: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  btnOutlined: {
    flex: 1, minWidth: 115, minHeight: 48, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 8,
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg,
  },
  btnOutlinedText: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  btnFilled: {
    flex: 1, minWidth: 130, minHeight: 48, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 8,
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.lightBg,
  },
  btnFilledText: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },

  // ── ZIP ──
  zipRow: { marginBottom: 6 },

  // ── Identify button ──
  identifyBtn: {
    backgroundColor: COLORS.darkGreen, borderRadius: 10, minHeight: 52,
    paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
  },
  identifyBtnDisabled: { opacity: 0.4 },
  identifyBtnText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.onDark },

  facts: { marginTop: 8, gap: 20, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 20 },
  fact: { flexDirection: 'row', gap: 12 },
  factIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.seaGrapeSoft, alignItems: 'center', justifyContent: 'center' },
  factBody: { flex: 1, minWidth: 0, gap: 2 },
  factLabel: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  factText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: LINE.body },
  noData: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 6 },
  errorText: { color: COLORS.error, fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.body, backgroundColor: COLORS.invasiveTint, borderRadius: 10, padding: 14 },

  // ── Results ──
  resultsSection: { marginTop: 8, paddingHorizontal: 20, paddingBottom: 48 },
  resultsHeader: {
    flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: 14,
  },
  resultsTitle: { fontSize: TYPE.h2, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  byName: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingVertical: 8 },
  byNameText: { fontSize: TYPE.caption, lineHeight: LINE.caption, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, textAlign: 'center' },
  namingBox: {
    padding: 18, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg,
  },
  confidenceText: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted },
  confidenceValue: { fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },

  resultCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 16,
  },
  resultCardNarrow: { flexDirection: 'column' },
  resultThumb: { width: 180, height: 180 },
  resultThumbNarrow: { width: '100%', height: 180 },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compareText: { flex: 1, fontSize: TYPE.caption, fontFamily: FONTS.bodyMedium, color: COLORS.textMuted },
  thumbs: { paddingHorizontal: 16, paddingTop: 12 },
  clearPhotos: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  clearPhotosText: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.textMuted, textDecorationLine: 'underline' },
  photoCount: { fontSize: TYPE.caption, lineHeight: LINE.caption, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', marginTop: 10, paddingHorizontal: 16 },
  retakeTip: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, marginTop: 8 },
  resultInfo: { flex: 1, minWidth: 0, padding: 20, justifyContent: 'center', gap: 10 },
  plantName: { fontSize: TYPE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen, lineHeight: LINE.h3 },
  recBtn: {
    marginTop: 20, borderRadius: 10, borderWidth: 1, borderColor: COLORS.darkGreen, minHeight: 48,
    paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
  },
  recBtnText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, textAlign: 'center' },

  credit: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', gap: 8, marginTop: 18, paddingVertical: 10, minHeight: 44 },
  creditLogo: { width: 102, height: 24 },
  creditText: { fontSize: TYPE.fine, lineHeight: 17, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },
  agreedBox: {
    backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border,
  },
  notice: {
    backgroundColor: STATUS_COLORS.invasive.bg, borderRadius: 12, padding: 14, marginTop: 10,
  },
  noticeText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: STATUS_COLORS.invasive.color, lineHeight: LINE.body },
});
