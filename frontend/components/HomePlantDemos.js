import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HOME_PLANTS } from '../homeMedia';
import { COLORS, STATUS_COLORS, FONTS, TYPE } from '../theme';

const HIDDEN = {
  'aria-hidden': true,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
};
const SCAN_PLANTS = [HOME_PLANTS.beautyberry, HOME_PLANTS.porterweed, HOME_PLANTS.creepingOxeye];
const statusLabel = status => status === 'native' ? 'Native' : 'Invasive';

function Status({ status, full = false }) {
  const color = STATUS_COLORS[status];
  return (
    <View style={[styles.status, { backgroundColor: color.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: color.color }]} />
      <Text style={[styles.statusText, { color: color.color }]}>
        {full && status === 'native' ? 'Native to Florida' : statusLabel(status)}
      </Text>
    </View>
  );
}

export function EcoScanDemo() {
  const nativeCount = SCAN_PLANTS.filter(plant => plant.status === 'native').length;
  const invasiveCount = SCAN_PLANTS.filter(plant => plant.status === 'invasive').length;
  const nativePercent = Math.round(nativeCount / SCAN_PLANTS.length * 100);
  return (
    <View style={styles.scan} accessible accessibilityRole="image"
      accessibilityLabel={`EcoScan preview with ${SCAN_PLANTS.length} plants: ${SCAN_PLANTS.map(plant => `${plant.commonName}, ${statusLabel(plant.status).toLowerCase()}`).join('; ')}. ${nativePercent} percent native.`}>
      <View style={styles.scanContent} {...HIDDEN}>
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Ionicons name="scan-outline" size={17} color={COLORS.softGreen} accessible={false} />
            <Text style={styles.eyebrow}>EcoScan</Text>
          </View>
          <Text style={styles.muted}>{SCAN_PLANTS.length} plants</Text>
        </View>
        <View style={styles.scanRows}>
          {SCAN_PLANTS.map(plant => (
            <View key={plant.scientificName} style={styles.scanRow}>
              <Image source={plant.image} style={styles.scanPhoto} resizeMode="cover" accessible={false} />
              <Text style={styles.scanName}>{plant.commonName}</Text>
              <Status status={plant.status} />
            </View>
          ))}
        </View>
        <View style={styles.scanSummary}>
          <View style={styles.header}>
            <Text style={styles.summaryText}>{nativeCount} native · {invasiveCount} invasive</Text>
            <Text style={styles.percent}>{nativePercent}% native</Text>
          </View>
          <View style={styles.progress}>
            <View style={[styles.progressNative, { flex: nativeCount }]} />
            <View style={[styles.progressInvasive, { flex: invasiveCount }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function RealIdentifyDemo() {
  const plant = HOME_PLANTS.beautyberry;
  return (
    <View style={styles.identify} accessible accessibilityRole="image"
      accessibilityLabel={`Plant identification preview: ${plant.commonName}, ${plant.scientificName}. Native to Florida. Source: ${plant.statusSource}.`}>
      <View style={styles.identifyContent} {...HIDDEN}>
        <View style={styles.identifyPhotoFrame}>
          <Image source={plant.image} style={styles.identifyPhoto} resizeMode="cover" accessible={false} />
        </View>
        <View style={styles.resultPanel}>
          <Text style={styles.resultName}>{plant.commonName}</Text>
          <Text style={styles.scientificName}>{plant.scientificName}</Text>
          <View style={styles.resultMeta}>
            <Status status={plant.status} full />
            <Text style={styles.resultSource}>Source: {plant.statusSource}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function NativePlantsDemo() {
  return (
    <Image source={HOME_PLANTS.milkweed.image} style={styles.fullPhoto} resizeMode="cover"
      accessibilityLabel="Pink swamp milkweed flowers against green foliage" />
  );
}

const styles = StyleSheet.create({
  scan: { flex: 1, backgroundColor: COLORS.cardBg, padding: 14 },
  scanContent: { flex: 1, justifyContent: 'space-between', gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontFamily: FONTS.bodyBold, fontSize: TYPE.note, lineHeight: 20, color: COLORS.darkGreen },
  muted: { fontFamily: FONTS.body, fontSize: TYPE.caption, lineHeight: 18, color: COLORS.textMuted },
  scanRows: { gap: 6 },
  scanRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
  scanPhoto: { width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.photoBg },
  scanName: { flex: 1, minWidth: 0, fontFamily: FONTS.bodyBold, fontSize: TYPE.caption, lineHeight: 16, color: COLORS.textBody },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  statusText: { fontFamily: FONTS.bodyBold, fontSize: TYPE.caption, lineHeight: 16 },
  scanSummary: { gap: 6 },
  summaryText: { fontFamily: FONTS.body, fontSize: TYPE.caption, lineHeight: 18, color: COLORS.textMuted },
  percent: { fontFamily: FONTS.bodyBold, fontSize: TYPE.caption, lineHeight: 18, color: COLORS.darkGreen },
  progress: { height: 5, flexDirection: 'row', gap: 3, overflow: 'hidden', borderRadius: 3 },
  progressNative: { backgroundColor: STATUS_COLORS.native.color, borderRadius: 3 },
  progressInvasive: { backgroundColor: STATUS_COLORS.invasive.color, borderRadius: 3 },

  identify: { flex: 1, backgroundColor: COLORS.cardBg },
  identifyContent: { flex: 1 },
  identifyPhotoFrame: { height: 116, overflow: 'hidden', backgroundColor: COLORS.photoBg },
  identifyPhoto: { width: '100%', height: '100%' },
  resultPanel: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', gap: 2 },
  resultName: { fontFamily: FONTS.heading, fontSize: TYPE.lead, lineHeight: 22, color: COLORS.darkGreen },
  scientificName: { fontFamily: FONTS.accentItalic, fontSize: TYPE.caption, lineHeight: 18, color: COLORS.textMuted },
  resultMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 7 },
  resultSource: { flexShrink: 1, fontFamily: FONTS.body, fontSize: TYPE.caption, lineHeight: 17, color: COLORS.textMuted, textAlign: 'right' },

  fullPhoto: { flex: 1, width: '100%', height: '100%', backgroundColor: COLORS.photoBg },
});
