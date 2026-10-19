import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
  Fraunces_900Black,
} from '@expo-google-fonts/fraunces';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

export const PALETTE = {
  liveOak:   '#1E3A1E',
  oakLeaf:   '#4A7A3A',
  duneSand:  '#F5F0E8',
  shell:     '#FFFCF6',
  firebush:  '#B8431A',
  seaGrape:  '#5A3355',
  ink:       '#35482F',
  driftwood: '#646454',
  wrack:     '#D6D9CD',
};

export const COLORS = {
  cream:       PALETTE.duneSand,
  cardBg:      PALETTE.shell,
  border:      PALETTE.wrack,
  lightBg:     '#E8EDDF',
  darkGreen:   PALETTE.liveOak,
  softGreen:   PALETTE.oakLeaf,
  amber:       '#8A5A00',
  terracotta:  PALETTE.firebush,
  accent:      PALETTE.liveOak,
  accentSoft:  '#E7EDDF',
  accentOnDark:'#FFFCF6',
  accentInk:   PALETTE.liveOak,
  invasiveTint:'#FCF1F2',
  seaGrape:    PALETTE.seaGrape,
  seaGrapeSoft:'#EEE8ED',
  textBody:    PALETTE.ink,
  textMuted:   PALETTE.driftwood,
  onDark:      PALETTE.shell,
  onDarkMuted: '#C9D6CC',
  scrim:       'rgba(20, 38, 28, 0.62)',
  scrimTop:    'rgba(20, 38, 28, 0.45)',
  error:       '#A2281C',
  white:       '#FFFFFF',
  shadow:      '#14261C',
  tabInactive: '#BBCDB4',
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
  body:          'DMSans_400Regular',
  bodyMedium:    'DMSans_500Medium',
  bodyBold:      'DMSans_600SemiBold',
  bodyHeavy:     'DMSans_700Bold',
  heading:       'Fraunces_700Bold',
  headingBlack:  'Fraunces_700Bold',
  headingLight:  'Fraunces_400Regular',
  headingItalic: 'Fraunces_700Bold_Italic',
  accentItalic:  'Fraunces_400Regular_Italic',
};

export const TYPE = {
  eyebrow: 10,
  fine:    11,
  small:   12,
  caption: 13,
  note:    14,
  link:    15,
  body:    16,
  lead:    18,
  h3:      22,
  h2:      28,
  pageTitle: 32,
  h1:      34,
  display: 44,
  displayLarge: 48,
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
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
  Fraunces_900Black,
};
