import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import StatusBadge from './StatusBadge';
import { COLORS, STATUS_COLORS, FONTS, TYPE, LINE } from '../theme';

export const CHOSEN_BY_NAME = 'Chosen by name';

export function matchLabel(idSource) {
  return idSource === 'openai_fallback' ? 'OpenAI' : 'PlantNet';
}

export function matchText(idSource, confidence) {
  if (idSource === 'by_name') return CHOSEN_BY_NAME;
  return `${matchLabel(idSource)}: ${Math.round((confidence ?? 0) * 100)}% match`;
}

export const NO_MATCH_TEXT = "Couldn't identify this. Try a close-up of one leaf, or a flower";

export function agreedName(options) {
  return options.map(o => o.plant_name).join(' or ');
}

function sharesName(option, options) {
  const name = option.plant_name.toLowerCase();
  return options.filter(o => o.plant_name.toLowerCase() === name).length > 1;
}

function ScoreChart({ options, aiPick }) {
  const top = Math.max(...options.map(o => o.confidence), 0.01);
  return (
    <View style={styles.chart} accessible accessibilityLabel={options.map(o => `${o.plant_name} ${Math.round(o.confidence * 100)}%`).join(', ')}>
      {options.map((option, i) => {
        const color = (STATUS_COLORS[option.status] ?? STATUS_COLORS.unknown).color;
        return (
          <View key={option.scientific_name || i} style={styles.chartRow}>
            <Text style={styles.chartName} numberOfLines={1}>{sharesName(option, options) ? option.scientific_name : option.plant_name}</Text>
            <View style={styles.chartTrack}>
              <View style={[styles.chartBar, { width: `${(option.confidence / top) * 100}%`, backgroundColor: color },
                i === aiPick && styles.chartBarPick]} />
            </View>
            <Text style={styles.chartValue}>{Math.round(option.confidence * 100)}%</Text>
          </View>
        );
      })}
      {aiPick != null && <Text style={styles.chartNote}>Outlined bar: OpenAI's pick from your photos</Text>}
    </View>
  );
}

export function AgreedStatus({ options, onPickOne }) {
  const first = options[0];
  return (
    <View style={styles.agreed}>
      <StatusBadge pop status={first.status} label={first.status_label} />
      <Text style={styles.agreedText}>
        {options.length > 1
          ? `Every close match is ${first.status_label.toLowerCase()}. It's one of these: ${agreedName(options)}.`
          : `Most likely ${first.plant_name}.`}
      </Text>
      {onPickOne && (
        <TouchableOpacity onPress={onPickOne} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.pickOne}>I know which one it is</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function CandidatePicker({ options, suggested = 0, idSource, onPick, onNone }) {
  const aiPick = idSource === 'openai_adjudicated' ? suggested : null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Which one is it?</Text>
      <Text style={styles.hint}>We found a few close matches. Pick the one that looks like your plant.</Text>
      <ScoreChart options={options} aiPick={aiPick} />
      {options.map((option, i) => (
        <TouchableOpacity key={option.scientific_name || i} style={styles.option} onPress={() => onPick(i)}>
          <View style={styles.optionText}>
            <Text style={styles.name}>
              {option.plant_name}
              {sharesName(option, options) ? ` (${option.scientific_name})` : ''}
            </Text>
            <Text style={styles.match}>
              {matchText(idSource, option.confidence)}{i === aiPick ? " · OpenAI's pick" : ''}
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
  title: { fontSize: TYPE.lead, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  hint: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted },
  chart: { gap: 6, paddingVertical: 6 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartName: { width: 110, fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textBody },
  chartTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: COLORS.lightBg, overflow: 'hidden' },
  chartBar: { height: '100%', borderRadius: 5 },
  chartBarPick: { borderWidth: 2, borderColor: COLORS.darkGreen },
  chartValue: { width: 36, textAlign: 'right', fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.textBody },
  chartNote: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted },
  option: {
    gap: 6,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, backgroundColor: COLORS.cardBg,
  },
  optionText: { gap: 2 },
  name: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  match: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted },
  none: { alignSelf: 'flex-start', paddingVertical: 6 },
  noneText: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.textMuted, textDecorationLine: 'underline' },
  agreed: { gap: 6 },
  agreedText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: LINE.body },
  pickOne: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },
});
