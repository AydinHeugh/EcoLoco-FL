import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, useWindowDimensions, Animated, Easing, Linking,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import { getSummary, getPlantRecommendations, generateLetter } from '../services/geminiService';
import { COLORS, STATUS_COLORS, FONTS, FONT_ASSETS } from '../theme';
import StatusBadge from '../components/StatusBadge';
import PercentRing from '../components/PercentRing';

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

const LOGO = require('../../assets/EcoLoco_logo.png');

const BUCKETS = [
  { key: 'native',     status: 'native',     label: 'Native' },
  { key: 'non_native', status: 'non-native', label: 'Non-native (not harmful)' },
  { key: 'invasive',   status: 'invasive',   label: 'Invasive (hurting wildlife)' },
  { key: 'unknown',    status: 'unknown',    label: 'Unknown: not on Florida lists' },
];

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

function RecCard({ rec }) {
  return (
    <View style={styles.viewAllItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.viewAllName}>{rec.plant_name}</Text>
        {rec.scientific_name ? <Text style={styles.viewAllSci}>{rec.scientific_name}</Text> : null}
        {(rec.why || rec.impact || rec.benefit)
          ? <Text style={styles.viewAllBenefit}>{rec.why || rec.impact || rec.benefit}</Text>
          : null}
      </View>
    </View>
  );
}

function LetterGenerator({ recs, summary, zipCode }) {
  const [selected,      setSelected]      = useState(new Set([0, 1, 2]));
  const [letterLoading, setLetterLoading] = useState(false);
  const [letter,        setLetter]        = useState(null);
  const [editedLetter,  setEditedLetter]  = useState('');
  const [copied,        setCopied]        = useState(false);
  const [error,         setError]         = useState(null);

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
    setError(null);
    try {
      const data = await generateLetter(plantNames, summary, zipCode);
      setLetter(data.result);
      setEditedLetter(data.result);
    } catch {
      setError('Could not write the letter. Check your connection and try again.');
    } finally {
      setLetterLoading(false);
    }
  }

  const anySelected = recs.some((_, i) => selected.has(i));

  return (
    <View style={styles.letterSection}>
      <Text style={styles.letterTitle}>Letter to your principal</Text>
      <Text style={styles.letterSubtitle}>
        Pick the plants to ask for, then make a letter you can edit and send.
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
          : <Text style={styles.letterBtnText}>Write the letter</Text>
        }
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {letter && (
        <View style={styles.letterCard}>
          <Text style={styles.letterEditHint}>Tap to edit. Fill in the parts in [brackets].</Text>
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
          <Text style={styles.letterNote}>Read it over and change anything before you send it.</Text>
        </View>
      )}
    </View>
  );
}

