import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator,
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
import PressScale from '../components/PressScale';
import { rememberPlace } from '../lastPlace';
import { askForCamera } from '../cameraAccess';
import usePhotoDrop from '../components/usePhotoDrop';
import NamePicker from '../components/NamePicker';
import PhotoStrip from '../components/PhotoStrip';
import PlantPhoto from '../components/PlantPhoto';
import ScreenLayout from '../components/ScreenLayout';
import ScanningLeaf from '../components/ScanningLeaf';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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

function PlantCard({ card, number, disabled, onAddPhotos, onDropPhotos, onDropError, onRemovePhoto, onScan, onDelete, onPick, onNone, onPickOne, onNaming, onChooseName }) {
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
  const known = shown ?? (agreed ? r.options[0] : null);
  const dropId = `plant-drop-${card._id}`;
  const dragging = usePhotoDrop(dropId, {
    blocked: card.phase !== 'draft' || card.naming || disabled,
    room: MAX_PHOTOS - card.photos.length,
    max: MAX_PHOTOS,
    onPhotos: onDropPhotos,
    onError: onDropError,
  });

  const title = !done ? `Plant ${number}`
    : noMatch ? 'Not identified'
    : shown ? shown.plant_name
    : agreed ? agreedName(r.options)
    : 'Not sure yet';

  return (
    <Animated.View nativeID={dropId} style={[styles.plantCard, card.phase === 'draft' && styles.draftCard, dragging && styles.dropCard, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.cardHead}>
        {known?.photo && <PlantPhoto photo={known.photo} size={60} radius={16} label={title} />}
        <View style={styles.cardHeading}>
          <Text style={styles.plantName} numberOfLines={2}>{title}</Text>
          {shown && <StatusBadge key={shown.scientific_name} pop status={shown.status} label={shown.status_label} />}
        </View>
        {!scanning && (
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            style={styles.deleteBtn}
            accessibilityRole="button"
            accessibilityLabel="Remove this plant"
          >
            <View style={styles.deleteBtnInner}>
              <MaterialCommunityIcons name="close" size={19} color={COLORS.textMuted} />
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
          {card.photos.length > 0 && <Text style={styles.photoCount}>{card.photos.length} of {MAX_PHOTOS} photos of this plant</Text>}
          {card.error && <Text style={styles.cardError}>{card.error}</Text>}
          <View style={styles.cardButtons}>
            <TouchableOpacity accessibilityRole="button" style={[styles.smallBtn, (full || disabled) && styles.btnDisabled]} disabled={full || disabled} onPress={() => onAddPhotos('camera')}>
              <MaterialCommunityIcons name="camera-outline" size={18} color={COLORS.darkGreen} />
              <Text style={styles.smallBtnText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={[styles.smallBtn, (full || disabled) && styles.btnDisabled]} disabled={full || disabled} onPress={() => onAddPhotos('gallery')}>
              <MaterialCommunityIcons name="image-plus" size={18} color={COLORS.darkGreen} />
              <Text style={styles.smallBtnText}>{dragging ? 'Drop photos here' : 'Upload photos'}</Text>
            </TouchableOpacity>
          </View>
          {card.photos.length > 0 && <TouchableOpacity
            style={[styles.scanOneBtn, (card.photos.length === 0 || disabled) && styles.btnDisabled]}
            disabled={card.photos.length === 0 || disabled}
            onPress={onScan}
            accessibilityRole="button"
          >
            <Text style={styles.scanOneText}>Scan this plant</Text>
          </TouchableOpacity>}
          <TouchableOpacity accessibilityRole="button" onPress={() => onNaming(true)} disabled={disabled} style={styles.byName}>
            <Text style={styles.byNameText}>Choose by name</Text>
          </TouchableOpacity>
        </View>
      )}

      {scanning && (
        <View style={styles.scanningRow}>
          <ScanningLeaf size={40} />
          <Text accessibilityLiveRegion="polite" style={styles.scanningText}>{progress}</Text>
        </View>
      )}

      {done && (
        <View style={styles.cardBody}>
          {noMatch && <Text style={styles.expertWarning}>{NO_MATCH_TEXT}</Text>}
          {shown && <Text style={styles.matchText}>{matchText(r.id_source, shown.confidence)}</Text>}
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
  const [changingPlace, setChangingPlace] = useState(false);

  useEffect(() => { _savedPlants = plants; }, [plants]);
  useEffect(() => { _savedPlace = place; rememberPlace(place); }, [place]);
  useEffect(() => navigation.addListener('focus', () => {
    setPlants(prev => prev.filter(p => p.phase === 'scanning' || _savedPlants.some(s => s._id === p._id)));
  }), [navigation]);

  const zipCode = place?.zip ?? '';
  const zipValid = zipCode.length === 5;
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
      if (!(await askForCamera())) { setMessage('Camera access is needed to take a photo.'); return; }
      res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
    } else {
      res = await ImagePicker.launchImageLibraryAsync({
        base64: true, quality: 0.8, allowsMultipleSelection: room > 1, selectionLimit: room,
      });
    }
    if (res.canceled) return;
    attachPhotos(card, res.assets.slice(0, room).map(a => ({ uri: a.uri, base64: a.base64 })), res.assets.length > room);
  }

  function attachPhotos(card, picked, extra) {
    if (extra) setMessage(`Only ${MAX_PHOTOS} photos fit on one plant, so the extra ones were left out.`);
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
    <ScreenLayout
          scrollRef={scrollRef}
          contentWidth={plants.length ? 760 : 560}
          centered={plants.length === 0}
          title="EcoScan"
          subtitle="Only scan real plants growing outdoors."
          right={plants.length > 0 ? (
            <TouchableOpacity accessibilityRole="button" style={styles.headerAction} onPress={handleNewAudit} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={styles.newAuditBtn}>New scan</Text>
            </TouchableOpacity>
          ) : null}
        >
        <OfflineNotice />

        <View style={styles.zipSection}>
          {plants.length === 0 ? (
            <LocationPicker place={place} onChange={setPlace} />
          ) : changingPlace ? (
            <View style={styles.changePlace}>
              <LocationPicker place={place} onChange={found => { setPlace(found); setChangingPlace(false); }} />
              <Text style={styles.zipLockedSub}>Your scanned plants stay as they are.</Text>
              <TouchableOpacity onPress={() => setChangingPlace(false)} accessibilityRole="button">
                <Text style={styles.zipChange}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.zipLocked}>
              <View style={styles.zipLockedLeft}>
                <MaterialCommunityIcons name="map-marker-outline" size={18} color={COLORS.softGreen} />
                <Text style={styles.zipLockedText}>ZIP {zipCode}</Text>
                <TouchableOpacity style={styles.textAction} onPress={() => setChangingPlace(true)} accessibilityRole="button"
                  accessibilityLabel="Change location" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.zipChange}>Change</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.zipLockedSub}>{done.length} of {plants.length} plant{plants.length !== 1 ? 's' : ''} scanned</Text>
            </View>
          )}
        </View>

        {plants.length > 0 && (
          <View style={styles.listSection}>
            <View style={styles.listHeading}>
              <Text accessibilityRole="header" style={styles.listTitle}>Your plants</Text>
              <Text style={styles.listCount}>{plants.length}</Text>
            </View>
            {plants.map((card, i) => (
              <PlantCard
                key={card._id}
                card={card}
                number={i + 1}
                disabled={card.phase !== 'draft'}
                onAddPhotos={source => addPhotos(card, source)}
                onDropPhotos={(picked, extra) => { setMessage(null); attachPhotos(card, picked, extra); }}
                onDropError={error => update(card._id, { error })}
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

        {message && <Text accessibilityLiveRegion="assertive" style={styles.scanError}>{message}</Text>}

        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !zipValid }} style={[styles.addBtn, plants.length === 0 && styles.firstPlantBtn, !zipValid && styles.btnDisabled]} onPress={addCard} disabled={!zipValid}>
            <MaterialCommunityIcons name="plus" size={20} color={plants.length === 0 ? COLORS.onDark : COLORS.darkGreen} />
            <Text style={[styles.addBtnText, plants.length === 0 && styles.firstPlantText]}>Add plant</Text>
          </TouchableOpacity>
          {plants.length === 0 && !zipValid && <Text style={styles.startHint}>Choose your location to start.</Text>}

          {waiting.length > 0 && (
            <PressScale style={[styles.scanAllBtn, scanning && styles.btnDisabled]} onPress={scanAll} disabled={scanning}>
              {scanning
                ? <ActivityIndicator color={COLORS.cream} size="small" />
                : <Text style={styles.scanAllText}>Scan all ({waiting.length})</Text>}
            </PressScale>
          )}

          {done.length > 0 && waiting.length > 0 && !scanning && (
            <Text style={styles.waitingNote}>
              {waiting.length} plant{waiting.length !== 1 ? 's have' : ' has'} photos but {waiting.length !== 1 ? "aren't" : "isn't"} scanned yet.
            </Text>
          )}

          {done.length > 0 && (
            <PressScale style={[styles.finishBtn, !canFinish && styles.btnDisabled]} onPress={handleFinish} disabled={!canFinish}>
              <Text style={styles.finishBtnText}>See my results  →</Text>
            </PressScale>
          )}
        </View>

    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.cream },

  headerAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
  newAuditBtn:{ fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, textDecorationLine: 'underline' },

  zipSection: { marginBottom: 8 },
  zipLocked: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 16, rowGap: 0,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.cardBg, paddingVertical: 8, paddingHorizontal: 14,
  },
  zipLockedText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  zipLockedSub:  { fontSize: TYPE.caption, fontFamily: FONTS.bodyMedium, color: COLORS.textMuted },
  zipLockedLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zipChange:     { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, textDecorationLine: 'underline', textAlign: 'center' },
  textAction: { minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' },
  changePlace:   { gap: 10, paddingVertical: 8 },

  listSection: { paddingTop: 18, gap: 16 },
  listHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 2 },
  listTitle: { fontSize: TYPE.h3, lineHeight: LINE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  listCount: { minWidth: 26, overflow: 'hidden', borderRadius: 13, paddingHorizontal: 8, paddingVertical: 4, textAlign: 'center', backgroundColor: COLORS.lightBg, color: COLORS.softGreen, fontSize: TYPE.small, fontFamily: FONTS.bodyBold },

  plantCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 24, padding: 18, gap: 14,
    shadowColor: COLORS.shadow, shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  draftCard: { backgroundColor: COLORS.cardBg },
  dropCard:  { backgroundColor: COLORS.photoBg },
  cardHead:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeading: { flex: 1, minWidth: 0, gap: 6, alignItems: 'flex-start' },
  cardBody:  { gap: 10 },
  plantName: { fontSize: TYPE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen, lineHeight: LINE.h3 },
  deleteBtn:      { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  deleteBtnInner: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center',
  },

  photoCount:  { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: LINE.caption },
  cardButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  smallBtn: {
    flex: 1, minWidth: 120, minHeight: 48, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 8, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.lightBg,
  },
  smallBtnText: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, textAlign: 'center' },
  scanOneBtn:   { borderRadius: 10, minHeight: 48, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.darkGreen },
  scanOneText:  { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.onDark },
  byName:       { alignSelf: 'stretch', minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  byNameText:   { fontSize: TYPE.caption, lineHeight: LINE.caption, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, textAlign: 'center' },
  cardError:    { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.error },

  scanningRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scanningText: { flex: 1, fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.bodyMedium, color: COLORS.textBody },
  matchText:    { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted },

  actions: { paddingTop: 20, paddingBottom: 16, gap: 12 },
  addBtn: {
    borderRadius: 10, minHeight: 50, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.darkGreen, backgroundColor: COLORS.cardBg,
  },
  addBtnText:  { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  firstPlantBtn: { backgroundColor: COLORS.darkGreen },
  firstPlantText: { color: COLORS.onDark },
  startHint: { fontSize: TYPE.caption, lineHeight: LINE.caption, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },
  scanAllBtn:  { backgroundColor: COLORS.darkGreen, borderRadius: 10, minHeight: 52, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  scanAllText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.onDark },
  waitingNote: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },
  finishBtn: {
    backgroundColor: COLORS.darkGreen, borderRadius: 10, minHeight: 52,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  finishBtnText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.white },
  btnDisabled: { opacity: 0.35 },
  expertWarning: { fontSize: TYPE.body, fontFamily: FONTS.body, color: STATUS_COLORS.invasive.color, lineHeight: LINE.body },
  scanError: { marginHorizontal: 20, marginBottom: 10, fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.error, textAlign: 'center' },
});
