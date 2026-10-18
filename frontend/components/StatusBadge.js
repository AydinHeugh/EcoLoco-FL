import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_COLORS, FONTS } from '../theme';

export default function StatusBadge({ status, label }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  text: { fontSize: 12, fontFamily: FONTS.body },
});
