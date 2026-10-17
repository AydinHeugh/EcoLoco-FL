import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Alert, Image,
  useWindowDimensions, Animated, Easing, Linking,
} from 'react-native';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { DMSans_400Regular, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { getPlantRecommendations } from '../services/geminiService';

const CREAM      = '#f5f0e8';
const DARK_GREEN = '#1e3a1e';
const SOFT_GREEN = '#4a7a3a';
const LIGHT_BG   = '#eaeee6';
const TEXT_BODY  = '#4a4a3a';
const TEXT_MUTED = '#7a7a6a';
const BORDER     = '#d4cfc4';
const CARD_BG    = '#fefcf8';

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const LOGO = require('../../assets/EcoLoco_logo.png');

// ─── Highlight plant name in green ───────────────────────────────────────────
function HighlightedText({ text, plantName, style }) {
  if (!plantName || !text || !text.includes(plantName)) {
    return <Text style={style}>{text}</Text>;
  }
  const parts = text.split(plantName);
  return (
    <Text style={style}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <Text style={{ color: SOFT_GREEN, fontFamily: 'DMSans_700Bold' }}>{plantName}</Text>
          )}
        </React.Fragment>
      ))}
    </Text>
  );
}

// ─── Wildlife support pill ────────────────────────────────────────────────────
function SupportPill({ level }) {
  const cfg = {
    high:   { bg: '#eaf2e8', color: SOFT_GREEN,  label: '↑ High' },
    medium: { bg: '#faf3e0', color: '#c49a3a',   label: '→ Medium' },
    low:    { bg: '#f5efec', color: '#C97D5D',   label: '↓ Low' },
    unknown:{ bg: '#eeeeea', color: '#7a7a6a',   label: '? Unknown' },
  };
  const c = cfg[level?.toLowerCase()] ?? cfg.unknown;
  return (
    <View style={[sp.wrap, { backgroundColor: c.bg }]}>
      <Text style={[sp.text, { color: c.color }]}>{c.label} Wildlife</Text>
    </View>
  );
}

const sp = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: 11, fontFamily: 'DMSans_700Bold' },
});

// ─── Bouncing dots loader ────────────────────────────────────────────────────
function LoadingDots({ message }) {
  const d0 = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dot = (v, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: -9, duration: 280, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0,  duration: 280, easing: EASE_OUT, useNativeDriver: true }),
        Animated.delay(500),
      ])
    );
    Animated.parallel([dot(d0, 0), dot(d1, 160), dot(d2, 320)]).start();
  }, []);

  return (
    <View style={ld.wrap}>
      <View style={ld.dots}>
        {[d0, d1, d2].map((d, i) => (
          <Animated.View key={i} style={[ld.dot, { transform: [{ translateY: d }] }]} />
        ))}
      </View>
      <Text style={ld.text}>{message}</Text>
    </View>
  );
}

const ld = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 36, gap: 14 },
  dots: { flexDirection: 'row', gap: 8, height: 20, alignItems: 'flex-end' },
  dot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: SOFT_GREEN },
  text: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED },
});

// ─── Skeleton card ───────────────────────────────────────────────────────────
function SkeletonCard({ index }) {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,    duration: 750, delay: index * 180, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={[styles.skLine, { width: 58, height: 9, marginBottom: 11 }]} />
      <View style={[styles.skLine, { width: '72%', height: 20, marginBottom: 18 }]} />
      <View style={styles.cardDivider} />
      <View style={[styles.skLine, { width: 50, height: 9, marginBottom: 10, marginTop: 2 }]} />
      <View style={[styles.skLine, { width: '90%', height: 13, marginBottom: 7 }]} />
      <View style={[styles.skLine, { width: '62%', height: 13, marginBottom: 18 }]} />
      <View style={styles.cardDivider} />
      <View style={[styles.skLine, { width: 46, height: 9, marginBottom: 10, marginTop: 2 }]} />
      <View style={[styles.skLine, { width: '82%', height: 13 }]} />
    </Animated.View>
  );
}

