import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
} from '@expo-google-fonts/fraunces';
import { DMSans_400Regular, DMSans_700Bold } from '@expo-google-fonts/dm-sans';

export const COLORS = {
  cream:      '#f5f0e8',
  cardBg:     '#fefcf8',
  border:     '#d4cfc4',
  lightBg:    '#eaeee6',
  darkGreen:  '#1e3a1e',
  softGreen:  '#4a7a3a',
  amber:      '#c49a3a',
  terracotta: '#C97D5D',
  textBody:   '#4a4a3a',
  textMuted:  '#7a7a6a',
  error:      '#c0392b',
  white:      '#fff',
  shadow:     '#000',
  tabInactive:'#d9f2d9',
  photoBg:    '#f0ebe2',
};

export const STATUS_COLORS = {
  native:       { bg: '#eaf2e8', color: COLORS.softGreen },
  'non-native': { bg: '#faf3e0', color: COLORS.amber },
  invasive:     { bg: '#fdf0ec', color: COLORS.terracotta },
  unknown:      { bg: '#eeeeea', color: COLORS.textMuted },
};

export const FONTS = {
  body:          'DMSans_400Regular',
  bodyBold:      'DMSans_700Bold',
  heading:       'Fraunces_700Bold',
  headingLight:  'Fraunces_400Regular',
  headingItalic: 'Fraunces_700Bold_Italic',
  accentItalic:  'Fraunces_400Regular_Italic',
};

export const FONT_ASSETS = {
  DMSans_400Regular,
  DMSans_700Bold,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
};
