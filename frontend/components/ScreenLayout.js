import React from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { BrandHeader, ScreenHeading } from './ScreenHeader';
import { COLORS } from '../theme';

// Short setup flows sit together in the available space; longer workspaces scroll from the top.
export default function ScreenLayout({ title, subtitle, right, children, contentWidth = 560, centered = false, scrollRef, onScroll }) {
  const { width, height } = useWindowDimensions();
  const roomy = width >= 600 && height >= 600;
  const gutter = width < 360 ? 16 : width < 600 ? 20 : 32;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScroll={onScroll}
      scrollEventThrottle={64}
    >
      <View style={styles.shell}>
        <BrandHeader right={right} />
        <View style={[
          styles.stage,
          { paddingHorizontal: gutter, paddingTop: roomy ? 32 : 24 },
          centered && roomy && { justifyContent: 'center', paddingBottom: Math.min(120, height * 0.12) },
        ]}>
          <View style={[styles.content, { maxWidth: contentWidth }]}>
            <ScreenHeading title={title} subtitle={subtitle} style={styles.heading} />
            {children}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  shell: { width: '100%', maxWidth: 960, flexGrow: 1 },
  stage: { flexGrow: 1, alignItems: 'center', paddingBottom: 32 },
  content: { width: '100%', minWidth: 0 },
  heading: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 24 },
});
