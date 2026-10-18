import React, { useRef, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native'
import { useFonts } from 'expo-font'
import { COLORS, FONTS, FONT_ASSETS } from '../theme'
import SourceLine from '../components/SourceLine'


const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1)  // fast-out, ease-in-out feel

const LOGO            = require('../../assets/EcoLoco_logo.png')
const IMG_POLLINATORS = require('../../assets/EcoLoco_support_polinators.png')
const IMG_GROW        = require('../../assets/GrowWithConfidence_Ecoloco.png')
const IMG_ECOSYSTEM   = require('../../assets/EcoLoco_ecosystem.png')

// ─── Staggered mount fade-up ──────────────────────────────────────────────────
function useFadeUp(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(28)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 680, delay, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 680, delay, easing: EASE_OUT, useNativeDriver: true }),
    ]).start()
  }, [])

  return { opacity, transform: [{ translateY }] }
}

// ─── Animated press button ────────────────────────────────────────────────────
function AnimButton({ style, textStyle, label, onPress }) {
  const scale = useRef(new Animated.Value(1)).current
  const pressIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 24 }).start()
  return (
    <TouchableOpacity onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <Text style={textStyle}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

// ─── Ornament that draws itself in ────────────────────────────────────────────
function Ornament({ delay = 0 }) {
  const scaleX  = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleX, {
        toValue: 1, duration: 800, delay, easing: EASE_OUT, useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1, duration: 400, delay, useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[styles.ornamentRow, { opacity, transform: [{ scaleX }] }]}>
      <View style={styles.ornamentLine} />
      <View style={styles.ornamentDiamond} />
      <View style={styles.ornamentLine} />
    </Animated.View>
  )
}

// ─── Section divider ──────────────────────────────────────────────────────────
function Divider() {
  return <View style={styles.dividerLine} />
}

