import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions } from 'react-native';
import { DURATION, EASE_OUT, useReduceMotion } from '../motion';

const ScrollTick = createContext(null);
const STAGGER = 70;

export function RevealProvider({ children }) {
  const listeners = useRef(new Set()).current;
  const value = useRef({
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    tick: () => listeners.forEach(fn => fn()),
  }).current;
  return <ScrollTick.Provider value={value}>{children}</ScrollTick.Provider>;
}

export function useRevealScroll() {
  return useContext(ScrollTick)?.tick;
}

export function useInView(ref, margin = 40) {
  const scroll = useContext(ScrollTick);
  const [inView, setInView] = useState(!scroll);

  useEffect(() => {
    if (inView || !scroll) return undefined;
    const check = () => {
      ref.current?.measureInWindow?.((x, y) => {
        if (y < Dimensions.get('window').height - margin) setInView(true);
      });
    };
    const off = scroll.subscribe(check);
    const first = setTimeout(check, 60);
    return () => { off(); clearTimeout(first); };
  }, [inView, scroll]);

  return inView;
}

export default function Reveal({ index = 0, children, style }) {
  const reduce = useReduceMotion();
  const ref = useRef(null);
  const shown = useInView(ref);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!shown) return;
    if (reduce) { opacity.setValue(1); translateY.setValue(0); return; }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: DURATION, delay: Math.min(index, 4) * STAGGER, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: DURATION, delay: Math.min(index, 4) * STAGGER, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
  }, [shown, reduce]);

  return (
    <Animated.View ref={ref} collapsable={false} style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
