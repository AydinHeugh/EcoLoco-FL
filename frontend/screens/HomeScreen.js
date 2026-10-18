import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, useWindowDimensions, Animated, Easing, AccessibilityInfo } from 'react-native';
import { useFonts } from 'expo-font';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Fraunces_700Bold_Italic } from '@expo-google-fonts/fraunces/700Bold_Italic';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import Ionicons from '@expo/vector-icons/Ionicons';

const LOGO = require('../../assets/EcoLoco_logo.png');
const IMG_SCANNING = require('../../assets/EcoLoco_Scanning_Plant.png');
const IMG_POLLINATORS = require('../../assets/EcoLoco_support_polinators.png');
const IMG_GROW = require('../../assets/GrowWithConfidence_Ecoloco.png');
const IMG_ECOSYSTEM = require('../../assets/EcoLoco_ecosystem.png');

function Entry({ children, delay = 0, style }) {
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let active = true;
    let animation;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active || reduced) return;
      progress.setValue(0);
      animation = Animated.timing(progress, { toValue: 1, duration: 480, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
      animation.start();
    }).catch(() => {});
    return () => { active = false; animation?.stop(); };
  }, [delay, progress]);
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{children}</Animated.View>;
}

function FeatureRow({ image, heading, body, linkText, onPress, reverse, compact, fontsLoaded, delay }) {
  const picture = <Image source={image} style={[styles.featureImage, compact && styles.featureImageSmall]} resizeMode="cover" accessibilityLabel={`${heading} illustration`} />;
  const copy = <View style={styles.featureText}>
    <Text accessibilityRole="header" style={[styles.featureHeading, compact && styles.featureHeadingSmall, fontsLoaded && styles.serifBold]}>{heading}</Text>
    <Text style={[styles.body, fontsLoaded && styles.sans]}>{body}</Text>
    {linkText && <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.linkButton}><Text style={[styles.link, fontsLoaded && styles.sansBold]}>{linkText} →</Text></TouchableOpacity>}
  </View>;
  return <Entry delay={delay} style={[styles.feature, compact && styles.featureSmall]}>{reverse ? <>{copy}{picture}</> : <>{picture}{copy}</>}</Entry>;
}

export default function HomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ Fraunces_400Regular, Fraunces_700Bold, Fraunces_700Bold_Italic, DMSans_400Regular, DMSans_700Bold });
  const shared = { compact: width < 600, fontsLoaded };
  return <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
    <View style={[styles.inner, { width: Math.min(width, 960) }]}>
      <View style={styles.header}><Image source={LOGO} style={styles.logo} accessibilityLabel="EcoLoco" /><Text style={[styles.brand, fontsLoaded && styles.serifBold]}>EcoLoco</Text></View>
      <Entry style={styles.hero}>
        <Text accessibilityRole="header" style={[styles.heroHeading, width < 500 && styles.heroHeadingSmall, fontsLoaded && styles.serif]}>Welcome to <Text style={fontsLoaded ? styles.serifItalic : { fontStyle: 'italic' }}>EcoLoco</Text></Text>
        <View style={styles.ornament} accessible={false}><View style={styles.ornamentLine} /><View style={styles.diamond} /><View style={styles.ornamentLine} /></View>
        <Text style={[styles.tagline, fontsLoaded && styles.sans]}>Get to know the plants around you.</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Camera')} style={styles.primaryButton}><Ionicons name="camera-outline" size={20} color="#f5f0e8" /><Text style={[styles.primaryText, fontsLoaded && styles.sansBold]}>Scan a plant</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('EcoScan', { sample: true })} style={styles.sampleButton}><Text style={[styles.sampleText, fontsLoaded && styles.sans]}>Explore a sample audit →</Text></TouchableOpacity>
      </Entry>
      <FeatureRow {...shared} delay={90} image={IMG_SCANNING} heading="Identify Plants" body="Take a photo to discover its name and whether it’s native, nonnative or invasive in Florida." linkText="Go to Identification" onPress={() => navigation.navigate('Camera')} />
      <FeatureRow {...shared} delay={150} reverse image={IMG_POLLINATORS} heading="Support Pollinators" body="Learn how local plants provide food and shelter for butterflies, birds and other wildlife." />
      <FeatureRow {...shared} delay={210} image={IMG_GROW} heading="Grow with Confidence" body="Find native plants for your site, with growing needs and sources you can explore." linkText="Find native plants" onPress={() => navigation.navigate('Recommend')} />
      <FeatureRow {...shared} delay={270} reverse image={IMG_ECOSYSTEM} heading="Help Your Ecosystem" body="Survey your school grounds and turn what you learn into a practical planting proposal." linkText="Open EcoScan" onPress={() => navigation.navigate('EcoScan', { sample: false })} />
      <View style={styles.footer}><Image source={LOGO} style={styles.footerLogo} /><Text style={[styles.footerText, fontsLoaded && styles.sans]}>EcoLoco · Growing communities, one plant at a time</Text></View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' }, scrollContent: { alignItems: 'center' }, inner: { alignSelf: 'center' },
  serif: { fontFamily: 'Fraunces_400Regular' }, serifBold: { fontFamily: 'Fraunces_700Bold' }, serifItalic: { fontFamily: 'Fraunces_700Bold_Italic' }, sans: { fontFamily: 'DMSans_400Regular' }, sansBold: { fontFamily: 'DMSans_700Bold' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#d4cfc4' },
  logo: { width: 40, height: 40, resizeMode: 'contain' }, brand: { fontSize: 20, color: '#1e3a1e' },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 38, paddingBottom: 24, borderBottomWidth: 1, borderColor: '#d4cfc4' },
  heroHeading: { color: '#1e3a1e', fontSize: 43, lineHeight: 55, textAlign: 'center' }, heroHeadingSmall: { fontSize: 34, lineHeight: 44 },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: 12, width: 150, marginTop: 18, marginBottom: 18 }, ornamentLine: { flex: 1, height: 1, backgroundColor: '#c6cbbc' }, diamond: { width: 6, height: 6, transform: [{ rotate: '45deg' }], backgroundColor: '#4a7a3a', opacity: 0.65 },
  tagline: { color: '#4a4a3a', fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 22 },
  primaryButton: { backgroundColor: '#1e3a1e', paddingHorizontal: 28, paddingVertical: 15, borderRadius: 10, minHeight: 50, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#f5f0e8', fontSize: 15 },
  sampleButton: { minHeight: 44, justifyContent: 'center', marginTop: 5 }, sampleText: { color: '#4a4a3a', fontSize: 13 },
  feature: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 28, gap: 30, borderBottomWidth: 1, borderColor: '#d4cfc4' }, featureSmall: { paddingHorizontal: 20, gap: 18 },
  featureImage: { width: '42%', height: 250, borderRadius: 16, backgroundColor: '#eaeee6' }, featureImageSmall: { height: 190 }, featureText: { flex: 1, gap: 9 },
  featureHeading: { color: '#1e3a1e', fontSize: 27, lineHeight: 35 }, featureHeadingSmall: { fontSize: 21, lineHeight: 28 }, body: { color: '#4a4a3a', fontSize: 13, lineHeight: 21 },
  linkButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: '#1e3a1e', fontSize: 12, textDecorationLine: 'underline', lineHeight: 20 },
  footer: { alignItems: 'center', padding: 28, gap: 9 }, footerLogo: { width: 26, height: 26, resizeMode: 'contain', opacity: 0.5 }, footerText: { fontSize: 11, color: '#646454', textAlign: 'center' },
});
