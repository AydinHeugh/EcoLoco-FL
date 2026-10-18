import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, useWindowDimensions,
  Animated, Easing, Alert, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFonts } from 'expo-font';
import { identifyPlant, userMessage } from '../services/geminiService';
import { COLORS, FONTS, FONT_ASSETS } from '../theme';
import StatusBadge from '../components/StatusBadge';
import CandidatePicker, { NO_MATCH_TEXT, matchLabel } from '../components/CandidatePicker';
import OfflineNotice, { reportAi } from '../components/OfflineNotice';
import { useProgressText } from '../components/ProgressText';
import LocationPicker from '../components/LocationPicker';

const EASE_OUT   = Easing.bezier(0.22, 1, 0.36, 1);

const MAX_PHOTOS = 5;
const LOGO = require('../../assets/EcoLoco_logo.png');

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence, idSource }) {
  const pct = Math.round((confidence ?? 0) * 100);
  const color = pct >= 85 ? COLORS.softGreen : pct >= 75 ? COLORS.amber : COLORS.terracotta;
  return (
    <Text style={[cb.text, { color }]}>{matchLabel(idSource)}: {pct}% match</Text>
  );
}

const cb = StyleSheet.create({
  text: { fontSize: 11, fontFamily: FONTS.body, marginTop: 4 },
});

// ─── Animated plant card ──────────────────────────────────────────────────────
function PlantCard({ plant, onDelete, onPick, onNone }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 380, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 380, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
  }, []);

  const progress = useProgressText(!!plant.loading);
  const narrow   = useWindowDimensions().width < 420;
  const noMatch  = plant.state === 'unidentified' || plant.picked === -1;
  const choosing = plant.state === 'confirm' && plant.picked == null;
  const settled  = !noMatch && !choosing;

  if (plant.loading) {
    return (
      <Animated.View style={[styles.plantCard, styles.cardRow, { opacity, transform: [{ translateY }] }]}>
        <View style={styles.plantThumbPlaceholder}>
          <ActivityIndicator color={COLORS.softGreen} size="small" />
        </View>
        <View style={styles.plantInfo}>
          <Text style={styles.plantName}>{progress}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.plantCard, { opacity, transform: [{ translateY }] }]}>
      <View style={narrow ? null : styles.cardRow}>
      {plant.photo_uri
        ? <Image source={{ uri: plant.photo_uri }} style={[styles.plantThumb, narrow && styles.plantThumbNarrow]} resizeMode="cover" />
        : <View style={styles.plantThumbPlaceholder} />
      }
      <View style={styles.plantInfo}>
        <View style={styles.plantNameRow}>
          <Text style={[styles.plantName, { flex: 1 }]} numberOfLines={2}>
            {noMatch ? 'Not identified' : choosing ? 'Not sure yet' : plant.plant_name}
          </Text>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            style={styles.deleteBtn}
            accessibilityRole="button"
            accessibilityLabel="Remove this plant"
          >
            <View style={styles.deleteBtnInner}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </View>
          </TouchableOpacity>
        </View>
        {noMatch && <Text style={styles.expertWarning}>{NO_MATCH_TEXT}</Text>}
        {settled && (
          <>
            <View style={styles.badgeRow}>
              <StatusBadge status={plant.status} label={plant.status_label} />
            </View>
            <ConfidenceBadge confidence={plant.confidence} idSource={plant.id_source} />
          </>
        )}
      </View>
      </View>
      {choosing && (
        <View style={styles.cardBelow}>
          <CandidatePicker options={plant.options} suggested={plant.suggested} idSource={plant.id_source} onPick={onPick} onNone={onNone} />
        </View>
      )}
    </Animated.View>
  );
}

// Module-level vars so plants survive tab switches / component remounts
let _savedPlants = [];
let _savedPlace  = null;

export function forgetScannedPlant(id) {
  _savedPlants = _savedPlants.filter(p => p._id !== id);
}

