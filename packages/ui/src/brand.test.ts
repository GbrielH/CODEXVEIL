import { describe, expect, it } from 'vitest';
import { defaultEmblemColors, emblemPaths, emblemSvg } from './brand';

describe('emblemSvg', () => {
  it('gera um SVG quadrado com todas as partes do emblema', () => {
    const svg = emblemSvg({ size: 512 });
    expect(svg).toMatch(/^<svg [^>]*width="512" height="512" viewBox="0 0 64 64">/);
    for (const path of Object.values(emblemPaths)) {
      expect(svg).toContain(`d="${path}"`);
    }
    expect(svg).toContain(defaultEmblemColors.veil);
  });

  it('aplica fundo e escala para ícones adaptativos', () => {
    const svg = emblemSvg({ background: '#171719', scale: 0.5 });
    expect(svg).toContain('<rect width="64" height="64" fill="#171719"/>');
    expect(svg).toContain('translate(16 16) scale(0.5)');
  });

  it('versão monocromática usa apenas uma cor', () => {
    const svg = emblemSvg({ monochrome: '#FFFFFF' });
    const colorsUsed = new Set(svg.match(/#[0-9A-Fa-f]{6}/g));
    expect([...colorsUsed]).toEqual(['#FFFFFF']);
  });
});
