import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, STATUS_COLORS, FONTS } from '../theme';
import SourceLine from './SourceLine';

const NWF_SOURCE = {
  name: 'National Wildlife Federation',
  url: 'https://www.nwf.org/-/media/Documents/PDFs/Garden-for-Wildlife/Keystone-Plants/NWF-GFW-keystone-plant-list-ecoregion-15-tropical-wet-forests.pdf',
};

export default function CaterpillarBars({ items }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map(i => i.count));
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Kinds of caterpillars each plant's group feeds here</Text>
      {items.map((item, i) => {
        const color = item.kind === 'add' ? STATUS_COLORS.native.color : STATUS_COLORS.invasive.color;
        return (
          <View key={i} style={styles.row}>
            <Text style={styles.label}>
              {item.name} <Text style={[styles.kind, { color }]}>({item.kind})</Text>
            </Text>
            <View style={styles.track}>
              <View style={{ width: `${(item.count / max) * 100}%`, backgroundColor: color }} />
            </View>
            <Text style={styles.note}>{item.group[0].toUpperCase() + item.group.slice(1)}: {item.count}</Text>
          </View>
        );
      })}
      <Text style={styles.note}>Each number is for the whole plant group, not one species. They are never added together.</Text>
      <SourceLine source={NWF_SOURCE} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16, gap: 10, alignSelf: 'stretch' },
  title: { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  row: { gap: 3 },
  label: { fontSize: 12, fontFamily: FONTS.bodyBold, color: COLORS.textBody },
  kind: { fontFamily: FONTS.body },
  track: { flexDirection: 'row', height: 14, borderRadius: 4, overflow: 'hidden', backgroundColor: COLORS.lightBg },
  note: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted },
});
