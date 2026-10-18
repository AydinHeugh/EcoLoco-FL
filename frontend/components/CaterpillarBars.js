import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCountUp } from './CountUp';
import { BAR_MS, COUNT_STAGGER } from '../motion';
import { useInView } from './Reveal';
import { COLORS, STATUS_COLORS, FONTS, TYPE } from '../theme';
import SourceLine from './SourceLine';

const NWF_SOURCE = {
  name: 'National Wildlife Federation',
  url: 'https://www.nwf.org/-/media/Documents/PDFs/Garden-for-Wildlife/Keystone-Plants/NWF-GFW-keystone-plant-list-ecoregion-15-tropical-wet-forests.pdf',
};

function Row({ item, max, order }) {
  const ref = useRef(null);
  const shown = useCountUp(item.count, useInView(ref), order * COUNT_STAGGER, BAR_MS);
  const color = item.kind === 'add' ? STATUS_COLORS.native.color : STATUS_COLORS.invasive.color;
  return (
    <View ref={ref} collapsable={false} style={styles.row}>
      <Text style={styles.label}>
        {item.name} <Text style={[styles.kind, { color }]}>({item.kind})</Text>
      </Text>
      <View style={styles.track}>
        <View style={{ width: `${(shown / max) * 100}%`, backgroundColor: color }} />
      </View>
      <Text style={styles.note} accessibilityLabel={`${item.group}: ${item.count}`}>
        {item.group[0].toUpperCase() + item.group.slice(1)}: {shown}
      </Text>
    </View>
  );
}

export default function CaterpillarBars({ items }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map(i => i.count));
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Kinds of caterpillars each plant's group feeds here</Text>
      {items.map((item, i) => <Row key={i} item={item} max={max} order={i} />)}
      <Text style={styles.note}>Each number is for the whole plant group, not one species. They are never added together.</Text>
      <SourceLine source={NWF_SOURCE} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 8, paddingTop: 20, gap: 10, alignSelf: 'stretch', borderTopWidth: 1, borderTopColor: COLORS.border },
  title: { fontSize: TYPE.lead, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  row: { gap: 3 },
  label: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.textBody },
  kind: { fontFamily: FONTS.body },
  track: { flexDirection: 'row', height: 14, borderRadius: 4, overflow: 'hidden', backgroundColor: COLORS.lightBg },
  note: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted },
});
