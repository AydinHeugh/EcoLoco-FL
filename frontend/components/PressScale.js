import React, { useRef } from 'react';
import { Animated, TouchableOpacity } from 'react-native';
import { USE_NATIVE_DRIVER, useReduceMotion } from '../motion';

export default function PressScale({ style, children, disabled, ...touchable }) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = value => () => {
    if (!reduce) Animated.spring(scale, { toValue: value, speed: 40, bounciness: 6, useNativeDriver: USE_NATIVE_DRIVER }).start();
  };
  return (
    <TouchableOpacity activeOpacity={0.9} disabled={disabled} onPressIn={to(0.96)} onPressOut={to(1)} accessibilityRole="button" {...touchable}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
}
