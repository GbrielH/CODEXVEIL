/**
 * Tokens do design system do Codexveil — fonte única de verdade para web (Tailwind/CSS)
 * e mobile (React Native).
 *
 * Direção visual: "Dark Fantasy Premium" + "Grimório Vivo".
 * As quatro cores oficiais estão em `brandColors`; as escalas derivadas existem para
 * estados (hover, foco, desabilitado) e para garantir contraste legível.
 *
 * Este arquivo não pode importar outros módulos: ele é lido diretamente pelo Node
 * (type stripping) no script que gera `css/tokens.css`.
 */

/** As quatro cores oficiais da identidade do Codexveil. */
export const brandColors = {
  charcoal: '#171719',
  wine: '#571F2B',
  silver: '#B8B8BC',
  parchment: '#E4D8BD',
} as const;

export const palette = {
  charcoal: {
    950: '#0F0F11',
    900: brandColors.charcoal,
    850: '#1C1C1F',
    800: '#222226',
    700: '#2C2C31',
    600: '#3A3A40',
    500: '#4A4A51',
  },
  wine: {
    950: '#2A0E14',
    900: '#3D1520',
    800: '#4A1A24',
    700: brandColors.wine,
    600: '#692634',
    500: '#853244',
    400: '#B04A60',
    300: '#C9828E',
    200: '#E3B5BD',
    100: '#F3E1E4',
  },
  silver: {
    100: '#ECECEE',
    200: '#D4D4D8',
    300: brandColors.silver,
    400: '#9A9AA0',
    500: '#85858C',
    600: '#5E5E64',
  },
  parchment: {
    50: '#F7F1E3',
    100: '#EEE5CF',
    200: brandColors.parchment,
    300: '#D2C29F',
    400: '#BBA77D',
    500: '#9C8760',
  },
  ink: {
    900: '#2B2420',
    700: '#5A4D42',
  },
  verdigris: { 300: '#8CC7A3', 400: '#6FB38A', 900: '#16291F' },
  amber: { 300: '#E6BE74', 400: '#D9A54A', 900: '#2E2312' },
  ember: { 300: '#EC9384', 400: '#E26D5A', 900: '#3A1A17' },
  arcane: { 300: '#A5C2E6', 400: '#7FA7D9', 900: '#16233A' },
} as const;

/**
 * Cores semânticas. Componentes devem usar estes nomes, nunca valores hexadecimais soltos.
 * A interface é escura por definição; o pergaminho é usado em destaques e documentos.
 */
