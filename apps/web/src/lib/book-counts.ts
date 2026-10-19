/** Resumo do conteúdo de um livro importado ("12 espécies · 300 magias"), nos termos do sistema. */
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

const T20_COUNT_LABELS: [string, string, string][] = [
  ['species', 'raça', 'raças'],
  ['class', 'classe', 'classes'],
  ['background', 'origem', 'origens'],
  ['deity', 'divindade', 'divindades'],
  ['feat', 'poder', 'poderes'],
  ['spell', 'magia', 'magias'],
  ['equipment', 'equipamento', 'equipamentos'],
  ['magic_item', 'item mágico', 'itens mágicos'],
  ['monster', 'ameaça', 'ameaças'],
];

export function describeBookCounts(counts: Record<string, number>, systemId = 'dnd5e'): string {
  return (systemId === 'tormenta20' ? T20_COUNT_LABELS : COUNT_LABELS)
    .filter(([kind]) => (counts[kind] ?? 0) > 0)
    .map(([kind, one, many]) => `${counts[kind]} ${counts[kind] === 1 ? one : many}`)
    .join(' · ');
}
