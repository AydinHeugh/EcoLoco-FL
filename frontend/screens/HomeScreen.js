import React, { useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Platform, useWindowDimensions } from 'react-native'
import { useFonts } from 'expo-font'
import Ionicons from '@expo/vector-icons/Ionicons'
import { COLORS, FONTS, FONT_ASSETS, TYPE } from '../theme'
import SourceLine from '../components/SourceLine'
import CountUp, { useCountUp } from '../components/CountUp'
import Reveal, { RevealProvider, useRevealScroll, useInView } from '../components/Reveal'
import { LetterDemo } from '../components/HomeDemos'
import { COUNT_STAGGER, FOCUS_MS, useReduceMotion } from '../motion'

const LOGO = require('../../assets/EcoLoco_logo.png')
const IMG_SCANNING = require('../../assets/EcoLoco_Scanning_Plant.png')
const IMG_CAMPUS = require('../../assets/EcoLoco_ecosystem.png')
const IMG_GROW = require('../../assets/GrowWithConfidence_Ecoloco.png')
const IMG_POLLINATORS = require('../../assets/EcoLoco_support_polinators.png')
const OAK_KINDS = 395

const SOURCES = [
  { count: '179', label: "invasive plants on Florida's official 2026 list (FISC)" },
  { count: '5,322', label: 'plants recorded in Florida by USDA PLANTS' },
  { count: '30', label: 'plants we recommend, each checked in the USF Atlas' },
]

function SectionLink({ label, onPress }) {
  return <TouchableOpacity onPress={onPress} style={styles.linkBtn} accessibilityRole="button">
    <Text style={styles.featureLink}>{label}</Text>
    <Ionicons name="arrow-forward" size={17} color={COLORS.darkGreen} accessible={false} />
  </TouchableOpacity>
}

function Feature({ image, imageLabel, visual, heading, body, linkText, onLinkPress, reverse, wide, eyebrow, reduceMotion }) {
  const art = <View style={[styles.featureVisual, wide && styles.featureVisualWide]}>
    {visual || <Image source={image} style={[styles.featureImage, wide && styles.featureImageWide]} resizeMode="cover" accessibilityLabel={imageLabel} />}
  </View>
  const copy = <View style={styles.featureText}>
    <Text style={styles.eyebrow}>{eyebrow}</Text>
    <Text style={styles.featureHeading} accessibilityRole="header">{heading}</Text>
    <Text style={styles.featureBody}>{body}</Text>
    <SectionLink label={linkText} onPress={onLinkPress} />
  </View>
  return <Reveal duration={reduceMotion ? 0 : FOCUS_MS} distance={12} style={[styles.feature, wide && styles.featureWide]}>
    {wide && reverse ? <>{copy}{art}</> : <>{art}{copy}</>}
  </Reveal>
}

function OakFact() {
  const ref = useRef(null)
  const kinds = useCountUp(OAK_KINDS, useInView(ref, 120))
  const sentence = `Oaks feed ${OAK_KINDS} kinds of caterpillars in South Florida. Those caterpillars feed the birds that live here.`
  return <View ref={ref} collapsable={false}>
    <Text style={styles.whyBody} accessibilityLabel={sentence}>
      Oaks feed <Text style={styles.whyNumber}>{kinds}</Text> kinds of caterpillars in South Florida. Those caterpillars feed the birds that live here.
    </Text>
  </View>
}

export default function HomeScreen(props) {
  return <RevealProvider><Home {...props} /></RevealProvider>
}

