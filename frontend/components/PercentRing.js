import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import { COLORS, STATUS_COLORS, FONTS, TYPE } from '../theme';
import { useReduceMotion } from '../motion';

const DOTS = 40;
const COUNT_MS = 400;

function useCountUp(target) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [value, setValue] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) { setValue(target); return undefined; }
    progress.setValue(0);
    const id = progress.addListener(({ value: v }) => setValue(Math.round(v * target)));
    Animated.timing(progress, { toValue: 1, duration: COUNT_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => progress.removeListener(id);
  }, [target, reduce]);

  return value;
}

export default function PercentRing({ now, withPlan, size = 180, onDark = false }) {
  const shownNow = useCountUp(now);
  const shownPlan = useCountUp(withPlan);
  const dot = size / 14;
  const radius = size / 2 - dot;
  const filledNow = Math.round((shownNow / 100) * DOTS);
  const filledPlan = Math.round((shownPlan / 100) * DOTS);
  const nowColor = onDark ? COLORS.onDark : STATUS_COLORS.native.color;
  const planColor = onDark ? COLORS.accentOnDark : STATUS_COLORS.native.color;
  const track = onDark ? COLORS.ringTrackDark : COLORS.border;

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${now}% native now, ${withPlan}% with the plan`}>
      <View style={{ width: size, height: size }}>
        {Array.from({ length: DOTS }, (_, i) => {
          const angle = (i / DOTS) * 2 * Math.PI - Math.PI / 2;
          const isNow = i < filledNow;
          const isPlan = !isNow && i < filledPlan;
          return (
            <View
              key={i}
              style={{
                position: 'absolute', width: dot, height: dot, borderRadius: dot / 2,
                backgroundColor: isNow ? nowColor : isPlan ? planColor : track,
                opacity: isPlan && !onDark ? 0.35 : 1,
                left: size / 2 + radius * Math.cos(angle) - dot / 2,
                top: size / 2 + radius * Math.sin(angle) - dot / 2,
              }}
            />
          );
        })}
        <View style={styles.center}>
          <Text style={[styles.percent, { fontSize: size * 0.22, color: onDark ? COLORS.onDark : COLORS.darkGreen }]}>{shownNow}%</Text>
          <Text style={[styles.caption, onDark && styles.captionDark]}>native now</Text>
        </View>
      </View>
      <View style={styles.legend}>
        <Text style={[styles.legendText, onDark && styles.legendDark]}>
          <Text style={{ color: nowColor }}>●</Text> Now: {now}% native
        </Text>
        <Text style={[styles.legendText, onDark && styles.legendDark]}>
          <Text style={{ color: planColor, opacity: onDark ? 1 : 0.35 }}>●</Text> With the plan: {withPlan}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  percent: { fontFamily: FONTS.headingBlack },
  caption: { fontSize: TYPE.caption, fontFamily: FONTS.bodyMedium, color: COLORS.textMuted },
  captionDark: { color: COLORS.onDarkMuted },
  legend: { gap: 4, alignItems: 'center' },
  legendText: { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody },
  legendDark: { color: COLORS.onDark },
});
