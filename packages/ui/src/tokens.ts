/**
 * Tokens do design system do Codexveil — fonte única de verdade para web (Tailwind/CSS)
 * e mobile (React Native).
 *
 * Direção visual (redesign de 2026-10-23): "Grimório Arcano" — quase-preto, violeta arcano,
 * lavanda luminosa e marfim, com o mascote Tomo. As cores oficiais estão em `brandColors`; as
 * escalas derivadas existem para estados (hover, foco, desabilitado) e para garantir contraste.
 *
 * Os nomes das escalas (`wine`, `parchment`, `charcoal`, `silver`) foram mantidos para não
 * mexer em todas as telas: `wine` agora é a escala violeta e `parchment`, a marfim.
 *
 * Este arquivo não pode importar outros módulos: ele é lido diretamente pelo Node
 * (type stripping) no script que gera `css/tokens.css`.
 */

/** Cores oficiais da identidade do Codexveil (paleta do redesign). */
export const brandColors = {
  charcoal: '#0B0B0F',
  wine: '#6B3BC6',
  lavender: '#A88BFF',
  silver: '#4B4B5A',
  parchment: '#F5EDE7',
} as const;

export const palette = {
  charcoal: {
    950: '#07070A',
    900: brandColors.charcoal,
    850: '#111118',
    800: '#16161F',
    700: '#20202C',
    600: '#2C2B3B',
    500: brandColors.silver,
  },
  /** Violeta arcano (nome histórico: "wine"). */
  wine: {
    950: '#140A29',
    900: '#1D0F3D',
    800: '#2B1660',
    700: brandColors.wine,
    600: '#7A4AD6',
    500: '#8D63E3',
    400: brandColors.lavender,
    300: '#C2AEFF',
    200: '#DCD0FF',
    100: '#F0EBFF',
  },
  silver: {
    100: '#EEEDF4',
    200: '#D4D2DE',
    300: '#B6B3C6',
    400: '#9C98AF',
    500: '#868299',
    600: brandColors.silver,
  },
  /** Marfim (nome histórico: "parchment"). */
  parchment: {
    50: '#FCF9F6',
    100: '#F9F4EF',
    200: brandColors.parchment,
    300: '#E4D7CC',
    400: '#C9B7A9',
    500: '#A8958A',
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

  // Linhas e bordas (translúcidas, com um toque de lavanda)
  lineSubtle: 'rgba(176, 164, 220, 0.09)',
  line: 'rgba(176, 164, 220, 0.16)',
  lineStrong: 'rgba(176, 164, 220, 0.30)',

  // Texto sobre superfícies escuras
  fg: '#ECE7E3',
  fgSecondary: palette.silver[300],
  fgMuted: palette.silver[400],
  fgSubtle: palette.silver[500],
  fgAccent: palette.parchment[200],
  fgBrand: palette.wine[300],

  // Ação primária (violeta arcano, um tom abaixo da marca para o texto marfim ficar AAA)
  primary: '#5A2FB0',
  primaryHover: '#5F33B8',
  primaryPressed: '#4C2799',
  primaryFg: palette.parchment[50],

  // Pergaminho (notas, documentos, registros antigos)
  parchment: palette.parchment[200],
  parchmentRaised: palette.parchment[100],
  parchmentEdge: palette.parchment[400],
  ink: palette.ink[900],
  inkMuted: palette.ink[700],

  // Foco: anel lavanda de alto contraste sobre o fundo escuro
  focus: palette.wine[400],

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
  canvas: '#F5EDE7',
  sunken: '#ECE2DA',
  raised: '#FBF7F3',
  card: '#FFFFFF',
  hover: '#EDE4F7',
  overlay: 'rgba(23, 23, 25, 0.5)',

  lineSubtle: 'rgba(43, 36, 32, 0.08)',
  line: 'rgba(43, 36, 32, 0.16)',
  lineStrong: 'rgba(43, 36, 32, 0.30)',

  fg: '#231D19',
  fgSecondary: '#4A4038',
  fgMuted: '#5E5248',
  fgSubtle: '#6A5E54',
  fgAccent: '#4A2596',
  fgBrand: '#5A2FB0',

  primary: '#5A2FB0',
  primaryHover: '#5F33B8',
  primaryPressed: '#4C2799',
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
  'wine-200': '#5A2FB0',
  'wine-300': '#5F33B8',
  'wine-900': '#E6DCFA',
  'wine-950': '#F1EBFC',
  'parchment-100': '#4A2596',
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

/** Raios: um pouco mais arredondados no redesign, sem perder o ar de encadernação. */
export const radii = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
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
  card: '0 1px 0 0 rgba(168, 139, 255, 0.05) inset, 0 10px 28px -14px rgba(0, 0, 0, 0.75)',
  overlay: '0 24px 64px -16px rgba(0, 0, 0, 0.8)',
  glow: '0 0 0 1px rgba(168, 139, 255, 0.40), 0 0 28px -4px rgba(107, 59, 198, 0.70)',
} as const;

/** Tamanho mínimo de alvos de toque (WCAG 2.5.5 / diretrizes Android). */
export const minTouchTarget = 44;
