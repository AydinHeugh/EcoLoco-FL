import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, TextInput, useWindowDimensions,
  Animated, Easing, Alert, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFonts } from 'expo-font';
import { identifyPlant, userMessage } from '../services/geminiService';
import { COLORS, FONTS, FONT_ASSETS } from '../theme';
import StatusBadge from '../components/StatusBadge';
import CandidatePicker, { NO_MATCH_TEXT } from '../components/CandidatePicker';

const EASE_OUT   = Easing.bezier(0.22, 1, 0.36, 1);

const LOGO = require('../../assets/EcoLoco_logo.png');

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }) {
  const pct = Math.round((confidence ?? 0) * 100);
  const color = pct >= 85 ? COLORS.softGreen : pct >= 75 ? COLORS.amber : COLORS.terracotta;
  return (
    <Text style={[cb.text, { color }]}>PlantNet: {pct}% match</Text>
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
          <Text style={styles.plantName}>Identifying…</Text>
          <Text style={styles.plantSci}>Analyzing your photo</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.plantCard, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.cardRow}>
      {plant.photo_uri
        ? <Image source={{ uri: plant.photo_uri }} style={styles.plantThumb} resizeMode="cover" />
        : <View style={styles.plantThumbPlaceholder} />
      }
      <View style={styles.plantInfo}>
        <View style={styles.plantNameRow}>
          <Text style={[styles.plantName, { flex: 1 }]} numberOfLines={2}>
            {noMatch ? 'Not identified' : choosing ? 'Not sure yet' : plant.plant_name}
          </Text>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }} style={styles.deleteBtn}>
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
            <ConfidenceBadge confidence={plant.confidence} />
          </>
        )}
      </View>
      </View>
      {choosing && (
        <View style={styles.cardBelow}>
          <CandidatePicker options={plant.options} suggested={plant.suggested} onPick={onPick} onNone={onNone} />
        </View>
      )}
    </Animated.View>
  );
}

// Module-level vars so plants survive tab switches / component remounts
let _savedPlants = [];
let _savedZip    = '';

// ─── AuditScreen ─────────────────────────────────────────────────────────────
export default function AuditScreen({ navigation }) {
  const [zipCode, setZipCode] = useState(_savedZip);
  const [plants,  setPlants]  = useState(_savedPlants);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  // Keep module vars in sync so state is restored on remount
  useEffect(() => { _savedPlants = plants; }, [plants]);
  useEffect(() => { _savedZip = zipCode; }, [zipCode]);

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
      setScanError('Enter a 5-digit ZIP code before scanning.');
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
      res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });
    }

    if (res.canceled) return;

    const photo  = res.assets[0];
    const tempId = Date.now().toString();

    setScanning(true);
    setPlants(prev => [...prev, { _id: tempId, loading: true, photo_uri: photo.uri }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);

    try {
      const data   = await identifyPlant(photo.base64, zipCode);
      const result = data.result;
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
    navigation.navigate('AuditResults', { plants: settled, zipCode });
  }

  function handleNewAudit() {
    const clear = () => { setPlants([]); setScanError(null); };
    if (Platform.OS === 'web') {
      if (window.confirm('Start a new scan? This will clear all scanned plants.')) clear();
      return;
    }
    Alert.alert('Start New Audit', 'This will clear all scanned plants.', [
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

        {/* ── Title ── */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>EcoScan</Text>
          <Text style={styles.pageSubtitle}>
            Scan the plants around campus to see how many are native to Florida, and what to change.
          </Text>
        </View>

        {/* ── ZIP Input ── */}
        <View style={styles.zipSection}>
          {plants.length === 0 ? (
            <TextInput
              style={styles.zipInput}
              value={zipCode}
              onChangeText={t => setZipCode(t.replace(/[^0-9]/g, '').slice(0, 5))}
              placeholder="Enter your school's ZIP code"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              maxLength={5}
            />
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
            <Text style={styles.emptySubtitle}>Enter your ZIP code and start scanning plants around campus.</Text>
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
              <Text style={styles.finishBtnText}>Finish Audit  →</Text>
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

  zipSection: { paddingHorizontal: 20, marginBottom: 8 },
  zipInput: {
    backgroundColor: COLORS.white, color: COLORS.textBody, borderRadius: 10,
    padding: 13, fontSize: 14, fontFamily: FONTS.body,
    borderWidth: 1, borderColor: COLORS.border,
  },
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
  plantSci:     { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 2 },
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
