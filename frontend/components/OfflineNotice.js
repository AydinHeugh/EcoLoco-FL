import React, { useSyncExternalStore } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, STATUS_COLORS, FONTS, TYPE } from '../theme';

let offline = false;
const listeners = new Set();

export function reportAi(unavailable) {
  if (typeof unavailable !== 'boolean' || unavailable === offline) return;
  offline = unavailable;
  listeners.forEach(listener => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export default function OfflineNotice() {
  const isOffline = useSyncExternalStore(subscribe, () => offline);
  if (!isOffline) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>Extra descriptions are offline. Plant names and Florida status still work.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20, marginVertical: 8, padding: 10, borderRadius: 8,
    backgroundColor: STATUS_COLORS['non-native'].bg, borderWidth: 1, borderColor: COLORS.amber,
  },
  text: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, textAlign: 'center' },
});
