import React, { useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Image, Linking, Platform, ScrollView, useWindowDimensions } from 'react-native'
import { useIsFocused } from '@react-navigation/native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { COLORS, FONTS, FONT_ASSETS, TYPE } from '../theme'
import Reveal, { RevealProvider, useRevealScroll } from '../components/Reveal'
import RotatingLine from '../components/RotatingLine'
import PressScale from '../components/PressScale'
import { LetterDemo } from '../components/HomeDemos'
import { EcoScanDemo, RealIdentifyDemo, NativePlantsDemo } from '../components/HomePlantDemos'
import HomePhotoCredits from '../components/HomePhotoCredits'
import { FOCUS_MS, useReduceMotion } from '../motion'
import { HOME_HERO } from '../homeMedia'

const LOGO = require('../../assets/EcoLoco_logo.png')
const CREDIT = 'Congressional App Challenge: Aydin, Andrew, Kian'
const OAK_KINDS = 395
const NWF_SOURCE = 'https://www.nwf.org/-/media/Documents/PDFs/Garden-for-Wildlife/Keystone-Plants/NWF-GFW-keystone-plant-list-ecoregion-15-tropical-wet-forests.pdf'

const CATCHPHRASES = [
  'Harming Your Campus',
  'Helping Your Ecosystem',
  'Feeding The Birds',
  'Invading Your Environment',
  'Growing Around You',
  'Native To Florida',
  'Worth Planting Next',
]

const FEATURES = [
  {
    id: 'scan',
    title: 'Scan your campus',
    description: 'Spot native and invasive plants, then see what to plant instead.',
    action: 'Start a campus scan',
    screen: 'EcoScan',
  },
  {
    id: 'letter',
    title: 'Draft a letter',
    description: 'Turn your campus scan into an editable letter for your principal.',
    action: 'Make your plan',
    screen: 'EcoScan',
  },
  {
    id: 'identify',
    title: 'Identify a plant',
    description: 'Use a photo or plant name to check its Florida status.',
    action: 'Identify a plant',
    screen: 'Camera',
  },
  {
    id: 'natives',
    title: 'Plant Florida natives',
    description: 'Find plants checked for Palm Beach County that fit your space.',
    action: 'Find native plants',
    screen: 'Recommend',
  },
]

const SOURCES = [
  { name: 'FISC', count: '179', metric: 'invasive plants', detail: 'Florida’s official 2026 list', url: 'https://www.floridainvasives.org/wp-content/uploads/2026/07/FISC-2026-Plant-List-Cat-I-II_April2026.pdf' },
  { name: 'USDA', count: '5,322', metric: 'plant records', detail: 'Plants recorded in Florida', url: 'https://plants.usda.gov/' },
  { name: 'USF Atlas', count: '30', metric: 'native plants', detail: 'Our recommendations, each checked in the Atlas', url: 'https://florida.plantatlas.usf.edu/' },
]

function ExternalLink({ url, label, style, children }) {
  const action = Platform.OS === 'web'
    ? { href: url, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } }
    : { onPress: () => Linking.openURL(url).catch(() => {}) }
  return (
    <Pressable {...action} accessibilityRole="link" accessibilityLabel={`${label} (opens in a new tab or browser)`}
      style={({ hovered, pressed }) => [style, (hovered || pressed) && styles.sourceActive]}>
      {children}
    </Pressable>
  )
}

function FeatureRow({ feature, wide, previewWidth, onPress, reduceMotion }) {
  return (
    <Reveal duration={reduceMotion ? 0 : FOCUS_MS} distance={12} style={[styles.featureRow, wide && styles.featureRowWide]}>
      <View style={[styles.featurePreview, { width: previewWidth }]}>
        {feature.id === 'scan' ? <EcoScanDemo />
          : feature.id === 'letter' ? <View style={styles.letterPreview}><View style={styles.letterPaper}><LetterDemo /></View></View>
            : feature.id === 'identify' ? <RealIdentifyDemo /> : <NativePlantsDemo />}
      </View>
      <View style={[styles.featureContent, wide && styles.featureContentWide]}>
        <Text style={styles.featureHeading} accessibilityRole="header">{feature.title}</Text>
        <Text style={styles.featureBody}>{feature.description}</Text>
        <TouchableOpacity onPress={onPress} style={styles.featureAction} accessibilityRole="button" accessibilityLabel={feature.action}>
          <Text style={styles.featureActionText}>{feature.action}</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.darkGreen} accessible={false} />
        </TouchableOpacity>
      </View>
    </Reveal>
  )
}

