import React, { useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import Ionicons from '@expo/vector-icons/Ionicons'
import { COLORS, FONTS, FONT_ASSETS, TYPE } from '../theme'
import SourceLine from '../components/SourceLine'
import CountUp, { useCountUp } from '../components/CountUp'
import Reveal, { RevealProvider, useRevealScroll, useInView } from '../components/Reveal'
import RotatingLine from '../components/RotatingLine'
import PressScale from '../components/PressScale'
import { LetterDemo, IdentifyDemo } from '../components/HomeDemos'
import { COUNT_STAGGER, FOCUS_MS, useReduceMotion } from '../motion'
import { PHOTOS } from '../photos'

const LOGO = require('../../assets/EcoLoco_logo.png')
const IMG_SCANNING = require('../../assets/EcoLoco_Scanning_Plant.png')
const OAK_KINDS = 395
export const SLOGAN = 'Help Florida wildlife, one plant at a time'

const CATCHPHRASES = [
  'Find the plants hurting your campus.',
  "Know what's growing at your school.",
  'Swap invasives for Florida natives.',
  'Turn your scan into a plan.',
  'Get a letter draft you can edit.',
  'Every answer comes with a source.',
]

const SOURCES = [
  { count: '179', label: "invasive plants on Florida's official 2026 list (FISC)" },
  { count: '5,322', label: 'plants recorded in Florida by USDA PLANTS' },
  { count: '30', label: 'plants we recommend, each checked in the USF Atlas' },
]

function SectionLink({ label, onPress, onDark }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.linkBtn} accessibilityRole="button">
      <Text style={[styles.link, onDark && styles.linkOnDark]}>{label}</Text>
      <Ionicons name="arrow-forward" size={17} color={onDark ? COLORS.onDark : COLORS.darkGreen} accessible={false} />
    </TouchableOpacity>
  )
}

function Section({ children, style, reduceMotion }) {
  return <Reveal duration={reduceMotion ? 0 : FOCUS_MS} distance={12} style={style}>{children}</Reveal>
}

function OakFact() {
  const ref = useRef(null)
  const kinds = useCountUp(OAK_KINDS, useInView(ref, 120))
  return (
    <View ref={ref} collapsable={false} style={styles.oak}
      accessible accessibilityLabel={`Oaks feed ${OAK_KINDS} kinds of caterpillars in South Florida. Those caterpillars feed the birds that live here.`}>
      <Text style={styles.oakNumber}>{kinds}</Text>
      <Text style={styles.oakText}>kinds of caterpillars feed on oaks in South Florida. Those caterpillars feed the birds that live here.</Text>
      <SourceLine source={{ name: 'National Wildlife Federation', url: 'https://www.nwf.org/-/media/Documents/PDFs/Garden-for-Wildlife/Keystone-Plants/NWF-GFW-keystone-plant-list-ecoregion-15-tropical-wet-forests.pdf' }} />
    </View>
  )
}

export default function HomeScreen(props) {
  return <RevealProvider><Home {...props} /></RevealProvider>
}

