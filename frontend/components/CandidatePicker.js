import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import StatusBadge from './StatusBadge';
import { COLORS, FONTS } from '../theme';

export function matchLabel(idSource) {
  return idSource === 'openai_fallback' ? 'OpenAI' : 'PlantNet';
}

export const NO_MATCH_TEXT = "Couldn't identify this. Try a close-up of one leaf, or a flower";

function sharesName(option, options) {
  return options.filter(o => o.plant_name === option.plant_name).length > 1;
}

export default function CandidatePicker({ options, suggested = 0, idSource, onPick, onNone }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Which one is it?</Text>
      <Text style={styles.hint}>We found a few close matches. Pick the one that looks like your plant.</Text>
      {options.map((option, i) => (
        <TouchableOpacity key={option.scientific_name || i} style={styles.option} onPress={() => onPick(i)}>
          <View style={styles.optionText}>
            <Text style={styles.name}>
              {option.plant_name}
              {sharesName(option, options) ? ` (${option.scientific_name})` : ''}
            </Text>
            <Text style={styles.match}>
              {matchLabel(idSource)}: {Math.round(option.confidence * 100)}% match{i === suggested ? ' · Best guess' : ''}
            </Text>
          </View>
          <StatusBadge status={option.status} label={option.status_label} />
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.none} onPress={onNone}>
        <Text style={styles.noneText}>None of these</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { fontSize: 18, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  hint: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted },
  option: {
    gap: 6,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, backgroundColor: COLORS.cardBg,
  },
  optionText: { gap: 2 },
  name: { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  match: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted },
  none: { alignSelf: 'flex-start', paddingVertical: 6 },
  noneText: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.textMuted, textDecorationLine: 'underline' },
});
