import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import { COLORS, STATUS_COLORS, FONTS, TYPE } from '../theme';
import { EASE_OUT, useReduceMotion } from '../motion';
import { useInView } from './Reveal';

const DOTS = 40;
const FILL_MS = 400;
const PLAN_MS = 300;

function useRingProgress(play, delay) {
  const reduce = useReduceMotion();
  const fill = useRef(new Animated.Value(0)).current;
  const plan = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState({ fill: 0, plan: 0, moving: false });

  useEffect(() => {
    if (reduce) { setShown({ fill: 1, plan: 1, moving: false }); return undefined; }
    if (!play) return undefined;
    const ids = [
      fill.addListener(({ value }) => setShown(s => ({ ...s, fill: value, moving: value < 1 }))),
      plan.addListener(({ value }) => setShown(s => ({ ...s, plan: value, moving: value < 1 }))),
    ];
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(fill, { toValue: 1, duration: FILL_MS, easing: EASE_OUT, useNativeDriver: false }),
      Animated.timing(plan, { toValue: 1, duration: PLAN_MS, easing: EASE_OUT, useNativeDriver: false }),
      Animated.timing(settle, { toValue: 1.08, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.spring(settle, { toValue: 1, friction: 5, tension: 160, useNativeDriver: false }),
    ]).start();
    return () => { fill.removeListener(ids[0]); plan.removeListener(ids[1]); };
  }, [play, reduce]);

  return { ...shown, settle };
}

export default function PercentRing({ now, withPlan, size = 180, onDark = false, title, caption = 'native now', delay = 0 }) {
  const ref = useRef(null);
  const play = useInView(ref, 80);
  const { fill, plan, moving, settle } = useRingProgress(play, delay);

  const shownNow = Math.round(fill * now);
  const shownPlan = shownNow + Math.round(plan * (withPlan - now));
  const dot = size / 14;
  const radius = size / 2 - dot;
  const filledNow = Math.round((shownNow / 100) * DOTS);
  const filledPlan = Math.round((shownPlan / 100) * DOTS);
  const head = moving ? Math.max(filledNow, filledPlan) - 1 : -1;
  const nowColor = onDark ? COLORS.onDark : STATUS_COLORS.native.color;
  const planColor = onDark ? COLORS.accentOnDark : STATUS_COLORS.native.color;
  const track = onDark ? COLORS.ringTrackDark : COLORS.border;

  return (
    <View ref={ref} collapsable={false} style={[styles.wrap, title && { width: size + 16 }]} accessible
      accessibilityLabel={`${title ? `${title}: ` : ''}${now}% native now, ${withPlan}% with the plan`}>
      {title ? <Text style={[styles.title, onDark && styles.titleDark]}>{title}</Text> : null}
      <View style={{ width: size, height: size }}>
        {Array.from({ length: DOTS }, (_, i) => {
          const angle = (i / DOTS) * 2 * Math.PI - Math.PI / 2;
          const isNow = i < filledNow;
          const isPlan = !isNow && i < filledPlan;
          const d = i === head ? dot * 1.4 : dot;
          return (
            <View
              key={i}
              style={{
                position: 'absolute', width: d, height: d, borderRadius: d / 2,
                backgroundColor: isNow ? nowColor : isPlan ? planColor : track,
                opacity: isPlan && !onDark ? 0.35 : 1,
                left: size / 2 + radius * Math.cos(angle) - d / 2,
                top: size / 2 + radius * Math.sin(angle) - d / 2,
              }}
            />
          );
        })}
        <View style={styles.center}>
          <Animated.Text style={[styles.percent, { fontSize: size * 0.22, color: onDark ? COLORS.onDark : COLORS.darkGreen, transform: [{ scale: settle }] }]}>
            {shownNow}%
          </Animated.Text>
          <Text style={[styles.caption, onDark && styles.captionDark]}>{caption}</Text>
        </View>
      </View>
      <View style={styles.legend}>
        <Text style={[styles.legendText, onDark && styles.legendDark]}>
          <Text style={{ color: planColor, opacity: onDark ? 1 : 0.35 }}>●</Text> With the plan: {withPlan}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12 },
  title: { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  titleDark: { color: COLORS.onDark },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  percent: { fontFamily: FONTS.headingBlack },
  caption: { fontSize: TYPE.caption, fontFamily: FONTS.bodyMedium, color: COLORS.textMuted },
  captionDark: { color: COLORS.onDarkMuted },
  legend: { gap: 4, alignItems: 'center' },
  legendText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, textAlign: 'center' },
  legendDark: { color: COLORS.onDark },
});
