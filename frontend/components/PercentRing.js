import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, TYPE } from '../theme';
import { EASE_OUT, useReduceMotion } from '../motion';
import { useInView } from './Reveal';

const LEAVES = 50;
const FILL_MS = 1100;
const PLAN_MS = 700;
const STOPS = [[0, [178, 58, 46]], [50, [201, 154, 30]], [100, [46, 125, 50]]];

export function scoreColor(percent) {
  const p = Math.max(0, Math.min(100, percent));
  const [lo, hi] = p <= 50 ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]];
  const t = (p - lo[0]) / (hi[0] - lo[0]);
  const [r, g, b] = lo[1].map((c, i) => Math.round(c + (hi[1][i] - c) * t));
  return `rgb(${r}, ${g}, ${b})`;
}

function mood(percent) {
  if (percent >= 70) return { icon: 'emoticon-happy-outline', word: 'good' };
  if (percent >= 40) return { icon: 'emoticon-neutral-outline', word: 'okay' };
  return { icon: 'emoticon-sad-outline', word: 'low' };
}

function useRingProgress(play, delay) {
  const reduce = useReduceMotion();
  const fill = useRef(new Animated.Value(0)).current;
  const plan = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState({ fill: 0, plan: 0, moving: false });

  useEffect(() => {
    if (reduce) { setShown({ fill: 1, plan: 1, moving: false }); pop.setValue(1); return undefined; }
    if (!play) return undefined;
    const ids = [
      fill.addListener(({ value }) => setShown(s => ({ ...s, fill: value, moving: value < 1 }))),
      plan.addListener(({ value }) => setShown(s => ({ ...s, plan: value, moving: value < 1 }))),
    ];
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(fill, { toValue: 1, duration: FILL_MS, easing: EASE_OUT, useNativeDriver: false }),
      Animated.timing(plan, { toValue: 1, duration: PLAN_MS, easing: EASE_OUT, useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (!finished) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      Animated.spring(pop, { toValue: 1, friction: 6, tension: 180, useNativeDriver: true }).start();
    });
    return () => { fill.removeListener(ids[0]); plan.removeListener(ids[1]); };
  }, [play, reduce]);

  return { ...shown, pop };
}

export default function PercentRing({ now, withPlan, size = 180, title, caption = 'native now', delay = 0 }) {
  const ref = useRef(null);
  const play = useInView(ref, 80);
  const { fill, plan, moving, pop } = useRingProgress(play, delay);

  const shownNow = Math.round(fill * now);
  const shownPlan = shownNow + Math.round(plan * (withPlan - now));
  const leaf = size / 11;
  const radius = size / 2 - leaf * 0.75;
  const filledNow = Math.round((shownNow / 100) * LEAVES);
  const filledPlan = Math.round((shownPlan / 100) * LEAVES);
  const head = moving ? Math.max(filledNow, filledPlan) - 1 : -1;
  const nowColor = scoreColor(shownNow);
  const planColor = scoreColor(withPlan);
  const feeling = mood(now);
  const badge = Math.round(size * 0.24);

  return (
    <View ref={ref} collapsable={false} style={[styles.wrap, title && { width: size + 16 }]} accessible
      accessibilityLabel={`${title ? `${title}: ` : ''}${now}% native now, ${feeling.word}. ${withPlan}% with the plan.`}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={{ width: size, height: size }}>
        {Array.from({ length: LEAVES }, (_, i) => {
          const angle = (i / LEAVES) * 2 * Math.PI - Math.PI / 2;
          const isNow = i < filledNow;
          const isPlan = !isNow && i < filledPlan;
          const s = i === head ? leaf * 1.35 : leaf;
          return (
            <View
              key={i}
              style={[styles.leaf, {
                width: s, height: s,
                opacity: isPlan ? 0.4 : 1,
                left: size / 2 + radius * Math.cos(angle) - s / 2,
                top: size / 2 + radius * Math.sin(angle) - s / 2,
                transform: [{ rotate: `${(angle * 180) / Math.PI + 45}deg` }],
              }]}
            >
              <MaterialCommunityIcons name="leaf" size={s} color={isNow ? nowColor : isPlan ? planColor : COLORS.border} style={[styles.glyph, { lineHeight: s }]} />
            </View>
          );
        })}
        <View style={styles.center}>
          <Text style={[styles.percent, { fontSize: size * 0.22, lineHeight: Math.round(size * 0.26), width: size * 0.6 }]}>{shownNow}%</Text>
          <Text style={styles.caption}>{caption}</Text>
        </View>
        <Animated.View
          style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2, opacity: pop,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
          <MaterialCommunityIcons name={feeling.icon} size={badge * 0.72} color={scoreColor(now)} />
        </Animated.View>
      </View>
      <Text style={styles.legendText}>
        <Text style={{ color: planColor }}>●</Text> With the plan: {shownPlan}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12 },
  title: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  leaf: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  glyph: { includeFontPadding: false, textAlignVertical: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  percent: { fontFamily: FONTS.heading, color: COLORS.darkGreen, fontVariant: ['tabular-nums'], textAlign: 'center', includeFontPadding: false },
  caption: { fontSize: TYPE.caption, fontFamily: FONTS.bodyMedium, color: COLORS.textMuted },
  badge: {
    position: 'absolute', right: -4, top: -4, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.shadow, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  legendText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, textAlign: 'center' },
});
