import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';

export const DURATION = 300;
export const COUNT_MS = 1100;
export const BAR_MS = 1400;
export const COUNT_STAGGER = 220;
export const FOCUS_MS = 550;
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(on => { if (live) setReduce(on); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => { live = false; sub?.remove?.(); };
  }, []);
  return reduce;
}

export function useDelayedFlag(flag, ms = 400) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!flag) { setLate(false); return undefined; }
    const id = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(id);
  }, [flag]);
  return late;
}

export function feelResult(status) {
  const done = status === 'invasive'
    ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  done.catch(() => {});
}
