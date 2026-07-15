export const tokens = {
  color: {
    accent: '#006DC7',
    accentPressed: '#005AA8',
    accentSubtle: '#E6F1FB',

    success: '#10B981',
    successBg: '#ECFDF5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    info: '#3B82F6',
    infoBg: '#EFF6FF',

    bg: '#FFFFFF',
    bgSubtle: '#F9FAFB',
    bgMuted: '#F3F4F6',
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',

    text: '#111827',
    textMuted: '#6B7280',
    textSubtle: '#9CA3AF',
    textOnAccent: '#FFFFFF',

    overlay: 'rgba(17, 24, 39, 0.55)',
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48 },
  radius: { sm: 6, md: 8, lg: 12, xl: 16, full: 9999 },
  font: {
    xs: 11,
    sm: 12,
    base: 13,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 22,
  },
  weight: { regular: '400', medium: '500', semibold: '600' },
  motion: { instant: 80, fast: 120, base: 180, slow: 260 },
  shadow: {
    pop: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 6,
    },
    modal: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 32,
      elevation: 12,
    },
  },
};