function OakFact() {
  return (
    <View style={styles.oak}>
      <View style={styles.oakIcon} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="leaf-outline" size={22} color={COLORS.softGreen} accessible={false} />
      </View>
      <View style={styles.oakCopy}>
        <Text style={styles.oakText}>
          <Text style={styles.oakEmphasis}>{OAK_KINDS} kinds of caterpillars</Text> feed on oaks in South Florida.
        </Text>
        <Text style={styles.oakDetail}>Those caterpillars feed the birds that live here.</Text>
        <ExternalLink url={NWF_SOURCE} label="Source: National Wildlife Federation" style={styles.oakSource}>
          <Text style={styles.oakSourceText}>National Wildlife Federation</Text>
          <MaterialCommunityIcons name="arrow-top-right" size={14} color={COLORS.textMuted} accessible={false} />
        </ExternalLink>
      </View>
    </View>
  )
}

function Sources({ wide }) {
  return (
    <View style={styles.sourcesSection}>
      <Text style={styles.sourcesHeading} accessibilityRole="header">Our sources</Text>
      <View style={[styles.sources, wide && styles.sourcesWide]}>
        {SOURCES.map((source, index) => (
          <ExternalLink key={source.name} url={source.url} label={`${source.name}: ${source.count} ${source.metric}. ${source.detail}.`}
            style={[styles.sourceItem, wide && styles.sourceItemWide,
              index > 0 && (wide ? styles.sourceDividerWide : styles.sourceDivider),
              wide && index === 0 && styles.sourceFirst,
              wide && index === SOURCES.length - 1 && styles.sourceLast]}>
            <View style={styles.sourceCopy}>
              <View style={styles.sourceHeader}>
                <Text style={styles.sourceName}>{source.name}</Text>
                <MaterialCommunityIcons name="arrow-top-right" size={18} color={COLORS.softGreen} accessible={false} />
              </View>
              <Text style={styles.sourceMetric}>
                <Text style={styles.sourceCount}>{source.count}</Text> {source.metric}
              </Text>
              <Text style={styles.sourceDetail}>{source.detail}</Text>
            </View>
          </ExternalLink>
        ))}
      </View>
      <OakFact />
    </View>
  )
}

export default function HomeScreen(props) {
  return <RevealProvider><Home {...props} /></RevealProvider>
}

