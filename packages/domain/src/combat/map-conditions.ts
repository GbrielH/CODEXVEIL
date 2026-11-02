/** Condições compactas exibidas nos tokens do mapa. O catálogo é estático; o banco guarda chaves. */
export const MAP_CONDITIONS = [
  { key: 'grappled', name: 'Agarrado', icon: '⛓', description: 'Deslocamento reduzido a zero.' },
  { key: 'frightened', name: 'Amedrontado', icon: '☠', description: 'Tem dificuldade para agir diante da fonte do medo.' },
  { key: 'stunned', name: 'Atordoado', icon: '✹', description: 'Não consegue agir e fica vulnerável.' },
  { key: 'prone', name: 'Caído', icon: '↘', description: 'Está no chão até se levantar.' },
  { key: 'blinded', name: 'Cego', icon: '◉', description: 'Não enxerga.' },
  { key: 'restrained', name: 'Contido', icon: '▣', description: 'Movimento limitado e ataques prejudicados.' },
  { key: 'charmed', name: 'Enfeitiçado', icon: '♥', description: 'Não pode ferir quem o enfeitiçou.' },
  { key: 'poisoned', name: 'Envenenado', icon: '☣', description: 'Ataques e testes ficam prejudicados.' },
  { key: 'exhaustion', name: 'Exausto', icon: '◷', description: 'Exaustão acumulada por nível.', maxLevel: 6 },
  { key: 'hampered', name: 'Impedido', icon: '⊘', description: 'O movimento ou uma ação está impedida.' },
  { key: 'incapacitated', name: 'Incapacitado', icon: '✕', description: 'Não pode realizar ações nem reações.' },
  { key: 'unconscious', name: 'Inconsciente', icon: '☾', description: 'Não percebe o ambiente e fica indefeso.' },
  { key: 'invisible', name: 'Invisível', icon: '◌', description: 'Não pode ser visto sem sentidos especiais.' },
  { key: 'paralyzed', name: 'Paralisado', icon: '║', description: 'Não se move nem age.' },
  { key: 'petrified', name: 'Petrificado', icon: '◆', description: 'Transformado em matéria sólida e inerte.' },
  { key: 'deafened', name: 'Surdo', icon: '♪', description: 'Não ouve.' },
  { key: 'concentrating', name: 'Concentrando', icon: '◎', description: 'Mantém concentração em um efeito.' },
] as const;

export type MapConditionKey = (typeof MAP_CONDITIONS)[number]['key'];

export interface MapTokenCondition {
  key: MapConditionKey;
  /** Rodadas restantes; ausente dura até o mestre remover. */
  rounds?: number;
  /** Usado pela condição Exausto. */
  level?: number;
}

const keys = new Set<string>(MAP_CONDITIONS.map((condition) => condition.key));

export function isMapConditionKey(value: unknown): value is MapConditionKey {
  return typeof value === 'string' && keys.has(value);
}

export function parseMapTokenConditions(value: unknown): MapTokenCondition[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): MapTokenCondition[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (!isMapConditionKey(row.key)) return [];
    const rounds = typeof row.rounds === 'number' && Number.isInteger(row.rounds) && row.rounds > 0 ? row.rounds : undefined;
    const level = row.key === 'exhaustion' && typeof row.level === 'number' && Number.isInteger(row.level) && row.level >= 1 && row.level <= 6 ? row.level : undefined;
    return [{ key: row.key, ...(rounds === undefined ? {} : { rounds }), ...(level === undefined ? {} : { level }) }];
  });
}

export function mapConditionLabel(condition: MapTokenCondition): string {
  const definition = MAP_CONDITIONS.find((entry) => entry.key === condition.key);
  return `${definition?.name ?? condition.key}${condition.level ? ` ${condition.level}` : ''}${condition.rounds ? ` · ${condition.rounds} rod.` : ''}`;
}
