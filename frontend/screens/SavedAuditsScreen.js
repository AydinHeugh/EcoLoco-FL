import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenLayout from '../components/ScreenLayout';
import { savedAudits } from '../services/savedAudits';
import { startAudit } from '../startAudit';
import { COLORS, FONTS, FONT_ASSETS, TYPE, LINE } from '../theme';

export default function SavedAuditsScreen({ navigation }) {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useFocusEffect(useCallback(() => {
    let current = true;
    setLoading(true);
    setError(null);
    savedAudits.list()
      .then(items => { if (current) setAudits(items); })
      .catch(() => { if (current) setError('Could not load saved audits. Please try again.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [attempt]));

  async function remove(audit) {
    setDeleting(audit.id);
    setError(null);
    try {
      await savedAudits.remove(audit.id);
      setAudits(items => items.filter(a => a.id !== audit.id));
    } catch {
      setError('Could not delete this audit. It is still saved. Please try again.');
    } finally {
      setDeleting(null);
    }
  }

  function confirmDelete(audit) {
    const message = `Delete “${audit.name}” from this device? This cannot be undone.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) remove(audit);
    } else {
      Alert.alert('Delete saved audit?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(audit) },
      ]);
    }
  }

  if (!fontsLoaded) return <View style={styles.screen} />;

  return (
    <ScreenLayout title="Saved audits" subtitle="A place for every campus, garden or schoolyard you check." contentWidth={760}
      right={(
        <TouchableOpacity accessibilityRole="button" style={styles.textButton} onPress={() => navigation.goBack()}>
          <Text style={styles.link}>← Back</Text>
        </TouchableOpacity>
      )}>
      <TouchableOpacity accessibilityRole="button" style={styles.newButton}
        onPress={() => startAudit(() => navigation.popTo('Main', { screen: 'EcoScan' }))}>
        <MaterialCommunityIcons name="plus" size={20} color={COLORS.onDark} />
        <Text style={styles.newText}>New audit</Text>
      </TouchableOpacity>
      <Text style={styles.note}>Saved only on this device. Your results, plan and letter can be opened without a connection.</Text>

      {loading && <ActivityIndicator accessibilityLabel="Loading saved audits" color={COLORS.softGreen} style={styles.loading} />}
      {error && (
        <View style={styles.empty}>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.textButton} onPress={() => setAttempt(a => a + 1)}>
            <Text style={styles.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}
      {!loading && !error && audits.length === 0 && (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="bookmark-outline" size={36} color={COLORS.softGreen} />
          <Text accessibilityRole="header" style={styles.title}>Your first audit starts here</Text>
          <Text style={styles.emptyNote}>Check the plants at a place, open your results, then give the audit a name and save it.</Text>
        </View>
      )}
      {!loading && audits.map(audit => {
        const count = audit.request.plants.length;
        const percent = audit.plan.summary.percent_native;
        return (
          <View key={audit.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.icon}><MaterialCommunityIcons name="bookmark-check-outline" size={24} color={COLORS.softGreen} /></View>
              <View style={styles.cardHeading}>
                <Text accessibilityRole="header" style={styles.title}>{audit.name}</Text>
                <Text style={styles.note}>ZIP {audit.zipCode} · {count} plant{count === 1 ? '' : 's'}{percent == null ? '' : ` · ${percent}% native`}</Text>
              </View>
            </View>
            <Text style={styles.note}>Saved {new Date(audit.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            <View style={styles.actions}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open ${audit.name}`}
                style={styles.openButton} onPress={() => navigation.push('AuditResults', { savedAudit: audit })}>
                <Text style={styles.openText}>Open audit →</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${audit.name}`}
                disabled={deleting !== null} style={styles.textButton} onPress={() => confirmDelete(audit)}>
                {deleting === audit.id ? <ActivityIndicator color={COLORS.terracotta} /> : <Text style={styles.deleteText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  newButton: { minHeight: 50, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.darkGreen, padding: 14, borderRadius: 12, marginBottom: 12 },
  newText: { color: COLORS.onDark, fontFamily: FONTS.bodyBold, fontSize: TYPE.body },
  note: { color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: TYPE.caption, lineHeight: LINE.caption },
  loading: { marginTop: 32 },
  empty: { paddingVertical: 44, alignItems: 'center', gap: 14 },
  emptyNote: { color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: TYPE.body, lineHeight: LINE.body, textAlign: 'center', maxWidth: 400 },
  title: { color: COLORS.darkGreen, fontFamily: FONTS.heading, fontSize: TYPE.h3, lineHeight: LINE.h3, flexShrink: 1 },
  card: { marginTop: 20, backgroundColor: COLORS.cardBg, padding: 20, borderRadius: 24, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardHeading: { flex: 1, minWidth: 0, gap: 6 },
  icon: { width: 44, height: 44, backgroundColor: COLORS.lightBg, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  openButton: { flex: 1, minHeight: 48, padding: 12, borderRadius: 12, backgroundColor: COLORS.lightBg, alignItems: 'center', justifyContent: 'center' },
  openText: { fontFamily: FONTS.bodyBold, fontSize: TYPE.link, color: COLORS.darkGreen },
  textButton: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  link: { fontFamily: FONTS.bodyBold, fontSize: TYPE.caption, color: COLORS.darkGreen, textDecorationLine: 'underline' },
  deleteText: { fontFamily: FONTS.bodyBold, fontSize: TYPE.caption, color: COLORS.terracotta, textDecorationLine: 'underline' },
  error: { fontFamily: FONTS.body, fontSize: TYPE.body, lineHeight: LINE.body, color: COLORS.error, textAlign: 'center' },
});
