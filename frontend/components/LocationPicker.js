import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { locate, userMessage } from '../services/geminiService';
import { COLORS, FONTS, TYPE, LINE } from '../theme';

const round2 = n => Math.round(n * 100) / 100;

export default function LocationPicker({ place, onChange }) {
  const [query,   setQuery]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState(null);
  const [denied,  setDenied]  = useState(false);
  const [focused, setFocused] = useState(false);

  async function find(body) {
    setBusy(true);
    setError(null);
    try {
      const data = await locate(body);
      onChange(data.result);
    } catch (err) {
      setError(userMessage(err, "Couldn't find your location. Type your school's ZIP code instead."));
    } finally {
      setBusy(false);
    }
  }

  function findQuery() {
    if (!query.trim() || busy) return;
    find({ query: query.trim() });
  }

  async function useMyLocation() {
    if (denied || busy) return;
    setError(null);
    setBusy(true);
    let position;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDenied(true);
        setError("Location is off. Type your school's address or ZIP code instead.");
        return;
      }
      position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    } catch {
      setError("Couldn't get your location. Type your school's address or ZIP code instead.");
      return;
    } finally {
      setBusy(false);
    }
    await find({ lat: round2(position.coords.latitude), lon: round2(position.coords.longitude) });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <Text style={styles.label}>School address or ZIP code</Text>
        {place?.zip && (
          <View style={styles.found} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle-outline" size={15} color={COLORS.softGreen} accessible={false} />
            <Text style={styles.foundText}>{place.zip}</Text>
          </View>
        )}
      </View>
      <View style={styles.row}>
        <View style={[styles.inputWrap, focused && styles.inputFocused]}>
          <Ionicons name="location-outline" size={18} color={COLORS.textMuted} accessible={false} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Enter address or ZIP"
            placeholderTextColor={COLORS.textMuted}
            accessibilityLabel="School address or ZIP code"
            accessibilityHint="Enter a school address or five-digit ZIP code, then choose Find"
            editable={!busy}
            returnKeyType="search"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={findQuery}
          />
        </View>
        <TouchableOpacity
          style={[styles.findBtn, (!query.trim() || busy) && styles.disabled]}
          onPress={findQuery}
          disabled={!query.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Finding your location' : 'Find location'}
          accessibilityState={{ disabled: !query.trim() || busy, busy }}
        >
          {busy ? <ActivityIndicator color={COLORS.onDark} size="small" /> : <Text style={styles.findText}>Find</Text>}
        </TouchableOpacity>
      </View>
      {!denied && (
        <TouchableOpacity
          style={[styles.locationBtn, busy && styles.disabled]}
          onPress={useMyLocation}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
        >
          <Ionicons name="navigate-outline" size={16} color={COLORS.softGreen} accessible={false} />
          <Text style={styles.locationText}>Use my location</Text>
        </TouchableOpacity>
      )}
      {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      <Text style={styles.note}>Your location is rounded to about 1 km and never saved.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  label: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  found: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  foundText: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },
  row: { flexDirection: 'row', gap: 8 },
  inputWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 13, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12 },
  inputFocused: { borderColor: COLORS.softGreen },
  input: {
    flex: 1, minWidth: 0, color: COLORS.textBody, paddingVertical: 13, paddingRight: 10,
    fontSize: TYPE.body, fontFamily: FONTS.body, minHeight: 48,
  },
  findBtn: { backgroundColor: COLORS.darkGreen, borderRadius: 12, paddingHorizontal: 21, minWidth: 76, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  findText: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.onDark },
  locationBtn: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  locationText: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },
  disabled: { opacity: 0.45 },
  error: { fontSize: TYPE.link, fontFamily: FONTS.body, color: COLORS.error, lineHeight: LINE.link },
  note: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: LINE.caption },
});
