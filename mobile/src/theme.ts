export const colors = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceElevated: '#222222',
  border: 'rgba(255,255,255,0.08)',
  primary: '#7CFF4D',
  primaryDim: 'rgba(124,255,77,0.12)',
  primaryGlow: 'rgba(124,255,77,0.25)',
  text: '#F0F0F0',
  textMuted: '#888888',
  textDim: '#444444',
  error: '#FF4D4D',
  warning: '#FFB800',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text, lineHeight: 22 },
  bodyMuted: { fontSize: 15, fontWeight: '400' as const, color: colors.textMuted },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.textMuted },
  label: { fontSize: 11, fontWeight: '600' as const, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' as const },
};
