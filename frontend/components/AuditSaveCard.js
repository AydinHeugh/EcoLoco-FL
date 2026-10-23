import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPE, LINE } from '../theme';

export default function AuditSaveCard({ name, onNameChange, onSave, onNew, onViewSaved, saved, wasSaved, busy, disabled, error }) {
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <MaterialCommunityIcons name={saved ? 'bookmark-check-outline' : 'bookmark-outline'} size={24} color={COLORS.softGreen} />
        <Text accessibilityRole="header" style={styles.title}>{saved ? 'Saved on this device' : 'Keep this audit'}</Text>
      </View>
      <Text style={styles.note}>Save your plants, ZIP code, plan and letter, then start another campus or place.</Text>
      <Text style={styles.label}>Campus or place name</Text>
      <TextInput
        value={name} onChangeText={onNameChange} maxLength={80}
        editable={!busy} placeholder="For example: North campus"
        placeholderTextColor={COLORS.textMuted} accessibilityLabel="Audit name"
        style={styles.input} returnKeyType="done"
      />
      <TouchableOpacity
        accessibilityRole="button" accessibilityState={{ disabled: disabled || busy || saved, busy }}
        style={[styles.button, (disabled || busy || saved) && styles.disabled]}
        onPress={onSave} disabled={disabled || busy || saved}
      >
        {busy ? <ActivityIndicator color={COLORS.onDark} /> : <Text style={styles.buttonText}>{saved ? 'Saved' : wasSaved ? 'Save changes' : 'Save audit'}</Text>}
      </TouchableOpacity>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Text accessibilityLiveRegion="polite" style={styles.note}>
        {saved ? 'Your audit is ready to reopen in Saved audits.' : wasSaved ? 'You have changes to save.' : 'Saved only on this device. You can reopen it without a connection.'}
      </Text>
      {saved && (
        <TouchableOpacity accessibilityRole="button" style={styles.outline} onPress={onNew}>
          <MaterialCommunityIcons name="plus" size={20} color={COLORS.darkGreen} />
          <Text style={styles.outlineText}>Start another audit</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity accessibilityRole="button" style={styles.linkButton} onPress={onViewSaved}>
        <Text style={styles.link}>View saved audits</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 20, padding: 20, borderRadius: 24, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: FONTS.heading, fontSize: TYPE.h3, lineHeight: LINE.h3, color: COLORS.darkGreen },
  note: { fontFamily: FONTS.body, fontSize: TYPE.caption, lineHeight: LINE.caption, color: COLORS.textMuted },
  label: { fontFamily: FONTS.bodyBold, fontSize: TYPE.caption, color: COLORS.darkGreen },
  input: { minHeight: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, backgroundColor: COLORS.white, fontFamily: FONTS.body, fontSize: TYPE.body, color: COLORS.textBody },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: COLORS.darkGreen, padding: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: FONTS.bodyBold, fontSize: TYPE.body, color: COLORS.onDark },
  outline: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  outlineText: { fontFamily: FONTS.bodyBold, fontSize: TYPE.body, color: COLORS.darkGreen },
  disabled: { opacity: 0.45 },
  error: { fontFamily: FONTS.body, fontSize: TYPE.body, lineHeight: LINE.body, color: COLORS.error },
  linkButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  link: { fontFamily: FONTS.bodyBold, fontSize: TYPE.link, color: COLORS.softGreen, textDecorationLine: 'underline' },
});
