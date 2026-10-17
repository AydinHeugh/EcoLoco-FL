import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, TextInput, useWindowDimensions,
  Animated, Easing, Alert, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { DMSans_400Regular, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { identifyPlant } from '../services/geminiService';

const CREAM      = '#f5f0e8';
const DARK_GREEN = '#1e3a1e';
const SOFT_GREEN = '#4a7a3a';
const LIGHT_BG   = '#eaeee6';
const TEXT_BODY  = '#4a4a3a';
const TEXT_MUTED = '#7a7a6a';
const BORDER     = '#d4cfc4';
const AMBER      = '#c49a3a';
const TERRACOTTA = '#C97D5D';
const CARD_BG    = '#fefcf8';
const EASE_OUT   = Easing.bezier(0.22, 1, 0.36, 1);

const LOGO = require('../../assets/EcoLoco_logo.png');

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    native:        { bg: '#eaf2e8', color: SOFT_GREEN,    label: 'Native' },
    'non-native':  { bg: '#faf3e0', color: AMBER,          label: 'Non-Native' },
    invasive:      { bg: '#fdf0ec', color: TERRACOTTA,     label: 'Invasive' },
    unknown:       { bg: LIGHT_BG,  color: TEXT_MUTED,     label: 'Status unknown' },
  };
  const c = cfg[status?.toLowerCase()] ?? cfg.unknown;
  return (
    <View style={[sb.wrap, { backgroundColor: c.bg }]}>
      <Text style={[sb.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: 11, fontFamily: 'DMSans_700Bold' },
});

// ─── Wildlife support pill ────────────────────────────────────────────────────
function SupportPill({ level }) {
  const labels = { high: '↑ High', medium: '→ Medium', low: '↓ Low' };
  return (
    <Text style={sp.text}>{labels[level?.toLowerCase()] ?? '? Unknown'} wildlife support</Text>
  );
}

const sp = StyleSheet.create({
  text: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED, marginTop: 4 },
});

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }) {
  const pct = Math.round((confidence ?? 0) * 100);
  const color = pct >= 85 ? SOFT_GREEN : pct >= 75 ? AMBER : TERRACOTTA;
  return (
    <Text style={[cb.text, { color }]}>{pct}% confident</Text>
  );
}

const cb = StyleSheet.create({
  text: { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 4 },
});

