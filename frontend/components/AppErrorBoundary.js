import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default class AppErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={styles.page}>
      <Text accessibilityRole="header" style={styles.title}>Let’s reopen EcoLoco</Text>
      <Text style={styles.body}>This screen could not be displayed. Reopening the app keeps the audit and proposal already saved on this device. Unsaved photos or edits may need to be added again.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => this.setState({ failed: false })} style={styles.button}>
        <Text style={styles.buttonText}>Return to Home</Text>
      </TouchableOpacity>
    </View>;
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#faf8ef', padding: 28, justifyContent: 'center', alignItems: 'center', gap: 20 },
  title: { fontSize: 28, color: '#1e3a1e', fontWeight: '700' },
  body: { maxWidth: 600, fontSize: 16, lineHeight: 25, color: '#454c3d' },
  button: { backgroundColor: '#1e3a1e', paddingVertical: 15, paddingHorizontal: 24, borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
