import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View, StyleSheet } from 'react-native';
import { useReduceMotion } from '../motion';

const HOLD_MS = 3200;
const SWAP_MS = 220;

export default function RotatingLine({ lines, style }) {
  const reduce = useReduceMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), '');

  useEffect(() => {
    if (reduce || paused) return undefined;
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: SWAP_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
        setIndex(i => (i + 1) % lines.length);
        Animated.timing(fade, { toValue: 1, duration: SWAP_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });
    }, HOLD_MS);
    return () => clearInterval(timer);
  }, [reduce, paused, lines.length]);

  const rise = fade.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  return (
    <Pressable onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityRole="header" accessibilityLabel={lines[0]}>
      <View>
        <Text style={[style, styles.ghost]} aria-hidden accessible={false}>{longest}</Text>
        <Animated.Text style={[style, styles.live, { opacity: fade, transform: [{ translateY: rise }] }]} accessible={false}>
          {lines[index]}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ghost: { opacity: 0 },
  live: { ...StyleSheet.absoluteFillObject },
});