// ─── Animated plant card ──────────────────────────────────────────────────────
function PlantCard({ plant, onDelete }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 380, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 380, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
  }, []);

  if (plant.loading) {
    return (
      <Animated.View style={[styles.plantCard, { opacity, transform: [{ translateY }] }]}>
        <View style={styles.plantThumbPlaceholder}>
          <ActivityIndicator color={SOFT_GREEN} size="small" />
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
      {plant.photo_uri
        ? <Image source={{ uri: plant.photo_uri }} style={styles.plantThumb} resizeMode="cover" />
        : <View style={styles.plantThumbPlaceholder} />
      }
      <View style={styles.plantInfo}>
        <View style={styles.plantNameRow}>
          <Text style={[styles.plantName, { flex: 1 }]} numberOfLines={2}>{plant.plant_name}</Text>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }} style={styles.deleteBtn}>
            <View style={styles.deleteBtnInner}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </View>
          </TouchableOpacity>
        </View>
        {plant.scientific_name ? (
          <Text style={styles.plantSci}>{plant.scientific_name}</Text>
        ) : null}
        <View style={styles.badgeRow}>
          <StatusBadge status={plant.invasive_status} />
        </View>
        <SupportPill level={plant.wildlife_support} />
        <ConfidenceBadge confidence={plant.confidence} />
        {((plant.confidence ?? 1) < 0.80 || plant.needs_confirmation) && (
          <Text style={styles.expertWarning}>⚠ Low confidence — consult an expert before acting</Text>
        )}
      </View>
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

  const [fontsLoaded] = useFonts({ Fraunces_700Bold, DMSans_400Regular, DMSans_700Bold });

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
        p._id === tempId ? { ...result, _id: tempId, photo_uri: photo.uri, loading: false } : p
      ));
    } catch {
      setPlants(prev => prev.filter(p => p._id !== tempId));
      setScanError('Could not identify this plant. Check your connection and try again.');
    } finally {
      setScanning(false);
    }
  }

  function handleFinish() {
    navigation.navigate('AuditResults', { plants: identified, zipCode });
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
            Scan plants around campus to calculate your school's biodiversity score and discover how to improve it.
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
              placeholderTextColor={TEXT_MUTED}
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
              ? <ActivityIndicator color={CREAM} size="small" />
              : <Text style={styles.scanBtnText}>📷  Scan Plant</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadBtn, (!zipValid || scanning) && styles.uploadBtnDisabled]}
            onPress={() => scanPlant('gallery')}
            disabled={!zipValid || scanning}
          >
            <Text style={[styles.uploadBtnText, (!zipValid || scanning) && { color: BORDER }]}>Upload Photo</Text>
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
  container:    { flex: 1, backgroundColor: CREAM },
  scrollContent:{ alignItems: 'center' },
  inner:        { alignSelf: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 52, paddingBottom: 16,
  },
  logoRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg:    { width: 40, height: 40, resizeMode: 'contain' },
  logoText:   { fontSize: 20, fontFamily: 'Fraunces_700Bold', color: DARK_GREEN, letterSpacing: 0.3 },
  newAuditBtn:{ fontSize: 12, fontFamily: 'DMSans_400Regular', color: TERRACOTTA },

  divider: { height: 1, backgroundColor: BORDER },

  titleSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24 },
  pageTitle:    { fontSize: 34, fontFamily: 'Fraunces_700Bold', color: DARK_GREEN, marginBottom: 6 },
  pageSubtitle: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED, textAlign: 'center', lineHeight: 19 },

  zipSection: { paddingHorizontal: 20, marginBottom: 8 },
  zipInput: {
    backgroundColor: '#fff', color: TEXT_BODY, borderRadius: 10,
    padding: 13, fontSize: 14, fontFamily: 'DMSans_400Regular',
    borderWidth: 1, borderColor: BORDER,
  },
  zipLocked: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: LIGHT_BG, borderRadius: 10, padding: 13,
  },
  zipLockedText: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: DARK_GREEN },
  zipLockedSub:  { fontSize: 12, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED },

  listSection: { paddingHorizontal: 20, paddingTop: 16 },

  plantCard: {
    backgroundColor: CARD_BG, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 12,
  },
  plantThumb:           { width: 90, height: 90 },
  plantThumbPlaceholder:{ width: 90, height: 90, backgroundColor: LIGHT_BG, alignItems: 'center', justifyContent: 'center' },
  plantInfo:    { flex: 1, padding: 12, justifyContent: 'center' },
  plantNameRow: { flexDirection: 'row', alignItems: 'flex-start' },
  plantName:    { fontSize: 15, fontFamily: 'Fraunces_700Bold', color: DARK_GREEN, lineHeight: 21 },
  deleteBtn:      { paddingLeft: 8 },
  deleteBtnInner: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#f0ebe2', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 13, color: TERRACOTTA, fontFamily: 'DMSans_700Bold', lineHeight: 14 },
  plantSci:     { fontSize: 11, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED, fontStyle: 'italic', marginTop: 2 },
  badgeRow:     { flexDirection: 'row', marginTop: 6 },

  emptyState:   { alignItems: 'center', paddingVertical: 52, paddingHorizontal: 32 },
  emptyIcon:    { fontSize: 36, marginBottom: 12 },
  emptyTitle:   { fontSize: 17, fontFamily: 'Fraunces_700Bold', color: TEXT_BODY, marginBottom: 6 },
  emptySubtitle:{ fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED, textAlign: 'center', lineHeight: 19 },

  actions: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 52, gap: 12 },
  scanBtn: {
    backgroundColor: DARK_GREEN, borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
  },
  scanBtnText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: CREAM },
  uploadBtn: {
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: DARK_GREEN,
  },
  uploadBtnDisabled: { borderColor: BORDER },
  uploadBtnText: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: DARK_GREEN },
  finishBtn: {
    backgroundColor: SOFT_GREEN, borderRadius: 10,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  finishBtnText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: CREAM },
  btnDisabled: { opacity: 0.35 },
  expertWarning: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: '#C97D5D', marginTop: 4, lineHeight: 15 },
  scanError: { marginHorizontal: 20, marginBottom: 10, fontSize: 13, fontFamily: 'DMSans_400Regular', color: TERRACOTTA, textAlign: 'center' },
});