// ─── Feature row ─────────────────────────────────────────────────────────────
function FeatureRow({ image, heading, body, source, linkText, onLinkPress, imgHeight, reverse, animStyle }) {
  const imgBlock = image ? (
    <View style={[styles.featureImgWrap, { height: imgHeight }]}>
      <Image source={image} style={styles.featureImg} resizeMode="cover" />
    </View>
  ) : null
  const textBlock = (
    <View style={[styles.featureText, reverse && { paddingLeft: 4 }]}>
      <Text style={styles.featureHeading}>{heading}</Text>
      <Text style={styles.featureBody}>{body}</Text>
      {source && <SourceLine source={source} />}
      {linkText && (
        <TouchableOpacity onPress={onLinkPress} style={styles.linkBtn} accessibilityRole="link">
          <Text style={styles.featureLink}>{linkText}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
  return (
    <Animated.View style={[styles.featureRow, animStyle]}>
      {reverse ? <>{textBlock}{imgBlock}</> : <>{imgBlock}{textBlock}</>}
    </Animated.View>
  )
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { width } = useWindowDimensions()
  const isWide   = width > 600
  const imgHeight = isWide ? 280 : 190
  const maxWidth  = Math.min(width, 960)

  const nameAnim = useFadeUp(0)
  const tagAnim  = useFadeUp(400)
  const ctaAnim  = useFadeUp(560)
  const s1Anim = useFadeUp(200)
  const s2Anim = useFadeUp(320)
  const s3Anim = useFadeUp(440)
  const s4Anim = useFadeUp(560)
  const s5Anim = useFadeUp(680)
  const s6Anim = useFadeUp(800)

  const [fontsLoaded] = useFonts(FONT_ASSETS)

  if (!fontsLoaded) return <View style={styles.container} />

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.inner, { width: maxWidth }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image source={LOGO} style={styles.logoImg} />
            <Text style={styles.logoText}>EcoLoco</Text>
          </View>
        </View>

        <Divider />

        {/* ── Hero ── */}
        <View style={styles.hero}>
          <Animated.Text style={[styles.heroHeadingItalic, styles.heroName, nameAnim]}>EcoLoco</Animated.Text>
          <Ornament delay={300} />
          <Animated.Text style={[styles.tagline, tagAnim]}>
            Find out which plants on your campus help Florida wildlife, and which ones hurt it.
          </Animated.Text>
          <Animated.View style={[styles.ctaWrap, ctaAnim]}>
            <AnimButton
              style={styles.cta}
              textStyle={styles.ctaText}
              label="Start a campus scan"
              onPress={() => navigation?.navigate('EcoScan')}
            />
          </Animated.View>
        </View>

        <Divider />

        <FeatureRow
          animStyle={s1Anim}
          image={IMG_POLLINATORS}
          imgHeight={imgHeight}
          heading="Scan Your Campus"
          body="Add each plant around your school, give it up to 5 photos, then scan them all at once. You'll see what share are native, which invasive plants to remove, and what to plant instead."
          linkText="Start a campus scan →"
          onLinkPress={() => navigation?.navigate('EcoScan')}
        />

        <Divider />

        <FeatureRow
          animStyle={s2Anim}
          heading="Write to Your Principal"
          body="EcoLoco turns your scan into a letter for your principal: which invasive plants to remove and how to do it safely, which natives to plant and what to ask for at the nursery, with a source for every fact. You pick which plants go in it."
          linkText="Make your plan →"
          onLinkPress={() => navigation?.navigate('EcoScan')}
        />

        <Divider />

        <FeatureRow
          animStyle={s3Anim}
          heading="Identify a Plant"
          body="Add up to 5 photos of one plant, or choose it by name. EcoLoco tells you if it's native to Florida, not native, or invasive, and where that answer comes from."
          linkText="Identify a plant →"
          onLinkPress={() => navigation?.navigate('Camera')}
        />

        <Divider />

        <FeatureRow
          reverse
          animStyle={s4Anim}
          image={IMG_GROW}
          imgHeight={imgHeight}
          heading="Plant Florida Natives"
          body="See native plants checked for Palm Beach County, with what each one helps and what to ask for at the nursery. Every fact shows its source."
          linkText="See native plants →"
          onLinkPress={() => navigation?.navigate('Recommend')}
        />

        <Divider />

        <FeatureRow
          animStyle={s5Anim}
          image={IMG_ECOSYSTEM}
          imgHeight={imgHeight}
          heading="Why It Matters"
          body="Oaks feed 395 kinds of caterpillars in South Florida. Those caterpillars feed the birds that live here."
          source={{ name: 'National Wildlife Federation', url: 'https://www.nwf.org/-/media/Documents/PDFs/Garden-for-Wildlife/Keystone-Plants/NWF-GFW-keystone-plant-list-ecoregion-15-tropical-wet-forests.pdf' }}
        />

        <Divider />

        <FeatureRow
          animStyle={s6Anim}
          heading="How We Know"
          body="Every answer comes from Florida's official invasive list, USDA, and the USF Atlas. Our team checked every plant we recommend."
        />

        <View style={styles.footerDivider} />

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Image source={LOGO} style={styles.footerLogo} />
          <Text style={styles.footerText}>EcoLoco</Text>
        </View>

      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  scrollContent: {
    alignItems: 'center',
  },
  inner: {
    alignSelf: 'center',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImg: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  logoText: {
    fontSize: 20,
    fontFamily: FONTS.heading,
    color: COLORS.darkGreen,
    letterSpacing: 0.3,
  },
  // ── Divider ──
  dividerLine: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  // ── Hero ──
  hero: {
    paddingHorizontal: 28,
    paddingTop: 44,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heroHeadingItalic: {
    fontSize: 36,
    fontFamily: FONTS.headingItalic,
    color: COLORS.darkGreen,
    lineHeight: 46,
  },

  tagline: {
    fontSize: 15,
    fontFamily: FONTS.bodyBold,
    color: COLORS.darkGreen,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 23,
    paddingHorizontal: 16,
  },

  heroName: {
    marginBottom: 18,
  },
  ctaWrap: {
    alignSelf: 'stretch',
    marginTop: 24,
    paddingHorizontal: 8,
  },
  cta: {
    backgroundColor: COLORS.darkGreen,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontFamily: FONTS.bodyBold,
    color: COLORS.cream,
  },

  // ── Ornament ──
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '50%',
  },
  ornamentLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  ornamentDiamond: {
    width: 7,
    height: 7,
    backgroundColor: COLORS.softGreen,
    opacity: 0.45,
    transform: [{ rotate: '45deg' }],
  },

  // ── Feature rows ──
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 20,
  },
  featureImgWrap: {
    width: '42%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.lightBg,
    shadowColor: COLORS.darkGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  featureImg: {
    width: '100%',
    height: '100%',
  },
  featureText: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  featureHeading: {
    fontSize: 18,
    fontFamily: FONTS.heading,
    color: COLORS.darkGreen,
    lineHeight: 26,
  },
  featureBody: {
    fontSize: 12.5,
    fontFamily: FONTS.body,
    color: COLORS.textBody,
    lineHeight: 20,
  },
  linkBtn: {
    alignSelf: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.darkGreen,
    paddingBottom: 1,
  },
  featureLink: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: COLORS.darkGreen,
  },

  // ── Footer ──
  footerDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  footerLogo: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
    opacity: 0.45,
  },
  footerText: {
    fontSize: 11,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
})
