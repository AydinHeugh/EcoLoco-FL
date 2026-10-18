import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
  Fraunces_900Black,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export const PALETTE = {
  liveOak:   '#1F3B2C',
  oakLeaf:   '#3B6B4C',
  duneSand:  '#EFEDE4',
  shell:     '#FAF8F2',
  firebush:  '#B8431A',
  seaGrape:  '#5A3355',
  ink:       '#1A2A21',
  driftwood: '#5F6B61',
  wrack:     '#D6D2C4',
};

export const COLORS = {
  cream:       PALETTE.duneSand,
  cardBg:      PALETTE.shell,
  border:      PALETTE.wrack,
  lightBg:     '#E4E6DA',
  darkGreen:   PALETTE.liveOak,
  softGreen:   PALETTE.oakLeaf,
  amber:       '#8A5A00',
  terracotta:  PALETTE.firebush,
  accent:      PALETTE.firebush,
  accentSoft:  '#F4DED3',
  accentOnDark:'#F2895A',
  accentInk:   '#943513',
  invasiveTint:'#FCF1F2',
  seaGrape:    PALETTE.seaGrape,
  seaGrapeSoft:'#ECE3EA',
  textBody:    PALETTE.ink,
  textMuted:   PALETTE.driftwood,
  onDark:      PALETTE.shell,
  onDarkMuted: '#C9D6CC',
  scrim:       'rgba(20, 38, 28, 0.62)',
  scrimTop:    'rgba(20, 38, 28, 0.45)',
  error:       '#A2281C',
  white:       '#FFFFFF',
  shadow:      '#14261C',
  tabInactive: '#B9CDBF',
  photoBg:     '#DCDDD0',
  ringTrackDark: '#3A5A46',
};

export const STATUS_COLORS = {
  native:       { bg: '#E1EFE4', color: '#276B3E' },
  'non-native': { bg: '#F6EAD0', color: '#8A5A00' },
  invasive:     { bg: '#F6E1E3', color: '#8F1D2C' },
  unknown:      { bg: '#E7E7E1', color: '#5B5F58' },
};

export const FONTS = {
  body:          'Inter_400Regular',
  bodyMedium:    'Inter_500Medium',
  bodyBold:      'Inter_600SemiBold',
  bodyHeavy:     'Inter_700Bold',
  heading:       'Fraunces_700Bold',
  headingBlack:  'Fraunces_900Black',
  headingLight:  'Fraunces_400Regular',
  headingItalic: 'Fraunces_700Bold_Italic',
  accentItalic:  'Fraunces_400Regular_Italic',
};

export const TYPE = {
  caption: 13,
  link:    15,
  body:    16,
  lead:    18,
  h3:      22,
  h2:      28,
  h1:      34,
  display: 44,
};

export const LINE = {
  caption: 18,
  link:    22,
  body:    24,
  lead:    26,
  h3:      28,
  h2:      34,
  h1:      40,
  display: 48,
};

export const FONT_ASSETS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
  Fraunces_900Black,
};