function Home({ navigation }) {
  const { width } = useWindowDimensions()
  const wide = width >= 640
  const reduceMotion = useReduceMotion()
  const onScroll = useRevealScroll()
  const [fontsLoaded] = useFonts(FONT_ASSETS)
  if (!fontsLoaded) return <View style={styles.container} />

  return <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={64}>
    <View style={[styles.inner, { width: Math.min(width, 960) }]}>
      <View style={styles.brand}>
        <Image source={LOGO} style={styles.logo} accessibilityLabel="EcoLoco" />
        <Text style={styles.wordmark}>EcoLoco</Text>
        {wide && <Text style={styles.brandNote}>A little local knowledge. A greener campus.</Text>}
      </View>

      <View style={[styles.hero, wide && styles.heroWide]}>
        <Text style={styles.eyebrow}>ROOTED IN FLORIDA</Text>
        <Text style={[styles.headline, wide && styles.headlineWide]} accessibilityRole="header">Welcome to <Text style={styles.headlineItalic}>EcoLoco</Text></Text>
        <View style={styles.ornament} accessible={false}><View style={styles.ornamentLine} /><View style={styles.diamond} /><View style={styles.ornamentLine} /></View>
        <Text style={styles.tagline}>Get to know the plants around you.</Text>
        <Text style={styles.heroBody}>Find out which plants on your campus help Florida wildlife, and what to plant next.</Text>
        <View style={[styles.heroActions, wide && styles.heroActionsWide]}>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation?.navigate('EcoScan')} style={styles.primaryButton}>
            <Ionicons name="scan-outline" size={20} color={COLORS.onDark} accessible={false} />
            <Text style={styles.primaryText}>Start a campus scan</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation?.navigate('Camera')} style={styles.secondaryButton}>
            <Ionicons name="leaf-outline" size={19} color={COLORS.darkGreen} accessible={false} />
            <Text style={styles.secondaryText}>Identify one plant</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.features}>
        <Feature wide={wide} reduceMotion={reduceMotion} image={IMG_CAMPUS} imageLabel="A school garden full of native plants" eyebrow="EXPLORE YOUR SCHOOL" heading="Scan your campus" body="Add the plants around your school, with up to 5 photos of each. Scan them together to see which are native, which invasive plants to remove, and what to plant instead." linkText="Start a campus scan" onLinkPress={() => navigation?.navigate('EcoScan')} />
        <Feature wide={wide} reduceMotion={reduceMotion} reverse eyebrow="TURN FINDINGS INTO ACTION" visual={<View style={styles.letterPaper}><LetterDemo /></View>} heading="A plan for your principal" body="Turn your scan into a letter: what to remove safely, which natives to plant, and what to ask for at the nursery. You choose the plants, with a source for every fact." linkText="Make your plan" onLinkPress={() => navigation?.navigate('EcoScan')} />
        <Feature wide={wide} reduceMotion={reduceMotion} image={IMG_SCANNING} imageLabel="Identifying a flowering plant with a phone" eyebrow="START WITH CURIOSITY" heading="Identify a plant" body="Add up to 5 photos of one plant, or choose it by name. Learn whether it’s native to Florida, nonnative, or invasive—and where that answer comes from." linkText="Identify a plant" onLinkPress={() => navigation?.navigate('Camera')} />
        <Feature wide={wide} reduceMotion={reduceMotion} reverse image={IMG_GROW} imageLabel="Native plants growing in a garden" eyebrow="GROW WITH CONFIDENCE" heading="Plant Florida natives" body="Find native plants checked for Palm Beach County, matched to your space. See the wildlife each one supports, its growing needs, and what to ask for at the nursery." linkText="Find native plants" onLinkPress={() => navigation?.navigate('Recommend')} />
      </View>

      <View style={[styles.why, wide && styles.whyWide]}>
        <Image source={IMG_POLLINATORS} style={[styles.whyImage, wide && styles.whyImageWide]} resizeMode="cover" accessibilityLabel="Pollinators visiting native flowers" />
        <View style={styles.whyText}>
          <Text style={styles.eyebrow}>SMALL CHANGES, LIVING CONNECTIONS</Text>
          <Text style={styles.featureHeading} accessibilityRole="header">Help your ecosystem</Text>
          <OakFact />
          <SourceLine source={{ name: 'National Wildlife Federation', url: 'https://www.nwf.org/-/media/Documents/PDFs/Garden-for-Wildlife/Keystone-Plants/NWF-GFW-keystone-plant-list-ecoregion-15-tropical-wet-forests.pdf' }} />
        </View>
      </View>

      <View style={styles.know}>
        <Text style={styles.knowHeading} accessibilityRole="header">Good decisions start with good sources.</Text>
        <Text style={styles.knowBody}>Every answer comes from Florida’s official invasive list, USDA, and the USF Atlas. Our team checked every plant we recommend.</Text>
        <View style={[styles.sources, wide && styles.sourcesWide]} accessible accessibilityLabel={SOURCES.map(source => `${source.count} ${source.label}`).join('. ')}>
          {SOURCES.map((source, index) => <View key={source.count} style={[styles.sourceItem, wide && styles.sourceItemWide]}>
            <CountUp value={source.count} style={styles.sourceCount} delay={index * COUNT_STAGGER} />
            <Text style={styles.sourceLabel}>{source.label}</Text>
          </View>)}
        </View>
      </View>
      <View style={styles.footer}>
        <Image source={LOGO} style={styles.footerLogo} />
        <Text style={styles.footerText}>EcoLoco · Growing communities, one plant at a time</Text>
      </View>
    </View>
  </ScrollView>
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  scrollContent: { alignItems: 'center' },
  inner: { alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 24 : 48, paddingBottom: 18, borderBottomWidth: 1, borderColor: COLORS.border },
  logo: { width: 35, height: 35, resizeMode: 'contain' },
  wordmark: { fontSize: TYPE.h3, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  brandNote: { marginLeft: 'auto', fontSize: TYPE.small, fontFamily: FONTS.body, color: COLORS.textMuted },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 30, borderBottomWidth: 1, borderColor: COLORS.border },
  heroWide: { paddingTop: 46, paddingBottom: 44 },
  eyebrow: { fontSize: TYPE.eyebrow, lineHeight: 16, letterSpacing: 1.3, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },
  headline: { fontSize: TYPE.h1, lineHeight: 44, fontFamily: FONTS.headingLight, color: COLORS.darkGreen, textAlign: 'center', marginTop: 9 },
  headlineWide: { fontSize: TYPE.displayLarge, lineHeight: 58 },
  headlineItalic: { fontFamily: FONTS.accentItalic },
  ornament: { flexDirection: 'row', alignItems: 'center', width: 120, gap: 12, marginVertical: 18 },
  ornamentLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  diamond: { width: 5, height: 5, transform: [{ rotate: '45deg' }], backgroundColor: COLORS.softGreen },
  tagline: { fontSize: TYPE.lead, lineHeight: 25, fontFamily: FONTS.bodyMedium, color: COLORS.darkGreen, textAlign: 'center' },
  heroBody: { fontSize: TYPE.link, lineHeight: 23, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', maxWidth: 470, marginTop: 7 },
  heroActions: { gap: 10, width: '100%', maxWidth: 330, marginTop: 24 },
  heroActionsWide: { flexDirection: 'row', maxWidth: 460, justifyContent: 'center' },
  primaryButton: { backgroundColor: COLORS.darkGreen, minHeight: 50, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 20, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FONTS.bodyBold, fontSize: TYPE.link, color: COLORS.onDark },
  secondaryButton: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg, minHeight: 50, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: FONTS.bodyMedium, fontSize: TYPE.link, color: COLORS.darkGreen },
  features: { paddingHorizontal: 24 },
  feature: { gap: 20, paddingVertical: 30, borderBottomWidth: 1, borderColor: COLORS.border },
  featureWide: { flexDirection: 'row', alignItems: 'center', gap: 36, paddingVertical: 36 },
  featureVisual: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  featureVisualWide: { width: '43%' },
  featureImage: { width: '100%', height: 200, borderRadius: 16, backgroundColor: COLORS.lightBg },
  featureImageWide: { height: 265 },
  featureText: { flex: 1, gap: 8 },
  featureHeading: { fontFamily: FONTS.heading, fontSize: TYPE.h2, lineHeight: 35, color: COLORS.darkGreen },
  featureBody: { fontFamily: FONTS.body, fontSize: TYPE.link, lineHeight: 24, color: COLORS.textBody },
  linkBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, minHeight: 44 },
  featureLink: { fontFamily: FONTS.bodyBold, fontSize: TYPE.note, lineHeight: 21, color: COLORS.darkGreen, textDecorationLine: 'underline' },
  letterPaper: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.cardBg },
  why: { padding: 24, gap: 22, paddingVertical: 34 },
  whyWide: { flexDirection: 'row', gap: 30, alignItems: 'center' },
  whyImage: { width: '100%', height: 200, borderRadius: 16 },
  whyImageWide: { width: '36%', height: 240 },
  whyText: { flex: 1, gap: 10 },
  whyBody: { fontSize: TYPE.lead, lineHeight: 29, fontFamily: FONTS.headingLight, color: COLORS.darkGreen },
  whyNumber: { fontFamily: FONTS.heading, fontVariant: ['tabular-nums'] },
  know: { marginHorizontal: 24, padding: 24, borderRadius: 18, backgroundColor: COLORS.lightBg, gap: 12 },
  knowHeading: { fontFamily: FONTS.heading, fontSize: TYPE.h3, lineHeight: 32, color: COLORS.darkGreen },
  knowBody: { fontFamily: FONTS.body, fontSize: TYPE.note, lineHeight: 23, color: COLORS.textMuted, maxWidth: 650 },
  sources: { gap: 16, marginTop: 8 },
  sourcesWide: { flexDirection: 'row', gap: 26 },
  sourceItem: { flexDirection: 'row', alignItems: 'center', gap: 15, borderTopWidth: 1, borderColor: COLORS.border, paddingTop: 16 },
  sourceItemWide: { flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 5 },
  sourceCount: { fontFamily: FONTS.headingLight, fontSize: TYPE.h1, lineHeight: 42, color: COLORS.darkGreen, minWidth: 86, fontVariant: ['tabular-nums'] },
  sourceLabel: { fontFamily: FONTS.body, fontSize: TYPE.caption, lineHeight: 20, color: COLORS.textBody, flexShrink: 1 },
  footer: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 30, gap: 10 },
  footerLogo: { width: 28, height: 28, resizeMode: 'contain', opacity: 0.6 },
  footerText: { fontFamily: FONTS.body, fontSize: TYPE.fine, lineHeight: 18, color: COLORS.textMuted, textAlign: 'center' },
})
