import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, STATUS_COLORS, FONTS, TYPE } from '../theme';
import { BAR_MS, COUNT_STAGGER } from '../motion';
import { useCountUp } from './CountUp';
import { useInView } from './Reveal';

const SEGMENTS = [
  { key: 'native',     status: 'native',     label: 'Native' },
  { key: 'non_native', status: 'non-native', label: 'Non-native' },
  { key: 'invasive',   status: 'invasive',   label: 'Invasive' },
];

function Bar({ label, counts, order }) {
  const ref = useRef(null);
  const grown = useCountUp(100, useInView(ref), order * COUNT_STAGGER, BAR_MS);
  const total = SEGMENTS.reduce((sum, s) => sum + counts[s.key], 0);
  return (
    <View ref={ref} collapsable={false} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${grown}%` }]}>
          {total > 0 && SEGMENTS.map(s => counts[s.key] > 0 && (
            <View key={s.key} style={{ flex: counts[s.key], backgroundColor: STATUS_COLORS[s.status].color }} />
          ))}
        </View>
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
      <Bar label="Now" counts={now} order={0} />
      <Bar label="With plan" counts={withPlan} order={1} />
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
  card: { paddingVertical: 8, gap: 12, alignSelf: 'stretch' },
  title: { fontSize: TYPE.lead, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  row: { gap: 4 },
  rowLabel: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.textBody },
  track: { flexDirection: 'row', height: 22, borderRadius: 11, overflow: 'hidden', backgroundColor: COLORS.lightBg },
  fill: { flexDirection: 'row', height: '100%' },
  rowNote: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textBody },
});
