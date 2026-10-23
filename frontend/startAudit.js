import { Alert, Platform } from 'react-native';
import { clearAudit, currentAudit } from './auditDraft';

export function startAudit(onStart, savedCurrent = false) {
  const start = () => { clearAudit(); onStart(); };
  if (savedCurrent || currentAudit().plants.length === 0) { start(); return; }
  const message = 'Your current scan will be cleared. To keep any unsaved changes, open its results and save the audit first. Saved audits will stay on this device.';
  if (Platform.OS === 'web') {
    if (window.confirm(`Start a new audit?\n\n${message}`)) start();
  } else {
    Alert.alert('Start a new audit?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start new audit', style: 'destructive', onPress: start },
    ]);
  }
}
