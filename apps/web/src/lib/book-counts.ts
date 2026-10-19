/** Resumo do conteúdo de um livro importado ("12 espécies · 300 magias"). */
const COUNT_LABELS: [string, string, string][] = [
  ['species', 'espécie', 'espécies'],
  ['class', 'classe', 'classes'],
  ['subclass', 'subclasse', 'subclasses'],
  ['background', 'antecedente', 'antecedentes'],
  ['feat', 'talento', 'talentos'],
  ['spell', 'magia', 'magias'],
  ['monster', 'monstro', 'monstros'],
  ['magic_item', 'item mágico', 'itens mágicos'],
];

export function describeBookCounts(counts: Record<string, number>): string {
  return COUNT_LABELS.filter(([kind]) => (counts[kind] ?? 0) > 0)
    .map(([kind, one, many]) => `${counts[kind]} ${counts[kind] === 1 ? one : many}`)
    .join(' · ');
}
