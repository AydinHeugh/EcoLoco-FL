import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { COUNT_MS, EASE_OUT, useReduceMotion } from '../motion';
import { useInView } from './Reveal';

export function useCountUp(target, play, delay = 0, duration = COUNT_MS) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduce) { setShown(target); return undefined; }
    if (!play) return undefined;
    progress.setValue(0);
    const id = progress.addListener(({ value }) => setShown(Math.round(value * target)));
    Animated.timing(progress, { toValue: 1, duration, delay, easing: EASE_OUT, useNativeDriver: false }).start();
    return () => progress.removeListener(id);
  }, [target, play, reduce]);

  return shown;
}

export default function CountUp({ value, style, delay = 0 }) {
  const ref = useRef(null);
  const play = useInView(ref);
  const target = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
  const shown = useCountUp(target, play, delay);
  return (
    <View ref={ref} collapsable={false}>
      <Text style={style} accessibilityLabel={String(value)}>{shown.toLocaleString('en-US')}</Text>
    </View>
  );
}
