import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { STATUS_COLORS, FONTS, TYPE } from '../theme';
import { DURATION, USE_NATIVE_DRIVER, feelResult, useReduceMotion } from '../motion';

export default function StatusBadge({ status, label, pop = false }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(pop ? 0.6 : 1)).current;
  const opacity = useRef(new Animated.Value(pop ? 0 : 1)).current;

  useEffect(() => {
    if (!pop) return;
    feelResult(status);
    if (reduce) { scale.setValue(1); opacity.setValue(1); return; }
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, speed: 22, bounciness: 9, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(opacity, { toValue: 1, duration: DURATION / 2, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [pop, reduce]);

  return (
    <Animated.View style={[styles.wrap, { backgroundColor: c.bg, opacity, transform: [{ scale }] }]}>
      <Text style={[styles.text, { color: c.color }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  text: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold },
});
