import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, useWindowDimensions, Animated, Easing, Pressable, Linking,
  Alert, TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import { getScore, getPlantRecommendations, generateLetter } from '../services/geminiService';
import { COLORS, STATUS_COLORS, FONTS, FONT_ASSETS } from '../theme';


const SUPPORT_STYLES = {
  high:    { bg: STATUS_COLORS.native.bg, color: COLORS.softGreen, label: '↑ High' },
  medium:  { bg: STATUS_COLORS['non-native'].bg, color: COLORS.amber,      label: '→ Medium' },
  low:     { bg: STATUS_COLORS.invasive.bg, color: COLORS.terracotta, label: '↓ Low' },
  unknown: { bg: STATUS_COLORS.unknown.bg, color: COLORS.textMuted, label: '? Unknown' },
};
const EASE_OUT   = Easing.bezier(0.22, 1, 0.36, 1);

const LOGO = require('../../assets/EcoLoco_logo.png');

const BUCKETS = [
  { key: 'native',     status: 'native',     label: 'Native' },
  { key: 'non_native', status: 'non-native', label: 'Non-native (not harmful)' },
  { key: 'invasive',   status: 'invasive',   label: 'Invasive (hurting wildlife)' },
  { key: 'unknown',    status: 'unknown',    label: 'Unknown: not on Florida lists' },
];

function scoreColor(s) {
  if (s >= 66) return COLORS.softGreen;
  if (s >= 41) return COLORS.amber;
  return COLORS.terracotta;
}

function scoreLabel(s) {
  if (s >= 80) return 'Outstanding';
  if (s >= 65) return 'Good';
  if (s >= 45) return 'Moderate';
  if (s >= 25) return 'Low';
  return 'Critical';
}

// ─── Animated score ring ──────────────────────────────────────────────────────
function ScoreRing({ targetScore, label, size = 190 }) {
  const anim   = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    anim.stopAnimation();
    anim.removeAllListeners();
    anim.addListener(({ value }) => setShown(Math.round(value)));
    Animated.timing(anim, {
      toValue: targetScore,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => { anim.stopAnimation(); anim.removeAllListeners(); };
  }, [targetScore]);

  const color = scoreColor(shown || targetScore);

  return (
    <View style={[
      ring.wrap,
      { width: size, height: size, borderRadius: size / 2, borderColor: color },
    ]}>
      <Text style={[ring.num, { color, fontSize: size * 0.3 }]}>{shown}</Text>
      {label
        ? <Text style={[ring.sub, { color, fontFamily: FONTS.bodyBold }]}>{label}</Text>
        : <Text style={ring.sub}>out of 100</Text>
      }
    </View>
  );
}

const ring = StyleSheet.create({
  wrap: { borderWidth: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  num:  { fontFamily: FONTS.heading },
  sub:  { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 2 },
});

// ─── Highlight plant name in green inside a text block ───────────────────────
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
            <Text style={{ color: COLORS.softGreen, fontFamily: FONTS.bodyBold }}>{plantName}</Text>
          )}
        </React.Fragment>
      ))}
    </Text>
  );
}

// ─── Fade-in wrapper ──────────────────────────────────────────────────────────
function FadeIn({ delay = 0, children }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 480, delay, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 480, delay, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// ─── Before→After pill ───────────────────────────────────────────────────────
function BeforeAfterPill({ fromScore, toScore, visible }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 220, easing: EASE_OUT, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: visible ? 1 : 0.85, useNativeDriver: true, tension: 140, friction: 8 }),
    ]).start();
  }, [visible]);

  const delta = toScore - fromScore;

  return (
    <Animated.View style={[ba.wrap, { opacity, transform: [{ scale }] }]}>
      <Text style={[ba.score, { color: scoreColor(fromScore) }]}>{fromScore}</Text>
      <Text style={ba.arrow}>  →  </Text>
      <Text style={[ba.score, { color: scoreColor(toScore) }]}>{toScore}</Text>
      {delta > 0 && <Text style={ba.delta}>  +{delta} pts</Text>}
    </Animated.View>
  );
}

