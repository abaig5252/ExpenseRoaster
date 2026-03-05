export const colors = {
  background:      '#121212',
  surface:         '#1A1A1A',
  surfaceElevated: '#242424',
  border:          'rgba(255,255,255,0.06)',
  borderGreen:     'rgba(0,230,118,0.22)',

  primary:       '#00E676',
  primaryBright: '#69FF9C',
  primaryDim:    'rgba(0,230,118,0.07)',
  primaryGlow:   'rgba(0,230,118,0.18)',
  primaryBorder: 'rgba(0,230,118,0.22)',

  text:      '#F0F0F0',
  textMuted: '#8A9099',
  textDim:   '#4A5060',

  error:   '#FF5252',
  warning: '#FFB800',
  white:   '#FFFFFF',

  catFood:      '#E85D26',
  catGroceries: '#C4A832',
  catCoffee:    '#7B6FE8',
  catTransport: '#3BB8A0',
  catSubs:      '#E8526A',
  catSelfCare:  '#5BA85E',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 9999,
};

export const typography = {
  h1:        { fontSize: 28, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.5 },
  h2:        { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h3:        { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body:      { fontSize: 15, fontWeight: '400' as const, color: colors.text,      lineHeight: 22 },
  bodyMuted: { fontSize: 15, fontWeight: '400' as const, color: colors.textMuted, lineHeight: 22 },
  caption:   { fontSize: 12, fontWeight: '400' as const, color: colors.textMuted },
  label:     { fontSize: 11, fontWeight: '600' as const, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' as const },
};
