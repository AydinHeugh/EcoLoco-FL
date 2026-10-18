import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

export default function PhotoSlot({ source, style, label }) {
  if (!source) {
    return (
      <View style={[styles.empty, style]} accessible accessibilityLabel={label}>
        <Ionicons name="leaf-outline" size={40} color={COLORS.softGreen} />
      </View>
    );
  }
  return (
    <Image source={source} style={[styles.photo, style]} contentFit="cover" transition={200} accessibilityLabel={label} />
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', backgroundColor: COLORS.photoBg },
  empty: { width: '100%', backgroundColor: COLORS.photoBg, alignItems: 'center', justifyContent: 'center' },
});
