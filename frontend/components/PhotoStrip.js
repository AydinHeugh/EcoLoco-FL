import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

export default function PhotoStrip({ photos, onRemove, dimmed }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {photos.map((photo, i) => (
        <View key={i} style={[styles.item, dimmed && styles.dimmed]}>
          <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" accessibilityLabel={`Photo ${i + 1}`} />
          {onRemove && (
            <TouchableOpacity
              style={styles.remove}
              onPress={() => onRemove(i)}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 8 },
  item: { width: 76, height: 76, borderRadius: 8, overflow: 'hidden', backgroundColor: COLORS.photoBg },
  photo: { width: '100%', height: '100%' },
  remove: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  removeText: { fontSize: 10, color: COLORS.terracotta, fontFamily: FONTS.bodyBold },
  dimmed: { opacity: 0.5 },
});
