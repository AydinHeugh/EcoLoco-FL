import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import StatusBadge from './StatusBadge';
import SourceLine from './SourceLine';
import { COLORS, FONTS } from '../theme';

const SHOWN = 2;

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

function removeRows(card, replacementName) {
  return [
    { label: 'Why', text: card.why ?? "It is on Florida's official list of invasive plants.", source: { name: card.source_label } },
    { label: 'Safety', text: card.removal_safety?.text, source: card.removal_safety?.source },
    { label: 'Replace with', text: replacementName ?? 'No replacement is ready yet. Our team is still checking plants.' },
  ];
}

export default function PlanCard({ card, kind, replacementName }) {
  const [open, setOpen] = useState(false);
  const rows = (kind === 'remove' ? removeRows(card, replacementName) : addRows(card)).filter(r => r.text);
  const shown = open ? rows : rows.slice(0, SHOWN);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{kind === 'remove' ? `Remove: ${card.plant_name}` : `Add: ${card.common_name}`}</Text>
        {kind === 'remove' && <StatusBadge status="invasive" label="Invasive" />}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginBottom: 12, gap: 6,
  },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 17, fontFamily: FONTS.heading, color: COLORS.darkGreen, flexShrink: 1 },
  reason: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },
  effect: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textBody },
  row: { marginTop: 6 },
  label: { fontSize: 11, fontFamily: FONTS.bodyBold, color: COLORS.textMuted, letterSpacing: 0.5 },
  text: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: 20 },
  more: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, paddingVertical: 6 },
});