// ─── Animated result card ────────────────────────────────────────────────────
function AnimatedCard({ item, index }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 520, delay: index * 110, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 520, delay: index * 110, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardLabel}>PROBLEM</Text>
        <Text style={styles.cardNum}>{String(index + 1).padStart(2, '0')}</Text>
      </View>
      <Text style={styles.problemText}>{item.problem}</Text>
      {item.wildlife_support && (
        <View style={{ marginTop: 10 }}>
          <SupportPill level={item.wildlife_support} />
        </View>
      )}

      <View style={styles.cardDivider} />

      <Text style={styles.cardLabel}>ACTION</Text>
      <HighlightedText text={item.action} plantName={item.plant_name} style={styles.actionText} />

      <View style={styles.cardDivider} />

      <Text style={styles.cardLabel}>IMPACT</Text>
      <HighlightedText text={item.impact} plantName={item.plant_name} style={styles.impactText} />
    </Animated.View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function RecommendationScreen({ navigation, route }) {
  const prefillZip = route?.params?.prefillZip ?? '';
  const [zipCode,          setZipCode]         = useState(prefillZip);
  const [loading,          setLoading]         = useState(false);
  const [results,          setResults]         = useState(null);
  const [viewAllExpanded,  setViewAllExpanded] = useState(false);

  const { width } = useWindowDimensions();
  const maxWidth  = Math.min(width, 960);

  const [fontsLoaded] = useFonts({ Fraunces_700Bold, DMSans_400Regular, DMSans_700Bold });

  // Auto-run if navigated here with a ZIP pre-filled
  useEffect(() => {
    if (prefillZip?.length === 5) {
      setZipCode(prefillZip);
      handleRecommend(prefillZip);
    }
  }, [prefillZip]);

  async function handleRecommend(zip) {
    const target = zip ?? zipCode;
    if (target.length !== 5 || isNaN(target)) {
      Alert.alert('Invalid ZIP', 'Please enter a valid 5-digit ZIP code.');
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const data = await getPlantRecommendations(target);
      setResults(data.result);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not fetch recommendations. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.inner, { width: maxWidth }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image source={LOGO} style={styles.logoImg} />
            <Text style={styles.logoText}>EcoLoco</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Title ── */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Recommendations</Text>
          <Text style={styles.pageSubtitle}>
            Enter your ZIP code to get native plant recommendations for your area.
          </Text>
        </View>

        {/* ── Input + Button ── */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.input}
            placeholder="Enter ZIP code"
            placeholderTextColor={TEXT_MUTED}
            keyboardType="numeric"
            maxLength={5}
            value={zipCode}
            onChangeText={setZipCode}
          />
          <TouchableOpacity
            style={[styles.btn, (zipCode.length !== 5 || loading) && styles.btnDisabled]}
            onPress={() => handleRecommend()}
            disabled={loading || zipCode.length !== 5}
          >
            {loading
              ? <ActivityIndicator color={CREAM} size="small" />
              : <Text style={styles.btnText}>Get Recommendations</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Loading state ── */}
        {loading && (
          <View style={styles.resultsSection}>
            <LoadingDots message="Finding plants for your area…" />
            {[0, 1, 2].map(i => <SkeletonCard key={i} index={i} />)}
          </View>
        )}

        {/* ── Results ── */}
        {results && !loading && (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Top Picks</Text>
              <Text style={styles.resultsCount}>ranked by impact</Text>
            </View>

            {results.slice(0, 3).map((item, index) => (
              <AnimatedCard key={index} item={item} index={index} />
            ))}

            {results.length > 3 && (
              <View style={styles.viewAllSection}>
                <TouchableOpacity
                  style={styles.viewAllToggle}
                  onPress={() => setViewAllExpanded(v => !v)}
                >
                  <Text style={styles.viewAllToggleText}>
                    {viewAllExpanded ? '▲ Hide' : '▼ More high-impact natives for your area'} ({results.length - 3} more)
                  </Text>
                </TouchableOpacity>

                {viewAllExpanded && (
                  <>
                    {results.slice(3).map((item, i) => (
                      <View key={i} style={styles.viewAllItem}>
                        <View style={styles.viewAllLeft}>
                          <Text style={styles.viewAllName}>{item.plant_name}</Text>
                          {item.scientific_name
                            ? <Text style={styles.viewAllSci}>{item.scientific_name}</Text>
                            : null}
                          {item.benefit
                            ? <Text style={styles.viewAllBenefit}>{item.benefit}</Text>
                            : null}
                        </View>
                        {item.wildlife_support && <SupportPill level={item.wildlife_support} />}
                      </View>
                    ))}

                    <TouchableOpacity
                      style={styles.nwfLink}
                      onPress={() => Linking.openURL('https://nativeplantfinder.nwf.org')}
                    >
                      <Text style={styles.nwfLinkText}>
                        Looking for the complete native plant database for your exact location? Explore NWF's Native Plant Finder →
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  scrollContent: { alignItems: 'center' },
  inner: { alignSelf: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 52, paddingBottom: 16,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 40, height: 40, resizeMode: 'contain' },
  logoText: { fontSize: 20, fontFamily: 'Fraunces_700Bold', color: DARK_GREEN, letterSpacing: 0.3 },


  divider: { height: 1, backgroundColor: BORDER },

  titleSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24 },
  pageTitle: { fontSize: 34, fontFamily: 'Fraunces_700Bold', color: DARK_GREEN, marginBottom: 6 },
  pageSubtitle: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED, textAlign: 'center' },

  inputSection: { paddingHorizontal: 20, gap: 12, marginBottom: 8 },
  input: {
    backgroundColor: '#fff', color: TEXT_BODY, borderRadius: 10,
    padding: 13, fontSize: 14, fontFamily: 'DMSans_400Regular',
    borderWidth: 1, borderColor: BORDER,
  },
  btn: { backgroundColor: DARK_GREEN, borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: CREAM },

  resultsSection: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },
  resultsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: 20,
  },
  resultsTitle: { fontSize: 26, fontFamily: 'Fraunces_700Bold', color: DARK_GREEN },
  resultsCount: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED },

  card: {
    backgroundColor: CARD_BG, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 20, marginBottom: 14,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardNum: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: BORDER },
  cardLabel: { fontSize: 10, fontFamily: 'DMSans_700Bold', color: SOFT_GREEN, letterSpacing: 1.5 },
  cardDivider: { height: 1, backgroundColor: LIGHT_BG, marginVertical: 12 },
  problemText: { fontSize: 19, fontFamily: 'Fraunces_700Bold', color: DARK_GREEN, lineHeight: 27 },
  actionText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: TEXT_BODY, lineHeight: 22, marginTop: 5 },
  impactText: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED, lineHeight: 20, marginTop: 5 },

  skLine: { backgroundColor: LIGHT_BG, borderRadius: 4 },

  viewAllSection: { marginTop: 4, marginBottom: 24 },
  viewAllToggle: { paddingVertical: 14, alignItems: 'center' },
  viewAllToggleText: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: SOFT_GREEN },
  viewAllItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD_BG, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  viewAllLeft:    { flex: 1, marginRight: 10 },
  viewAllName:    { fontSize: 14, fontFamily: 'DMSans_700Bold', color: DARK_GREEN },
  viewAllSci:     { fontSize: 11, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED, fontStyle: 'italic', marginTop: 2 },
  viewAllBenefit: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: TEXT_MUTED, lineHeight: 18, marginTop: 4 },

  nwfLink: {
    marginTop: 8, marginBottom: 16, paddingVertical: 14,
    paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: '#eaf2e8', borderWidth: 1, borderColor: BORDER,
    alignItems: 'center',
  },
  nwfLinkText: {
    fontSize: 12, fontFamily: 'DMSans_400Regular', color: SOFT_GREEN,
    textAlign: 'center', lineHeight: 18,
  },
});
