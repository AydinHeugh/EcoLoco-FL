import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { COLORS, FONTS } from '../theme';

export default function AtlasButton({ url }) {
  if (!url) return null;
  return (
    <TouchableOpacity
      style={styles.btn}
      accessibilityRole="link"
      onPress={() => WebBrowser.openBrowserAsync(url).catch(() => {})}
    >
      <Text style={styles.text}>See where it grows</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'flex-start', marginTop: 8, borderWidth: 1.5, borderColor: COLORS.softGreen,
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
  },
  text: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },
});