export const colors = {
  // Superfícies
  canvas: palette.charcoal[900],
  sunken: palette.charcoal[950],
  raised: palette.charcoal[850],
  card: palette.charcoal[800],
  hover: palette.charcoal[700],
  overlay: 'rgba(8, 8, 10, 0.72)',

  // Linhas e bordas (translúcidas para se adaptarem a qualquer superfície)
  lineSubtle: 'rgba(184, 184, 188, 0.10)',
  line: 'rgba(184, 184, 188, 0.18)',
  lineStrong: 'rgba(184, 184, 188, 0.32)',

  // Texto sobre superfícies escuras
  fg: '#E7E4DD',
  fgSecondary: palette.silver[300],
  fgMuted: palette.silver[400],
  fgSubtle: palette.silver[500],
  fgAccent: palette.parchment[200],
  fgBrand: palette.wine[300],

  // Ação primária (vinho)
  primary: palette.wine[700],
  primaryHover: palette.wine[600],
  primaryPressed: palette.wine[800],
  primaryFg: palette.parchment[200],

  // Pergaminho (notas, documentos, registros antigos)
  parchment: palette.parchment[200],
  parchmentRaised: palette.parchment[100],
  parchmentEdge: palette.parchment[400],
  ink: palette.ink[900],
  inkMuted: palette.ink[700],

  // Foco: anel de alto contraste sobre o fundo escuro
  focus: palette.parchment[200],

  // Estados
  success: palette.verdigris[400],
  successBg: palette.verdigris[900],
  warning: palette.amber[400],
  warningBg: palette.amber[900],
  danger: palette.ember[400],
  dangerBg: palette.ember[900],
  info: palette.arcane[400],
  infoBg: palette.arcane[900],

  // Trilhas de vida (fichas e combate)
  hpHealthy: palette.verdigris[400],
  hpBloodied: palette.amber[400],
  hpCritical: palette.ember[400],
  hpTemp: palette.arcane[400],
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Tema claro (opcional): mesmas cores semânticas sobre papel envelhecido, com o vinho como
 * acento. Ativado no site por `data-theme="light"` no <html>.
 */
export const lightColors = {
  canvas: '#F3EDE0',
  sunken: '#E9E1CF',
  raised: '#FAF6EE',
  card: '#FFFCF5',
  hover: '#ECE3D0',
  overlay: 'rgba(23, 23, 25, 0.5)',

  lineSubtle: 'rgba(43, 36, 32, 0.08)',
  line: 'rgba(43, 36, 32, 0.16)',
  lineStrong: 'rgba(43, 36, 32, 0.30)',

  fg: '#231D19',
  fgSecondary: '#4A4038',
  fgMuted: '#5E5248',
  fgSubtle: '#6A5E54',
  fgAccent: palette.wine[700],
  fgBrand: palette.wine[500],

  primary: palette.wine[700],
  primaryHover: palette.wine[600],
  primaryPressed: palette.wine[800],
  primaryFg: palette.parchment[50],

  parchment: palette.parchment[200],
  parchmentRaised: palette.parchment[100],
  parchmentEdge: palette.parchment[400],
  ink: palette.ink[900],
  inkMuted: palette.ink[700],

  focus: palette.wine[700],

  success: '#2E6B47',
  successBg: '#E1EFE6',
  warning: '#7A500A',
  warningBg: '#F6EBD3',
  danger: '#A3321F',
  dangerBg: '#F7E0DB',
  info: '#2C5689',
  infoBg: '#E0E9F5',

  hpHealthy: '#3C8A5C',
  hpBloodied: '#A87418',
  hpCritical: '#C2442F',
  hpTemp: '#3F72B5',
} as const satisfies Record<ColorToken, string>;

/**
 * Tons da paleta usados diretamente como texto ou fundo tingido em telas escuras. No tema
 * claro eles escurecem (texto) ou clareiam (fundos vinho) para manter o contraste.
 */
export const lightPaletteOverrides = {
  'amber-300': '#7A500A',
  'amber-400': '#9A6A14',
  'ember-300': '#A3321F',
  'ember-400': '#C2442F',
  'verdigris-300': '#2E6B47',
  'verdigris-400': '#3C8A5C',
  'arcane-300': '#2C5689',
  'arcane-400': '#3F72B5',
  'wine-200': palette.wine[600],
  'wine-300': palette.wine[500],
  'wine-900': '#EBD3D8',
  'wine-950': '#F3E1E4',
  'parchment-100': palette.wine[700],
  'parchment-200': '#6E5C3A',
  'parchment-300': '#65512F',
  'parchment-400': '#7A6440',
} as const;

/** Famílias tipográficas. Cada app carrega os arquivos de fonte do seu jeito. */
export const fontFamilies = {
  /** Títulos, logotipo e cabeçalhos de seção (capitulares romanas). */
  display: 'Cinzel',
  /** Interface, números e dados de ficha. */
  sans: 'Inter',
  /** Leitura longa: notas, roteiros e descrições ("grimório"). */
  serif: 'Alegreya',
} as const;

/** Escala tipográfica em pixels: [tamanho, altura de linha]. */
export const fontSizes = {
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
  xl: [20, 28],
  '2xl': [24, 32],
  '3xl': [30, 36],
  '4xl': [36, 40],
  '5xl': [48, 52],
} as const satisfies Record<string, readonly [number, number]>;

/** Raios discretos: cantos mais retos combinam com a estética de tomo/encadernação. */
export const radii = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 10,
  xl: 14,
  full: 9999,
} as const;

/** Escala de espaçamento em pixels (múltiplos de 4). */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const motion = {
  durationFast: 120,
  durationBase: 200,
  durationSlow: 320,
  /** Curva padrão: entrada suave, sem "quicar" — animações discretas. */
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export const shadows = {
  card: '0 1px 0 0 rgba(228, 216, 189, 0.04) inset, 0 8px 24px -12px rgba(0, 0, 0, 0.6)',
  overlay: '0 24px 64px -16px rgba(0, 0, 0, 0.75)',
  glow: '0 0 0 1px rgba(201, 130, 142, 0.35), 0 0 24px -4px rgba(87, 31, 43, 0.65)',
} as const;

/** Tamanho mínimo de alvos de toque (WCAG 2.5.5 / diretrizes Android). */
export const minTouchTarget = 44;
