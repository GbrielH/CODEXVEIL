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
    className: 'bg-emerald-900/70 text-emerald-200 ring-emerald-500/50',
  },
  B: { label: 'Adaptação', glyph: '⟳', className: 'bg-sky-900/70 text-sky-200 ring-sky-500/50' },
  C: { label: 'Pressão', glyph: '✖', className: 'bg-red-950/80 text-red-200 ring-red-500/50' },
  d: {
    label: 'Ponto de Determinação',
    glyph: 'd',
    className: 'bg-amber-900/60 text-amber-100 ring-amber-500/40',
  },
  e: {
    label: 'Ponto de Assimilação',
    glyph: 'e',
    className: 'bg-violet-900/60 text-violet-100 ring-violet-500/40',
  },
  s: {
    label: 'Ponto de Saúde',
    glyph: 's',
    className: 'bg-rose-900/60 text-rose-100 ring-rose-500/40',
  },
  D: {
    label: 'Nível de Determinação',
    glyph: 'D',
    className: 'bg-amber-800/70 text-amber-50 ring-amber-400/50 font-bold',
  },
  E: {
    label: 'Nível de Assimilação',
    glyph: 'E',
    className: 'bg-violet-800/70 text-violet-50 ring-violet-400/50 font-bold',
  },
  S: {
    label: 'Nível de Saúde',
    glyph: 'S',
    className: 'bg-rose-800/70 text-rose-50 ring-rose-400/50 font-bold',
  },
  '6': { label: 'd6', glyph: 'd6', className: 'bg-stone-800 text-stone-100 ring-stone-500/50' },
  '1': { label: 'd10', glyph: 'd10', className: 'bg-stone-800 text-stone-100 ring-stone-500/50' },
  '2': { label: 'd12', glyph: 'd12', className: 'bg-stone-800 text-stone-100 ring-stone-500/50' },
  F: { label: 'Copas', glyph: '♥', className: 'bg-sunken text-red-300 ring-line' },
  G: { label: 'Ouros', glyph: '♦', className: 'bg-sunken text-red-300 ring-line' },
  H: { label: 'Espadas', glyph: '♠', className: 'bg-sunken text-fg ring-line' },
  I: { label: 'Paus', glyph: '♣', className: 'bg-sunken text-fg ring-line' },
  P: {
    label: 'Penalidade',
    glyph: 'P',
    className: 'bg-orange-950/80 text-orange-200 ring-orange-500/50',
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
