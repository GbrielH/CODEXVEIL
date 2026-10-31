import { Fragment, type ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * Ícones do Assimilação RPG nos textos do livro e da ficha. O pacote marca cada ícone entre
 * chaves ({A}, {d}, {6}…); aqui eles viram selos com cor e nome (para leitores de tela também).
 */
const SYMBOLS: Record<string, { label: string; glyph: string; className: string }> = {
  A: {
    label: 'Sucesso',
    glyph: '✦',
    className: 'bg-verdigris-900/70 text-verdigris-300 ring-verdigris-400/50',
  },
  B: {
    label: 'Adaptação',
    glyph: '⟳',
    className: 'bg-arcane-900/70 text-arcane-300 ring-arcane-400/50',
  },
  C: {
    label: 'Pressão',
    glyph: '✖',
    className: 'bg-ember-900/80 text-ember-300 ring-ember-400/50',
  },
  d: {
    label: 'Ponto de Determinação',
    glyph: 'd',
    className: 'bg-amber-900/60 text-amber-300 ring-amber-400/40',
  },
  e: {
    label: 'Ponto de Assimilação',
    glyph: 'e',
    className: 'bg-arcane-900/60 text-arcane-300 ring-arcane-400/40',
  },
  s: {
    label: 'Ponto de Saúde',
    glyph: 's',
    className: 'bg-ember-900/60 text-ember-300 ring-ember-400/40',
  },
  D: {
    label: 'Nível de Determinação',
    glyph: 'D',
    className: 'bg-amber-900/70 text-amber-300 ring-amber-400/50 font-bold',
  },
  E: {
    label: 'Nível de Assimilação',
    glyph: 'E',
    className: 'bg-arcane-900/70 text-arcane-300 ring-arcane-400/50 font-bold',
  },
  S: {
    label: 'Nível de Saúde',
    glyph: 'S',
    className: 'bg-ember-900/70 text-ember-300 ring-ember-400/50 font-bold',
  },
  '6': {
    label: 'd6',
    glyph: 'd6',
    className: 'bg-charcoal-800 text-silver-100 ring-silver-500/50',
  },
  '1': {
    label: 'd10',
    glyph: 'd10',
    className: 'bg-charcoal-800 text-silver-100 ring-silver-500/50',
  },
  '2': {
    label: 'd12',
    glyph: 'd12',
    className: 'bg-charcoal-800 text-silver-100 ring-silver-500/50',
  },
  F: { label: 'Copas', glyph: '♥', className: 'bg-sunken text-ember-300 ring-line' },
  G: { label: 'Ouros', glyph: '♦', className: 'bg-sunken text-ember-300 ring-line' },
  H: { label: 'Espadas', glyph: '♠', className: 'bg-sunken text-fg ring-line' },
  I: { label: 'Paus', glyph: '♣', className: 'bg-sunken text-fg ring-line' },
  P: {
    label: 'Penalidade',
    glyph: 'P',
    className: 'bg-ember-900/80 text-ember-300 ring-ember-400/50',
  },
};

const TOKEN = /(\{[ABCdeDEsS612FGHIP]\})/g;

export function AssimSymbol({ code, className }: { code: string; className?: string }) {
  const symbol = SYMBOLS[code];
  if (!symbol) return <>{`{${code}}`}</>;
  return (
    <span
      role="img"
      aria-label={symbol.label}
      title={symbol.label}
      className={cx(
        'mx-px inline-flex h-[1.35em] min-w-[1.35em] items-center justify-center rounded-full px-1 align-[-0.2em] text-[0.75em] leading-none ring-1',
        symbol.className,
        className,
      )}
    >
      {symbol.glyph}
    </span>
  );
}

/** Troca os marcadores de um texto pelos selos; o resto passa por `renderText`. */
export function withAssimSymbols(
  text: string,
  renderText: (part: string, key: number) => ReactNode = (part) => part,
): ReactNode {
  if (!text.includes('{')) return renderText(text, 0);
  return text
    .split(TOKEN)
    .map((part, index) =>
      /^\{[ABCdeDEsS612FGHIP]\}$/.test(part) ? (
        <AssimSymbol key={index} code={part[1]!} />
      ) : (
        <Fragment key={index}>{renderText(part, index)}</Fragment>
      ),
    );
}

export const assimSymbolLabels = Object.fromEntries(
  Object.entries(SYMBOLS).map(([code, value]) => [code, value.label]),
);
