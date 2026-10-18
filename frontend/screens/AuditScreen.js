import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, useWindowDimensions,
  Animated, Alert, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFonts } from 'expo-font';
import { choosePlant, identifyPlant, userMessage } from '../services/geminiService';
import { COLORS, STATUS_COLORS, FONTS, FONT_ASSETS, TYPE, LINE } from '../theme';
import StatusBadge from '../components/StatusBadge';
import CandidatePicker, { AgreedStatus, NO_MATCH_TEXT, agreedName, matchText } from '../components/CandidatePicker';
import OfflineNotice, { reportAi } from '../components/OfflineNotice';
import { useProgressText } from '../components/ProgressText';
import { DURATION, EASE_OUT, useReduceMotion } from '../motion';
import LocationPicker from '../components/LocationPicker';
import NamePicker from '../components/NamePicker';
import PhotoStrip from '../components/PhotoStrip';
import ScreenHeader from '../components/ScreenHeader';
import ScanningLeaf from '../components/ScanningLeaf';
import { PHOTOS } from '../photos';

const MAX_PHOTOS = 5;
const SCANS_AT_ONCE = 3;

let _savedPlants = [];
let _savedPlace  = null;

export function forgetScannedPlant(id) {
  _savedPlants = _savedPlants.filter(p => p._id !== id);
}

function newCard() {
  return { _id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, photos: [], phase: 'draft', result: null, picked: null, pickingOne: false, error: null, naming: false };
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

function PlantCard({ card, number, disabled, onAddPhotos, onRemovePhoto, onScan, onDelete, onPick, onNone, onPickOne, onNaming, onChooseName }) {
  const reduce = useReduceMotion();
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: reduce ? 0 : DURATION, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: reduce ? 0 : DURATION, easing: EASE_OUT, useNativeDriver: true }),
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
    <Animated.View style={[styles.plantCard, card.phase === 'draft' && styles.draftCard, { opacity, transform: [{ translateY }] }]}>
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

      {card.phase === 'draft' && card.naming && (
        <View style={styles.cardBody}>
          {card.error && <Text style={styles.cardError}>{card.error}</Text>}
          <NamePicker onChoose={onChooseName} onClose={() => onNaming(false)} />
        </View>
      )}

      {card.phase === 'draft' && !card.naming && (
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
          <TouchableOpacity onPress={() => onNaming(true)} disabled={disabled} style={styles.byName}>
            <Text style={styles.byNameText}>Know its name? Choose by name</Text>
          </TouchableOpacity>
        </View>
      )}

      {scanning && (
        <View style={styles.scanningRow}>
          <ScanningLeaf size={40} />
          <Text style={styles.scanningText}>{progress}</Text>
        </View>
      )}

      {done && (
        <View style={styles.cardBody}>
          {noMatch && <Text style={styles.expertWarning}>{NO_MATCH_TEXT}</Text>}
          {shown && (
            <>
              <StatusBadge key={shown.scientific_name} pop status={shown.status} label={shown.status_label} />
              <Text style={styles.matchText}>{matchText(r.id_source, shown.confidence)}</Text>
            </>
          )}
          {agreed && <AgreedStatus options={r.options} onPickOne={onPickOne} />}
          {choosing && (
            <CandidatePicker
              options={r.options}
              suggested={r.suggested}
              idSource={r.id_source}
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

  async function chooseByName(card, plant) {
    update(card._id, { phase: 'scanning', naming: false, error: null });
    try {
      const data = await choosePlant(plant.scientific_name, zipCode);
      update(card._id, { phase: 'done', result: data.result, picked: 0, pickingOne: false });
    } catch (err) {
      update(card._id, { phase: 'draft', naming: true, error: userMessage(err, 'Could not check that plant. Check your connection and try again.') });
    }
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

        <ScreenHeader
          photo={PHOTOS.ecoscan}
          photoLabel="Plants and pollinators on a school campus"
          title="EcoScan"
          subtitle="Scan the plants around campus to see how many are native to Florida, and what to change."
          right={plants.length > 0 ? (
            <TouchableOpacity onPress={handleNewAudit} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={styles.newAuditBtn}>New Scan</Text>
            </TouchableOpacity>
          ) : null}
        />
        <OfflineNotice />

        <View style={styles.titleSection}>
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
                onNaming={on => update(card._id, { naming: on, error: null })}
                onChooseName={plant => chooseByName(card, plant)}
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

  newAuditBtn:{ fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.onDark, textDecorationLine: 'underline' },

  titleSection: { paddingTop: 18, paddingBottom: 6, paddingHorizontal: 20 },
  realOnly: {
    alignSelf: 'flex-start', fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.bodyBold, color: COLORS.accentInk,
    backgroundColor: COLORS.accentSoft, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, overflow: 'hidden',
  },

  zipSection: { paddingHorizontal: 20, marginTop: 12, marginBottom: 8 },
  zipLocked: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, paddingVertical: 12,
  },
  zipLockedText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  zipLockedSub:  { fontSize: TYPE.caption, fontFamily: FONTS.bodyMedium, color: COLORS.textMuted },

  listSection: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },

  plantCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', padding: 16, gap: 12,
  },
  draftCard: { backgroundColor: 'transparent', borderStyle: 'dashed', borderWidth: 1.5, borderColor: COLORS.softGreen },
  cardHead:  { flexDirection: 'row', alignItems: 'flex-start' },
  cardBody:  { gap: 10 },
  plantName: { flex: 1, fontSize: TYPE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen, lineHeight: LINE.h3 },
  deleteBtn:      { paddingLeft: 8 },
  deleteBtnInner: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.lightBg, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: TYPE.body, color: COLORS.textBody, fontFamily: FONTS.bodyBold, lineHeight: LINE.body },

  photoCount:  { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: LINE.body },
  cardButtons: { flexDirection: 'row', gap: 10 },
  smallBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border,
  },
  smallBtnText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, textAlign: 'center' },
  scanOneBtn:   { borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: COLORS.darkGreen },
  scanOneText:  { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.onDark },
  byName:       { alignSelf: 'center', paddingVertical: 4 },
  byNameText:   { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, textDecorationLine: 'underline' },
  cardError:    { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.error },

  scanningRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scanningText: { fontSize: TYPE.body, fontFamily: FONTS.bodyMedium, color: COLORS.textBody },
  matchText:    { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted },

  emptyState:   { alignItems: 'flex-start', paddingVertical: 36, paddingHorizontal: 20 },
  emptyIcon:    { fontSize: TYPE.display, marginBottom: 8 },
  emptyTitle:   { fontSize: TYPE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen, marginBottom: 6 },
  emptySubtitle:{ fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: LINE.body },

  actions: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 52, gap: 12 },
  addBtn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.darkGreen,
  },
  addBtnText:  { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  scanAllBtn:  { backgroundColor: COLORS.darkGreen, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  scanAllText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.onDark },
  waitingNote: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },
  finishBtn: {
    backgroundColor: COLORS.accent, borderRadius: 14,
    paddingVertical: 17, alignItems: 'center', marginTop: 4,
  },
  finishBtnText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.white },
  btnDisabled: { opacity: 0.35 },
  expertWarning: { fontSize: TYPE.body, fontFamily: FONTS.body, color: STATUS_COLORS.invasive.color, lineHeight: LINE.body },
  scanError: { marginHorizontal: 20, marginBottom: 10, fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.error, textAlign: 'center' },
});
