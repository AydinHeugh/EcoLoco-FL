import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, useWindowDimensions } from 'react-native';
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
  const { width, height } = useWindowDimensions();
  const [inView, setInView] = useState(!scroll);

  useEffect(() => {
    if (inView || !scroll) return undefined;
    const check = () => {
      ref.current?.measureInWindow?.((x, y) => {
        if (y < height - margin) setInView(true);
      });
    };
    const off = scroll.subscribe(check);
    const first = setTimeout(check, 60);
    return () => { off(); clearTimeout(first); };
  }, [inView, scroll, width, height, margin, ref]);

  return inView;
}

export default function Reveal({ index = 0, children, style, scaleFrom = 1, distance = 16, duration = DURATION }) {
  const reduce = useReduceMotion();
  const ref = useRef(null);
  const shown = useInView(ref);
  const notifyLayout = useRevealScroll();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(distance)).current;
  const scale = useRef(new Animated.Value(scaleFrom)).current;

  useEffect(() => {
    if (!shown) return;
    if (reduce) { opacity.setValue(1); translateY.setValue(0); scale.setValue(1); return; }
    const delay = Math.min(index, 4) * STAGGER;
    Animated.parallel([opacity, translateY, scale].map((value, i) =>
      Animated.timing(value, { toValue: i === 1 ? 0 : 1, duration, delay, easing: EASE_OUT, useNativeDriver: true }),
    )).start();
  }, [shown, reduce]);

  return (
    <Animated.View ref={ref} onLayout={notifyLayout} collapsable={false} style={[style, { opacity, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}
