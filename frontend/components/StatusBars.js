import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, STATUS_COLORS, FONTS } from '../theme';

const SEGMENTS = [
  { key: 'native',     status: 'native',     label: 'Native' },
  { key: 'non_native', status: 'non-native', label: 'Non-native' },
  { key: 'invasive',   status: 'invasive',   label: 'Invasive' },
];

function Bar({ label, counts }) {
  const total = SEGMENTS.reduce((sum, s) => sum + counts[s.key], 0);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.track}>
        {total > 0 && SEGMENTS.map(s => counts[s.key] > 0 && (
          <View key={s.key} style={{ flex: counts[s.key], backgroundColor: STATUS_COLORS[s.status].color }} />
        ))}
      </View>
      <Text style={styles.rowNote}>
        {SEGMENTS.map(s => `${counts[s.key]} ${s.label.toLowerCase()}`).join(' · ')}
      </Text>
    </View>
  );
}

export default function StatusBars({ now, withPlan }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Plants on campus, now and with the plan</Text>
      <Bar label="Now" counts={now} />
      <Bar label="With plan" counts={withPlan} />
      <View style={styles.legend}>
        {SEGMENTS.map(s => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: STATUS_COLORS[s.status].color }]} />
            <Text style={styles.legendText}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16, gap: 12, alignSelf: 'stretch' },
  title: { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  row: { gap: 4 },
  rowLabel: { fontSize: 12, fontFamily: FONTS.bodyBold, color: COLORS.textBody },
  track: { flexDirection: 'row', height: 18, borderRadius: 4, overflow: 'hidden', backgroundColor: COLORS.lightBg },
  rowNote: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textBody },
});
