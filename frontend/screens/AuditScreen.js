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
import CandidatePicker, { AgreedStatus, NO_MATCH_TEXT, agreedName, matchText } from '../components/CandidatePicker';
import OfflineNotice, { reportAi } from '../components/OfflineNotice';
import { useProgressText } from '../components/ProgressText';
import LocationPicker from '../components/LocationPicker';

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const MAX_PHOTOS = 5;
const SCANS_AT_ONCE = 3;
const LOGO = require('../../assets/EcoLoco_logo.png');

let _savedPlants = [];
let _savedPlace  = null;

export function forgetScannedPlant(id) {
  _savedPlants = _savedPlants.filter(p => p._id !== id);
}

function newCard() {
  return { _id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, photos: [], phase: 'draft', result: null, picked: null, pickingOne: false, error: null };
}

export function settledPlant(card) {
  const r = card.result;
  const base = { _id: card._id, photo_uri: card.photos[0]?.uri };
  if (!r || r.state === 'unidentified' || card.picked === -1) {
    return { ...base, plant_name: 'Unidentified plant', scientific_name: '', status: 'unknown' };
  }
  if (card.picked != null && card.picked >= 0) {
    const o = r.options[card.picked];
    return { ...base, plant_name: o.plant_name, scientific_name: o.scientific_name, status: o.status };
  }
  if (r.agreed_status) {
    return { ...base, plant_name: agreedName(r.options), scientific_name: r.options[0].scientific_name, status: r.agreed_status };
  }
  return { ...base, plant_name: 'Unidentified plant', scientific_name: '', status: 'unknown' };
}

