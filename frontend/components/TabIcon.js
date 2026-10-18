import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useReduceMotion } from '../motion';

const listeners = new Set();

export function tabPressed(routeName) {
  Haptics.selectionAsync().catch(() => {});
  listeners.forEach(fn => fn(routeName));
}

export default function TabIcon({ routeName, name, color, size }) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pop = pressed => {
      if (pressed !== routeName || reduce) return;
      scale.setValue(0.75);
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start();
    };
    listeners.add(pop);
    return () => listeners.delete(pop);
  }, [routeName, reduce]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}
