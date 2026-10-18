import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { isLoaded } from 'expo-font';

export default class AppErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={styles.page}>
      <Text accessibilityRole="header" style={[styles.title, isLoaded('Fraunces_700Bold') && { fontFamily: 'Fraunces_700Bold' }]}>Let’s try that again.</Text>
      <Text style={[styles.body, isLoaded('DMSans_400Regular') && { fontFamily: 'DMSans_400Regular' }]}>Your saved audit is still on this device. Unsaved edits may need to be added again.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => this.setState({ failed: false })} style={styles.button}>
        <Text style={styles.buttonText}>Reopen EcoLoco</Text>
      </TouchableOpacity>
    </View>;
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f0e8', padding: 28, justifyContent: 'center', alignItems: 'center', gap: 20 },
  title: { fontSize: 28, color: '#1e3a1e', fontWeight: '700' },
  body: { maxWidth: 390, textAlign: 'center', fontSize: 16, lineHeight: 25, color: '#454c3d' },
  button: { backgroundColor: '#1e3a1e', paddingVertical: 15, paddingHorizontal: 24, borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