const ba = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: STATUS_COLORS.native.bg, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 11, marginTop: 16 },
  score: { fontSize: 22, fontFamily: FONTS.heading },
  arrow: { fontSize: 16, color: COLORS.textMuted },
  delta: { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },
});

// ─── Pressable action card ────────────────────────────────────────────────────
function ActionCard({ rec, index, onHoverIn, onHoverOut, boost }) {
  const num   = String(index + 1).padStart(2, '0');
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    onHoverIn();
    Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, tension: 160, friction: 7 }).start();
  }

  function pressOut() {
    onHoverOut();
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 160, friction: 7 }).start();
  }

  return (
    <FadeIn delay={index * 110}>
      <Pressable onPressIn={pressIn} onPressOut={pressOut}>
        <Animated.View style={[ac.card, { transform: [{ scale }] }]}>
          <View style={ac.topRow}>
            <Text style={ac.num}>{num}</Text>
            <View style={ac.badgeRow}>
              {boost != null && (
                <View style={ac.boostBadge}>
                  <Text style={ac.boostText}>+{boost} pts</Text>
                </View>
              )}
              <View style={ac.badge}>
                <Text style={ac.badgeText}>↑ Native Plant</Text>
              </View>
            </View>
          </View>
          <Text style={ac.problem}>{rec.problem}</Text>
          <View style={ac.divider} />
          <Text style={ac.label}>ACTION</Text>
          <HighlightedText text={rec.action} plantName={rec.plant_name} style={ac.body} />
          <View style={ac.divider} />
          <Text style={ac.label}>ECOLOGICAL BENEFIT</Text>
          <HighlightedText text={rec.impact} plantName={rec.plant_name} style={ac.body} />
        </Animated.View>
      </Pressable>
    </FadeIn>
  );
}

const ac = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 18, marginBottom: 14,
  },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  num:       { fontSize: 12, fontFamily: FONTS.bodyBold, color: COLORS.textMuted, letterSpacing: 1 },
  badgeRow:  { flexDirection: 'row', gap: 6, alignItems: 'center' },
  boostBadge:{ backgroundColor: COLORS.darkGreen, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  boostText: { fontSize: 11, fontFamily: FONTS.bodyBold, color: COLORS.cream },
  badge:     { backgroundColor: STATUS_COLORS.native.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },
  problem:  { fontSize: 17, fontFamily: FONTS.heading, color: COLORS.darkGreen, lineHeight: 24, marginBottom: 14 },
  divider:  { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  label:    { fontSize: 10, fontFamily: FONTS.bodyBold, color: COLORS.textMuted, letterSpacing: 1.2, marginBottom: 5 },
  body:     { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: 21 },
});

