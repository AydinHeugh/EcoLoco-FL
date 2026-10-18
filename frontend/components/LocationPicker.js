import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { locate, userMessage } from '../services/geminiService';
import { COLORS, FONTS } from '../theme';

const round2 = n => Math.round(n * 100) / 100;

export default function LocationPicker({ place, onChange }) {
  const [query,   setQuery]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState(null);
  const [denied,  setDenied]  = useState(false);

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
      {place?.zip && <Text style={styles.found}>📍 ZIP {place.zip}</Text>}
      {!denied && (
        <TouchableOpacity style={[styles.btn, busy && styles.disabled]} onPress={useMyLocation} disabled={busy}>
          <Text style={styles.btnText}>Use my location</Text>
        </TouchableOpacity>
      )}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Or type your school's address or ZIP"
          placeholderTextColor={COLORS.textMuted}
          onSubmitEditing={() => query.trim() && find({ query: query.trim() })}
        />
        <TouchableOpacity
          style={[styles.findBtn, (!query.trim() || busy) && styles.disabled]}
          onPress={() => find({ query: query.trim() })}
          disabled={!query.trim() || busy}
        >
          {busy ? <ActivityIndicator color={COLORS.cream} size="small" /> : <Text style={styles.btnText}>Find</Text>}
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.note}>Your location is rounded to about 1 km and never saved.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  found: { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, textAlign: 'center' },
  btn: { backgroundColor: COLORS.darkGreen, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnText: { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.cream },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, minWidth: 0, backgroundColor: COLORS.white, color: COLORS.textBody, borderRadius: 10, padding: 12,
    fontSize: 14, fontFamily: FONTS.body, borderWidth: 1, borderColor: COLORS.border,
  },
  findBtn: { backgroundColor: COLORS.softGreen, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  error: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.error, textAlign: 'center' },
  note: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },
});
