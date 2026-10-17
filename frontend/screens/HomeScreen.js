import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';

const LOGO = require('../../assets/EcoLoco_logo.png');
const IMG_SCANNING = require('../../assets/EcoLoco_Scanning_Plant.png');
const IMG_GROW = require('../../assets/GrowWithConfidence_Ecoloco.png');
const IMG_ECOSYSTEM = require('../../assets/EcoLoco_ecosystem.png');

function FeatureRow({ number, image, heading, body, linkText, onPress, wide, fontsLoaded }) {
  return <View style={[styles.feature, !wide && styles.featureSmall]}>
    <Image source={image} style={[styles.featureImage, !wide && styles.featureImageSmall]} resizeMode="cover" accessibilityLabel={`${heading} illustration`} />
    <View style={styles.featureText}>
      <Text style={styles.step}>STEP {number}</Text>
      <Text accessibilityRole="header" style={[styles.featureHeading, fontsLoaded && { fontFamily: 'Fraunces_700Bold' }]}>{heading}</Text>
      <Text style={styles.body}>{body}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.linkButton}><Text style={styles.link}>{linkText} →</Text></TouchableOpacity>
    </View>
  </View>;
}

export default function HomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ Fraunces_400Regular, Fraunces_700Bold });
  return <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
    <View style={[styles.inner, { width: Math.min(width, 960) }]}>
      <View style={styles.header}><Image source={LOGO} style={styles.logo} accessibilityLabel="EcoLoco" /><Text style={[styles.brand, fontsLoaded && { fontFamily: 'Fraunces_700Bold' }]}>EcoLoco</Text></View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>FROM YOUR CAMPUS TO A PLANTING PLAN</Text>
        <Text accessibilityRole="header" style={[styles.heroHeading, fontsLoaded && { fontFamily: 'Fraunces_400Regular' }, width < 500 && { fontSize: 34, lineHeight: 43 }]}>Turn your school’s plant survey into a habitat improvement plan.</Text>
        <Text style={styles.tagline}>Identify plants, review Florida sources, and prepare a proposal for your school.</Text>
        <View style={styles.heroButtons}>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('EcoScan', { sample: false })} style={styles.primaryButton}><Text style={styles.primaryText}>Start a campus audit</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('EcoScan', { sample: true })} style={styles.secondaryButton}><Text style={styles.secondaryText}>Explore a sample audit</Text></TouchableOpacity>
        </View>
        <Text style={styles.scope}>South Florida pilot · ZIP prefixes 330–334</Text>
        <View style={styles.steps}><Text style={styles.stepsText}>Survey</Text><Text style={styles.arrow}>→</Text><Text style={styles.stepsText}>Review</Text><Text style={styles.arrow}>→</Text><Text style={styles.stepsText}>Propose</Text></View>
      </View>
      <FeatureRow number="01" image={IMG_SCANNING} heading="Survey what is growing" body="Photograph plants on a defined part of your campus. Compare identification alternatives and keep unresolved observations visible. Your audit saves on this device so you can return to it." linkText="Identify one plant" onPress={() => navigation.navigate('Camera')} wide={width > 550} fontsLoaded={fontsLoaded} />
      <FeatureRow number="02" image={IMG_GROW} heading="Review the evidence" body="See which verified species are native, nonnative or invasive in Florida. Read the sources and find native additions that fit the sunlight, moisture, space and care available at your site." linkText="Explore planting options" onPress={() => navigation.navigate('Recommend')} wide={width > 550} fontsLoaded={fontsLoaded} />
      <FeatureRow number="03" image={IMG_ECOSYSTEM} heading="Propose a practical next step" body="Turn observations and selected plants into an editable school proposal. Include where to plant, the budget and who will maintain it. A native-species percentage describes your sample; it is not a measurement of the whole campus’s biodiversity." linkText="Build your campus proposal" onPress={() => navigation.navigate('EcoScan', { sample: false })} wide={width > 550} fontsLoaded={fontsLoaded} />
      <View style={styles.note}><Text style={styles.noteTitle}>Make the next survey real.</Text><Text style={styles.body}>Sample observations show how EcoLoco works. For your own proposal, record the survey area and date, check uncertain identifications, and ask your school before changing the grounds. Track plant survival and wildlife observations after an approved planting.</Text></View>
      <View style={styles.footer}><Image source={LOGO} style={styles.footerLogo} /><Text style={styles.footerText}>EcoLoco · Observe, learn, and care for your campus.</Text></View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' }, scrollContent: { alignItems: 'center' }, inner: { alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 24, paddingTop: 48, borderBottomWidth: 1, borderColor: '#d4cfc4' },
  logo: { width: 40, height: 40 }, brand: { fontSize: 22, fontWeight: '700', color: '#1e3a1e' },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 22, borderBottomWidth: 1, borderColor: '#d4cfc4' },
  eyebrow: { color: '#4a7a3a', fontWeight: '700', fontSize: 11, letterSpacing: 1.6, textAlign: 'center' },
  heroHeading: { color: '#1e3a1e', fontSize: 43, lineHeight: 53, textAlign: 'center', maxWidth: 790 },
  tagline: { color: '#4a4a3a', fontSize: 16, lineHeight: 25, textAlign: 'center', maxWidth: 560 },
  heroButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  primaryButton: { backgroundColor: '#1e3a1e', paddingHorizontal: 24, paddingVertical: 15, borderRadius: 10, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fffdf8', fontSize: 15, fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#1e3a1e', paddingHorizontal: 24, paddingVertical: 15, borderRadius: 10, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#1e3a1e', fontSize: 15, fontWeight: '600' },
  scope: { color: '#646454', fontSize: 12 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#eaeee6', padding: 14, borderRadius: 24 },
  stepsText: { color: '#1e3a1e', fontSize: 13, fontWeight: '700' }, arrow: { color: '#4a7a3a' },
  feature: { flexDirection: 'row', alignItems: 'center', padding: 24, gap: 28, borderBottomWidth: 1, borderColor: '#d4cfc4' },
  featureSmall: { alignItems: 'stretch', flexDirection: 'column', gap: 20 },
  featureImage: { width: '42%', height: 260, borderRadius: 16, backgroundColor: '#eaeee6' },
  featureImageSmall: { width: '100%', height: 220 },
  featureText: { flex: 1, gap: 11 }, step: { color: '#4a7a3a', letterSpacing: 1.5, fontSize: 11, fontWeight: '700' },
  featureHeading: { color: '#1e3a1e', fontSize: 25, lineHeight: 33, fontWeight: '700' }, body: { color: '#4a4a3a', fontSize: 14, lineHeight: 23 },
  linkButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: '#1e3a1e', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  note: { margin: 24, padding: 24, borderRadius: 16, backgroundColor: '#eaeee6', gap: 10 }, noteTitle: { fontWeight: '700', fontSize: 20, color: '#1e3a1e' },
  footer: { alignItems: 'center', padding: 24, gap: 10 }, footerLogo: { width: 30, height: 30, opacity: 0.7 }, footerText: { fontSize: 12, color: '#646454', textAlign: 'center' },
});
