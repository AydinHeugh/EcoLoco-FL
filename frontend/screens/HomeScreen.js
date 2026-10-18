import React, { useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  useWindowDimensions,
} from 'react-native'
import { useFonts } from 'expo-font'
import { COLORS, FONTS, FONT_ASSETS, TYPE, LINE } from '../theme'
import SourceLine from '../components/SourceLine'
import PhotoSlot from '../components/PhotoSlot'
import CountUp from '../components/CountUp'
import Reveal, { RevealProvider, useRevealScroll, useInView } from '../components/Reveal'
import { useCountUp } from '../components/CountUp'
import { IdentifyDemo, LetterDemo } from '../components/HomeDemos'
import { PHOTOS } from '../photos'
import { COUNT_STAGGER, FOCUS_MS, useReduceMotion } from '../motion'

const LOGO         = require('../../assets/EcoLoco_logo.png')
const IMG_SCANNING = require('../../assets/EcoLoco_Scanning_Plant.png')
const HERO_HEIGHT  = 380
const PARALLAX     = 0.35
const OAK_KINDS    = 395

const SOURCES = [
  { count: '179', label: "invasive plants on Florida's official 2026 list (FISC)" },
  { count: '5,322', label: 'plants recorded in Florida by USDA PLANTS' },
  { count: '30', label: 'plants we recommend, each checked in the USF Atlas' },
]

function PressButton({ style, textStyle, label, onPress }) {
  const scale = useRef(new Animated.Value(1)).current
  const pressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 24 }).start()
  return (
    <TouchableOpacity onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1} accessibilityRole="button">
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <Text style={textStyle}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

function SectionLink({ label, onPress, onDark }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.linkBtn} accessibilityRole="link" hitSlop={{ top: 8, bottom: 8 }}>
      <Text style={[styles.featureLink, onDark && styles.featureLinkDark]}>{label}</Text>
    </TouchableOpacity>
  )
}

function OakFact() {
  const ref = useRef(null)
  const kinds = useCountUp(OAK_KINDS, useInView(ref, 120))
  const sentence = `Oaks feed ${OAK_KINDS} kinds of caterpillars in South Florida. Those caterpillars feed the birds that live here.`
  return (
    <View ref={ref} collapsable={false}>
      <Text style={styles.whyBody} accessibilityLabel={sentence}>
        Oaks feed <Text style={styles.whyNumber}>{kinds}</Text> kinds of caterpillars in South Florida. Those caterpillars feed the birds that live here.
      </Text>
    </View>
  )
}

function Feature({ visual, heading, body, linkText, onLinkPress, reverse, wide, visualWidth = '46%' }) {
  const text = (
    <Reveal index={1} duration={FOCUS_MS} distance={24} style={[styles.featureText, wide && styles.featureTextWide]}>
      <Text style={styles.featureHeading} accessibilityRole="header">{heading}</Text>
      <Text style={styles.featureBody}>{body}</Text>
      {linkText && <SectionLink label={linkText} onPress={onLinkPress} />}
    </Reveal>
  )
  const art = (
    <Reveal duration={FOCUS_MS} scaleFrom={0.94} distance={24} style={wide ? { width: visualWidth } : styles.visualStacked}>
      {visual}
    </Reveal>
  )
  if (!wide) return <View style={styles.featureStack}>{art}{text}</View>
  return <View style={styles.featureRow}>{reverse ? <>{text}{art}</> : <>{art}{text}</>}</View>
}

export default function HomeScreen(props) {
  return <RevealProvider><Home {...props} /></RevealProvider>
}

