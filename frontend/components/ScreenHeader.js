import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { COLORS, FONTS, TYPE } from '../theme';

const LOGO = require('../../assets/EcoLoco_logo.png');

export default function ScreenHeader({ title, subtitle, right }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View style={styles.brand}>
          <Image source={LOGO} style={styles.logo} accessibilityLabel="EcoLoco" />
          <Text style={styles.wordmark}>EcoLoco</Text>
        </View>
        {right}
      </View>
      <View style={styles.bottom}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.cream },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 24 : 48, paddingBottom: 18, borderBottomWidth: 1, borderColor: COLORS.border },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 35, height: 35, resizeMode: 'contain' },
  wordmark: { fontSize: TYPE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  bottom: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 8, gap: 10 },
  title: { fontSize: TYPE.pageTitle, lineHeight: 40, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  subtitle: { fontSize: TYPE.link, lineHeight: 23, fontFamily: FONTS.body, color: COLORS.textMuted, maxWidth: 560 },
});
