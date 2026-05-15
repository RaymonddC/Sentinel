// Design tokens — ports of design/project/colors_and_type.css.
// Devvit Blocks accept hex strings directly on color attributes.

export const COLOR = {
  // Surfaces (dark mode default)
  bgCanvas: '#0b0d0f',
  bgPanel: '#14171a',
  bgRaised: '#1b1f23',
  bgRaised2: '#22272d',
  // Borders
  border: '#2b3138',
  borderStrong: '#3a4148',
  borderSubtle: '#1f242a',
  // Text
  fg0: '#e6e9ed',
  fg1: '#aab2bd',
  fg2: '#6e7681',
  fg3: '#4a5159',
  fgInv: '#0b0d0f',
  // Severity
  sevCritical: '#e74c3c',
  sevHigh: '#f39c12',
  sevMedium: '#f5b041',
  sevHealthy: '#46a973',
  // Accent (interactive)
  accent: '#5b8def',
  accentHover: '#6f9bf2',
  accentPress: '#4a7cd9',
} as const;

export const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s12: 48 } as const;
export const RADIUS = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
export const ROW = { alert: 64, kpi: 88, tab: 44, touchMin: 44 } as const;
export const FONT = {
  fs11: 11, fs12: 12, fs13: 13, fs14: 14, fs15: 15, fs17: 17, fs20: 20, fs24: 24, fs32: 32,
} as const;
