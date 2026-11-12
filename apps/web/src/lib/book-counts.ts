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

const ASSIMILACAO_COUNT_LABELS: [string, string, string][] = [
  ['section', 'seção', 'seções'],
  ['characteristic', 'característica', 'características'],
  ['assimilation', 'carta de Assimilação', 'cartas de Assimilação'],
  ['artifact', 'artefato', 'artefatos'],
  ['event', 'carta de Evento', 'cartas de Evento'],
];

const TRIANGLE_COUNT_LABELS: [string, string, string][] = [
  ['arc_anomaly', 'Anomalia', 'Anomalias'],
  ['arc_reality', 'Realidade', 'Realidades'],
  ['arc_competency', 'Competência', 'Competências'],
  ['anomalous_ability', 'habilidade anômala', 'habilidades anômalas'],
  ['requisition', 'requisição', 'requisições'],
  ['locked_document', 'documento bloqueado', 'documentos bloqueados'],
  ['section', 'página', 'páginas'],
];

const ORDEM2_COUNT_LABELS: [string, string, string][] = [
  ['mission', 'missão', 'missões'],
  ['scene', 'cena', 'cenas'],
  ['point_of_interest', 'ponto de interesse', 'pontos de interesse'],
  ['creature', 'criatura', 'criaturas'],
  ['map', 'mapa', 'mapas'],
  ['tool', 'ferramenta', 'ferramentas'],
  ['section', 'página', 'páginas'],
];

export function describeBookCounts(counts: Record<string, number>, systemId = 'dnd5e'): string {
  const labels =
    systemId === 'tormenta20'
      ? T20_COUNT_LABELS
      : systemId === 'assimilacao'
        ? ASSIMILACAO_COUNT_LABELS
        : systemId === 'triangle-agency'
          ? TRIANGLE_COUNT_LABELS
          : systemId === 'ordem2'
            ? ORDEM2_COUNT_LABELS
            : COUNT_LABELS;
  return labels
    .filter(([kind]) => (counts[kind] ?? 0) > 0)
    .map(([kind, one, many]) => `${counts[kind]} ${counts[kind] === 1 ? one : many}`)
    .join(' · ');
}
