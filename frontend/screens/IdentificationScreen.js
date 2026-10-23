import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  Animated,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { askForCamera } from '../cameraAccess';
import usePhotoDrop from '../components/usePhotoDrop';
import { pickPhotos } from '../photoFiles';
import { useFonts } from 'expo-font';
import { choosePlant, identifyPlant, userMessage } from '../services/geminiService';
import { COLORS, STATUS_COLORS, FONTS, FONT_ASSETS, TYPE, LINE } from '../theme';
import StatusBadge from '../components/StatusBadge';
import CandidatePicker, { AgreedStatus, CHOSEN_BY_NAME, NO_MATCH_TEXT, matchLabel } from '../components/CandidatePicker';
import NamePicker from '../components/NamePicker';
import PhotoStrip from '../components/PhotoStrip';
import ScreenLayout from '../components/ScreenLayout';
import ScanningLeaf from '../components/ScanningLeaf';
import { DURATION, EASE_OUT, USE_NATIVE_DRIVER, useReduceMotion } from '../motion';
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

function AnimatedResults({ children }) {
  const reduce = useReduceMotion();
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: reduce ? 0 : DURATION, easing: EASE_OUT, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(translateY, { toValue: 0, duration: reduce ? 0 : DURATION, easing: EASE_OUT, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [reduce]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

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
  const [uploadFocused, setUploadFocused] = useState(false);
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  const busy = loading || checkingName;
  const full = photos.length >= MAX_PHOTOS;

  const isDragging = usePhotoDrop('plant-drop-zone', {
    ready: fontsLoaded,
    blocked: busy,
    room: MAX_PHOTOS - photos.length,
    max: MAX_PHOTOS,
    onError: setError,
    onPhotos: (read, extra) => {
      setPhotos(prev => [...prev, ...read].slice(0, MAX_PHOTOS));
      setUploadFocused(false);
      setResult(null); setPicked(null);
      setError(extra ? 'You can use 5 photos per plant. Extra photos weren’t added.' : null);
    },
  });

  const { width, height, fontScale } = useWindowDimensions();
  const columns = (width >= 900 || (width >= 760 && height < 600)) && fontScale <= 1.3;

  const progress = useProgressText(loading);

  async function handleTakePhoto() {
    if (busy || full) return;
    if (!(await askForCamera())) { setError('Camera access is needed to take a photo.'); return; }
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
    if (!res.canceled) { setPhotos(prev => [...prev, res.assets[0]].slice(0, MAX_PHOTOS)); setResult(null); setPicked(null); setError(null); }
  }

  async function handleUploadPhoto() {
    if (busy || full) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    let picked;
    try { picked = await pickPhotos(room); } catch { setError('Could not read that photo. Try choosing it again.'); return; }
    if (picked) {
      setPhotos(prev => [...prev, ...picked.photos].slice(0, MAX_PHOTOS));
      setUploadFocused(false);
      setResult(null); setPicked(null);
      setError(picked.extra ? 'You can use 5 photos per plant. Extra photos weren’t added.' : null);
    }
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
  const canIdentify = photos.length > 0 && zipCode.length === 5 && !busy;
  const noMatch  = result && (result.state === 'unidentified' || picked === -1);
  const agreed   = result && result.state === 'confirm' && picked === null && result.agreed_status && !pickingOne;
  const choosing = result && result.state === 'confirm' && picked === null && !agreed;
  const shown    = result && !noMatch && picked !== null ? result.options[picked] : null;

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <ScreenLayout
      title="Identify a plant"
      contentWidth={columns ? 880 : 560}
      centered={!result && !naming}
    >
        <OfflineNotice />
        <View style={[styles.workspace, columns && styles.workspaceWide]}>

        <View style={[styles.photoSection, columns && styles.workspaceColumn]}>
        <View
          nativeID="plant-drop-zone"
          style={[styles.uploadBox, !photo && styles.emptyUploadBox, (isDragging || uploadFocused) && styles.uploadBoxDragging]}
        >
          {photo
            ? (
              <View>
                <Image source={{ uri: photo.uri }} style={styles.uploadPreview} resizeMode="cover" />
                <View style={styles.thumbs}>
                  <PhotoStrip
                    photos={photos}
                    onRemove={busy ? null : index => { setPhotos(prev => prev.filter((_, i) => i !== index)); setResult(null); setPicked(null); setError(null); }}
                  />
                </View>
                <Text style={styles.photoCount}>
                  {photos.length} / {MAX_PHOTOS} photos
                </Text>
                <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { setPhotos([]); setResult(null); setPicked(null); setError(null); }} style={styles.clearPhotos}>
                  <Text style={styles.clearPhotosText}>Clear photos</Text>
                </TouchableOpacity>
              </View>
            )
            : (
              <TouchableOpacity
                style={[styles.uploadPlaceholder, width < 600 && height < 800 && styles.uploadPlaceholderCompact]}
                onPress={handleUploadPhoto}
                onFocus={() => setUploadFocused(true)}
                onBlur={() => setUploadFocused(false)}
                accessibilityRole="button"
                accessibilityLabel="Upload plant photos"
                accessibilityHint="Choose photos of the same plant"
                disabled={busy}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="cloud-upload-outline" size={38} color={COLORS.softGreen} accessible={false} />
                <Text style={styles.uploadPlaceholderText}>
                  {isDragging ? 'Drop photos here' : 'Upload plant photos'}
                </Text>
                <Text style={styles.uploadDragHint}>{Platform.OS === 'web' && columns ? 'Drag & drop or click to browse' : 'Tap to choose photos'}</Text>
                <Text style={styles.uploadTip}>Add photos of one plant only</Text>
              </TouchableOpacity>
            )
          }
        </View>
          {!full && <View style={styles.uploadBtns}>
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.btnOutlined, busy && styles.identifyBtnDisabled]} onPress={handleTakePhoto}>
              <MaterialCommunityIcons name="camera-outline" size={19} color={COLORS.darkGreen} />
              <Text style={styles.btnOutlinedText}>Take photo</Text>
            </TouchableOpacity>
            {photo && <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.btnFilled, busy && styles.identifyBtnDisabled]} onPress={handleUploadPhoto}>
              <MaterialCommunityIcons name="image-plus" size={19} color={COLORS.darkGreen} />
              <Text style={styles.btnFilledText}>Add photos</Text>
            </TouchableOpacity>}
          </View>}
        </View>

        <View style={[styles.checkSection, columns && styles.workspaceColumn]}>
        <View style={styles.zipRow}>
          <LocationPicker place={place} onChange={found => { setPlace(found); rememberPlace(found); }} />
        </View>

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
          <TouchableOpacity accessibilityRole="button" style={styles.byName} disabled={busy} onPress={() => setNaming(true)}>
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
                      <MaterialCommunityIcons name={fact.icon} size={18} color={COLORS.softGreen} />
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

    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  workspace: { paddingBottom: 8, gap: 24 },
  workspaceWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 32 },
  workspaceColumn: { flex: 1, minWidth: 0 },
  photoSection: { gap: 10 },
  checkSection: { gap: 10 },

  uploadBox: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg,
    borderRadius: 18, overflow: 'hidden',
  },
  emptyUploadBox: { borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.softGreen, backgroundColor: COLORS.lightBg },
  uploadPlaceholder: {
    minHeight: 220, paddingVertical: 28, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
  },
  uploadPlaceholderCompact: { minHeight: 180, paddingVertical: 20 },
  uploadBoxDragging: { borderColor: COLORS.darkGreen, backgroundColor: COLORS.photoBg },
  uploadPlaceholderText: { fontSize: TYPE.h3, lineHeight: LINE.h3, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, textAlign: 'center', marginTop: 12 },
  uploadDragHint: { fontSize: TYPE.link, lineHeight: LINE.link, fontFamily: FONTS.body, color: COLORS.textBody, marginTop: 6, textAlign: 'center' },
  uploadTip: { fontSize: TYPE.caption, lineHeight: LINE.caption, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', marginTop: 16 },
  uploadPreview: { width: '100%', height: 220 },
  uploadBtns: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10,
  },
  btnOutlined: {
    minWidth: 130, minHeight: 44, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
  },
  btnOutlinedText: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  btnFilled: {
    minWidth: 130, minHeight: 44, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.lightBg,
  },
  btnFilledText: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },

  zipRow: { marginBottom: 6 },

  identifyBtn: {
    backgroundColor: COLORS.darkGreen, borderRadius: 10, minHeight: 52,
    paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
  },
  identifyBtnDisabled: { opacity: 0.4 },
  identifyBtnText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.onDark },

  facts: { marginTop: 8, gap: 20, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 20 },
  fact: { flexDirection: 'row', gap: 12 },
  factIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.lightBg, alignItems: 'center', justifyContent: 'center' },
  factBody: { flex: 1, minWidth: 0, gap: 2 },
  factLabel: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  factText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: LINE.body },
  noData: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 6 },
  errorText: { color: COLORS.error, fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.body, backgroundColor: COLORS.invasiveTint, borderRadius: 10, padding: 14 },

  resultsSection: { marginTop: 24, paddingBottom: 16 },
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