function PhotoStrip({ photos, onRemove, dimmed }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {photos.map((photo, i) => (
        <View key={i} style={[styles.stripItem, dimmed && styles.dimmed]}>
          <Image source={{ uri: photo.uri }} style={styles.stripPhoto} resizeMode="cover" />
          {onRemove && (
            <TouchableOpacity
              style={styles.stripRemove}
              onPress={() => onRemove(i)}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={styles.stripRemoveText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function PlantCard({ card, number, disabled, onAddPhotos, onRemovePhoto, onScan, onDelete, onPick, onNone, onPickOne }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 380, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 380, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
  }, []);

  const scanning = card.phase === 'scanning';
  const progress = useProgressText(scanning);
  const r = card.result;
  const done = card.phase === 'done';
  const noMatch = done && (r.state === 'unidentified' || card.picked === -1);
  const agreed = done && !noMatch && card.picked == null && r.agreed_status && !card.pickingOne;
  const choosing = done && !noMatch && card.picked == null && !agreed && (r.state === 'confirm');
  const shown = done && !noMatch && card.picked != null && card.picked >= 0 ? r.options[card.picked] : null;
  const full = card.photos.length >= MAX_PHOTOS;

  const title = !done ? `Plant ${number}`
    : noMatch ? 'Not identified'
    : shown ? shown.plant_name
    : agreed ? agreedName(r.options)
    : 'Not sure yet';

  return (
    <Animated.View style={[styles.plantCard, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.cardHead}>
        <Text style={styles.plantName} numberOfLines={2}>{title}</Text>
        {!scanning && (
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
        )}
      </View>

      {card.photos.length > 0 && <PhotoStrip photos={card.photos} dimmed={scanning} onRemove={card.phase === 'draft' ? onRemovePhoto : null} />}

      {card.phase === 'draft' && (
        <View style={styles.cardBody}>
          <Text style={styles.photoCount}>
            Photos of this one plant: {card.photos.length} of {MAX_PHOTOS}. A leaf up close and a flower work best.
          </Text>
          {card.error && <Text style={styles.cardError}>{card.error}</Text>}
          <View style={styles.cardButtons}>
            <TouchableOpacity style={[styles.smallBtn, (full || disabled) && styles.btnDisabled]} disabled={full || disabled} onPress={() => onAddPhotos('camera')}>
              <Text style={styles.smallBtnText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, (full || disabled) && styles.btnDisabled]} disabled={full || disabled} onPress={() => onAddPhotos('gallery')}>
              <Text style={styles.smallBtnText}>Upload photos</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.scanOneBtn, (card.photos.length === 0 || disabled) && styles.btnDisabled]}
            disabled={card.photos.length === 0 || disabled}
            onPress={onScan}
          >
            <Text style={styles.scanOneText}>Scan this plant</Text>
          </TouchableOpacity>
        </View>
      )}

      {scanning && (
        <View style={styles.scanningRow}>
          <ActivityIndicator color={COLORS.softGreen} size="small" />
          <Text style={styles.scanningText}>{progress}</Text>
        </View>
      )}

      {done && (
        <View style={styles.cardBody}>
          {noMatch && <Text style={styles.expertWarning}>{NO_MATCH_TEXT}</Text>}
          {shown && (
            <>
              <StatusBadge status={shown.status} label={shown.status_label} />
              <Text style={styles.matchText}>{matchText(r.id_source, shown.confidence)}</Text>
            </>
          )}
          {agreed && <AgreedStatus options={r.options} onPickOne={onPickOne} />}
          {choosing && (
            <CandidatePicker
              options={r.options}
              suggested={r.suggested}
              idSource={r.id_source}
              suggestedConfidence={r.suggested_confidence}
              onPick={onPick}
              onNone={onNone}
            />
          )}
        </View>
      )}
    </Animated.View>
  );
}

export default function AuditScreen({ navigation }) {
  const [place,   setPlace]   = useState(_savedPlace);
  const [plants,  setPlants]  = useState(_savedPlants);
  const [message, setMessage] = useState(null);

  useEffect(() => { _savedPlants = plants; }, [plants]);
  useEffect(() => { _savedPlace = place; }, [place]);
  useEffect(() => navigation.addListener('focus', () => {
    setPlants(prev => prev.filter(p => p.phase === 'scanning' || _savedPlants.some(s => s._id === p._id)));
  }), [navigation]);

  const zipCode = place?.zip ?? '';
  const zipValid = zipCode.length === 5;
  const { width } = useWindowDimensions();
  const maxWidth = Math.min(width, 960);
  const scrollRef = useRef(null);
  const [fontsLoaded] = useFonts(FONT_ASSETS);

  const scanning = plants.some(p => p.phase === 'scanning');
  const waiting  = plants.filter(p => p.phase === 'draft' && p.photos.length > 0);
  const done     = plants.filter(p => p.phase === 'done');
  const canFinish = done.length > 0 && !scanning && waiting.length === 0;

  function update(id, change) {
    setPlants(prev => prev.map(p => (p._id === id ? { ...p, ...(typeof change === 'function' ? change(p) : change) } : p)));
  }

  function addCard() {
    setMessage(null);
    if (!zipValid) { setMessage("Find your school's location before adding plants."); return; }
    setPlants(prev => [...prev, newCard()]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }

  async function addPhotos(card, source) {
    setMessage(null);
    const room = MAX_PHOTOS - card.photos.length;
    if (room <= 0) return;
    let res;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { setMessage('Camera access is needed to take a photo.'); return; }
      res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { setMessage('Photo library access is needed to upload photos.'); return; }
      res = await ImagePicker.launchImageLibraryAsync({
        base64: true, quality: 0.8, allowsMultipleSelection: room > 1, selectionLimit: room,
      });
    }
    if (res.canceled) return;
    const picked = res.assets.slice(0, room).map(a => ({ uri: a.uri, base64: a.base64 }));
    if (res.assets.length > room) setMessage(`Only ${MAX_PHOTOS} photos fit on one plant, so the extra ones were left out.`);
    update(card._id, p => ({ photos: [...p.photos, ...picked].slice(0, MAX_PHOTOS), error: null }));
  }

  async function scanCard(card) {
    update(card._id, { phase: 'scanning', error: null });
    try {
      const data = await identifyPlant(card.photos.map(p => p.base64), zipCode);
      const result = data.result;
      reportAi(result.ai_unavailable);
      update(card._id, { phase: 'done', result, picked: result.state === 'identified' ? 0 : null, pickingOne: false });
    } catch (err) {
      update(card._id, { phase: 'draft', error: userMessage(err, 'Could not scan this plant. Check your connection and try again.') });
    }
  }

  async function scanAll() {
    setMessage(null);
    const queue = [...waiting];
    const worker = async () => {
      while (queue.length) await scanCard(queue.shift());
    };
    await Promise.all(Array.from({ length: Math.min(SCANS_AT_ONCE, queue.length) }, worker));
  }

  function deleteCard(id) {
    setPlants(prev => prev.filter(p => p._id !== id));
  }

  function handleFinish() {
    navigation.navigate('AuditResults', { plants: done.map(settledPlant), zipCode, lat: place?.lat, lon: place?.lon });
  }

  function handleNewAudit() {
    const clear = () => { setPlants([]); setMessage(null); };
    if (Platform.OS === 'web') {
      if (window.confirm('Start a new scan? This will clear all plants.')) clear();
      return;
    }
    Alert.alert('Start a new scan?', 'This will clear all plants.', [
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

        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>EcoScan</Text>
          <Text style={styles.pageSubtitle}>
            Scan the plants around campus to see how many are native to Florida, and what to change.
          </Text>
          <Text style={styles.realOnly}>Only scan real plants growing outdoors.</Text>
        </View>

        <View style={styles.zipSection}>
          {plants.length === 0 ? (
            <LocationPicker place={place} onChange={setPlace} />
          ) : (
            <View style={styles.zipLocked}>
              <Text style={styles.zipLockedText}>📍 ZIP {zipCode}</Text>
              <Text style={styles.zipLockedSub}>{done.length} of {plants.length} plant{plants.length !== 1 ? 's' : ''} scanned</Text>
            </View>
          )}
        </View>

        {plants.length > 0 && (
          <View style={styles.listSection}>
            {plants.map((card, i) => (
              <PlantCard
                key={card._id}
                card={card}
                number={i + 1}
                disabled={card.phase !== 'draft'}
                onAddPhotos={source => addPhotos(card, source)}
                onRemovePhoto={index => update(card._id, p => ({ photos: p.photos.filter((_, j) => j !== index) }))}
                onScan={() => scanCard(card)}
                onDelete={() => deleteCard(card._id)}
                onPick={index => update(card._id, { picked: index })}
                onNone={() => update(card._id, { picked: -1 })}
                onPickOne={() => update(card._id, { pickingOne: true })}
              />
            ))}
          </View>
        )}

        {plants.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🌿</Text>
            <Text style={styles.emptyTitle}>No plants yet</Text>
            <Text style={styles.emptySubtitle}>
              Find your school's location, then add a plant. Give each plant up to 5 photos of that one plant, then scan.
            </Text>
          </View>
        )}

        {message && <Text style={styles.scanError}>{message}</Text>}

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.addBtn, !zipValid && styles.btnDisabled]} onPress={addCard} disabled={!zipValid}>
            <Text style={styles.addBtnText}>＋  Add plant</Text>
          </TouchableOpacity>

          {waiting.length > 0 && (
            <TouchableOpacity style={[styles.scanAllBtn, scanning && styles.btnDisabled]} onPress={scanAll} disabled={scanning}>
              {scanning
                ? <ActivityIndicator color={COLORS.cream} size="small" />
                : <Text style={styles.scanAllText}>Scan all ({waiting.length})</Text>}
            </TouchableOpacity>
          )}

          {done.length > 0 && waiting.length > 0 && !scanning && (
            <Text style={styles.waitingNote}>
              {waiting.length} plant{waiting.length !== 1 ? 's have' : ' has'} photos but {waiting.length !== 1 ? "aren't" : "isn't"} scanned yet.
            </Text>
          )}

          {done.length > 0 && (
            <TouchableOpacity style={[styles.finishBtn, !canFinish && styles.btnDisabled]} onPress={handleFinish} disabled={!canFinish}>
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

  listSection: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },

  plantCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', padding: 12, gap: 10,
  },
  cardHead:  { flexDirection: 'row', alignItems: 'flex-start' },
  cardBody:  { gap: 8 },
  plantName: { flex: 1, fontSize: 16, fontFamily: FONTS.heading, color: COLORS.darkGreen, lineHeight: 22 },
  deleteBtn:      { paddingLeft: 8 },
  deleteBtnInner: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.photoBg, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 13, color: COLORS.terracotta, fontFamily: FONTS.bodyBold, lineHeight: 14 },

  strip:           { gap: 8 },
  stripItem:       { width: 76, height: 76, borderRadius: 8, overflow: 'hidden', backgroundColor: COLORS.photoBg },
  stripPhoto:      { width: '100%', height: '100%' },
  stripRemove: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  stripRemoveText: { fontSize: 10, color: COLORS.terracotta, fontFamily: FONTS.bodyBold },
  dimmed:          { opacity: 0.5 },

  photoCount:  { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 17 },
  cardButtons: { flexDirection: 'row', gap: 8 },
  smallBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.darkGreen,
  },
  smallBtnText: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, textAlign: 'center' },
  scanOneBtn:   { borderRadius: 8, paddingVertical: 11, alignItems: 'center', backgroundColor: COLORS.softGreen },
  scanOneText:  { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.cream },
  cardError:    { fontSize: 12, fontFamily: FONTS.body, color: COLORS.error },

  scanningRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scanningText: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textBody },
  matchText:    { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted },

  emptyState:   { alignItems: 'center', paddingVertical: 52, paddingHorizontal: 32 },
  emptyIcon:    { fontSize: 36, marginBottom: 12 },
  emptyTitle:   { fontSize: 17, fontFamily: FONTS.heading, color: COLORS.textBody, marginBottom: 6 },
  emptySubtitle:{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },

  actions: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 52, gap: 12 },
  addBtn: {
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.darkGreen,
  },
  addBtnText:  { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  scanAllBtn:  { backgroundColor: COLORS.darkGreen, borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  scanAllText: { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.cream },
  waitingNote: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },
  finishBtn: {
    backgroundColor: COLORS.softGreen, borderRadius: 10,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  finishBtnText: { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.cream },
  btnDisabled: { opacity: 0.35 },
  expertWarning: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.terracotta, lineHeight: 17 },
  scanError: { marginHorizontal: 20, marginBottom: 10, fontSize: 13, fontFamily: FONTS.body, color: COLORS.terracotta, textAlign: 'center' },
});
