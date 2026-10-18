/**
 * Gera o CSS de tokens consumido pelo Tailwind CSS v4 (bloco `@theme`).
 * Executado por `scripts/build-css.ts`; um teste garante que o arquivo gerado
 * em `css/tokens.css` está sincronizado com `tokens.ts`.
 */
import {
  colors,
  fontSizes,
  lightColors,
  lightPaletteOverrides,
  motion,
  palette,
  radii,
  shadows,
} from './tokens.ts';

function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function buildTokensCss(): string {
  const lines: string[] = [];
  const push = (name: string, value: string | number) => lines.push(`  --${name}: ${value};`);

  // Remove a paleta padrão do Tailwind: só cores do design system podem ser usadas.
  lines.push('  --color-*: initial;');
  push('color-white', '#ffffff');
  push('color-black', '#000000');

  for (const [scaleName, scale] of Object.entries(palette)) {
    for (const [step, value] of Object.entries(scale)) {
      push(`color-${scaleName}-${step}`, value);
    }
  }
  for (const [name, value] of Object.entries(colors)) {
    push(`color-${kebab(name)}`, value);
  }

  // As variáveis --font-cinzel, --font-inter e --font-alegreya são definidas pelo app
  // (next/font). Os nomes literais servem de alternativa quando a fonte já está instalada.
  push('font-display', 'var(--font-cinzel), "Cinzel", "Times New Roman", serif');
  push('font-sans', 'var(--font-inter), "Inter", ui-sans-serif, system-ui, sans-serif');
  push('font-serif', 'var(--font-alegreya), "Alegreya", Georgia, serif');

  for (const [name, [size, lineHeight]] of Object.entries(fontSizes)) {
    push(`text-${name}`, `${size / 16}rem`);
    push(`text-${name}--line-height`, `${lineHeight / 16}rem`);
  }

  for (const [name, value] of Object.entries(radii)) {
    push(`radius-${name}`, `${value}px`);
  }

  for (const [name, value] of Object.entries(shadows)) {
    push(`shadow-${kebab(name)}`, value);
  }

  // Tailwind não tem namespace de duração: estas variáveis servem ao CSS próprio
  // (ex.: `duration-(--motion-fast)` ou `animation: ... var(--motion-slow)`).
  push('ease-codex', motion.easing);
  push('motion-fast', `${motion.durationFast}ms`);
  push('motion-base', `${motion.durationBase}ms`);
  push('motion-slow', `${motion.durationSlow}ms`);

  return [
    '/* Arquivo gerado por packages/ui/scripts/build-css.ts — não edite manualmente. */',
    '/* Fonte da verdade: packages/ui/src/tokens.ts */',
    '/* `static`: todas as variáveis ficam disponíveis via var(), mesmo sem utilitário em uso. */',
    '@theme static {',
    ...lines,
    '}',
    '',
    '/* Tema claro: `data-theme="light"` no <html> (escolha salva no navegador). */',
    ":root[data-theme='light'] {",
    '  color-scheme: light;',
    ...Object.entries(lightPaletteOverrides).map(([name, value]) => `  --color-${name}: ${value};`),
    ...Object.entries(lightColors).map(([name, value]) => `  --color-${kebab(name)}: ${value};`),
    '}',
    '',
  ].join('\n');
}
