import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import PhotoSlot from './PhotoSlot';
import { COLORS, FONTS, TYPE, LINE } from '../theme';

const LOGO = require('../../assets/EcoLoco_logo.png');

export default function ScreenHeader({ photo, photoLabel, title, subtitle, right }) {
  return (
    <View style={styles.wrap}>
      <PhotoSlot source={photo} label={photoLabel} style={StyleSheet.absoluteFillObject} />
      <View style={styles.scrim} />
      <View style={styles.top}>
        <View style={styles.brand}>
          <Image source={LOGO} style={styles.logo} />
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
  wrap: { minHeight: 230, justifyContent: 'space-between', overflow: 'hidden', backgroundColor: COLORS.darkGreen },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.scrim },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 48 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 30, height: 30, resizeMode: 'contain', borderRadius: 6 },
  wordmark: { fontSize: TYPE.lead, fontFamily: FONTS.heading, color: COLORS.onDark },
  bottom: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 22, gap: 6 },
  title: { fontSize: TYPE.h1, lineHeight: LINE.h1, fontFamily: FONTS.headingBlack, color: COLORS.onDark },
  subtitle: { fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.body, color: COLORS.onDarkMuted, maxWidth: 520 },
});
