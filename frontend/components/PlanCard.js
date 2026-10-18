import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import StatusBadge from './StatusBadge';
import SourceLine from './SourceLine';
import AtlasButton from './AtlasButton';
import { COLORS, STATUS_COLORS, FONTS, TYPE, LINE } from '../theme';

const SHOWN = 2;
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
  return (
    <TouchableOpacity
      style={styles.check}
      onPress={onToggle ?? undefined}
      disabled={!onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !onToggle }}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked && <Text style={styles.tick}>✓</Text>}
      </View>
      <Text style={styles.checkText}>In my letter</Text>
    </TouchableOpacity>
  );
}

export default function PlanCard({ card, kind, replacementName, plantingsChecked = true, inLetter = true, onToggleLetter }) {
  const [open, setOpen] = useState(false);
  const rows = (kind === 'remove' ? removeRows(card, replacementName, plantingsChecked) : addRows(card)).filter(r => r?.text);
  const shown = open ? rows : rows.slice(0, SHOWN);

  return (
    <View style={[styles.card, kind === 'remove' ? styles.removeCard : styles.addCard, kind === 'add' && !inLetter && styles.cardOff]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{kind === 'remove' ? `Remove: ${card.plant_name}` : `Add: ${card.common_name}`}</Text>
        {kind === 'remove' && <StatusBadge status="invasive" label="Invasive" />}
        {kind === 'add' && onToggleLetter !== undefined && <LetterCheck checked={inLetter} onToggle={onToggleLetter} />}
      </View>
      {card.reason && <Text style={styles.reason}>{card.reason[0].toUpperCase() + card.reason.slice(1)}</Text>}
      {card.effect && <Text style={styles.effect}>{card.effect}</Text>}
      {shown.map((row, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.text}>{row.text}</Text>
          <SourceLine source={row.source} />
        </View>
      ))}
      {rows.length > SHOWN && (
        <TouchableOpacity onPress={() => setOpen(o => !o)}>
          <Text style={styles.more}>{open ? 'Less' : 'More'}</Text>
        </TouchableOpacity>
      )}
      {kind === 'add' && <AtlasButton url={card.atlas_url} />}
    </View>
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
  cardOff: { opacity: 0.55 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.darkGreen, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: COLORS.darkGreen },
  tick: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.onDark, lineHeight: LINE.caption },
  checkText: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  more: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, paddingVertical: 6, textDecorationLine: 'underline' },
});
