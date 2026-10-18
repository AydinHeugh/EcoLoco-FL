import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';
import SourceLine from './SourceLine';
import AtlasButton from './AtlasButton';
import PlantPhoto, { PhotoCredit } from './PlantPhoto';
import { COLORS, STATUS_COLORS, FONTS, TYPE, LINE } from '../theme';
import { DURATION, EASE_OUT, useReduceMotion } from '../motion';

const SHOWN = 2;
const DIMMED = 0.55;
const ROW_ICONS = {
  Helps: 'butterfly-outline', Where: 'white-balance-sunny', 'Buying it': 'storefront-outline', 'Watch out': 'alert-outline',
  'Look into': 'magnify', Why: 'alert-octagon-outline', Safety: 'hand-back-right-outline', 'Replace with': 'swap-horizontal',
};
export const NOT_CHECKED_HERE = 'Planting recommendations are only checked for Palm Beach County so far.';

function addRows(card) {
  const buying = card.buying ?? {};
  return [
    { label: 'Helps', text: card.helps?.text, source: card.helps?.source },
    { label: 'Where', text: card.where, source: card.growing_source },
    {
      label: 'Buying it',
      text: `Ask for ${buying.ask_for}.${buying.avoid ? ` ${buying.avoid}` : ''}`,
      source: buying.avoid ? buying.source : null,
    },
    ...(card.watch_out ?? []).map(w => ({ label: 'Watch out', text: w.text, source: w.source })),
    ...(card.look_into ?? []).map(q => ({ label: 'Look into', text: q })),
  ];
}

function removeRows(card, replacementName, plantingsChecked) {
  return [
    { label: 'Why', text: card.why ?? "It is on Florida's official list of invasive plants.", source: { name: card.source_label } },
    { label: 'Safety', text: card.removal_safety?.text, source: card.removal_safety?.source },
    plantingsChecked && { label: 'Replace with', text: replacementName ?? 'No replacement is ready yet. Our team is still checking plants.' },
  ];
}

function LetterCheck({ checked, onToggle }) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    Haptics.selectionAsync().catch(() => {});
    if (!reduce) {
      scale.setValue(0.7);
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }).start();
    }
    onToggle();
  };

  return (
    <TouchableOpacity
      style={styles.check}
      onPress={onToggle ? press : undefined}
      disabled={!onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !onToggle }}
      aria-checked={checked}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
    >
      <Animated.View style={[styles.box, checked && styles.boxOn, { transform: [{ scale }] }]}>
        {checked && <Text style={styles.tick}>✓</Text>}
      </Animated.View>
      <Text style={styles.checkText}>In my letter</Text>
    </TouchableOpacity>
  );
}

function OpenedRow({ order, children }) {
  const reduce = useReduceMotion();
  const enter = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { enter.setValue(1); return; }
    Animated.timing(enter, { toValue: 1, duration: DURATION, delay: order * 50, easing: EASE_OUT, useNativeDriver: true }).start();
  }, []);
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function Row({ row }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name={ROW_ICONS[row.label]} size={18} color={COLORS.seaGrape} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.label}>{row.label}</Text>
        <Text style={styles.text}>{row.text}</Text>
        <SourceLine source={row.source} />
      </View>
    </View>
  );
}