function Home({ navigation }) {
  const { width, height } = useWindowDimensions()
  const { top } = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const viewportHeight = height - tabBarHeight
  const wide = width >= 640
  const desktop = width >= 1000
  const compactHero = viewportHeight < 740
  const heroPhotoHeight = Math.min((width - GUTTER * 2) / 1.5, 320, Math.max(140, viewportHeight * 0.26))
  const featureWidth = Math.min(width, 960) - GUTTER * 2
  const previewWidth = wide ? Math.min(320, featureWidth * 0.42) : featureWidth
  const focused = useIsFocused()
  const [heroVisible, setHeroVisible] = useState(true)
  const scrollRef = useRef(null)
  const heroBottom = useRef(Infinity)
  const detailsTop = useRef(0)
  const reduceMotion = useReduceMotion()
  const onScroll = useRevealScroll()
  const [fontsLoaded] = useFonts(FONT_ASSETS)
  if (!fontsLoaded) return <View style={styles.container} />
  const go = screen => () => navigation?.navigate(screen)

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={event => {
      onScroll?.()
      setHeroVisible(event.nativeEvent.contentOffset.y < heroBottom.current)
    }} scrollEventThrottle={64}>
      <View style={[styles.inner, { width: Math.min(width, 1120) }]}>
        <View style={[styles.landing, { minHeight: viewportHeight }]} onLayout={event => {
          heroBottom.current = event.nativeEvent.layout.y + event.nativeEvent.layout.height
        }}>
          <View style={[styles.brand, { paddingTop: Math.max(top + 12, 22) }]}>
            <Image source={LOGO} style={styles.logo} accessibilityLabel="EcoLoco" />
            <Text style={styles.wordmark}>EcoLoco</Text>
          </View>

          <View style={[styles.hero, wide && styles.heroWide, compactHero && styles.heroCompact, desktop && styles.heroDesktop]}>
            <View style={[styles.heroCopy, compactHero && styles.heroCopyCompact, desktop && styles.heroCopyDesktop]}>
              <RotatingLine prefix="Find out what’s" lines={CATCHPHRASES}
                style={[styles.headline, width < 380 && styles.headlineCompact, wide && styles.headlineWide]}
                enabled={focused && heroVisible}
                accessibilityLabel="Find out what's growing on your campus, which plants help Florida wildlife, and which invasive plants cause harm." />
              <Text style={styles.heroBody}>Scan your campus for native and invasive plants.</Text>
              <View style={[styles.heroActions, wide && styles.heroActionsWide]}>
                <PressScale onPress={go('EcoScan')} style={styles.primaryButton} accessibilityLabel="Start a campus scan">
                  <Ionicons name="scan-outline" size={20} color={COLORS.onDark} accessible={false} />
                  <Text style={styles.primaryText}>Start a campus scan</Text>
                  <Ionicons name="arrow-forward" size={17} color={COLORS.onDark} accessible={false} />
                </PressScale>
                <PressScale onPress={go('Camera')} style={styles.secondaryButton} accessibilityLabel="Identify one plant">
                  <Ionicons name="leaf-outline" size={19} color={COLORS.darkGreen} accessible={false} />
                  <Text style={styles.secondaryText}>Identify one plant</Text>
                </PressScale>
              </View>
            </View>
            <View style={[styles.heroVisual, desktop && styles.heroVisualDesktop]}>
              <View style={[styles.heroPhoto, desktop ? styles.heroPhotoDesktop : { height: heroPhotoHeight }]}>
                <Image source={HOME_HERO.image} style={styles.fill} resizeMode="cover" accessibilityLabel={HOME_HERO.alt} />
              </View>
            </View>
          </View>

          <View style={styles.scrollCue}>
            <TouchableOpacity style={styles.scrollCueButton} accessibilityRole="button" accessibilityLabel="Scroll to features"
              onPress={() => scrollRef.current?.scrollTo({ y: detailsTop.current, animated: !reduceMotion })}>
              <Ionicons name="chevron-down" size={24} color={COLORS.textMuted} accessible={false} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.details} onLayout={event => { detailsTop.current = event.nativeEvent.layout.y }}>
          <View style={styles.featureList}>
            {FEATURES.map(feature => (
              <FeatureRow key={feature.id} feature={feature} wide={wide} previewWidth={previewWidth}
                onPress={go(feature.screen)} reduceMotion={reduceMotion} />
            ))}
          </View>

          <Sources wide={wide} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>{CREDIT}</Text>
            <HomePhotoCredits />
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const GUTTER = 20

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  scrollContent: { alignItems: 'center' },
  inner: { alignSelf: 'center' },
  details: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: GUTTER, paddingBottom: 8 },
  logo: { width: 34, height: 34, resizeMode: 'contain' },
  wordmark: { fontSize: TYPE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen },

  landing: { width: '100%' },
  hero: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: GUTTER, paddingTop: 24, paddingBottom: 24, gap: 24 },
  heroWide: { paddingTop: 32, paddingBottom: 40 },
  heroCompact: { paddingTop: 12, paddingBottom: 12, gap: 18 },
  heroDesktop: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  heroCopy: { gap: 18 },
  heroCopyCompact: { gap: 14 },
  heroCopyDesktop: { flex: 1, minWidth: 0 },
  headline: { fontSize: TYPE.h1, lineHeight: 42, letterSpacing: -0.8, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  headlineCompact: { fontSize: TYPE.pageTitle, lineHeight: 40, letterSpacing: -0.7 },
  headlineWide: { fontSize: TYPE.displayLarge, lineHeight: 56, letterSpacing: -1.4 },
  heroBody: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONTS.body, color: COLORS.textMuted, maxWidth: 500 },
  heroActions: { gap: 12, marginTop: 2 },
  heroActionsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  heroVisual: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  heroVisualDesktop: { width: 370, maxWidth: '38%' },
  heroPhoto: { width: '100%', borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.photoBg },
  heroPhotoDesktop: { aspectRatio: 1 },
  scrollCue: { alignItems: 'center', paddingBottom: 12 },
  scrollCueButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  primaryButton: { backgroundColor: COLORS.darkGreen, minHeight: 52, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FONTS.bodyBold, fontSize: TYPE.body, color: COLORS.onDark },
  secondaryButton: { backgroundColor: COLORS.cardBg, minHeight: 52, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.shadow, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  secondaryText: { fontFamily: FONTS.bodyBold, fontSize: TYPE.body, color: COLORS.darkGreen },

  featureList: { paddingHorizontal: GUTTER, paddingBottom: 32 },
  featureRow: { gap: 20, paddingVertical: 28 },
  featureRowWide: { flexDirection: 'row', alignItems: 'center', gap: 36 },
  featurePreview: { height: 220, borderRadius: 12, backgroundColor: COLORS.lightBg, overflow: 'hidden' },
  featureContent: { gap: 10 },
  featureContentWide: { flex: 1, minWidth: 0 },
  featureHeading: { fontFamily: FONTS.heading, fontSize: TYPE.h3, lineHeight: 28, color: COLORS.darkGreen },
  featureBody: { fontFamily: FONTS.body, fontSize: TYPE.body, lineHeight: 24, color: COLORS.textMuted, maxWidth: 480 },
  featureAction: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureActionText: { flexShrink: 1, fontFamily: FONTS.bodyBold, fontSize: TYPE.link, lineHeight: 22, color: COLORS.darkGreen, textDecorationLine: 'underline' },
  letterPreview: { flex: 1, padding: 12, alignItems: 'center', justifyContent: 'center' },
  letterPaper: { width: '100%', maxWidth: 340, borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.cardBg, shadowColor: COLORS.shadow, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },

  sourcesSection: { marginHorizontal: GUTTER, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 28, gap: 20 },
  sourcesHeading: { fontFamily: FONTS.bodyBold, fontSize: TYPE.body, lineHeight: 24, color: COLORS.textMuted },
  sources: { gap: 0 },
  sourcesWide: { flexDirection: 'row' },
  sourceItem: { paddingVertical: 16, minHeight: 104 },
  sourceItemWide: { flex: 1, minWidth: 0, paddingHorizontal: 24, paddingVertical: 4 },
  sourceFirst: { paddingLeft: 0 },
  sourceLast: { paddingRight: 0 },
  sourceDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  sourceDividerWide: { borderLeftWidth: 1, borderLeftColor: COLORS.border },
  sourceCopy: { gap: 6 },
  sourceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  sourceName: { fontFamily: FONTS.bodyBold, fontSize: TYPE.body, lineHeight: 22, color: COLORS.darkGreen },
  sourceMetric: { fontFamily: FONTS.body, fontSize: TYPE.body, lineHeight: 28, color: COLORS.darkGreen },
  sourceCount: { fontFamily: FONTS.bodyBold, fontSize: TYPE.h3, color: COLORS.darkGreen, fontVariant: ['tabular-nums'] },
  sourceDetail: { fontFamily: FONTS.body, fontSize: TYPE.caption, lineHeight: 20, color: COLORS.textMuted },
  sourceActive: { backgroundColor: COLORS.lightBg },
  oak: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: COLORS.lightBg, borderRadius: 12, padding: 20, marginTop: 4 },
  oakIcon: { paddingTop: 2 },
  oakCopy: { flex: 1, minWidth: 0, gap: 4 },
  oakText: { fontFamily: FONTS.body, fontSize: TYPE.body, lineHeight: 24, color: COLORS.darkGreen },
  oakEmphasis: { fontFamily: FONTS.bodyBold },
  oakDetail: { fontFamily: FONTS.body, fontSize: TYPE.note, lineHeight: 22, color: COLORS.textMuted },
  oakSource: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingVertical: 10, marginTop: 2, marginBottom: -10 },
  oakSourceText: { flexShrink: 1, fontFamily: FONTS.body, fontSize: TYPE.caption, lineHeight: 18, color: COLORS.textMuted, textDecorationLine: 'underline' },

  footer: { alignItems: 'center', paddingHorizontal: GUTTER, paddingTop: 28, paddingBottom: 32 },
  footerText: { fontFamily: FONTS.body, fontSize: TYPE.caption, lineHeight: 19, color: COLORS.textMuted, textAlign: 'center' },
})
