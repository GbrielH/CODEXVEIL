import { Fragment, type ReactNode } from 'react';
import { Text } from 'react-native';

/**
 * Ícones do Assimilação RPG no app, como no site: os marcadores ({A}, {d}, {6}…) viram um
 * símbolo colorido com o nome para o leitor de tela.
 */
const SYMBOLS: Record<string, { label: string; glyph: string; color: string }> = {
  A: { label: 'Sucesso', glyph: '✦', color: '#6ee7b7' },
  B: { label: 'Adaptação', glyph: '⟳', color: '#7dd3fc' },
  C: { label: 'Pressão', glyph: '✖', color: '#fca5a5' },
  d: { label: 'Ponto de Determinação', glyph: 'd', color: '#fcd34d' },
  e: { label: 'Ponto de Assimilação', glyph: 'e', color: '#c4b5fd' },
  s: { label: 'Ponto de Saúde', glyph: 's', color: '#fda4af' },
  D: { label: 'Nível de Determinação', glyph: 'D', color: '#fcd34d' },
  E: { label: 'Nível de Assimilação', glyph: 'E', color: '#c4b5fd' },
  S: { label: 'Nível de Saúde', glyph: 'S', color: '#fda4af' },
  '6': { label: 'd6', glyph: 'd6', color: '#e7e5e4' },
  '1': { label: 'd10', glyph: 'd10', color: '#e7e5e4' },
  '2': { label: 'd12', glyph: 'd12', color: '#e7e5e4' },
  F: { label: 'Copas', glyph: '♥', color: '#fca5a5' },
  G: { label: 'Ouros', glyph: '♦', color: '#fca5a5' },
  H: { label: 'Espadas', glyph: '♠', color: '#e7e5e4' },
  I: { label: 'Paus', glyph: '♣', color: '#e7e5e4' },
  P: { label: 'Penalidade', glyph: 'P', color: '#fdba74' },
};

export function AssimSymbol({ code }: { code: string }) {
  const symbol = SYMBOLS[code];
  if (!symbol) return <Text>{`{${code}}`}</Text>;
  return (
    <Text accessibilityLabel={symbol.label} style={{ color: symbol.color, fontWeight: '700' }}>
      {symbol.glyph}
    </Text>
  );
}

/** Troca os marcadores de um texto pelos símbolos (usar dentro de um <Text>). */
export function withAssimSymbols(text: string): ReactNode {
  if (!text.includes('{')) return text;
  return text
    .split(/(\{[ABCdeDEsS612FGHIP]\})/g)
    .map((part, index) =>
      /^\{[ABCdeDEsS612FGHIP]\}$/.test(part) ? (
        <AssimSymbol key={index} code={part[1]!} />
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );
}