function Home({ navigation }) {
  const { width } = useWindowDimensions()
  const { top } = useSafeAreaInsets()
  const wide = width >= 640
  const reduceMotion = useReduceMotion()
  const onScroll = useRevealScroll()
  const [fontsLoaded] = useFonts(FONT_ASSETS)
  if (!fontsLoaded) return <View style={styles.container} />
  const go = screen => () => navigation?.navigate(screen)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={64}>
      <View style={[styles.inner, { width: Math.min(width, 960) }]}>
        <View style={[styles.brand, { paddingTop: Math.max(top + 12, 22) }]}>
          <Image source={LOGO} style={styles.logo} accessibilityLabel="EcoLoco" />
          <Text style={styles.wordmark}>EcoLoco</Text>
        </View>

        <View style={[styles.hero, wide && styles.heroWide]}>
          <RotatingLine lines={CATCHPHRASES} style={[styles.headline, wide && styles.headlineWide]} />
          <Text style={styles.heroBody}>Find out which plants on your campus help Florida wildlife, and which ones hurt it.</Text>
          <View style={[styles.heroActions, wide && styles.heroActionsWide]}>
            <PressScale onPress={go('EcoScan')} style={styles.primaryButton}>
              <Ionicons name="scan-outline" size={20} color={COLORS.onDark} accessible={false} />
              <Text style={styles.primaryText}>Start a campus scan</Text>
            </PressScale>
            <PressScale onPress={go('Camera')} style={styles.secondaryButton}>
              <Ionicons name="leaf-outline" size={19} color={COLORS.darkGreen} accessible={false} />
              <Text style={styles.secondaryText}>Identify one plant</Text>
            </PressScale>
          </View>
        </View>

        <Section reduceMotion={reduceMotion} style={[styles.block, wide && styles.splitWide]}>
          <View style={[styles.photoFrame, wide && styles.halfWide]}>
            <Image source={PHOTOS.home} style={styles.fill} resizeMode="cover" accessibilityLabel="A school garden full of native plants" />
          </View>
          <View style={[styles.copy, wide && styles.halfWide]}>
            <Text style={styles.heading} accessibilityRole="header">Scan your campus</Text>
            <Text style={styles.body}>Add each plant around your school, give it up to 5 photos, then scan them all at once. See what share are native, which invasive plants to remove, and what to plant instead.</Text>
            <SectionLink label="Start a campus scan" onPress={go('EcoScan')} />
          </View>
        </Section>

        <Section reduceMotion={reduceMotion} style={styles.letterBlock}>
          <View style={styles.copy}>
            <Text style={styles.heading} accessibilityRole="header">A letter draft for your principal</Text>
            <Text style={styles.body}>Your scan becomes a draft letter: what to remove safely and which natives to plant, each with a source. Change anything you like, or don't use it at all.</Text>
          </View>
          <View style={styles.letterPaper}><LetterDemo /></View>
          <SectionLink label="Make your plan" onPress={go('EcoScan')} />
        </Section>

        <Section reduceMotion={reduceMotion} style={[styles.block, styles.row]}>
          <View style={styles.thumb}><IdentifyDemo image={IMG_SCANNING} /></View>
          <View style={[styles.copy, styles.rowCopy]}>
            <Text style={styles.headingSmall} accessibilityRole="header">Identify a plant</Text>
            <Text style={styles.body}>Add a photo or choose a plant by name. See if it's native, non-native, or invasive, and where that answer comes from.</Text>
            <SectionLink label="Identify a plant" onPress={go('Camera')} />
          </View>
        </Section>

        <Section reduceMotion={reduceMotion} style={styles.bleedBlock}>
          <View style={styles.bleedPhoto}>
            <Image source={PHOTOS.homeNatives} style={styles.fill} resizeMode="cover" accessibilityLabel="A garden path lined with native plants" />
          </View>
          <View style={[styles.copy, styles.bleedCopy]}>
            <Text style={styles.heading} accessibilityRole="header">Plant Florida natives</Text>
            <Text style={styles.body}>See native plants checked for Palm Beach County that fit your space, with the wildlife each one supports and what to ask for at the nursery.</Text>
            <SectionLink label="Find native plants" onPress={go('Recommend')} />
          </View>
        </Section>

        <Section reduceMotion={reduceMotion} style={styles.block}>
          <OakFact />
        </Section>

        <View style={styles.know}>
          <Text style={styles.knowHeading} accessibilityRole="header">Where our answers come from</Text>
          <Text style={styles.knowBody}>Every answer comes from Florida's official invasive list, USDA, and the USF Atlas. Our team checked every plant we recommend.</Text>
          <View style={[styles.sources, wide && styles.sourcesWide]} accessible accessibilityLabel={SOURCES.map(s => `${s.count} ${s.label}`).join('. ')}>
            {SOURCES.map((source, index) => (
              <View key={source.count} style={[styles.sourceItem, wide && styles.sourceItemWide]}>
                <CountUp value={source.count} style={styles.sourceCount} delay={index * COUNT_STAGGER} />
                <Text style={styles.sourceLabel}>{source.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{SLOGAN}</Text>
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
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: GUTTER, paddingBottom: 8 },
  logo: { width: 34, height: 34, resizeMode: 'contain' },
  wordmark: { fontSize: TYPE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen },

  hero: { paddingHorizontal: GUTTER, paddingTop: 28, paddingBottom: 36, gap: 14 },
  heroWide: { paddingTop: 48, paddingBottom: 56, maxWidth: 720 },
  headline: { fontSize: TYPE.h1, lineHeight: 42, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  headlineWide: { fontSize: TYPE.displayLarge, lineHeight: 56 },
  heroBody: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONTS.body, color: COLORS.textBody, maxWidth: 520 },
  heroActions: { gap: 10, marginTop: 8 },
  heroActionsWide: { flexDirection: 'row' },
  primaryButton: { backgroundColor: COLORS.darkGreen, minHeight: 52, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FONTS.bodyBold, fontSize: TYPE.body, color: COLORS.onDark },
  secondaryButton: { backgroundColor: COLORS.cardBg, minHeight: 52, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.shadow, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  secondaryText: { fontFamily: FONTS.bodyBold, fontSize: TYPE.body, color: COLORS.darkGreen },

  block: { paddingHorizontal: GUTTER, paddingVertical: 24, gap: 18 },
  splitWide: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  halfWide: { flex: 1 },
  photoFrame: { width: '100%', aspectRatio: 1.5, borderRadius: 22, overflow: 'hidden', backgroundColor: COLORS.lightBg },
  copy: { gap: 8 },
  heading: { fontFamily: FONTS.heading, fontSize: TYPE.h2, lineHeight: 34, color: COLORS.darkGreen },
  headingSmall: { fontFamily: FONTS.heading, fontSize: TYPE.h3, lineHeight: 28, color: COLORS.darkGreen },
  body: { fontFamily: FONTS.body, fontSize: TYPE.body, lineHeight: 24, color: COLORS.textBody },
  linkBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, minHeight: 44 },
  link: { fontFamily: FONTS.bodyBold, fontSize: TYPE.link, color: COLORS.darkGreen, textDecorationLine: 'underline' },
  linkOnDark: { color: COLORS.onDark },

  letterBlock: { marginHorizontal: GUTTER, marginVertical: 16, padding: 20, borderRadius: 24, backgroundColor: COLORS.lightBg, gap: 16 },
  letterPaper: { borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.cardBg, shadowColor: COLORS.shadow, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2, transform: [{ rotate: '-1deg' }] },

  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  thumb: { width: 120, aspectRatio: 0.8, borderRadius: 18, overflow: 'hidden', backgroundColor: COLORS.lightBg },
  rowCopy: { flex: 1, minWidth: 0 },

  bleedBlock: { paddingVertical: 24, gap: 18 },
  bleedCopy: { paddingHorizontal: GUTTER },
  bleedPhoto: { width: '100%', aspectRatio: 1.8, backgroundColor: COLORS.lightBg },

  oak: { gap: 6 },
  oakNumber: { fontFamily: FONTS.headingLight, fontSize: TYPE.stat, lineHeight: 80, color: COLORS.softGreen, fontVariant: ['tabular-nums'] },
  oakText: { fontFamily: FONTS.heading, fontSize: TYPE.h3, lineHeight: 30, color: COLORS.darkGreen, maxWidth: 560 },

  know: { marginHorizontal: GUTTER, marginTop: 20, padding: 22, borderRadius: 24, backgroundColor: COLORS.darkGreen, gap: 10 },
  knowHeading: { fontFamily: FONTS.heading, fontSize: TYPE.h3, lineHeight: 30, color: COLORS.onDark },
  knowBody: { fontFamily: FONTS.body, fontSize: TYPE.link, lineHeight: 23, color: COLORS.onDarkMuted },
  sources: { gap: 14, marginTop: 10 },
  sourcesWide: { flexDirection: 'row', gap: 24 },
  sourceItem: { flexDirection: 'row', alignItems: 'baseline', gap: 14 },
  sourceItemWide: { flex: 1, flexDirection: 'column', gap: 4 },
  sourceCount: { fontFamily: FONTS.heading, fontSize: TYPE.h1, lineHeight: 42, color: COLORS.onDark, minWidth: 92, fontVariant: ['tabular-nums'] },
  sourceLabel: { fontFamily: FONTS.body, fontSize: TYPE.link, lineHeight: 21, color: COLORS.onDarkMuted, flexShrink: 1 },

  footer: { alignItems: 'center', paddingHorizontal: GUTTER, paddingVertical: 32, gap: 10 },
  footerText: { fontFamily: FONTS.bodyBold, fontSize: TYPE.body, color: COLORS.darkGreen, textAlign: 'center' },
})
