import React from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { useReduceMotion } from '../motion';

const LEAF = require('../../assets/lottie/leaf.json');

export default function ScanningLeaf({ size = 44 }) {
  const reduce = useReduceMotion();
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LottieView source={LEAF} autoPlay={!reduce} loop={!reduce} progress={reduce ? 0.5 : undefined} style={styles.fill} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
