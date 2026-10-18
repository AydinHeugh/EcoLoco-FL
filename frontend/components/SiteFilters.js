import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, TYPE, LINE } from '../theme';

export const ANY_SITE = { light: 'unknown', moisture: 'unknown', space: 'unknown', care: 'unknown' };

const FIELDS = [
  { key: 'light', label: 'Light', options: [['full', 'Full sun'], ['part', 'Part shade'], ['shade', 'Shade']] },
  { key: 'moisture', label: 'Moisture', options: [['dry', 'Dry'], ['average', 'Average'], ['wet', 'Wet']] },
  { key: 'space', label: 'Space', options: [['small', 'Small bed'], ['medium', 'Shrub area'], ['large', 'Tree space']] },
  { key: 'care', label: 'Care', options: [['low', 'Low'], ['moderate', 'Moderate']] },
];

function Chip({ label, on, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.chip, on && styles.chipOn, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: on, disabled }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SiteFilters({ site, onChange, hidden, disabled }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Your site</Text>
      <Text style={styles.note}>Optional. Pick what fits where you'll plant. Moisture and care only narrow the list once our team has checked those details for a plant.</Text>
      {FIELDS.map(field => (
        <View key={field.key} style={styles.row}>
          <Text style={styles.label}>{field.label}</Text>
          <View style={styles.chips}>
            <Chip label="Any" on={site[field.key] === 'unknown'} disabled={disabled}
              onPress={() => onChange({ ...site, [field.key]: 'unknown' })} />
            {field.options.map(([value, label]) => (
              <Chip key={value} label={label} on={site[field.key] === value} disabled={disabled}
                onPress={() => onChange({ ...site, [field.key]: value })} />
            ))}
          </View>
        </View>
      ))}
      {hidden > 0 && (
        <Text style={styles.hidden}>{hidden} plant{hidden === 1 ? ' is' : 's are'} hidden because {hidden === 1 ? "it doesn't" : "they don't"} fit your site.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12, padding: 18, borderRadius: 18,
    backgroundColor: COLORS.lightBg, marginBottom: 16,
  },
  title: { fontSize: TYPE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  note: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: LINE.body },
  row: { gap: 6 },
  label: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.seaGrape },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: COLORS.darkGreen, borderColor: COLORS.darkGreen },
  chipText: { fontSize: TYPE.link, fontFamily: FONTS.body, color: COLORS.textBody },
  chipTextOn: { color: COLORS.onDark, fontFamily: FONTS.bodyBold },
  disabled: { opacity: 0.5 },
  hidden: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.textBody },
});
