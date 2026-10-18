import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, STATUS_COLORS, FONTS } from '../theme';

const DOTS = 40;

export default function PercentRing({ now, withPlan, size = 180 }) {
  const dot = size / 14;
  const radius = size / 2 - dot;
  const filledNow = Math.round((now / 100) * DOTS);
  const filledPlan = Math.round((withPlan / 100) * DOTS);

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        {Array.from({ length: DOTS }, (_, i) => {
          const angle = (i / DOTS) * 2 * Math.PI - Math.PI / 2;
          const filled = i < filledPlan;
          return (
            <View
              key={i}
              style={{
                position: 'absolute', width: dot, height: dot, borderRadius: dot / 2,
                backgroundColor: filled ? STATUS_COLORS.native.color : COLORS.border,
                opacity: filled && i >= filledNow ? 0.35 : 1,
                left: size / 2 + radius * Math.cos(angle) - dot / 2,
                top: size / 2 + radius * Math.sin(angle) - dot / 2,
              }}
            />
          );
        })}
        <View style={styles.center}>
          <Text style={[styles.percent, { fontSize: size * 0.22 }]}>{now}%</Text>
          <Text style={styles.caption}>native now</Text>
        </View>
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>
          <Text style={{ color: STATUS_COLORS.native.color }}>●</Text> Now: {now}% native
        </Text>
        <Text style={styles.legendText}>
          <Text style={{ color: STATUS_COLORS.native.color, opacity: 0.35 }}>●</Text> With the plan: {withPlan}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  percent: { fontFamily: FONTS.heading, color: COLORS.darkGreen },
  caption: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted },
  legend: { gap: 4, alignItems: 'center' },
  legendText: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textBody },
});