function MoreToggle({ open, onPress }) {
  const reduce = useReduceMotion();
  const turn = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { turn.setValue(open ? 1 : 0); return; }
    Animated.timing(turn, { toValue: open ? 1 : 0, duration: DURATION, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [open, reduce]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  return (
    <TouchableOpacity style={styles.moreBtn} onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <Text style={styles.more}>{open ? 'Less' : 'More'}</Text>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.softGreen} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function reasonIcon(reason) {
  if (reason.startsWith('replaces')) return 'swap-horizontal';
  if (reason.startsWith('fills a gap')) return 'puzzle-outline';
  return 'sprout-outline';
}

export default function PlanCard({ card, kind, replacementName, plantingsChecked = true, inLetter = true, onToggleLetter }) {
  const [open, setOpen] = useState(false);
  const reduce = useReduceMotion();
  const rows = (kind === 'remove' ? removeRows(card, replacementName, plantingsChecked) : addRows(card)).filter(r => r?.text);
  const shown = open ? rows : rows.slice(0, SHOWN);
  const off = kind === 'add' && !inLetter;
  const dim = useRef(new Animated.Value(off ? DIMMED : 1)).current;
  const name = kind === 'remove' ? card.plant_name : card.common_name;

  useEffect(() => {
    if (reduce) { dim.setValue(off ? DIMMED : 1); return; }
    Animated.timing(dim, { toValue: off ? DIMMED : 1, duration: DURATION, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [off, reduce]);

  return (
    <Animated.View style={[styles.card, kind === 'remove' ? styles.removeCard : styles.addCard, { opacity: dim }]}>
      <View style={styles.header}>
        <PlantPhoto photo={card.photo} size={76} radius={kind === 'remove' ? 8 : 16} label={name} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{kind === 'remove' ? `Remove: ${card.plant_name}` : `Add: ${card.common_name}`}</Text>
          {kind === 'remove' && <StatusBadge status="invasive" label="Invasive" />}
          {kind === 'add' && card.reason && (
            <View style={styles.tag}>
              <MaterialCommunityIcons name={reasonIcon(card.reason)} size={15} color={COLORS.seaGrape} />
              <Text style={styles.tagText}>{card.reason[0].toUpperCase() + card.reason.slice(1)}</Text>
            </View>
          )}
          {kind === 'add' && onToggleLetter !== undefined && <LetterCheck checked={inLetter} onToggle={onToggleLetter} />}
        </View>
      </View>
      {card.effect && (
        <View style={[styles.impact, kind === 'remove' && styles.impactOnTint]}>
          <MaterialCommunityIcons name={card.nwf && kind === 'add' ? 'butterfly-outline' : 'trending-up'} size={20} color={COLORS.softGreen} />
          <Text style={styles.impactText}>{card.effect}</Text>
        </View>
      )}
      <View style={styles.rows}>
        {shown.map((row, i) => (i < SHOWN
          ? <Row key={i} row={row} />
          : <OpenedRow key={i} order={i - SHOWN}><Row row={row} /></OpenedRow>))}
      </View>
      {(rows.length > SHOWN || card.atlas_url) && (
        <View style={styles.footer}>
          {rows.length > SHOWN ? <MoreToggle open={open} onPress={() => setOpen(o => !o)} /> : <View />}
          {kind === 'add' && <AtlasButton url={card.atlas_url} />}
        </View>
      )}
      <PhotoCredit photo={card.photo} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, marginBottom: 14, gap: 14 },
  addCard: { backgroundColor: COLORS.cardBg, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border },
  removeCard: { backgroundColor: COLORS.invasiveTint, borderRadius: 6 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  headerText: { flex: 1, minWidth: 0, gap: 8, alignItems: 'flex-start' },
  title: { fontSize: TYPE.h3, lineHeight: LINE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    backgroundColor: COLORS.seaGrapeSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  tagText: { flexShrink: 1, fontSize: TYPE.caption, lineHeight: LINE.caption, fontFamily: FONTS.bodyBold, color: COLORS.seaGrape },
  impact: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.lightBg, borderRadius: 12, padding: 12 },
  impactOnTint: { backgroundColor: COLORS.cardBg },
  impactText: { flex: 1, fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.bodyMedium, color: COLORS.textBody },
  rows: { gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.seaGrapeSoft, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: TYPE.caption, lineHeight: LINE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  text: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: LINE.body },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6 },
  more: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.darkGreen, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: COLORS.darkGreen },
  tick: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.onDark, lineHeight: LINE.caption },
  checkText: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
});
