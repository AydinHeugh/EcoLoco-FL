import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native';
import { COLORS, STATUS_COLORS, FONTS, TYPE } from '../theme';
import { DURATION, USE_NATIVE_DRIVER, useReduceMotion } from '../motion';

const TYPE_MS = 80;
const HOLD_MS = 2600;

const BLANKS = [
  { blank: '[PRINCIPAL_NAME]', fill: 'Ms. Lefevre' },
  { blank: '[SCHOOL_NAME]', fill: 'American Heritage School' },
];

function Blank({ index, typed, active, cursorOn }) {
  const { blank, fill } = BLANKS[index];
  if (typed == null) return <Text style={styles.blank}>{blank}</Text>;
  return (
    <Text style={styles.filled}>
      {fill.slice(0, typed)}
      {active && <Text style={[styles.cursor, !cursorOn && styles.cursorOff]}>|</Text>}
    </Text>
  );
}

export function LetterDemo() {
  const reduce = useReduceMotion();
  const [typed, setTyped] = useState([null, null]);
  const [active, setActive] = useState(-1);
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    if (reduce) {
      setTyped(BLANKS.map(b => b.fill.length));
      setActive(-1);
      return undefined;
    }
    let timer;
    let field = 0;
    let count = 0;
    const tick = () => {
      if (field >= BLANKS.length) {
        setActive(-1);
        timer = setTimeout(() => {
          field = 0; count = 0;
          setTyped([null, null]);
          timer = setTimeout(tick, 900);
        }, HOLD_MS);
        return;
      }
      count += 1;
      const current = field;
      const shown = count;
      setActive(current);
      setTyped(prev => prev.map((v, i) => (i === current ? shown : v)));
      if (count >= BLANKS[field].fill.length) {
        field += 1;
        count = 0;
        timer = setTimeout(tick, 500);
      } else {
        timer = setTimeout(tick, TYPE_MS);
      }
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, [reduce]);

  useEffect(() => {
    if (reduce) return undefined;
    const blink = setInterval(() => setCursorOn(on => !on), 450);
    return () => clearInterval(blink);
  }, [reduce]);

  const filled = BLANKS.map(b => b.fill.length);
  return (
    <View style={styles.paper} accessible accessibilityLabel="Example letter to your principal: your school’s plan to remove Brazilian pepper and plant Dahoon holly.">
      <View style={styles.ghost} aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <LetterBody typed={filled} active={-1} cursorOn={false} />
      </View>
      <View style={styles.live} aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <LetterBody typed={typed} active={active} cursorOn={cursorOn} />
      </View>
    </View>
  );
}

function LetterBody({ typed, active, cursorOn }) {
  return (
    <>
      <Text style={styles.editTag}>Letter preview</Text>
      <Text style={styles.line}>Dear <Blank index={0} typed={typed[0]} active={active === 0} cursorOn={cursorOn} />,</Text>
      <Text style={styles.line}>
        Our <Blank index={1} typed={typed[1]} active={active === 1} cursorOn={cursorOn} /> eco-club has a plan for a healthier campus.
      </Text>
      <Text style={styles.line}><Text style={styles.heading}>Remove:</Text> Brazilian pepper</Text>
      <Text style={styles.line}><Text style={styles.heading}>Plant:</Text> Dahoon holly</Text>
    </>
  );
}

export function IdentifyDemo({ image }) {
  const reduce = useReduceMotion();
  const [height, setHeight] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce || !height) {
      badge.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(badge, { toValue: 0, duration: DURATION / 2, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.delay(500),
      Animated.timing(sweep, { toValue: 1, duration: DURATION + 100, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(badge, { toValue: 1, speed: 14, bounciness: 8, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.delay(2200),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: USE_NATIVE_DRIVER }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, height]);

  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(height - 3, 0)] });
  const lineOpacity = sweep.interpolate({ inputRange: [0, 0.05, 0.95, 1], outputRange: [0, 1, 1, 0] });
  const native = STATUS_COLORS.native;

  return (
    <View style={styles.photo} onLayout={e => setHeight(e.nativeEvent.layout.height)}
      accessible accessibilityLabel="A phone scanning a plant photo, then showing that the plant is native to Florida">
      <Image source={image} style={styles.photoImg} resizeMode="cover" />
      {!reduce && height > 0 && (
        <Animated.View pointerEvents="none" style={[styles.scanLine, { opacity: lineOpacity, transform: [{ translateY }] }]} />
      )}
      <Animated.View style={[styles.result, { backgroundColor: native.bg, opacity: badge, transform: [{ scale: badge }] }]}>
        <Text style={[styles.resultText, { color: native.color }]}>Native to Florida</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: COLORS.cardBg },
  ghost: { padding: 14, gap: 6, opacity: 0 },
  live: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 14, gap: 6 },
  editTag: { alignSelf: 'flex-start', fontSize: TYPE.caption, lineHeight: 18, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, marginBottom: 2 },
  line: { fontSize: TYPE.caption, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: 18 },
  heading: { fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  blank: { fontFamily: FONTS.bodyBold, color: COLORS.amber },
  filled: { fontFamily: FONTS.bodyBold, color: COLORS.darkGreen },
  cursor: { color: COLORS.softGreen },
  cursorOff: { color: 'transparent' },
  photo: { flex: 1, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  scanLine: {
    position: 'absolute', left: 0, right: 0, top: 0, height: 3,
    backgroundColor: COLORS.softGreen,
    shadowColor: COLORS.softGreen, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  result: { position: 'absolute', left: 10, bottom: 10, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  resultText: { fontSize: 11, fontFamily: FONTS.bodyBold },
});
