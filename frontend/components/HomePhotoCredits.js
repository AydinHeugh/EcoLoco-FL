import React from 'react'
import { Text, Linking, Platform, StyleSheet } from 'react-native'
import { COLORS, FONTS, TYPE } from '../theme'
import { HOME_PHOTO_CREDITS } from '../homeMedia'

const attributedPhotos = HOME_PHOTO_CREDITS.filter(photo => photo.license === 'CC BY')

function CreditLink({ url, label, children }) {
  const action = Platform.OS === 'web'
    ? { href: url, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } }
    : { onPress: () => Linking.openURL(url).catch(() => {}) }
  return (
    <Text {...action} accessibilityRole="link" accessibilityLabel={`${label} (opens in a new tab or browser)`} style={styles.link}>
      {children}
    </Text>
  )
}

export default function HomePhotoCredits() {
  return (
    <Text style={styles.credit}>
      Plant photos (cropped): {attributedPhotos.map((photo, index) => (
        <React.Fragment key={photo.sourceUrl}>
          {index > 0 ? ' · ' : ''}
          <CreditLink url={photo.sourceUrl} label={`${photo.title} by ${photo.creator} on ${photo.sourceName}`}>
            {photo.creator}
          </CreditLink>
        </React.Fragment>
      ))} · <CreditLink url={attributedPhotos[0].licenseUrl} label="Creative Commons Attribution 4.0 license">CC BY</CreditLink>
    </Text>
  )
}

const styles = StyleSheet.create({
  credit: { fontFamily: FONTS.body, fontSize: TYPE.caption, lineHeight: 20, color: COLORS.textMuted, textAlign: 'center', marginTop: 8 },
  link: { color: COLORS.textMuted, textDecorationLine: 'underline' },
})
