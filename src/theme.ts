/**
 * Design tokens.
 *
 * The look is deliberately quiet: flat surfaces, one accent, hairline dividers,
 * no gradients, no glow, no neon. Elevation appears only on sheets, where it
 * carries meaning. Type does the work.
 */

export type ThemeName = 'light' | 'dark';

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  line: string;
  lineSoft: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  danger: string;
  warn: string;
  scrim: string;
  shadow: string;
};

export const light: Palette = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceAlt: '#FAFAFB',
  line: '#E6E6EA',
  lineSoft: '#EFEFF2',
  text: '#111114',
  muted: '#6C6C75',
  faint: '#9B9BA3',
  accent: '#2C6BED',
  accentSoft: '#EAF0FD',
  onAccent: '#FFFFFF',
  success: '#1E7F52',
  danger: '#C0392B',
  warn: '#8A5B00',
  scrim: 'rgba(17,17,20,0.32)',
  shadow: '#111114',
};

export const dark: Palette = {
  bg: '#0F1012',
  surface: '#16181B',
  surfaceAlt: '#1A1D21',
  line: '#26292E',
  lineSoft: '#1F2226',
  text: '#ECEDEF',
  muted: '#9AA0A6',
  faint: '#6B7077',
  accent: '#7AA2FF',
  accentSoft: '#1B2436',
  onAccent: '#0B1220',
  success: '#4CC38A',
  danger: '#F07266',
  warn: '#E3B341',
  scrim: 'rgba(0,0,0,0.55)',
  shadow: '#000000',
};

export function palette(name: ThemeName): Palette {
  return name === 'dark' ? dark : light;
}

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const radius = {
  control: 10,
  card: 14,
  sheet: 20,
  pill: 999,
};

export const type = {
  display: { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.6 },
  title: { fontSize: 21, fontWeight: '600' as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.1 },
  label: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0 },
  caption: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0 },
  mono: { fontSize: 12.5, letterSpacing: 0 },
};

export const mono = 'monospace';
export const ui = undefined; // system font: SF Pro on iOS, Roboto on Android

/** Motion: short, eased, never bouncy. */
export const motion = {
  fast: 140,
  base: 200,
  slow: 280,
};
