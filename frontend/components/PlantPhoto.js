import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS, FONTS, TYPE } from '../theme';

export function photoCredit(photo) {
  if (!photo?.credit) return null;
  const match = photo.credit.match(/^\(c\)\s*(.+?),\s*(?:some|no|all) rights reserved\s*\(([^)]+)\)/i);
  return match ? `Photo: ${match[1]}, ${match[2]}, via iNaturalist` : `Photo: ${photo.credit}, via iNaturalist`;
}

export function PhotoCredit({ photo, onDark = false }) {
  const credit = photoCredit(photo);
  if (!credit) return null;
  return <Text style={[styles.credit, onDark && styles.creditDark]} numberOfLines={2}>{credit}</Text>;
}

export default function PlantPhoto({ photo, size = 72, radius = 14, label, style }) {
  const box = { width: size, height: size, borderRadius: radius };
  if (!photo?.url) {
    return (
      <View style={[styles.empty, box, style]} accessibilityLabel={label}>
        <Text style={{ fontSize: size * 0.45 }} accessible={false}>🌱</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: photo.url }}
      style={[box, styles.image, style]}
      contentFit="cover"
      transition={250}
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  empty: { backgroundColor: COLORS.lightBg, alignItems: 'center', justifyContent: 'center' },
  image: { backgroundColor: COLORS.lightBg },
  credit: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted },
  creditDark: { color: COLORS.onDarkMuted },
});