export default function AuditResultsScreen({ route, navigation }) {
  const { plants = [], zipCode } = route.params ?? {};

  const [summary,         setSummary]         = useState(null);
  const [recs,            setRecs]            = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [recsLoading,     setRecsLoading]     = useState(true);
  const [viewAllExpanded, setViewAllExpanded] = useState(false);

  const { width } = useWindowDimensions();
  const maxWidth   = Math.min(width, 960);

  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useEffect(() => {
    async function fetchAll() {
      try {
        const data = await getSummary(plants.map(p => ({ scientific_name: p.scientific_name, plant_name: p.plant_name })));
        setSummary(data.result);
      } catch (err) {
        console.error('Summary fetch error:', err);
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

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.inner, { width: maxWidth }]}>

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

        {loading && (
          <View style={styles.centerSection}>
            <ActivityIndicator color={COLORS.softGreen} size="large" />
            <Text style={styles.loadingText}>Checking your plants against Florida lists…</Text>
          </View>
        )}

        {!loading && summary && (
          <>
            <View style={styles.summarySection}>
              <Text style={styles.pageTitle}>Your campus</Text>
              <Text style={styles.plantCountLabel}>
                {summary.plant_count} plant{summary.plant_count !== 1 ? 's' : ''} checked
              </Text>

              {summary.percent_native === null
                ? <Text style={styles.loadingText}>Not enough identified plants yet</Text>
                : <PercentRing now={summary.percent_native} withPlan={summary.percent_native_with_plan} />}

              <View style={styles.countRow}>
                {BUCKETS.map(({ key, status, label }) => (
                  <View key={key} style={styles.countItem}>
                    <Text style={[styles.countNum, { color: STATUS_COLORS[status].color }]}>{summary.counts[key]}</Text>
                    <Text style={styles.countLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              {summary.counts.unknown > 0 && (
                <Text style={styles.countNote}>Unknown plants are not counted in the percentage.</Text>
              )}
            </View>

            <View style={styles.divider} />

            <FadeIn>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What's on campus</Text>
                {BUCKETS.map(({ key, status, label }) => {
                  const group = summary.plants.filter(p => p.status === status);
                  if (group.length === 0) return null;
                  return (
                    <View key={key} style={styles.bCard}>
                      <View style={styles.bHeader}>
                        <StatusBadge status={status} label={label} />
                        <View style={styles.bBadge}><Text style={styles.bBadgeText}>{group.length}</Text></View>
                      </View>
                      {group.map((p, i) => (
                        <Text key={i} style={styles.bItem}>· {p.plant_name}</Text>
                      ))}
                    </View>
                  );
                })}
              </View>
            </FadeIn>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Native plants to add</Text>

              {recsLoading && (
                <View style={[styles.centerSection, { paddingVertical: 32 }]}>
                  <ActivityIndicator color={COLORS.softGreen} />
                  <Text style={styles.loadingText}>Finding native plants for your area…</Text>
                </View>
              )}

              {!recsLoading && recs.length === 0 && (
                <Text style={styles.loadingText}>No recommendations found for this ZIP code.</Text>
              )}

              {!recsLoading && recs.slice(0, 3).map((rec, i) => <RecCard key={i} rec={rec} />)}

              {!recsLoading && recs.length > 3 && (
                <View style={styles.viewAllSection}>
                  <TouchableOpacity style={styles.viewAllToggle} onPress={() => setViewAllExpanded(v => !v)}>
                    <Text style={styles.viewAllToggleText}>
                      {viewAllExpanded ? '▲ Hide' : '▼ More native plants for your area'} ({recs.length - 3} more)
                    </Text>
                  </TouchableOpacity>
                  {viewAllExpanded && (
                    <>
                      {recs.slice(3).map((rec, i) => <RecCard key={i} rec={rec} />)}
                      <TouchableOpacity style={styles.nwfLink} onPress={() => Linking.openURL('https://nativeplantfinder.nwf.org')}>
                        <Text style={styles.nwfLinkText}>
                          Want more? Search the National Wildlife Federation's Native Plant Finder →
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {!recsLoading && recs.length >= 1 && (
                <LetterGenerator recs={recs.slice(0, 3)} summary={summary} zipCode={zipCode} />
              )}
            </View>

            <View style={styles.divider} />

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

        {!loading && !summary && (
          <View style={styles.centerSection}>
            <Text style={styles.loadingText}>Could not check your plants. Check your connection and try again.</Text>
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

  summarySection:    { alignItems: 'center', paddingTop: 32, paddingHorizontal: 24, paddingBottom: 28 },
  pageTitle:       { fontSize: 34, fontFamily: FONTS.heading, color: COLORS.darkGreen, marginBottom: 4 },
  plantCountLabel: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 28 },


  countRow:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 24 },
  countItem:  { alignItems: 'center', width: 90 },
  countNum:   { fontSize: 24, fontFamily: FONTS.heading },
  countLabel: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },
  countNote:  { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 12, textAlign: 'center' },
  errorText:  { fontSize: 13, fontFamily: FONTS.body, color: COLORS.error, marginTop: 10, textAlign: 'center' },

  section:         { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sectionTitle:    { fontSize: 22, fontFamily: FONTS.heading, color: COLORS.darkGreen, marginBottom: 6 },


  bCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginBottom: 12,
  },
  bHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  bBadge:     { backgroundColor: COLORS.lightBg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  bBadgeText: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted },
  bItem:      { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: 22, paddingLeft: 4 },



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
