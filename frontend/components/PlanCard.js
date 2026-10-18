import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import StatusBadge from './StatusBadge';
import SourceLine from './SourceLine';
import AtlasButton from './AtlasButton';
import { COLORS, STATUS_COLORS, FONTS, TYPE, LINE } from '../theme';
import { DURATION, EASE_OUT, useReduceMotion } from '../motion';

const SHOWN = 2;
const DIMMED = 0.55;
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
  return <Animated.View style={[styles.row, { opacity: enter, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export default function PlanCard({ card, kind, replacementName, plantingsChecked = true, inLetter = true, onToggleLetter }) {
  const [open, setOpen] = useState(false);
  const reduce = useReduceMotion();
  const rows = (kind === 'remove' ? removeRows(card, replacementName, plantingsChecked) : addRows(card)).filter(r => r?.text);
  const shown = open ? rows : rows.slice(0, SHOWN);
  const off = kind === 'add' && !inLetter;
  const dim = useRef(new Animated.Value(off ? DIMMED : 1)).current;

  useEffect(() => {
    if (reduce) { dim.setValue(off ? DIMMED : 1); return; }
    Animated.timing(dim, { toValue: off ? DIMMED : 1, duration: DURATION, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [off, reduce]);

  return (
    <Animated.View style={[styles.card, kind === 'remove' ? styles.removeCard : styles.addCard, { opacity: dim }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{kind === 'remove' ? `Remove: ${card.plant_name}` : `Add: ${card.common_name}`}</Text>
        {kind === 'remove' && <StatusBadge status="invasive" label="Invasive" />}
        {kind === 'add' && onToggleLetter !== undefined && <LetterCheck checked={inLetter} onToggle={onToggleLetter} />}
      </View>
      {card.reason && <Text style={styles.reason}>{card.reason[0].toUpperCase() + card.reason.slice(1)}</Text>}
      {card.effect && <Text style={styles.effect}>{card.effect}</Text>}
      {shown.map((row, i) => {
        const body = (
          <>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.text}>{row.text}</Text>
            <SourceLine source={row.source} />
          </>
        );
        return i < SHOWN
          ? <View key={i} style={styles.row}>{body}</View>
          : <OpenedRow key={i} order={i - SHOWN}>{body}</OpenedRow>;
      })}
      {rows.length > SHOWN && (
        <TouchableOpacity onPress={() => setOpen(o => !o)}>
          <Text style={styles.more}>{open ? 'Less' : 'More'}</Text>
        </TouchableOpacity>
      )}
      {kind === 'add' && <AtlasButton url={card.atlas_url} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, marginBottom: 14, gap: 8 },
  addCard: { backgroundColor: COLORS.cardBg, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border },
  removeCard: { backgroundColor: COLORS.invasiveTint, borderRadius: 6, borderLeftWidth: 0 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: TYPE.h3, lineHeight: LINE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen, flexShrink: 1 },
  reason: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },
  effect: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody },
  row: { marginTop: 6 },
  label: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.seaGrape },
  text: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: LINE.body },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.darkGreen, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: COLORS.darkGreen },
  tick: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.onDark, lineHeight: LINE.caption },
  checkText: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  more: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, paddingVertical: 6, textDecorationLine: 'underline' },
});
