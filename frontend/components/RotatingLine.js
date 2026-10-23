import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, Text, View, StyleSheet } from 'react-native';
import { useReduceMotion } from '../motion';

const HOLD_MS = 2250;
const TYPE_MS = 55;
const DELETE_MS = 25;
const BETWEEN_MS = 100;
const BLINK_MS = 350;

export default function RotatingLine({ lines, prefix, style, accentStyle, accessibilityLabel, enabled = true }) {
  const reduce = useReduceMotion();
  const [frame, setFrame] = useState(() => ({ index: 0, count: lines[0]?.length || 0, phase: 'hold' }));
  const [measurements, setMeasurements] = useState({});
  const [appActive, setAppActive] = useState(!AppState.currentState || AppState.currentState === 'active');
  const cursor = useRef(new Animated.Value(1)).current;
  const running = enabled && appActive && !reduce && lines.length > 1;
  const currentLine = lines[frame.index % lines.length] || '';
  const shown = reduce ? lines[0] : currentLine.slice(0, frame.count);
  const lineHeight = StyleSheet.flatten(style)?.lineHeight || 42;
  const measuredHeights = Object.values(measurements);
  const reservedHeight = measuredHeights.length === lines.length ? Math.max(lineHeight, ...measuredHeights) : lineHeight * 2;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  // Show a complete phrase if the reduced-motion setting changes mid-word.
  useEffect(() => {
    if (!reduce) return;
    setFrame({ index: 0, count: lines[0]?.length || 0, phase: 'hold' });
  }, [reduce, lines]);

  useEffect(() => {
    if (!running) return undefined;
    const delay = { hold: HOLD_MS, deleting: DELETE_MS, waiting: BETWEEN_MS, typing: TYPE_MS }[frame.phase];
    const timer = setTimeout(() => {
      setFrame(previous => {
        const index = previous.index % lines.length;
        const length = lines[index].length;
        if (previous.phase === 'hold') return { index, count: Math.max(0, length - 1), phase: 'deleting' };
        if (previous.phase === 'deleting') {
          if (previous.count > 1) return { ...previous, count: previous.count - 1 };
          return { index: (index + 1) % lines.length, count: 0, phase: 'waiting' };
        }
        const count = Math.min(previous.count + 1, length);
        return { index, count, phase: count === length ? 'hold' : 'typing' };
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [frame, lines, running]);

  useEffect(() => {
    cursor.setValue(1);
    if (!running || frame.phase !== 'hold') return undefined;
    const blink = Animated.loop(Animated.sequence([
      Animated.delay(BLINK_MS),
      Animated.timing(cursor, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(BLINK_MS),
      Animated.timing(cursor, { toValue: 1, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    blink.start();
    return () => blink.stop();
  }, [cursor, frame.phase, running]);

  if (!lines.length) return null;

  return (
    <View accessible accessibilityRole="header" accessibilityLabel={accessibilityLabel || `${prefix || ''} ${lines[0]}`.trim()}>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {prefix && <Text style={style}>{prefix}</Text>}
        <View style={{ minHeight: reservedHeight }}>
          {/* Measure every complete phrase so wrapping never moves the content below. */}
          {lines.map((line, index) => (
            <Text key={line} style={[style, accentStyle, styles.measure]} onLayout={event => {
              const height = event.nativeEvent.layout.height;
              setMeasurements(previous => previous[index] === height ? previous : { ...previous, [index]: height });
            }}>
              {line}<Text style={styles.cursor}>|</Text>
            </Text>
          ))}
          <Text style={[style, accentStyle]}>
            <Text>{shown}</Text>
            <Animated.Text style={[styles.cursor, { opacity: reduce ? 0 : cursor }]}>|</Animated.Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0, pointerEvents: 'none' },
  cursor: { fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', fontWeight: '200', textDecorationLine: 'none' },
});
