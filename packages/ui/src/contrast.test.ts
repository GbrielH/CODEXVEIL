import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb } from './contrast';
import { brandColors, colors, lightColors, lightPaletteOverrides } from './tokens';

const AA_TEXT = 4.5;
const AAA_TEXT = 7;
const NON_TEXT = 3;

describe('contrastRatio', () => {
  it('calcula os extremos da escala WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('rejeita cores em formato inválido', () => {
    expect(() => hexToRgb('#abc')).toThrow(/inválida/);
    expect(() => hexToRgb('rgba(0,0,0,1)')).toThrow(/inválida/);
  });
});

describe('paleta oficial', () => {
  it('mantém as quatro cores da identidade', () => {
    expect(brandColors).toEqual({
      charcoal: '#171719',
      wine: '#571F2B',
      silver: '#B8B8BC',
      parchment: '#E4D8BD',
    });
  });
});

describe('contraste dos pares usados pela interface', () => {
  const darkSurfaces = {
    canvas: colors.canvas,
    raised: colors.raised,
    card: colors.card,
  } as const;

  it.each(Object.entries(darkSurfaces))('texto principal é AAA sobre %s', (_name, surface) => {
    expect(contrastRatio(colors.fg, surface)).toBeGreaterThanOrEqual(AAA_TEXT);
    expect(contrastRatio(colors.fgAccent, surface)).toBeGreaterThanOrEqual(AAA_TEXT);
  });

  it.each(Object.entries(darkSurfaces))('textos secundários são AA sobre %s', (_name, surface) => {
    for (const token of [colors.fgSecondary, colors.fgMuted, colors.fgBrand]) {
      expect(contrastRatio(token, surface)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it.each(Object.entries(darkSurfaces))('cores de estado são AA sobre %s', (_name, surface) => {
    for (const token of [colors.success, colors.warning, colors.danger, colors.info]) {
      expect(contrastRatio(token, surface)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('texto de estado é AA sobre o próprio fundo de alerta', () => {
    expect(contrastRatio(colors.success, colors.successBg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(colors.warning, colors.warningBg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(colors.danger, colors.dangerBg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(colors.info, colors.infoBg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('texto sutil (placeholders) é AA sobre o fundo de campos e da página', () => {
    expect(contrastRatio(colors.fgSubtle, colors.sunken)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(colors.fgSubtle, colors.canvas)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('texto sobre o botão primário (vinho) é AAA em todos os estados', () => {
    for (const background of [colors.primary, colors.primaryHover, colors.primaryPressed]) {
      expect(contrastRatio(colors.primaryFg, background)).toBeGreaterThanOrEqual(AAA_TEXT);
    }
  });

  it('tinta sobre pergaminho é legível', () => {
    expect(contrastRatio(colors.ink, colors.parchment)).toBeGreaterThanOrEqual(AAA_TEXT);
    expect(contrastRatio(colors.inkMuted, colors.parchment)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('anel de foco e trilhas de vida são visíveis (contraste não textual)', () => {
    for (const surface of Object.values(darkSurfaces)) {
      for (const token of [
        colors.focus,
        colors.hpHealthy,
        colors.hpBloodied,
        colors.hpCritical,
        colors.hpTemp,
      ]) {
        expect(contrastRatio(token, surface)).toBeGreaterThanOrEqual(NON_TEXT);
      }
    }
  });
});

describe('contraste do tema claro', () => {
  const lightSurfaces = {
    canvas: lightColors.canvas,
    raised: lightColors.raised,
    card: lightColors.card,
    sunken: lightColors.sunken,
  } as const;

  it.each(Object.entries(lightSurfaces))(
    'textos são AA (principal AAA) sobre %s',
    (_name, surface) => {
      expect(contrastRatio(lightColors.fg, surface)).toBeGreaterThanOrEqual(AAA_TEXT);
      expect(contrastRatio(lightColors.fgAccent, surface)).toBeGreaterThanOrEqual(AAA_TEXT);
      for (const token of [
        lightColors.fgSecondary,
        lightColors.fgMuted,
        lightColors.fgSubtle,
        lightColors.fgBrand,
      ]) {
        expect(contrastRatio(token, surface)).toBeGreaterThanOrEqual(AA_TEXT);
      }
    },
  );

  it.each(Object.entries(lightSurfaces))(
    'cores de estado e tons de texto da paleta são AA sobre %s',
    (_name, surface) => {
      for (const token of [
        lightColors.success,
        lightColors.warning,
        lightColors.danger,
        lightColors.info,
      ]) {
        expect(contrastRatio(token, surface)).toBeGreaterThanOrEqual(AA_TEXT);
      }
      for (const key of [
        'amber-300',
        'ember-300',
        'verdigris-300',
        'arcane-300',
        'wine-200',
        'parchment-300',
      ] as const) {
        expect(contrastRatio(lightPaletteOverrides[key], surface)).toBeGreaterThanOrEqual(AA_TEXT);
      }
    },
  );

  it('estados sobre o próprio fundo e o botão primário', () => {
    expect(contrastRatio(lightColors.success, lightColors.successBg)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
    expect(contrastRatio(lightColors.warning, lightColors.warningBg)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
    expect(contrastRatio(lightColors.danger, lightColors.dangerBg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(lightColors.info, lightColors.infoBg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(lightColors.primaryFg, lightColors.primary)).toBeGreaterThanOrEqual(
      AAA_TEXT,
    );
  });

  it('texto vinho sobre os fundos tingidos de vinho', () => {
    for (const background of [
      lightPaletteOverrides['wine-900'],
      lightPaletteOverrides['wine-950'],
    ]) {
      expect(contrastRatio(lightPaletteOverrides['wine-200'], background)).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
      expect(
        contrastRatio(lightPaletteOverrides['parchment-300'], background),
      ).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(lightColors.fgAccent, background)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('foco e trilhas de vida são visíveis', () => {
    for (const surface of Object.values(lightSurfaces)) {
      for (const token of [
        lightColors.focus,
        lightColors.hpHealthy,
        lightColors.hpBloodied,
        lightColors.hpCritical,
        lightColors.hpTemp,
      ]) {
        expect(contrastRatio(token, surface)).toBeGreaterThanOrEqual(NON_TEXT);
      }
    }
  });
});
