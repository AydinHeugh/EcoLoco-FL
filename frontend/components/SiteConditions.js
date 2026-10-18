import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Platform, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export const DEFAULT_SITE = { sun: 'unknown', moisture: 'unknown', space: 'unknown', maintenance: 'unknown' };
export const SITE_FIELDS = [
  { key: 'sun', label: 'Sun exposure', shortLabel: 'Light', icon: 'sunny-outline', options: [['full', 'Full sun'], ['part', 'Part sun'], ['shade', 'Shade'], ['unknown', 'Not sure']] },
  { key: 'moisture', label: 'Soil moisture', shortLabel: 'Moisture', icon: 'water-outline', options: [['dry', 'Dry'], ['average', 'Average'], ['wet', 'Wet'], ['unknown', 'Not sure']] },
  { key: 'space', label: 'Room for mature plants', shortLabel: 'Space', icon: 'resize-outline', options: [['small', 'Small bed'], ['medium', 'Shrub area'], ['large', 'Tree space'], ['unknown', 'Not sure']] },
  { key: 'maintenance', label: 'Ongoing maintenance', shortLabel: 'Care', icon: 'leaf-outline', options: [['low', 'Low'], ['moderate', 'Moderate'], ['unknown', 'Not sure']] },
];

export default function SiteConditions({ site = DEFAULT_SITE, onChange, disabled = false }) {
  const { width } = useWindowDimensions();
  const [panelWidth, setPanelWidth] = useState(0);
  const [activeKey, setActiveKey] = useState(null);
  const [focusedKey, setFocusedKey] = useState(null);
  const availableWidth = panelWidth || Math.min(width - 44, 896);
  const columns = availableWidth >= 640 ? 4 : 2;
  const tileWidth = Math.max(0, (availableWidth - 12 * (columns - 1)) / columns);
  const activeField = SITE_FIELDS.find(field => field.key === activeKey);

  function selectValue(key, value) {
    if (disabled) return;
    onChange({ ...DEFAULT_SITE, ...site, [key]: value });
    setActiveKey(null);
  }

  return <View style={styles.container}>
    <View style={styles.headingRow}>
      <Text style={styles.title}>Your site</Text>
      <Text style={styles.optional}>Optional</Text>
    </View>
    <View style={styles.fields} onLayout={event => setPanelWidth(event.nativeEvent.layout.width)}>
      {SITE_FIELDS.map(field => {
        const value = site[field.key] || 'unknown';
        const selectedLabel = field.options.find(option => option[0] === value)?.[1] || 'Not sure';
        const frame = [styles.field, { width: tileWidth }, focusedKey === field.key && styles.focused, disabled && styles.disabled];
        const label = <View style={styles.labelRow}>
          <Ionicons name={field.icon} size={16} color="#6f7e64" accessible={false} />
          <Text style={styles.label}>{field.shortLabel}</Text>
        </View>;
        return Platform.OS === 'web' ? <View key={field.key} style={frame}>
          {label}
          <View style={styles.selectRow}>
            {React.createElement('select', {
              'aria-label': field.label,
              value, disabled,
              onChange: event => selectValue(field.key, event.target.value),
              onFocus: () => setFocusedKey(field.key),
              onBlur: () => setFocusedKey(null),
              style: { appearance: 'none', WebkitAppearance: 'none', width: '100%', minWidth: 0, height: 44, padding: '0 23px 0 0', border: 0, outline: 0, background: 'transparent', color: value === 'unknown' ? '#76806e' : '#1e3a1e', fontFamily: 'DMSans_400Regular, sans-serif', fontSize: 15, cursor: disabled ? 'default' : 'pointer' },
            }, field.options.map(([optionValue, optionLabel]) => React.createElement('option', { key: optionValue, value: optionValue }, optionLabel)))}
            <View pointerEvents="none" style={styles.chevron}><Ionicons name="chevron-down" size={15} color="#63745a" /></View>
          </View>
        </View> : <TouchableOpacity key={field.key} style={frame} accessibilityRole="button" accessibilityLabel={`${field.label}: ${selectedLabel}`} accessibilityState={{ disabled, expanded: activeKey === field.key }} disabled={disabled} onPress={() => setActiveKey(field.key)}>
          {label}
          <View style={styles.valueRow}><Text style={[styles.value, value === 'unknown' && styles.unset]}>{selectedLabel}</Text><Ionicons name="chevron-down" size={15} color="#63745a" /></View>
        </TouchableOpacity>;
      })}
    </View>
    {Platform.OS !== 'web' && <Modal visible={Boolean(activeField) && !disabled} transparent animationType="fade" onRequestClose={() => setActiveKey(null)}>
      <Pressable style={styles.scrim} onPress={() => setActiveKey(null)} accessibilityRole="button" accessibilityLabel="Close site options">
        <Pressable style={styles.sheet} onPress={event => event.stopPropagation()} accessibilityViewIsModal>
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{activeField?.label}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close site options" onPress={() => setActiveKey(null)} style={styles.close}><Ionicons name="close" size={21} color="#1e3a1e" /></TouchableOpacity></View>
          <View accessibilityRole="radiogroup" accessibilityLabel={activeField?.label}>
            {activeField?.options.map(([value, label]) => {
              const selected = (site[activeField.key] || 'unknown') === value;
              return <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => selectValue(activeField.key, value)} style={[styles.choice, selected && styles.choiceSelected]}>
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
                {selected && <Ionicons name="checkmark" size={19} color="#1e3a1e" />}
              </TouchableOpacity>;
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#35482f', fontFamily: 'DMSans_700Bold', fontSize: 13 },
  optional: { color: '#7b8173', fontFamily: 'DMSans_400Regular', fontSize: 12 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { paddingHorizontal: 15, paddingTop: 12, paddingBottom: 9, borderRadius: 12, backgroundColor: '#fcfaf5', borderWidth: 1, borderColor: '#d6d9cd', minHeight: 78, justifyContent: 'space-between' },
  focused: { borderColor: '#4a7a3a', backgroundColor: '#f7f9f2', shadowColor: '#1e3a1e', shadowOpacity: 0.09, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6b775f' },
  selectRow: { position: 'relative', width: '100%' },
  chevron: { position: 'absolute', right: 0, top: 14 },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32, gap: 6 },
  value: { color: '#1e3a1e', fontFamily: 'DMSans_400Regular', fontSize: 15, flexShrink: 1 },
  unset: { color: '#76806e' }, disabled: { opacity: 0.45 },
  scrim: { flex: 1, backgroundColor: '#14271166', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { backgroundColor: '#f5f0e8', borderRadius: 20, width: '100%', maxWidth: 380, padding: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 10, marginBottom: 10 },
  sheetTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 23, color: '#1e3a1e', flex: 1 },
  close: { padding: 10, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, minHeight: 52, borderRadius: 10 },
  choiceSelected: { backgroundColor: '#e7eddf' },
  choiceText: { fontFamily: 'DMSans_400Regular', fontSize: 16, color: '#5f6d56' },
  choiceTextSelected: { fontFamily: 'DMSans_700Bold', color: '#1e3a1e' },
});
