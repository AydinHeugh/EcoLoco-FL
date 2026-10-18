import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export const auditStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f0e8' },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 42, paddingBottom: 56, gap: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  card: { backgroundColor: '#fefcf8', borderWidth: 1, borderColor: '#deded2', borderRadius: 16, padding: 20, gap: 12 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 32, color: '#1e3a1e' },
  heading: { fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#1e3a1e' },
  body: { fontFamily: 'DMSans_400Regular', color: '#4a4a3a', fontSize: 14, lineHeight: 22 },
  muted: { fontFamily: 'DMSans_400Regular', color: '#707767', fontSize: 12, lineHeight: 19 },
  label: { fontFamily: 'DMSans_700Bold', color: '#415039', fontSize: 12 },
  field: { gap: 7, flexGrow: 1 },
  input: { borderWidth: 1, borderColor: '#d0d5c7', borderRadius: 10, padding: 13, backgroundColor: '#fcfaf5', color: '#293b27', fontFamily: 'DMSans_400Regular', fontSize: 15, minHeight: 48 },
  button: { backgroundColor: '#1e3a1e', borderWidth: 1, borderColor: '#1e3a1e', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 18, minHeight: 46, justifyContent: 'center', alignItems: 'center' },
  secondary: { backgroundColor: '#fefcf8' },
  buttonText: { fontFamily: 'DMSans_700Bold', color: '#fff', fontSize: 14 },
  secondaryText: { color: '#1e3a1e' },
  disabled: { opacity: 0.45 },
  notice: { backgroundColor: '#eaeee5', borderRadius: 10, padding: 12, gap: 8 },
  error: { backgroundColor: '#fbe9e4', borderWidth: 1, borderColor: '#c59b8c' },
  modalShade: { flex: 1, backgroundColor: '#102410bb', alignItems: 'center', justifyContent: 'center', padding: 22 },
  modal: { backgroundColor: '#f5f0e8', borderRadius: 18, width: '100%', maxWidth: 650, maxHeight: '85%', padding: 22, gap: 16 },
});

export function AuditButton({ children, onPress, disabled, secondary, style, textStyle, ...props }) {
  return <TouchableOpacity accessibilityRole="button" aria-disabled={Boolean(disabled)} accessibilityState={{ disabled: Boolean(disabled) }} {...props} onPress={onPress} disabled={disabled} style={[auditStyles.button, secondary && auditStyles.secondary, style, disabled && auditStyles.disabled]}>
    <Text style={[auditStyles.buttonText, secondary && auditStyles.secondaryText, textStyle]}>{children}</Text>
  </TouchableOpacity>;
}

export function AuditField({ label, ...props }) {
  return <View style={auditStyles.field}>
    <Text style={auditStyles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor="#687260" {...props} style={[auditStyles.input, props.multiline && { minHeight: 100, textAlignVertical: 'top' }, props.style]} />
  </View>;
}

export function AuditNotice({ children, error = false }) {
  return <View style={[auditStyles.notice, error && auditStyles.error]} accessibilityLiveRegion="polite">
    {typeof children === 'string' ? <Text style={auditStyles.body}>{children}</Text> : children}
  </View>;
}

export function AuditPage({ children }) {
  return <ScrollView style={auditStyles.page} contentContainerStyle={auditStyles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}
