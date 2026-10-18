import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, useWindowDimensions, Linking,
} from 'react-native';
import { useFonts } from 'expo-font';
import { getPlantRecommendations, userMessage } from '../services/geminiService';
import { COLORS, FONTS, FONT_ASSETS, TYPE } from '../theme';
import PlanCard, { NOT_CHECKED_HERE } from '../components/PlanCard';
import SiteFilters, { ANY_SITE } from '../components/SiteFilters';
import ScreenHeader from '../components/ScreenHeader';
import Reveal, { RevealProvider, useRevealScroll } from '../components/Reveal';
import { PHOTOS } from '../photos';
import LocationPicker from '../components/LocationPicker';

const NURSERY_URL = 'https://plantrealflorida.org';

export default function RecommendationScreen(props) {
  return <RevealProvider><Recommendations {...props} /></RevealProvider>;
}

function Recommendations({ route }) {
  const onScroll = useRevealScroll();
  const prefillZip = route?.params?.prefillZip ?? '';
  const [place,   setPlace]   = useState(prefillZip ? { zip: prefillZip } : null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error,   setError]   = useState(null);
  const [site,    setSite]    = useState(ANY_SITE);

  const { width } = useWindowDimensions();
  const maxWidth  = Math.min(width, 960);

  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useEffect(() => {
    if (prefillZip?.length === 5) {
      setPlace({ zip: prefillZip });
      handleRecommend(prefillZip);
    }
  }, [prefillZip]);

  async function handleRecommend(zip, siteChoice = site) {
    const target = zip ?? place?.zip ?? '';
    setError(null);
    if (!/^\d{5}$/.test(target)) {
      setError('Enter a 5-digit ZIP code.');
      return;
    }
    setLoading(true);
    try {
      const data = await getPlantRecommendations(target, siteChoice);
      setResults({ cards: data.result, plantingsChecked: data.plantings_checked !== false, hidden: data.hidden_by_site ?? 0 });
    } catch (err) {
      setError(userMessage(err, 'Could not get recommendations. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  }

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
      onScroll={onScroll} scrollEventThrottle={64}>
      <View style={[styles.inner, { width: maxWidth }]}>

        <ScreenHeader
          photo={PHOTOS.recommend}
          photoLabel="A native plant garden"
          title="Native plants to add"
          subtitle="Find your school's location to see Florida native plants that help wildlife."
        />
        <View style={styles.headerGap} />

        <View style={styles.inputSection}>
          <LocationPicker place={place} onChange={found => { setPlace(found); handleRecommend(found.zip); }} />
          {loading && <ActivityIndicator color={COLORS.softGreen} size="small" />}
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {results && (
          <View style={styles.resultsSection}>
            {results.plantingsChecked && (
              <SiteFilters site={site} hidden={results.hidden} disabled={loading}
                onChange={next => { setSite(next); handleRecommend(place?.zip, next); }} />
            )}
            {!results.plantingsChecked
              ? <Text style={styles.emptyText}>{NOT_CHECKED_HERE}</Text>
              : results.cards.length === 0
                ? <Text style={styles.emptyText}>{results.hidden > 0 ? 'No checked plants fit all of those choices. Try setting one back to Any.' : 'No plants are ready to recommend yet. Our team is still checking each one.'}</Text>
                : results.cards.map((card, i) => (
                  <Reveal key={card.scientific_name} index={i}><PlanCard card={card} kind="add" /></Reveal>
                ))}
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

  headerGap: { height: 18 },

  inputSection: { paddingHorizontal: 20, gap: 12, marginBottom: 8 },
  errorText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.error, textAlign: 'center' },

  resultsSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  emptyText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', marginBottom: 16 },
  link: { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, textAlign: 'center', paddingVertical: 14, textDecorationLine: 'underline' },
});
