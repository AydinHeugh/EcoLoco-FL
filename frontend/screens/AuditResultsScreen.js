import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, useWindowDimensions, Linking, TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import { getPlan, generateLetter, userMessage } from '../services/geminiService';
import { COLORS, STATUS_COLORS, FONTS, FONT_ASSETS } from '../theme';
import StatusBadge from '../components/StatusBadge';
import PercentRing from '../components/PercentRing';
import PlanCard from '../components/PlanCard';
import SourceLine from '../components/SourceLine';
import OfflineNotice, { reportAi } from '../components/OfflineNotice';

const LOGO = require('../../assets/EcoLoco_logo.png');
const NURSERY_URL = 'https://plantrealflorida.org';
const NO_DATA = "We don't have wildlife info for this plant yet";

const BUCKETS = [
  { key: 'native',     status: 'native',     label: 'Native' },
  { key: 'non_native', status: 'non-native', label: 'Non-native (not harmful)' },
  { key: 'invasive',   status: 'invasive',   label: 'Invasive (hurting wildlife)' },
  { key: 'unknown',    status: 'unknown',    label: 'Unknown: not on Florida lists' },
];

function LetterGenerator({ plan, zipCode }) {
  const [loading, setLoading] = useState(false);
  const [letter,  setLetter]  = useState('');
  const [copied,  setCopied]  = useState(false);
  const [error,   setError]   = useState(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const data = await generateLetter(plan, zipCode);
      setLetter(data.result);
      reportAi(data.ai_unavailable);
    } catch (err) {
      setError(userMessage(err, 'Could not write the letter. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Letter to your principal</Text>
      <Text style={styles.sectionNote}>
        It lists the plants to remove and add, how to buy them, safety notes and sources.
      </Text>
      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleGenerate} disabled={loading}>
        {loading ? <ActivityIndicator color={COLORS.cream} size="small" /> : <Text style={styles.btnText}>Write the letter</Text>}
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {letter ? (
        <View style={styles.letterCard}>
          <Text style={styles.sectionNote}>Tap to edit. Fill in the parts in [brackets].</Text>
          <TextInput multiline scrollEnabled={false} value={letter} onChangeText={setLetter}
            style={styles.letterInput} textAlignVertical="top" />
          <TouchableOpacity
            style={styles.btnOutline}
            onPress={async () => {
              await Clipboard.setStringAsync(letter);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Text style={styles.btnOutlineText}>{copied ? 'Copied!' : 'Copy Letter'}</Text>
          </TouchableOpacity>
          <Text style={styles.sectionNote}>Read it over and change anything before you send it.</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function AuditResultsScreen({ route, navigation }) {
  const { plants = [], zipCode } = route.params ?? {};
  const [plan,    setPlan]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const { width } = useWindowDimensions();
  const maxWidth   = Math.min(width, 960);
  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useEffect(() => {
    getPlan(plants.map(p => ({ scientific_name: p.scientific_name, plant_name: p.plant_name })), zipCode)
      .then(data => setPlan(data.result))
      .catch(err => setError(userMessage(err, 'Could not check your plants. Check your connection and try again.')))
      .finally(() => setLoading(false));
  }, []);

  if (!fontsLoaded) return <View style={styles.container} />;

  const summary = plan?.summary;
  const addName = name => plan?.add.find(a => a.scientific_name === name)?.common_name;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
        <OfflineNotice />

        {loading && (
          <View style={styles.centerSection}>
            <ActivityIndicator color={COLORS.softGreen} size="large" />
            <Text style={styles.mutedText}>Checking your plants against Florida lists…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerSection}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
              <Text style={styles.btnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && plan && (
          <>
            <View style={styles.section}>
              <Text style={styles.pageTitle}>Your plan</Text>
              {plan.remove.map(card => (
                <PlanCard key={card.scientific_name} card={card} kind="remove" replacementName={addName(card.replacement)} />
              ))}
              {plan.add.length === 0
                ? <Text style={styles.mutedText}>No plants are ready to recommend yet. Our team is still checking each one.</Text>
                : plan.add.map(card => <PlanCard key={card.scientific_name} card={card} kind="add" />)}
              <TouchableOpacity onPress={() => Linking.openURL(NURSERY_URL)}>
                <Text style={styles.link}>Find a native plant nursery near you (plantrealflorida.org) →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What your campus supports now</Text>
              {summary.plants.map((p, i) => (
                <View key={i} style={styles.plantRow}>
                  <View style={styles.plantHead}>
                    <Text style={styles.plantName}>{p.plant_name}</Text>
                    <StatusBadge status={p.status} label={p.status_label} />
                  </View>
                  <Text style={styles.plantWhy}>{p.why || NO_DATA}</Text>
                  {p.why ? <SourceLine source={{ name: p.source_label }} /> : null}
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.ringSection}>
              <Text style={styles.sectionTitle}>How native is your campus?</Text>
              {summary.percent_native === null
                ? <Text style={styles.mutedText}>Not enough identified plants yet</Text>
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
                <Text style={styles.mutedText}>Unknown plants are not counted in the percentage.</Text>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Why this matters</Text>
              {plan.why_this_matters.map((line, i) => (
                <View key={i} style={styles.whyLine}>
                  <Text style={styles.plantWhy}>{line.text}</Text>
                  <SourceLine source={line.source} />
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            <LetterGenerator plan={plan} zipCode={zipCode} />

            <View style={styles.ctaSection}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.goBack()}>
                <Text style={styles.btnOutlineText}>Scan More Plants</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.cream },
  scrollContent: { alignItems: 'center' },
  inner:         { alignSelf: 'center', width: '100%' },

  header: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 52, paddingBottom: 16, rowGap: 8,
  },
  logoRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg:  { width: 40, height: 40, resizeMode: 'contain' },
  logoText: { fontSize: 20, fontFamily: FONTS.heading, color: COLORS.darkGreen, letterSpacing: 0.3 },
  backBtn:  { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textBody },

  divider: { height: 1, backgroundColor: COLORS.border },

  centerSection: { alignItems: 'center', paddingVertical: 60, gap: 14, paddingHorizontal: 24 },
  section:       { paddingHorizontal: 20, paddingVertical: 24, gap: 8 },
  ringSection:   { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 24, gap: 12 },

  pageTitle:    { fontSize: 30, fontFamily: FONTS.heading, color: COLORS.darkGreen, marginBottom: 8 },
  sectionTitle: { fontSize: 22, fontFamily: FONTS.heading, color: COLORS.darkGreen, marginBottom: 4 },
  sectionNote:  { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 18 },
  mutedText:    { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },
  errorText:    { fontSize: 13, fontFamily: FONTS.body, color: COLORS.error, textAlign: 'center' },
  link:         { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, textAlign: 'center', paddingVertical: 14 },

  plantRow:  { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightBg, gap: 4 },
  plantHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  plantName: { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, flexShrink: 1 },
  whyLine:   { paddingVertical: 6 },
  plantWhy:  { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: 19 },

  countRow:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 12 },
  countItem:  { alignItems: 'center', width: 90 },
  countNum:   { fontSize: 24, fontFamily: FONTS.heading },
  countLabel: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },

  btn:            { backgroundColor: COLORS.darkGreen, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnDisabled:    { opacity: 0.45 },
  btnText:        { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.cream },
  btnOutline:     { borderWidth: 1.5, borderColor: COLORS.darkGreen, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnOutlineText: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },

  letterCard: {
    marginTop: 16, backgroundColor: COLORS.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 16, gap: 8,
  },
  letterInput: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.textBody,
    lineHeight: 22, backgroundColor: COLORS.lightBg, borderRadius: 8, padding: 12, minHeight: 520,
  },

  ctaSection: { padding: 24, paddingBottom: 52 },
});
