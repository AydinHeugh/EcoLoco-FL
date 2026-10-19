import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable,
  Platform, useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, TYPE, LINE } from '../theme';

export const ANY_SITE = { light: 'unknown', moisture: 'unknown', space: 'unknown', care: 'unknown' };

const FIELDS = [
  { key: 'light', label: 'Light', accessibleLabel: 'Sun exposure', icon: 'sunny-outline', options: [['unknown', 'Not sure'], ['full', 'Full sun'], ['part', 'Part shade'], ['shade', 'Shade']] },
  { key: 'moisture', label: 'Moisture', accessibleLabel: 'Soil moisture', icon: 'water-outline', options: [['unknown', 'Not sure'], ['dry', 'Dry'], ['average', 'Average'], ['wet', 'Wet']] },
  { key: 'space', label: 'Space', accessibleLabel: 'Room for mature plants', icon: 'resize-outline', options: [['unknown', 'Not sure'], ['small', 'Small bed'], ['medium', 'Shrub area'], ['large', 'Tree space']] },
  { key: 'care', label: 'Care', accessibleLabel: 'Ongoing maintenance', icon: 'leaf-outline', options: [['unknown', 'Not sure'], ['low', 'Low'], ['moderate', 'Moderate']] },
];

export default function SiteFilters({ site = ANY_SITE, onChange, hidden = 0, disabled = false }) {
  const { width } = useWindowDimensions();
  const [panelWidth, setPanelWidth] = useState(0);
  const [activeKey, setActiveKey] = useState(null);
  const [focusedKey, setFocusedKey] = useState(null);
  const availableWidth = panelWidth || Math.min(width - 40, 920);
  const columns = availableWidth >= 640 ? 4 : 2;
  const tileWidth = Math.max(0, (availableWidth - 12 * (columns - 1)) / columns);
  const activeField = FIELDS.find(field => field.key === activeKey);

  function selectValue(key, value) {
    if (disabled) return;
    onChange({ ...ANY_SITE, ...site, [key]: value });
    setActiveKey(null);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <Text style={styles.title}>Your site</Text>
        <Text style={styles.optional}>Optional</Text>
      </View>
      <View style={styles.fields} onLayout={event => setPanelWidth(event.nativeEvent.layout.width)}>
        {FIELDS.map(field => {
          const value = site[field.key] || 'unknown';
          const selectedLabel = field.options.find(option => option[0] === value)?.[1] || 'Not sure';
          const frame = [styles.field, { width: tileWidth }, focusedKey === field.key && styles.focused, disabled && styles.disabled];
          const label = (
            <View style={styles.labelRow}>
              <Ionicons name={field.icon} size={17} color={COLORS.textMuted} accessible={false} />
              <Text style={styles.label}>{field.label}</Text>
            </View>
          );

          if (Platform.OS === 'web') {
            return (
              <View key={field.key} style={frame}>
                {label}
                <View style={styles.selectRow}>
                  {React.createElement('select', {
                    'aria-label': field.accessibleLabel,
                    value,
                    disabled,
                    onChange: event => selectValue(field.key, event.target.value),
                    onFocus: () => setFocusedKey(field.key),
                    onBlur: () => setFocusedKey(null),
                    style: {
                      appearance: 'none', WebkitAppearance: 'none', width: '100%', minWidth: 0,
                      height: 44, padding: '0 24px 0 0', border: 0, outline: 0,
                      background: 'transparent', color: value === 'unknown' ? COLORS.textMuted : COLORS.darkGreen,
                      fontFamily: `${FONTS.body}, sans-serif`, fontSize: TYPE.body,
                      cursor: disabled ? 'default' : 'pointer',
                    },
                  }, field.options.map(([optionValue, optionLabel]) => (
                    React.createElement('option', { key: optionValue, value: optionValue }, optionLabel)
                  )))}
                  <View pointerEvents="none" style={styles.chevron}>
                    <Ionicons name="chevron-down" size={16} color={COLORS.softGreen} accessible={false} />
                  </View>
                </View>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={field.key}
              style={frame}
              accessibilityRole="button"
              accessibilityLabel={`${field.accessibleLabel}: ${selectedLabel}`}
              accessibilityHint="Choose a site condition"
              accessibilityState={{ disabled, expanded: activeKey === field.key }}
              disabled={disabled}
              onPress={() => setActiveKey(field.key)}
            >
              {label}
              <View style={styles.valueRow}>
                <Text style={[styles.value, value === 'unknown' && styles.unset]}>{selectedLabel}</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.softGreen} accessible={false} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.note}>Moisture and care only narrow the list when our team has checked those details for a plant.</Text>
      {hidden > 0 && (
        <Text style={styles.hidden} accessibilityLiveRegion="polite">
          {hidden} plant{hidden === 1 ? ' is' : 's are'} hidden because {hidden === 1 ? "it doesn't" : "they don't"} fit your site.
        </Text>
      )}
      {Platform.OS !== 'web' && (
        <Modal visible={Boolean(activeField) && !disabled} transparent animationType="fade" onRequestClose={() => setActiveKey(null)}>
          <Pressable style={styles.scrim} onPress={() => setActiveKey(null)} accessible={false}>
            <Pressable style={styles.sheet} onPress={event => event.stopPropagation()} accessible={false} accessibilityViewIsModal>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{activeField?.accessibleLabel}</Text>
                <TouchableOpacity style={styles.close} accessibilityRole="button" accessibilityLabel="Close site options" onPress={() => setActiveKey(null)}>
                  <Ionicons name="close" size={22} color={COLORS.darkGreen} />
                </TouchableOpacity>
              </View>
              <View accessibilityRole="radiogroup" accessibilityLabel={activeField?.accessibleLabel}>
                {activeField?.options.map(([value, label]) => {
                  const selected = (site[activeField.key] || 'unknown') === value;
                  return (
                    <TouchableOpacity key={value} style={[styles.choice, selected && styles.choiceSelected]} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => selectValue(activeField.key, value)}>
                      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
                      {selected && <Ionicons name="checkmark" size={20} color={COLORS.darkGreen} accessible={false} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginBottom: 20 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  optional: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: {
    paddingHorizontal: 15, paddingTop: 13, paddingBottom: 7, borderRadius: 14,
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border,
    minHeight: 88, justifyContent: 'space-between',
  },
  focused: { borderColor: COLORS.softGreen, backgroundColor: COLORS.lightBg, shadowColor: COLORS.darkGreen, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { fontFamily: FONTS.body, fontSize: TYPE.caption, color: COLORS.textMuted },
  selectRow: { position: 'relative', width: '100%' },
  chevron: { position: 'absolute', right: 0, top: 14 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 6 },
  value: { fontFamily: FONTS.body, fontSize: TYPE.body, color: COLORS.darkGreen, flexShrink: 1 },
  unset: { color: COLORS.textMuted },
  disabled: { opacity: 0.5 },
  note: { fontFamily: FONTS.body, fontSize: TYPE.caption, color: COLORS.textMuted, lineHeight: LINE.caption },
  hidden: { fontFamily: FONTS.bodyBold, fontSize: TYPE.caption, color: COLORS.textBody, lineHeight: LINE.caption },
  scrim: { flex: 1, backgroundColor: COLORS.scrim, justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { backgroundColor: COLORS.cream, borderRadius: 20, width: '100%', maxWidth: 380, padding: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 10, marginBottom: 10 },
  sheetTitle: { fontFamily: FONTS.heading, fontSize: TYPE.h3, color: COLORS.darkGreen, flex: 1 },
  close: { minWidth: 44, minHeight: 44, padding: 10, alignItems: 'center', justifyContent: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, minHeight: 52, borderRadius: 10 },
  choiceSelected: { backgroundColor: COLORS.lightBg },
  choiceText: { fontFamily: FONTS.body, fontSize: TYPE.body, color: COLORS.textMuted },
  choiceTextSelected: { fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
});