// ─── AuditScreen ─────────────────────────────────────────────────────────────
export default function AuditScreen({ navigation }) {
  const [place,   setPlace]   = useState(_savedPlace);
  const [plants,  setPlants]  = useState(_savedPlants);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  // Keep module vars in sync so state is restored on remount
  useEffect(() => { _savedPlants = plants; }, [plants]);
  useEffect(() => { _savedPlace = place; }, [place]);
  useEffect(() => navigation.addListener('focus', () => {
    setPlants(prev => prev.filter(p => p.loading || _savedPlants.some(s => s._id === p._id)));
  }), [navigation]);
  const zipCode = place?.zip ?? '';

  const { width } = useWindowDimensions();
  const maxWidth   = Math.min(width, 960);
  const scrollRef  = useRef(null);

  const [fontsLoaded] = useFonts(FONT_ASSETS);

  const zipValid   = zipCode.length === 5;
  const identified = plants.filter(p => !p.loading);
  const canFinish  = identified.length > 0 && !scanning;

  async function scanPlant(source) {
    setScanError(null);
    if (!zipValid) {
      setScanError("Find your school's location before scanning.");
      return;
    }

    let res;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { setScanError('Camera access is required to scan a plant.'); return; }
      res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { setScanError('Photo library access is required to upload a photo.'); return; }
      res = await ImagePicker.launchImageLibraryAsync({
        base64: true, quality: 0.8, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS,
      });
    }

    if (res.canceled) return;

    const photos = res.assets.slice(0, MAX_PHOTOS);
    const photo  = photos[0];
    const tempId = Date.now().toString();

    setScanning(true);
    setPlants(prev => [...prev, { _id: tempId, loading: true, photo_uri: photo.uri }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);

    try {
      const data   = await identifyPlant(photos.map(p => p.base64), zipCode);
      const result = data.result;
      reportAi(result.ai_unavailable);
      setPlants(prev => prev.map(p =>
        p._id === tempId
          ? { ...result, _id: tempId, photo_uri: photo.uri, loading: false, picked: result.state === 'identified' ? 0 : null }
          : p
      ));
    } catch (err) {
      setPlants(prev => prev.filter(p => p._id !== tempId));
      setScanError(userMessage(err, 'Could not identify this plant. Check your connection and try again.'));
    } finally {
      setScanning(false);
    }
  }

  function pickOption(id, index) {
    setPlants(prev => prev.map(p => {
      if (p._id !== id) return p;
      if (index === -1) return { ...p, picked: -1 };
      return { ...p, ...p.options[index], picked: index };
    }));
  }

  function handleFinish() {
    const settled = identified.map(p => (
      p.picked != null && p.picked >= 0
        ? p
        : { ...p, plant_name: 'Unidentified plant', scientific_name: '', status: 'unknown' }
    ));
    navigation.navigate('AuditResults', { plants: settled, zipCode, lat: place?.lat, lon: place?.lon });
  }

  function handleNewAudit() {
    const clear = () => { setPlants([]); setScanError(null); };
    if (Platform.OS === 'web') {
      if (window.confirm('Start a new scan? This will clear all scanned plants.')) clear();
      return;
    }
    Alert.alert('Start a new scan?', 'This will clear all scanned plants.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clear },
    ]);
  }

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.inner, { width: maxWidth }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image source={LOGO} style={styles.logoImg} />
            <Text style={styles.logoText}>EcoLoco</Text>
          </View>
          {plants.length > 0 && (
            <TouchableOpacity onPress={handleNewAudit}>
              <Text style={styles.newAuditBtn}>New Scan</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider} />
        <OfflineNotice />

        {/* ── Title ── */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>EcoScan</Text>
          <Text style={styles.pageSubtitle}>
            Scan the plants around campus to see how many are native to Florida, and what to change.
          </Text>
          <Text style={styles.realOnly}>Only scan real plants growing outdoors.</Text>
        </View>

        {/* ── ZIP Input ── */}
        <View style={styles.zipSection}>
          {plants.length === 0 ? (
            <LocationPicker place={place} onChange={setPlace} />
          ) : (
            <View style={styles.zipLocked}>
              <Text style={styles.zipLockedText}>📍 ZIP {zipCode}</Text>
              <Text style={styles.zipLockedSub}>{identified.length} plant{identified.length !== 1 ? 's' : ''} identified</Text>
            </View>
          )}
        </View>

        {/* ── Plant List ── */}
        {plants.length > 0 && (
          <View style={styles.listSection}>
            {plants.map(plant => (
              <PlantCard
                key={plant._id}
                plant={plant}
                onPick={i => pickOption(plant._id, i)}
                onNone={() => pickOption(plant._id, -1)}
                onDelete={() => {
                  if (plant.loading) return;
                  setPlants(prev => prev.filter(p => p._id !== plant._id));
                }}
              />
            ))}
          </View>
        )}

        {/* ── Empty state ── */}
        {plants.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🌿</Text>
            <Text style={styles.emptyTitle}>No plants scanned yet</Text>
            <Text style={styles.emptySubtitle}>Find your school's location, then start scanning plants around campus.</Text>
          </View>
        )}

        {scanError && <Text style={styles.scanError}>{scanError}</Text>}

        {/* ── Action Buttons ── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.scanBtn, (!zipValid || scanning) && styles.btnDisabled]}
            onPress={() => scanPlant('camera')}
            disabled={!zipValid || scanning}
          >
            {scanning
              ? <ActivityIndicator color={COLORS.cream} size="small" />
              : <Text style={styles.scanBtnText}>📷  Scan Plant</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadBtn, (!zipValid || scanning) && styles.uploadBtnDisabled]}
            onPress={() => scanPlant('gallery')}
            disabled={!zipValid || scanning}
          >
            <Text style={[styles.uploadBtnText, (!zipValid || scanning) && { color: COLORS.border }]}>Upload Photo</Text>
          </TouchableOpacity>

          {canFinish && (
            <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
              <Text style={styles.finishBtnText}>See my results  →</Text>
            </TouchableOpacity>
          )}
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.cream },
  scrollContent:{ alignItems: 'center' },
  inner:        { alignSelf: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 52, paddingBottom: 16,
  },
  logoRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg:    { width: 40, height: 40, resizeMode: 'contain' },
  logoText:   { fontSize: 20, fontFamily: FONTS.heading, color: COLORS.darkGreen, letterSpacing: 0.3 },
  newAuditBtn:{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.terracotta },

  divider: { height: 1, backgroundColor: COLORS.border },

  titleSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24 },
  pageTitle:    { fontSize: 34, fontFamily: FONTS.heading, color: COLORS.darkGreen, marginBottom: 6 },
  pageSubtitle: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },
  realOnly:     { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, textAlign: 'center', marginTop: 10 },

  zipSection: { paddingHorizontal: 20, marginBottom: 8 },
  zipLocked: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.lightBg, borderRadius: 10, padding: 13,
  },
  zipLockedText: { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  zipLockedSub:  { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted },

  listSection: { paddingHorizontal: 20, paddingTop: 16 },

  plantCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', marginBottom: 12,
  },
  cardRow:   { flexDirection: 'row' },
  cardBelow: { padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  plantThumb:           { width: 90, height: 90 },
  plantThumbNarrow:     { width: '100%', height: 160 },
  plantThumbPlaceholder:{ width: 90, height: 90, backgroundColor: COLORS.lightBg, alignItems: 'center', justifyContent: 'center' },
  plantInfo:    { flex: 1, padding: 12, justifyContent: 'center' },
  plantNameRow: { flexDirection: 'row', alignItems: 'flex-start' },
  plantName:    { fontSize: 15, fontFamily: FONTS.heading, color: COLORS.darkGreen, lineHeight: 21 },
  deleteBtn:      { paddingLeft: 8 },
  deleteBtnInner: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.photoBg, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 13, color: COLORS.terracotta, fontFamily: FONTS.bodyBold, lineHeight: 14 },
  badgeRow:     { flexDirection: 'row', marginTop: 6 },

  emptyState:   { alignItems: 'center', paddingVertical: 52, paddingHorizontal: 32 },
  emptyIcon:    { fontSize: 36, marginBottom: 12 },
  emptyTitle:   { fontSize: 17, fontFamily: FONTS.heading, color: COLORS.textBody, marginBottom: 6 },
  emptySubtitle:{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },

  actions: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 52, gap: 12 },
  scanBtn: {
    backgroundColor: COLORS.darkGreen, borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
  },
  scanBtnText: { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.cream },
  uploadBtn: {
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.darkGreen,
  },
  uploadBtnDisabled: { borderColor: COLORS.border },
  uploadBtnText: { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  finishBtn: {
    backgroundColor: COLORS.softGreen, borderRadius: 10,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  finishBtnText: { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.cream },
  btnDisabled: { opacity: 0.35 },
  expertWarning: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.terracotta, marginTop: 4, lineHeight: 15 },
  scanError: { marginHorizontal: 20, marginBottom: 10, fontSize: 13, fontFamily: FONTS.body, color: COLORS.terracotta, textAlign: 'center' },
});
