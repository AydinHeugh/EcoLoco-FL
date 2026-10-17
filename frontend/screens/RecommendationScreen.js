import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Image, useWindowDimensions, Linking,
} from 'react-native';
import { useFonts } from 'expo-font';
import { getPlantRecommendations, userMessage } from '../services/geminiService';
import { COLORS, FONTS, FONT_ASSETS } from '../theme';
import PlanCard from '../components/PlanCard';

const LOGO = require('../../assets/EcoLoco_logo.png');
const NURSERY_URL = 'https://plantrealflorida.org';

export default function RecommendationScreen({ route }) {
  const prefillZip = route?.params?.prefillZip ?? '';
  const [zipCode, setZipCode] = useState(prefillZip);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error,   setError]   = useState(null);

  const { width } = useWindowDimensions();
  const maxWidth  = Math.min(width, 960);

  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useEffect(() => {
    if (prefillZip?.length === 5) {
      setZipCode(prefillZip);
      handleRecommend(prefillZip);
    }
  }, [prefillZip]);

  async function handleRecommend(zip) {
    const target = zip ?? zipCode;
    setError(null);
    if (!/^\d{5}$/.test(target)) {
      setError('Enter a 5-digit ZIP code.');
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const data = await getPlantRecommendations(target);
      setResults(data.result);
    } catch (err) {
      setError(userMessage(err, 'Could not get recommendations. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  }

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.inner, { width: maxWidth }]}>

        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image source={LOGO} style={styles.logoImg} />
            <Text style={styles.logoText}>EcoLoco</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Native plants to add</Text>
          <Text style={styles.pageSubtitle}>
            Enter your school's ZIP code to see Florida native plants that help wildlife.
          </Text>
        </View>

        <View style={styles.inputSection}>
          <TextInput
            style={styles.input}
            placeholder="Enter ZIP code"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            maxLength={5}
            value={zipCode}
            onChangeText={t => setZipCode(t.replace(/[^0-9]/g, '').slice(0, 5))}
          />
          <TouchableOpacity
            style={[styles.btn, (zipCode.length !== 5 || loading) && styles.btnDisabled]}
            onPress={() => handleRecommend()}
            disabled={loading || zipCode.length !== 5}
          >
            {loading
              ? <ActivityIndicator color={COLORS.cream} size="small" />
              : <Text style={styles.btnText}>Show plants</Text>
            }
          </TouchableOpacity>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {results && !loading && (
          <View style={styles.resultsSection}>
            {results.length === 0
              ? <Text style={styles.emptyText}>No plants are ready to recommend yet. Our team is still checking each one.</Text>
              : results.map(card => <PlanCard key={card.scientific_name} card={card} kind="add" />)}
            <TouchableOpacity onPress={() => Linking.openURL(NURSERY_URL)}>
              <Text style={styles.link}>Find a native plant nursery near you (plantrealflorida.org) →</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  scrollContent: { alignItems: 'center' },
  inner: { alignSelf: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 52, paddingBottom: 16,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 40, height: 40, resizeMode: 'contain' },
  logoText: { fontSize: 20, fontFamily: FONTS.heading, color: COLORS.darkGreen, letterSpacing: 0.3 },

  divider: { height: 1, backgroundColor: COLORS.border },

  titleSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24 },
  pageTitle: { fontSize: 30, fontFamily: FONTS.heading, color: COLORS.darkGreen, marginBottom: 6, textAlign: 'center' },
  pageSubtitle: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },

  inputSection: { paddingHorizontal: 20, gap: 12, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.white, color: COLORS.textBody, borderRadius: 10,
    padding: 13, fontSize: 14, fontFamily: FONTS.body,
    borderWidth: 1, borderColor: COLORS.border,
  },
  btn: { backgroundColor: COLORS.darkGreen, borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 15, fontFamily: FONTS.bodyBold, color: COLORS.cream },
  errorText: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.error, textAlign: 'center' },

  resultsSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  emptyText: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', marginBottom: 16 },
  link: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, textAlign: 'center', paddingVertical: 14 },
});
