import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTokensCss } from './css';
import { brandColors } from './tokens';

describe('tokens.css', () => {
  const generated = buildTokensCss();

  it('está sincronizado com tokens.ts (rode `pnpm --filter @codexveil/ui build:css`)', () => {
    const onDisk = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
    expect(onDisk.replace(/\r\n/g, '\n')).toBe(generated);
  });

  it('expõe as cores oficiais e remove a paleta padrão do Tailwind', () => {
    expect(generated).toContain('--color-*: initial;');
    for (const value of Object.values(brandColors)) {
      expect(generated).toContain(value);
    }
    expect(generated).toContain('--color-fg-secondary:');
    expect(generated).toContain('--font-display:');
  });
});