function Home({ navigation }) {
  const { width } = useWindowDimensions()
  const wide = width > 600
  const maxWidth = Math.min(width, 960)
  const reduce = useReduceMotion()
  const scrollY = useRef(new Animated.Value(0)).current
  const tick = useRevealScroll()
  const [fontsLoaded] = useFonts(FONT_ASSETS)

  if (!fontsLoaded) return <View style={styles.container} />

  const drift = reduce ? 0 : scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0, HERO_HEIGHT],
    outputRange: [-HERO_HEIGHT * PARALLAX, 0, HERO_HEIGHT * PARALLAX],
    extrapolate: 'clamp',
  })
  const photoHeight = wide ? 300 : 230

  return (
    <Animated.ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true, listener: tick })}
    >
      <View style={styles.hero}>
        <Animated.View style={[styles.heroPhoto, { transform: [{ translateY: drift }] }]}>
          <PhotoSlot source={PHOTOS.home} label="A school garden full of native plants" style={styles.fill} />
        </Animated.View>
        <View style={styles.heroScrim} />
        <View style={[styles.brand, { width: maxWidth }]}>
          <Image source={LOGO} style={styles.logo} />
          <Text style={styles.wordmark}>EcoLoco</Text>
        </View>
      </View>

      <View style={[styles.inner, { width: maxWidth }]}>
        <View style={styles.intro}>
          <Text style={[styles.headline, wide && styles.headlineWide]} accessibilityRole="header">
            Find out which plants on your campus help Florida wildlife, and which ones hurt it.
          </Text>
          <PressButton
            style={styles.cta}
            textStyle={styles.ctaText}
            label="Start a campus scan"
            onPress={() => navigation?.navigate('EcoScan')}
          />
        </View>

        <Feature
          wide={wide}
          visual={<PhotoSlot source={PHOTOS.homeScan} label="Pollinators on native flowers" style={[styles.photo, { height: photoHeight }]} />}
          heading="Scan Your Campus"
          body="Add each plant around your school, give it up to 5 photos, then scan them all at once. You'll see what share are native, which invasive plants to remove, and what to plant instead."
          linkText="Start a campus scan →"
          onLinkPress={() => navigation?.navigate('EcoScan')}
        />
      </View>

      <View style={styles.letterBand}>
        <View style={[styles.inner, { width: maxWidth }]}>
          <Feature
            wide={wide}
            reverse
            visualWidth="44%"
            visual={<View style={styles.letterPaper}><LetterDemo /></View>}
            heading="Write to Your Principal"
            body="EcoLoco turns your scan into a letter for your principal: which invasive plants to remove and how to do it safely, which natives to plant and what to ask for at the nursery, with a source for every fact. You pick which plants go in it."
            linkText="Make your plan →"
            onLinkPress={() => navigation?.navigate('EcoScan')}
          />
        </View>
      </View>

      <View style={[styles.inner, { width: maxWidth }]}>
        <Feature
          wide={wide}
          visual={<View style={[styles.photo, { height: photoHeight }]}><IdentifyDemo image={IMG_SCANNING} /></View>}
          heading="Identify a Plant"
          body="Add up to 5 photos of one plant, or choose it by name. EcoLoco tells you if it's native to Florida, not native, or invasive, and where that answer comes from."
          linkText="Identify a plant →"
          onLinkPress={() => navigation?.navigate('Camera')}
        />

        <Feature
          wide={wide}
          reverse
          visual={<PhotoSlot source={PHOTOS.homeNatives} label="A garden path lined with native plants" style={[styles.photo, { height: photoHeight }]} />}
          heading="Plant Florida Natives"
          body="See native plants checked for Palm Beach County, with what each one helps and what to ask for at the nursery. Every fact shows its source."
          linkText="See native plants →"
          onLinkPress={() => navigation?.navigate('Recommend')}
        />
      </View>

      <View style={styles.whyBand}>
        <PhotoSlot source={PHOTOS.homeWhy} label="A hummingbird and a monarch butterfly at native flowers" style={StyleSheet.absoluteFillObject} />
        <View style={styles.whyScrim} />
        <View style={[styles.inner, styles.whyInner, { width: maxWidth }]}>
          <Text style={styles.whyHeading} accessibilityRole="header">Why It Matters</Text>
          <OakFact />
          <SourceLine onDark source={{ name: 'National Wildlife Federation', url: 'https://www.nwf.org/-/media/Documents/PDFs/Garden-for-Wildlife/Keystone-Plants/NWF-GFW-keystone-plant-list-ecoregion-15-tropical-wet-forests.pdf' }} />
        </View>
      </View>

      <View style={styles.knowBand}>
        <View style={[styles.inner, styles.knowInner, { width: maxWidth }]}>
          <Text style={styles.knowHeading} accessibilityRole="header">How We Know</Text>
          <Text style={styles.knowBody}>Every answer comes from Florida's official invasive list, USDA, and the USF Atlas. Our team checked every plant we recommend.</Text>
          <View style={[styles.sources, wide && styles.sourcesWide]} accessible accessibilityLabel={SOURCES.map(s => `${s.count} ${s.label}`).join('. ')}>
            {SOURCES.map((source, i) => (
              <View key={source.count} style={[styles.sourceItem, wide && styles.sourceItemWide]}>
                <CountUp value={source.count} style={styles.sourceCount} delay={i * COUNT_STAGGER} />
                <Text style={styles.sourceLabel}>{source.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Image source={LOGO} style={styles.footerLogo} />
        <Text style={styles.footerText}>EcoLoco</Text>
      </View>
    </Animated.ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  scrollContent: { alignItems: 'center' },
  inner: { alignSelf: 'center' },
  fill: { width: '100%', height: '100%' },

  hero: { width: '100%', height: HERO_HEIGHT, overflow: 'hidden', backgroundColor: COLORS.darkGreen, alignItems: 'center' },
  heroPhoto: { ...StyleSheet.absoluteFillObject },
  heroScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: 120, backgroundColor: COLORS.scrimTop },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 52 },
  logo: { width: 34, height: 34, resizeMode: 'contain', borderRadius: 7 },
  wordmark: { fontSize: TYPE.h3, fontFamily: FONTS.heading, color: COLORS.onDark },

  intro: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 36, gap: 26 },
  headline: { fontSize: TYPE.h1, lineHeight: LINE.h1, fontFamily: FONTS.headingBlack, color: COLORS.darkGreen, maxWidth: 680 },
  headlineWide: { fontSize: TYPE.display, lineHeight: LINE.display },
  cta: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 24, alignItems: 'center', alignSelf: 'stretch', maxWidth: 420 },
  ctaText: { fontSize: TYPE.lead, fontFamily: FONTS.bodyBold, color: COLORS.white },

  featureStack: { paddingHorizontal: 20, paddingVertical: 28, gap: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 40, gap: 36 },
  visualStacked: { width: '100%' },
  featureText: { gap: 12 },
  featureTextWide: { flex: 1 },
  featureHeading: { fontSize: TYPE.h2, lineHeight: LINE.h2, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  featureBody: { fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.body, color: COLORS.textBody, maxWidth: 560 },
  linkBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  featureLink: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.accent, textDecorationLine: 'underline' },
  featureLinkDark: { color: COLORS.onDark },
  photo: { width: '100%', borderRadius: 24, overflow: 'hidden', backgroundColor: COLORS.photoBg },

  letterBand: { width: '100%', backgroundColor: COLORS.seaGrapeSoft, alignItems: 'center', marginTop: 8 },
  letterPaper: { borderRadius: 4, overflow: 'hidden', transform: [{ rotate: '-1.5deg' }] },

  whyBand: { width: '100%', minHeight: 340, justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden', marginTop: 8 },
  whyScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.scrim },
  whyInner: { paddingHorizontal: 20, paddingVertical: 36, gap: 12 },
  whyHeading: { fontSize: TYPE.lead, fontFamily: FONTS.bodyBold, color: COLORS.onDarkMuted },
  whyBody: { fontSize: TYPE.h2, lineHeight: LINE.h2, fontFamily: FONTS.headingItalic, color: COLORS.onDark, maxWidth: 640 },
  whyNumber: { fontFamily: FONTS.headingBlack, color: COLORS.accentOnDark, fontVariant: ['tabular-nums'] },

  knowBand: { width: '100%', backgroundColor: COLORS.darkGreen, alignItems: 'center' },
  knowInner: { paddingHorizontal: 20, paddingVertical: 40, gap: 14 },
  knowHeading: { fontSize: TYPE.h2, lineHeight: LINE.h2, fontFamily: FONTS.heading, color: COLORS.onDark },
  knowBody: { fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.body, color: COLORS.onDarkMuted, maxWidth: 560 },
  sources: { marginTop: 10, gap: 18 },
  sourcesWide: { flexDirection: 'row', gap: 28 },
  sourceItem: { gap: 2, borderTopWidth: 1, borderTopColor: COLORS.ringTrackDark, paddingTop: 12 },
  sourceItemWide: { flex: 1 },
  sourceCount: { fontSize: TYPE.h1, lineHeight: LINE.h1, fontFamily: FONTS.headingBlack, color: COLORS.accentOnDark },
  sourceLabel: { fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.body, color: COLORS.onDark },

  footer: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  footerLogo: { width: 26, height: 26, resizeMode: 'contain', opacity: 0.45 },
  footerText: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textMuted, letterSpacing: 0.4 },
})
