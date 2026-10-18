import React from 'react';
import { Text, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { COLORS, FONTS, TYPE } from '../theme';

export default function SourceLine({ source, onDark = false }) {
  if (!source?.name) return null;
  const tone = onDark && styles.onDark;
  if (!source.url) return <Text style={[styles.text, tone]}>Source: {source.name}</Text>;
  return (
    <Text style={[styles.text, styles.link, tone]} accessibilityRole="link" onPress={() => Linking.openURL(source.url).catch(() => {})}>
      Source: {source.name}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: TYPE.link, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 2 },
  link: { textDecorationLine: 'underline' },
  onDark: { color: COLORS.onDarkMuted },
});
