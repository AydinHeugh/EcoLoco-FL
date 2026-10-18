import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, useWindowDimensions, Linking,
} from 'react-native';
import { useFonts } from 'expo-font';
import { getPlantRecommendations, userMessage } from '../services/geminiService';
import { COLORS, FONTS, FONT_ASSETS } from '../theme';
import PlanCard, { NOT_SOUTH_FLORIDA } from '../components/PlanCard';
import LocationPicker from '../components/LocationPicker';

const LOGO = require('../../assets/EcoLoco_logo.png');
const NURSERY_URL = 'https://plantrealflorida.org';

export default function RecommendationScreen({ route }) {
  const prefillZip = route?.params?.prefillZip ?? '';
  const [place,   setPlace]   = useState(prefillZip ? { zip: prefillZip } : null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error,   setError]   = useState(null);

  const { width } = useWindowDimensions();
  const maxWidth  = Math.min(width, 960);

  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useEffect(() => {
    if (prefillZip?.length === 5) {
      setPlace({ zip: prefillZip });
      handleRecommend(prefillZip);
    }
  }, [prefillZip]);

  async function handleRecommend(zip) {
    const target = zip ?? place?.zip ?? '';
    setError(null);
    if (!/^\d{5}$/.test(target)) {
      setError('Enter a 5-digit ZIP code.');
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const data = await getPlantRecommendations(target);
      setResults({ cards: data.result, southFlorida: data.south_florida !== false });
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
            Find your school's location to see Florida native plants that help wildlife.
          </Text>
        </View>

        <View style={styles.inputSection}>
          <LocationPicker place={place} onChange={found => { setPlace(found); handleRecommend(found.zip); }} />
          {loading && <ActivityIndicator color={COLORS.softGreen} size="small" />}
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {results && !loading && (
          <View style={styles.resultsSection}>
            {!results.southFlorida
              ? <Text style={styles.emptyText}>{NOT_SOUTH_FLORIDA}</Text>
              : results.cards.length === 0
                ? <Text style={styles.emptyText}>No plants are ready to recommend yet. Our team is still checking each one.</Text>
                : results.cards.map(card => <PlanCard key={card.scientific_name} card={card} kind="add" />)}
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
  errorText: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.error, textAlign: 'center' },

  resultsSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  emptyText: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', marginBottom: 16 },
  link: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, textAlign: 'center', paddingVertical: 14 },
});
