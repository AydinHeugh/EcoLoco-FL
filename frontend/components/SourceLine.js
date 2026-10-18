import React from 'react';
import { Text, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { COLORS, FONTS } from '../theme';

export default function SourceLine({ source }) {
  if (!source?.name) return null;
  if (!source.url) return <Text style={styles.text}>Source: {source.name}</Text>;
  return (
    <Text style={[styles.text, styles.link]} accessibilityRole="link" onPress={() => Linking.openURL(source.url).catch(() => {})}>
      Source: {source.name}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 2 },
  link: { textDecorationLine: 'underline' },
});