// ─── Letter Generator ────────────────────────────────────────────────────────
function LetterGenerator({ recs, score, zipCode }) {
  const [selected,      setSelected]      = useState(new Set([0, 1, 2]));
  const [letterLoading, setLetterLoading] = useState(false);
  const [letter,        setLetter]        = useState(null);
  const [editedLetter,  setEditedLetter]  = useState('');
  const [copied,        setCopied]        = useState(false);

  function togglePlant(i) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
    setLetter(null);
    setEditedLetter('');
  }

  async function handleGenerate() {
    const plantNames = recs.filter((_, i) => selected.has(i)).map(r => r.plant_name);
    if (plantNames.length === 0) return;
    setLetterLoading(true);
    setLetter(null);
    setEditedLetter('');
    try {
      const data = await generateLetter(plantNames, score, zipCode);
      setLetter(data.result);
      setEditedLetter(data.result);
    } catch {
      Alert.alert('Error', 'Could not generate letter. Please try again.');
    } finally {
      setLetterLoading(false);
    }
  }

  const anySelected = recs.some((_, i) => selected.has(i));

  return (
    <View style={styles.letterSection}>
      <Text style={styles.letterTitle}>Draft Letter to Administration</Text>
      <Text style={styles.letterSubtitle}>
        Select plants to include, then generate a ready-to-personalise letter.
      </Text>

      {recs.map((rec, i) => (
        <TouchableOpacity key={i} style={styles.checkRow} onPress={() => togglePlant(i)}>
          <View style={[styles.checkbox, selected.has(i) && styles.checkboxChecked]}>
            {selected.has(i) && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel} numberOfLines={1}>{rec.plant_name}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[styles.letterBtn, (!anySelected || letterLoading) && styles.letterBtnDisabled]}
        onPress={handleGenerate}
        disabled={!anySelected || letterLoading}
      >
        {letterLoading
          ? <ActivityIndicator color={COLORS.cream} size="small" />
          : <Text style={styles.letterBtnText}>Generate Letter for Administration</Text>
        }
      </TouchableOpacity>

      {letter && (
        <View style={styles.letterCard}>
          <Text style={styles.letterEditHint}>Tap to edit — fill in the bracketed fields</Text>
          <TextInput
            multiline
            scrollEnabled={false}
            value={editedLetter}
            onChangeText={setEditedLetter}
            style={styles.letterInput}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={async () => {
              await Clipboard.setStringAsync(editedLetter);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy Letter'}</Text>
          </TouchableOpacity>
          <Text style={styles.letterNote}>Review and personalise before sending.</Text>
        </View>
      )}
    </View>
  );
}

// ─── AuditResultsScreen ───────────────────────────────────────────────────────
export default function AuditResultsScreen({ route, navigation }) {
  const { plants = [], zipCode } = route.params ?? {};

  const [scoreData,    setScoreData]     = useState(null);
  const [recs,         setRecs]          = useState([]);
  const [loading,      setLoading]       = useState(true);
  const [recsLoading,  setRecsLoading]   = useState(true);
  const [showProjected,  setShowProjected]   = useState(false);
  const [hovering,       setHovering]        = useState(null); // 0|1|2 = card index, 'all' = combined, null = none
  const [viewAllExpanded,setViewAllExpanded] = useState(false);

  const BOOST = { high: 8, medium: 6, low: 5 };

  const { width } = useWindowDimensions();
  const maxWidth   = Math.min(width, 960);

  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useEffect(() => {
    async function fetchAll() {
      try {
        const plantsPayload = plants.map(p => ({
          name:             p.plant_name,
          status:           p.status,
          wildlife_support: p.wildlife_support ?? 'low',
        }));
        const data = await getScore(plantsPayload);
        setScoreData(data.result);
      } catch (err) {
        console.error('Score fetch error:', err);
      } finally {
        setLoading(false);
      }

      if (zipCode) {
        try {
          const recData = await getPlantRecommendations(zipCode);
          setRecs(recData.result ?? []);
        } catch (err) {
          console.error('Recs fetch error:', err);
        } finally {
          setRecsLoading(false);
        }
      } else {
        setRecsLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Combined projected score (top 3 actions only) — shown in subtitle + "all" hold
  const projectedScore = (!recsLoading && recs.length > 0 && scoreData)
    ? Math.min(100, scoreData.score + recs.slice(0, 3).reduce((sum, r) => sum + (BOOST[r.wildlife_support] ?? 5), 0))
    : (scoreData?.projected_score ?? 0);

  // Score preview: single card → that card's boost; 'all' → combined projected
  const hoverScore = hovering === 'all'
    ? projectedScore
    : (hovering !== null && recs[hovering] && scoreData)
      ? Math.min(100, scoreData.score + (BOOST[recs[hovering].wildlife_support] ?? 5))
      : null;

  const ringTarget = scoreData
    ? (showProjected
        ? (hovering !== null ? hoverScore : scoreData.score)
        : scoreData.score)
    : 0;

  const ringLabel = showProjected
    ? (hovering === 'all' ? 'all 3' : hovering !== null ? 'this action' : 'current')
    : null;

  const delta = scoreData ? projectedScore - scoreData.score : 0;

  const onHoverOut = useCallback(() => setHovering(null), []);

  if (!fontsLoaded) return <View style={styles.container} />;

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
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>← Back to EcoScan</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* ── Loading ── */}
        {loading && (
          <View style={styles.centerSection}>
            <ActivityIndicator color={COLORS.softGreen} size="large" />
            <Text style={styles.loadingText}>Calculating your biodiversity score…</Text>
          </View>
        )}

        {/* ── Results ── */}
        {!loading && scoreData && (
          <>
            {/* Score ring + toggle */}
            <View style={styles.scoreSection}>
              <Text style={styles.pageTitle}>Biodiversity Score</Text>
              <Text style={styles.plantCountLabel}>
                {scoreData.plant_count} plant{scoreData.plant_count !== 1 ? 's' : ''} scanned
              </Text>

              <View style={styles.ringWrap}>
                <ScoreRing targetScore={ringTarget} label={ringLabel} size={190} />
                <Text style={[styles.scoreLabel, { color: scoreColor(ringTarget) }]}>
                  {scoreLabel(ringTarget)}
                </Text>
              </View>

              {/* Before→After pill — only visible when hovering in After Actions */}
              {showProjected && (
                <BeforeAfterPill
                  fromScore={scoreData.score}
                  toScore={hoverScore ?? scoreData.score}
                  visible={hovering !== null}
                />
              )}

              {/* Current / After Actions toggle */}
              <View style={[styles.toggle, showProjected && { marginTop: 20 }]}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !showProjected && styles.toggleActive]}
                  onPress={() => { setShowProjected(false); setHovering(null); }}
                >
                  <Text style={[styles.toggleText, !showProjected && styles.toggleTextActive]}>
                    Current
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, showProjected && styles.toggleActive]}
                  onPress={() => setShowProjected(true)}
                >
                  <Text style={[styles.toggleText, showProjected && styles.toggleTextActive]}>
                    After Actions
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── CURRENT view ── */}
            {!showProjected && (
              <FadeIn>
                <View style={styles.section}>
                  <View style={styles.insightCard}>
                    <Text style={styles.insightText}>{scoreData.insight}</Text>
                  </View>

                  <Text style={styles.sectionTitle}>What's on campus</Text>

                  {BUCKETS.map(({ key, status, label }) => scoreData.breakdown[key].length > 0 && (
                    <View key={key} style={styles.bCard}>
                      <View style={styles.bHeader}>
                        <View style={[styles.dot, { backgroundColor: STATUS_COLORS[status].color }]} />
                        <Text style={styles.bLabel}>{label}</Text>
                        <View style={styles.bBadge}><Text style={styles.bBadgeText}>{scoreData.breakdown[key].length}</Text></View>
                      </View>
                      {scoreData.breakdown[key].map((name, i) => (
                        <Text key={i} style={styles.bItem}>· {name}</Text>
                      ))}
                    </View>
                  ))}

                  {delta > 0 && (
                    <TouchableOpacity
                      style={styles.afterHint}
                      onPress={() => setShowProjected(true)}
                    >
                      <Text style={styles.afterHintText}>
                        See how you could reach {projectedScore} →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </FadeIn>
            )}

            {/* ── AFTER ACTIONS view ── */}
            {showProjected && (
              <FadeIn>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Your 3-Action Plan</Text>
                  <Text style={styles.sectionSubtitle}>
                    All 3 actions together could raise your score from{' '}
                    <Text style={{ fontFamily: FONTS.bodyBold, color: scoreColor(scoreData.score) }}>{scoreData.score}</Text>
                    {' → '}
                    <Text style={{ fontFamily: FONTS.bodyBold, color: scoreColor(projectedScore) }}>{projectedScore}</Text>
                    {' '}(+{delta} pts). Hold any card to preview.
                  </Text>

                  {recsLoading && (
                    <View style={[styles.centerSection, { paddingVertical: 32 }]}>
                      <ActivityIndicator color={COLORS.softGreen} />
                      <Text style={styles.loadingText}>Finding native plants for your area…</Text>
                    </View>
                  )}

                  {!recsLoading && recs.length === 0 && (
                    <View style={styles.insightCard}>
                      <Text style={styles.insightText}>
                        No recommendations found for this ZIP. Use the Recommendations tab for full results.
                      </Text>
                    </View>
                  )}

                  {!recsLoading && recs.slice(0, 3).map((rec, i) => (
                    <ActionCard
                      key={i}
                      rec={rec}
                      index={i}
                      onHoverIn={() => setHovering(i)}
                      onHoverOut={onHoverOut}
                      boost={BOOST[rec.wildlife_support] ?? 5}
                    />
                  ))}

                  {/* ── All 3 combined hold button ── */}
                  {!recsLoading && recs.length >= 3 && (
                    <Pressable
                      onPressIn={() => setHovering('all')}
                      onPressOut={() => setHovering(null)}
                    >
                      <View style={[styles.allBtn, hovering === 'all' && styles.allBtnActive]}>
                        <Text style={[styles.allBtnText, hovering === 'all' && { color: COLORS.cream }]}>
                          {hovering === 'all'
                            ? `All 3 together: ${scoreData.score} → ${projectedScore}  (+${delta} pts)`
                            : `Hold to preview all 3 combined  (+${delta} pts)`}
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {/* ── More high-impact natives ── */}
                  {!recsLoading && recs.length > 3 && (
                    <View style={styles.viewAllSection}>
                      <TouchableOpacity
                        style={styles.viewAllToggle}
                        onPress={() => setViewAllExpanded(v => !v)}
                      >
                        <Text style={styles.viewAllToggleText}>
                          {viewAllExpanded ? '▲ Hide' : '▼ More high-impact natives for your area'} ({recs.length - 3} more)
                        </Text>
                      </TouchableOpacity>

                      {viewAllExpanded && (
                        <>
                          {recs.slice(3).map((rec, i) => (
                            <View key={i} style={styles.viewAllItem}>
                              <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.viewAllName}>{rec.plant_name}</Text>
                                {rec.scientific_name
                                  ? <Text style={styles.viewAllSci}>{rec.scientific_name}</Text>
                                  : null}
                                {rec.benefit
                                  ? <Text style={styles.viewAllBenefit}>{rec.benefit}</Text>
                                  : null}
                              </View>
                              {(() => {
                                const support = SUPPORT_STYLES[rec.wildlife_support] ?? SUPPORT_STYLES.unknown;
                                return (
                                  <View style={[styles.supportPill, { backgroundColor: support.bg }]}>
                                    <Text style={[styles.supportPillText, { color: support.color }]}>
                                      {support.label} Wildlife
                                    </Text>
                                  </View>
                                );
                              })()}
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

                  {/* ── Draft Letter ── */}
                  {!recsLoading && recs.length >= 1 && (
                    <LetterGenerator
                      recs={recs.slice(0, 3)}
                      score={scoreData.score}
                      zipCode={zipCode}
                    />
                  )}
                </View>
              </FadeIn>
            )}

            <View style={styles.divider} />

            {/* ── CTAs ── */}
            <View style={styles.ctaSection}>
              <TouchableOpacity
                style={styles.ctaBtn}
                onPress={() => navigation.navigate('Main', { screen: 'Recommend', params: { prefillZip: zipCode } })}
              >
                <Text style={styles.ctaBtnText}>Full Recommendations</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctaSecondary} onPress={() => navigation.goBack()}>
                <Text style={styles.ctaSecondaryText}>Scan More Plants</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Error ── */}
        {!loading && !scoreData && (
          <View style={styles.centerSection}>
            <Text style={styles.loadingText}>Could not calculate score. Please try again.</Text>
            <TouchableOpacity style={[styles.ctaBtn, { marginTop: 16 }]} onPress={() => navigation.goBack()}>
              <Text style={styles.ctaBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.cream },
  scrollContent:{ alignItems: 'center' },
  inner:        { alignSelf: 'center', width: '100%' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 52, paddingBottom: 16,
  },
  logoRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg:  { width: 40, height: 40, resizeMode: 'contain' },
  logoText: { fontSize: 20, fontFamily: FONTS.heading, color: COLORS.darkGreen, letterSpacing: 0.3 },
  backBtn:  { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textBody },

  divider: { height: 1, backgroundColor: COLORS.border },

  centerSection: { alignItems: 'center', paddingVertical: 60, gap: 14, paddingHorizontal: 24 },
  loadingText:   { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },

  scoreSection:    { alignItems: 'center', paddingTop: 32, paddingHorizontal: 24, paddingBottom: 28 },
  pageTitle:       { fontSize: 34, fontFamily: FONTS.heading, color: COLORS.darkGreen, marginBottom: 4 },
  plantCountLabel: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 28 },
  ringWrap:        { alignItems: 'center', gap: 14, marginBottom: 8 },
  scoreLabel:      { fontSize: 22, fontFamily: FONTS.heading },

  toggle: {
    flexDirection: 'row', backgroundColor: COLORS.lightBg,
    borderRadius: 12, padding: 4, gap: 4, marginTop: 24,
  },
  toggleBtn:        { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10 },
  toggleActive:     { backgroundColor: COLORS.cream, shadowColor: COLORS.shadow, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  toggleText:       { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted },
  toggleTextActive: { fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },

  section:         { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sectionTitle:    { fontSize: 22, fontFamily: FONTS.heading, color: COLORS.darkGreen, marginBottom: 6 },
  sectionSubtitle: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 19, marginBottom: 20 },

  insightCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 18, marginBottom: 20,
  },
  insightText: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: 22, textAlign: 'center' },

  bCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginBottom: 12,
  },
  bHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  bLabel:     { flex: 1, fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  bBadge:     { backgroundColor: COLORS.lightBg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  bBadgeText: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted },
  bItem:      { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: 22, paddingLeft: 4 },

  afterHint: { alignItems: 'center', marginTop: 8, paddingVertical: 12 },
  afterHintText: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },

  allBtn: {
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.darkGreen,
    paddingVertical: 15, alignItems: 'center', marginBottom: 4,
  },
  allBtnActive: { backgroundColor: COLORS.darkGreen },
  allBtnText: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },

  viewAllSection: { marginTop: 8, marginBottom: 4 },
  viewAllToggle:  { paddingVertical: 14, alignItems: 'center' },
  viewAllToggleText: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.softGreen },
  viewAllItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  viewAllName:    { fontSize: 14, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  viewAllSci:     { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 2 },
  viewAllBenefit: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 18, marginTop: 4 },
  supportPill:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  supportPillText: { fontSize: 11, fontFamily: FONTS.bodyBold },

  nwfLink: {
    marginTop: 8, marginBottom: 16, paddingVertical: 14,
    paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: STATUS_COLORS.native.bg, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  nwfLinkText: {
    fontSize: 12, fontFamily: FONTS.body, color: COLORS.softGreen,
    textAlign: 'center', lineHeight: 18,
  },

  ctaSection: { padding: 24, paddingBottom: 52, alignItems: 'center', gap: 10 },
  ctaBtn: {
    backgroundColor: COLORS.darkGreen, borderRadius: 10,
    paddingVertical: 15, alignItems: 'center', width: '100%',
  },
  ctaBtnText:       { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.cream },
  ctaSecondary:     { paddingVertical: 10 },
  ctaSecondaryText: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted },

  letterSection: {
    marginTop: 28, paddingTop: 24, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  letterTitle: {
    fontSize: 20, fontFamily: FONTS.heading, color: COLORS.darkGreen, marginBottom: 6,
  },
  letterSubtitle: {
    fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted,
    lineHeight: 18, marginBottom: 16,
  },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked:  { backgroundColor: COLORS.softGreen, borderColor: COLORS.softGreen },
  checkmark:        { fontSize: 13, color: COLORS.cream, fontFamily: FONTS.bodyBold },
  checkLabel:       { flex: 1, fontSize: 14, fontFamily: FONTS.body, color: COLORS.darkGreen },
  letterBtn: {
    marginTop: 12, backgroundColor: COLORS.darkGreen, borderRadius: 10,
    paddingVertical: 15, alignItems: 'center',
  },
  letterBtnDisabled: { opacity: 0.45 },
  letterBtnText:     { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.cream },
  letterCard: {
    marginTop: 16, backgroundColor: COLORS.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 20,
  },
  letterEditHint: {
    fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted,
    fontStyle: 'italic', marginBottom: 10,
  },
  letterInput: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.textBody,
    lineHeight: 22, backgroundColor: COLORS.lightBg,
    borderRadius: 8, padding: 12, minHeight: 520,
  },
  copyBtn: {
    marginTop: 16, borderWidth: 1.5, borderColor: COLORS.darkGreen,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  copyBtnText: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  letterNote: {
    marginTop: 10, fontSize: 11, fontFamily: FONTS.body,
    color: COLORS.textMuted, textAlign: 'center', fontStyle: 'italic',
  },
});
