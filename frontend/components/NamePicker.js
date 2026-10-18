import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { searchNames, userMessage } from '../services/geminiService';
import { COLORS, FONTS, TYPE, LINE } from '../theme';

const WAIT_MS = 250;

export default function NamePicker({ onChoose, onClose, busy }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const latest = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) { setResults([]); setSearching(false); setError(null); return undefined; }
    const ticket = ++latest.current;
    setSearching(true);
    const timer = setTimeout(() => {
      searchNames(text)
        .then(data => { if (ticket === latest.current) { setResults(data.result); setError(null); } })
        .catch(err => { if (ticket === latest.current) setError(userMessage(err, 'Could not search right now. Check your connection.')); })
        .finally(() => { if (ticket === latest.current) setSearching(false); });
    }, WAIT_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const typed = query.trim().length >= 2;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Choose by name</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={styles.close}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.hint}>Type a common or scientific name. Its Florida status is checked after you pick.</Text>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="For example: coontie, live oak, Schinus"
        placeholderTextColor={COLORS.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Plant name"
        editable={!busy}
      />
      {(searching || busy) && <ActivityIndicator color={COLORS.softGreen} size="small" style={styles.spinner} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!searching && !error && typed && results.length === 0 && (
        <Text style={styles.empty}>No Florida plants match that. Try the scientific name.</Text>
      )}
      {!busy && results.map(plant => (
        <TouchableOpacity
          key={plant.scientific_name}
          style={styles.row}
          onPress={() => onChoose(plant)}
          accessibilityRole="button"
          accessibilityLabel={`Choose ${plant.common_name || plant.scientific_name}`}
        >
          {plant.common_name ? <Text style={styles.common}>{plant.common_name}</Text> : null}
          <Text style={plant.common_name ? styles.sci : styles.common}>{plant.scientific_name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: TYPE.body, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  close: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.textMuted },
  hint: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: LINE.body },
  input: {
    minWidth: 0, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, backgroundColor: COLORS.white,
  },
  spinner: { alignSelf: 'flex-start' },
  error: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.error },
  empty: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted },
  row: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.lightBg },
  common: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  sci: { fontSize: TYPE.caption, fontFamily: FONTS.accentItalic, color: COLORS.textMuted },
});
