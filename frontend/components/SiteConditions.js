import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const DEFAULT_SITE = { sun: 'unknown', moisture: 'unknown', space: 'unknown', maintenance: 'unknown' };
export const SITE_FIELDS = [
  { key: 'sun', label: 'Sun exposure', options: [['full', 'Full sun'], ['part', 'Part sun'], ['shade', 'Shade'], ['unknown', 'Not sure']] },
  { key: 'moisture', label: 'Soil moisture', options: [['dry', 'Dry'], ['average', 'Average'], ['wet', 'Wet'], ['unknown', 'Not sure']] },
  { key: 'space', label: 'Room for mature plants', options: [['small', 'Small bed'], ['medium', 'Shrub area'], ['large', 'Tree space'], ['unknown', 'Not sure']] },
  { key: 'maintenance', label: 'Ongoing maintenance', options: [['low', 'Low'], ['moderate', 'Moderate'], ['unknown', 'Not sure']] },
];

export default function SiteConditions({ site = DEFAULT_SITE, onChange, disabled = false }) {
  return <View style={styles.container}>
    <Text accessibilityRole="header" style={styles.title}>Choose for your planting site</Text>
    <Text style={styles.description}>Known conditions narrow the choices. “Not sure” keeps options open and marks what still needs a site check.</Text>
    {SITE_FIELDS.map((field) => <View key={field.key} style={styles.field}>
      <Text style={styles.label}>{field.label}</Text>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={field.label}>
        {field.options.map(([value, label]) => {
          const selected = (site[field.key] || 'unknown') === value;
          return <TouchableOpacity key={value} accessibilityRole="radio" accessibilityLabel={`${field.label}: ${label}`} accessibilityState={{ checked: selected, disabled }} aria-checked={selected} aria-disabled={disabled} disabled={disabled} onPress={() => onChange({ ...DEFAULT_SITE, ...site, [field.key]: value })} style={[styles.option, selected && styles.selected, disabled && styles.disabled]}>
            <Text style={[styles.optionText, selected && styles.selectedText]}>{label}</Text>
          </TouchableOpacity>;
        })}
      </View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  container: { padding: 18, borderRadius: 14, backgroundColor: '#eaeee6', gap: 12 },
  title: { color: '#1e3a1e', fontSize: 18, fontWeight: '700' },
  description: { color: '#4a4a3a', fontSize: 13, lineHeight: 20 },
  field: { gap: 7 },
  label: { color: '#1e3a1e', fontSize: 13, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: { minHeight: 44, padding: 12, borderRadius: 9, justifyContent: 'center', borderWidth: 1, borderColor: '#a9b49f', backgroundColor: '#fffdf8' },
  selected: { backgroundColor: '#1e3a1e', borderColor: '#1e3a1e' },
  optionText: { fontSize: 12, color: '#1e3a1e' },
  selectedText: { color: '#fffdf8' },
  disabled: { opacity: 0.5 },
});
