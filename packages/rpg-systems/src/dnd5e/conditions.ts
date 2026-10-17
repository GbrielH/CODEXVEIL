/**
 * Condições do SRD 5.2.1 ("Rules Glossary"). O texto das regras foi traduzido e adaptado pelo
 * Codexveil (CC-BY-4.0; veja docs/CONTENT_LICENSES.md), com medidas em metros. Os efeitos
 * mecânicos ficam em dados estruturados para que a ficha os aplique sozinha: vantagem e
 * desvantagem, falhas automáticas, deslocamento, penalidade de Exaustão e incapacitação.
 *
 * Condições não têm duração própria no SRD: duram até serem anuladas (levantar-se encerra
 * Caído, por exemplo) ou pelo tempo que o efeito que as impôs determinar. Por isso a duração
 * é informada ao aplicar a condição, em rodadas (veja `dnd5eConditionDurations`).
 */
import type { ConditionDefinition, ConditionDurationPreset } from '../types';
import { ABILITIES, abilityLabels, type Ability } from './abilities';

export type RollMode = 'advantage' | 'disadvantage';

/** Vantagem ou desvantagem; `qualifier` indica que só vale numa situação específica. */
export interface RollEffect {
  readonly mode: RollMode;
  readonly qualifier?: string;
}

export interface Dnd5eConditionMechanics {
  /** Jogadas de ataque feitas pela criatura. */
  readonly attackRolls?: readonly RollEffect[];
  /** Jogadas de ataque contra a criatura. */
  readonly attacksAgainst?: readonly RollEffect[];
  /** Testes de atributo (inclui perícias e iniciativa). */
  readonly abilityChecks?: readonly RollEffect[];
  /** Efeitos só na jogada de iniciativa. */
  readonly initiative?: readonly RollEffect[];
  readonly savingThrows?: readonly {
    readonly abilities: readonly Ability[];
    readonly mode: RollMode | 'auto_fail';
  }[];
  readonly speedZero?: boolean;
  /** Sem ações, ações bônus nem reações; concentração interrompida; não fala. */
  readonly incapacitated?: boolean;
  /** Acertos de atacantes a até 1,5 m são críticos. */
  readonly autoCritWithin5ft?: boolean;
  readonly resistAllDamage?: boolean;
  readonly conditionImmunities?: readonly string[];
}

export interface Dnd5eConditionDefinition extends ConditionDefinition {
  readonly mechanics: Dnd5eConditionMechanics;
}

const STR_DEX = ['str', 'dex'] as const;

const SPEED_ZERO = { title: 'Deslocamento 0', text: 'Seu Deslocamento é 0 e não pode aumentar.' };
const INCAPACITATED = { title: 'Incapacitado', text: 'Você tem a condição Incapacitado.' };
const STR_DEX_FAIL = {
  title: 'Resistências afetadas',
  text: 'Você falha automaticamente em testes de resistência de Força e Destreza.',
};
const AUTO_CRIT = {
  title: 'Críticos automáticos',
  text: 'Qualquer jogada de ataque que o atinja é um Acerto Crítico se o atacante estiver a até 1,5 m de você.',
};

export const dnd5eConditions = [
  {
    key: 'blinded',
    label: 'Cego',
    summary: 'Não enxerga. Ataques contra ele têm vantagem; os ataques dele têm desvantagem.',
    rules: [
      {
        title: 'Não enxerga',
        text: 'Você não consegue ver e falha automaticamente em qualquer teste de atributo que dependa da visão.',
      },
      {
        title: 'Ataques afetados',
        text: 'Jogadas de ataque contra você têm Vantagem, e as suas jogadas de ataque têm Desvantagem.',
      },
    ],
    mechanics: {
      attackRolls: [{ mode: 'disadvantage' }],
      attacksAgainst: [{ mode: 'advantage' }],
    },
  },
  {
    key: 'charmed',
    label: 'Enfeitiçado',
    summary:
      'Não pode atacar quem o enfeitiçou; essa criatura tem vantagem em interações sociais com ele.',
    rules: [
      {
        title: 'Não fere quem o enfeitiçou',
        text: 'Você não pode atacar quem o enfeitiçou nem escolhê-lo como alvo de habilidades ou efeitos mágicos que causem dano.',
      },
      {
        title: 'Vantagem social',
        text: 'Quem o enfeitiçou tem Vantagem em qualquer teste de atributo para interagir socialmente com você.',
      },
    ],
    mechanics: {},
  },
  {
    key: 'deafened',
    label: 'Surdo',
    summary: 'Não ouve e falha em testes que dependem de audição.',
    rules: [
      {
        title: 'Não ouve',
        text: 'Você não consegue ouvir e falha automaticamente em qualquer teste de atributo que dependa da audição.',
      },
    ],
    mechanics: {},
  },
  {
    key: 'exhaustion',
    label: 'Exaustão',
    summary:
      'Cada nível impõe −2 em testes de d20 e reduz o deslocamento em 1,5 m. No nível 6, a criatura morre.',
    maxLevel: 6,
    rules: [
      {
        title: 'Níveis de Exaustão',
        text: 'A condição é cumulativa: cada vez que você a recebe, ganha 1 nível de Exaustão. Você morre se o seu nível de Exaustão chegar a 6.',
      },
      {
        title: 'Testes de d20 afetados',
        text: 'Toda jogada de Teste de d20 (ataque, teste de atributo ou de resistência) é reduzida em 2 × o seu nível de Exaustão.',
      },
      {
        title: 'Deslocamento reduzido',
        text: 'Seu Deslocamento é reduzido em 1,5 m × o seu nível de Exaustão.',
      },
      {
        title: 'Removendo níveis',
        text: 'Terminar um Descanso Longo remove 1 nível de Exaustão. Quando o nível chega a 0, a condição termina.',
      },
    ],
    mechanics: {},
  },
  {
    key: 'frightened',
    label: 'Amedrontado',
    summary:
      'Desvantagem em testes e ataques enquanto vê a fonte do medo; não se aproxima dela por vontade própria.',
    rules: [
      {
        title: 'Testes e ataques afetados',
        text: 'Você tem Desvantagem em testes de atributo e jogadas de ataque enquanto a fonte do medo estiver na sua linha de visão.',
      },
      {
        title: 'Não se aproxima',
        text: 'Você não pode se aproximar voluntariamente da fonte do medo.',
      },
    ],
    mechanics: {
      attackRolls: [{ mode: 'disadvantage', qualifier: 'com a fonte do medo à vista' }],
      abilityChecks: [{ mode: 'disadvantage', qualifier: 'com a fonte do medo à vista' }],
    },
  },
  {
    key: 'grappled',
    label: 'Agarrado',
    summary: 'Deslocamento 0. Desvantagem em ataques contra alvos que não sejam quem o agarra.',
    rules: [
      SPEED_ZERO,
      {
        title: 'Ataques afetados',
        text: 'Você tem Desvantagem em jogadas de ataque contra qualquer alvo que não seja quem o agarra.',
      },
      {
        title: 'Pode ser arrastado',
        text: 'Quem o agarra pode arrastá-lo ou carregá-lo ao se mover, mas cada 1,5 m percorrido custa 1,5 m extra, a menos que você seja Miúdo ou pelo menos dois tamanhos menor que ele.',
      },
      {
        title: 'Escapando',
        text: 'Com uma ação, você faz um teste de Força (Atletismo) ou Destreza (Acrobacia) contra a CD de fuga; no sucesso, a condição termina. Ela também termina se quem o agarra ficar Incapacitado ou se afastar além do alcance.',
      },
    ],
    mechanics: {
      speedZero: true,
      attackRolls: [{ mode: 'disadvantage', qualifier: 'contra quem não o agarra' }],
    },
  },
  {
    key: 'incapacitated',
    label: 'Incapacitado',
    summary: 'Não realiza ações, ações bônus nem reações; perde a concentração e não pode falar.',
    rules: [
      { title: 'Inativo', text: 'Você não pode realizar nenhuma ação, Ação Bônus ou Reação.' },
      { title: 'Sem concentração', text: 'Sua Concentração é interrompida.' },
      { title: 'Sem fala', text: 'Você não pode falar.' },
      {
        title: 'Surpreso',
        text: 'Se estiver Incapacitado ao rolar Iniciativa, você tem Desvantagem na jogada.',
      },
    ],
    mechanics: {
      incapacitated: true,
      initiative: [{ mode: 'disadvantage' }],
    },
  },
  {
    key: 'invisible',
    label: 'Invisível',
    summary: 'Não pode ser visto. Ataques contra ele têm desvantagem; os ataques dele têm vantagem.',
    rules: [
      {
        title: 'Surpresa',
        text: 'Se estiver Invisível ao rolar Iniciativa, você tem Vantagem na jogada.',
      },
      {
        title: 'Oculto',
        text: 'Você não é afetado por efeitos que exigem que o alvo seja visto, a menos que quem os cria consiga vê-lo de algum modo. O equipamento que você veste ou carrega também fica oculto.',
      },
      {
        title: 'Ataques afetados',
        text: 'Jogadas de ataque contra você têm Desvantagem, e as suas têm Vantagem. Contra uma criatura que consiga vê-lo de algum modo, você não tem esse benefício.',
      },
    ],
    mechanics: {
      initiative: [{ mode: 'advantage' }],
      attackRolls: [{ mode: 'advantage' }],
      attacksAgainst: [{ mode: 'disadvantage' }],
    },
  },
  {
    key: 'paralyzed',
    label: 'Paralisado',
    summary:
      'Incapacitado e sem deslocamento. Falha em resistências de FOR e DES; acertos a até 1,5 m são críticos.',
    includes: ['incapacitated'],
    rules: [
      INCAPACITATED,
      SPEED_ZERO,
      STR_DEX_FAIL,
      { title: 'Ataques afetados', text: 'Jogadas de ataque contra você têm Vantagem.' },
      AUTO_CRIT,
    ],
    mechanics: {
      speedZero: true,
      savingThrows: [{ abilities: STR_DEX, mode: 'auto_fail' }],
      attacksAgainst: [{ mode: 'advantage' }],
      autoCritWithin5ft: true,
    },
  },
  {
    key: 'petrified',
    label: 'Petrificado',
    summary: 'Transformado em matéria inanimada: incapacitado, com resistência a todo dano.',
    includes: ['incapacitated'],
    rules: [
      {
        title: 'Matéria inanimada',
        text: 'Você e os objetos não mágicos que veste e carrega se transformam numa substância sólida e inanimada (geralmente pedra). Seu peso é multiplicado por dez e você deixa de envelhecer.',
      },
      INCAPACITATED,
      SPEED_ZERO,
      { title: 'Ataques afetados', text: 'Jogadas de ataque contra você têm Vantagem.' },
      STR_DEX_FAIL,
      { title: 'Resiste a dano', text: 'Você tem Resistência a todo dano.' },
      { title: 'Imune a veneno', text: 'Você tem Imunidade à condição Envenenado.' },
    ],
    mechanics: {
      speedZero: true,
      attacksAgainst: [{ mode: 'advantage' }],
      savingThrows: [{ abilities: STR_DEX, mode: 'auto_fail' }],
      resistAllDamage: true,
      conditionImmunities: ['poisoned'],
    },
  },
  {
    key: 'poisoned',
    label: 'Envenenado',
    summary: 'Desvantagem em jogadas de ataque e testes de atributo.',
    rules: [
      {
        title: 'Testes e ataques afetados',
        text: 'Você tem Desvantagem em jogadas de ataque e testes de atributo.',
      },
    ],
    mechanics: {
      attackRolls: [{ mode: 'disadvantage' }],
      abilityChecks: [{ mode: 'disadvantage' }],
    },
  },
  {
    key: 'prone',
    label: 'Caído',
    summary:
      'Só rasteja e tem desvantagem em ataques. Ataques corpo a corpo próximos contra ele têm vantagem.',
    rules: [
      {
        title: 'Movimento restrito',
        text: 'Você só pode rastejar ou gastar metade do seu Deslocamento (arredondado para baixo) para se levantar, o que encerra a condição. Com Deslocamento 0, você não consegue se levantar.',
      },
      {
        title: 'Ataques afetados',
        text: 'Você tem Desvantagem em jogadas de ataque. Uma jogada de ataque contra você tem Vantagem se o atacante estiver a até 1,5 m; caso contrário, tem Desvantagem.',
      },
    ],
    mechanics: {
      attackRolls: [{ mode: 'disadvantage' }],
      attacksAgainst: [
        { mode: 'advantage', qualifier: 'atacante a até 1,5 m' },
        { mode: 'disadvantage', qualifier: 'atacante a mais de 1,5 m' },
      ],
    },
  },
  {
    key: 'restrained',
    label: 'Contido',
    summary:
      'Deslocamento 0. Ataques contra ele têm vantagem; os dele e suas resistências de DES têm desvantagem.',
    rules: [
      SPEED_ZERO,
      {
        title: 'Ataques afetados',
        text: 'Jogadas de ataque contra você têm Vantagem, e as suas jogadas de ataque têm Desvantagem.',
      },
      {
        title: 'Resistências afetadas',
        text: 'Você tem Desvantagem em testes de resistência de Destreza.',
      },
    ],
    mechanics: {
      speedZero: true,
      attacksAgainst: [{ mode: 'advantage' }],
      attackRolls: [{ mode: 'disadvantage' }],
      savingThrows: [{ abilities: ['dex'], mode: 'disadvantage' }],
    },
  },
  {
    key: 'stunned',
    label: 'Atordoado',
    summary: 'Incapacitado. Falha em resistências de FOR e DES; ataques contra ele têm vantagem.',
    includes: ['incapacitated'],
    rules: [
      INCAPACITATED,
      STR_DEX_FAIL,
      { title: 'Ataques afetados', text: 'Jogadas de ataque contra você têm Vantagem.' },
    ],
    mechanics: {
      savingThrows: [{ abilities: STR_DEX, mode: 'auto_fail' }],
      attacksAgainst: [{ mode: 'advantage' }],
    },
  },
  {
    key: 'unconscious',
    label: 'Inconsciente',
    summary:
      'Incapacitado e caído, solta o que segura. Ataques contra ele têm vantagem; acertos próximos são críticos.',
    includes: ['incapacitated', 'prone'],
    leaves: ['prone'],
    rules: [
      {
        title: 'Inerte',
        text: 'Você tem as condições Incapacitado e Caído e larga o que estiver segurando. Quando esta condição termina, você continua Caído.',
      },
      SPEED_ZERO,
      { title: 'Ataques afetados', text: 'Jogadas de ataque contra você têm Vantagem.' },
      STR_DEX_FAIL,
      AUTO_CRIT,
      { title: 'Alheio', text: 'Você não percebe o que acontece ao seu redor.' },
    ],
    mechanics: {
      speedZero: true,
      attacksAgainst: [{ mode: 'advantage' }],
      savingThrows: [{ abilities: STR_DEX, mode: 'auto_fail' }],
      autoCritWithin5ft: true,
    },
  },
] as const satisfies readonly Dnd5eConditionDefinition[];

export type Dnd5eConditionKey = (typeof dnd5eConditions)[number]['key'];

const definitionsByKey = new Map<string, Dnd5eConditionDefinition>(
  dnd5eConditions.map((condition) => [condition.key, condition]),
);

export function findDnd5eCondition(key: string): Dnd5eConditionDefinition | undefined {
  return definitionsByKey.get(key);
}

/**
 * Durações oferecidas ao aplicar uma condição. Uma rodada são 6 segundos; a contagem diminui
 * no fim de cada turno de quem tem a condição.
 */
export const dnd5eConditionDurations: readonly ConditionDurationPreset[] = [
  { rounds: null, label: 'Até ser removida' },
  { rounds: 1, label: '1 rodada (até o fim do próximo turno)' },
  { rounds: 10, label: '1 minuto (10 rodadas)' },
  { rounds: 100, label: '10 minutos (100 rodadas)' },
  { rounds: 600, label: '1 hora (600 rodadas)' },
];

/** "1 rodada", "10 rodadas (1 min)", "600 rodadas (1 h)"; `null` = até ser removida. */
export function formatDnd5eConditionRounds(rounds: number | null): string {
  if (rounds === null) return 'até ser removida';
  const base = rounds === 1 ? '1 rodada' : `${rounds.toLocaleString('pt-BR')} rodadas`;
  if (rounds >= 600 && rounds % 600 === 0) return `${base} (${rounds / 600} h)`;
  if (rounds >= 10 && rounds % 10 === 0) return `${base} (${rounds / 10} min)`;
  return base;
}

// ---------------------------------------------------------------------------
// Efeitos combinados das condições ativas
// ---------------------------------------------------------------------------

export interface ActiveConditionInput {
  key: string;
  level: number | null;
}

/** Vantagem ou desvantagem com a condição que a causa. */
export interface ConditionRollSource extends RollEffect {
  readonly source: string;
}

export interface Dnd5eActiveCondition {
  key: string;
  /** Nome com o nível, quando houver (ex.: "Exaustão 2"). */
  label: string;
  level: number | null;
  /** Condição que impôs esta (ex.: "Paralisado"), quando não foi aplicada diretamente. */
  impliedBy: string | null;
  /** Condição que anula esta por imunidade (ex.: Petrificado anula Envenenado). */
  suppressedBy: string | null;
  definition: Dnd5eConditionDefinition | null;
}

export interface Dnd5eConditionEffects {
  /** Condições em vigor: as aplicadas e as impostas por elas. */
  conditions: Dnd5eActiveCondition[];
  exhaustionLevel: number;
  /** Quanto reduzir toda jogada de Teste de d20 (Exaustão: 2 × nível). */
  d20Penalty: number;
  /** Condições que zeram o deslocamento. */
  speedZero: string[];
  /** Redução do deslocamento, em pés (Exaustão: 5 × nível). */
  speedReductionFeet: number;
  attackRolls: ConditionRollSource[];
  attacksAgainst: ConditionRollSource[];
  abilityChecks: ConditionRollSource[];
  /** Testes de atributo mais os efeitos próprios da iniciativa. */
  initiative: ConditionRollSource[];
  savingThrows: Record<Ability, { autoFail: string[]; rolls: ConditionRollSource[] }>;
  incapacitated: string[];
  autoCritWithin5ft: string[];
  resistAllDamage: string[];
  /** Exaustão 6. */
  dead: boolean;
}

function withSource(effects: readonly RollEffect[] | undefined, source: string): ConditionRollSource[] {
  return (effects ?? []).map((effect) => ({ ...effect, source }));
}

/** Junta os efeitos de todas as condições ativas (inclusive as impostas por outras). */
export function dnd5eConditionEffects(active: readonly ActiveConditionInput[]): Dnd5eConditionEffects {
  const conditions: Dnd5eActiveCondition[] = [];
  const add = (key: string, level: number | null, impliedBy: string | null) => {
    const existing = conditions.find((condition) => condition.key === key);
    const definition = findDnd5eCondition(key) ?? null;
    if (existing) {
      if (level !== null && (existing.level ?? 0) < level) existing.level = level;
      if (impliedBy === null) existing.impliedBy = null;
      return;
    }
    conditions.push({ key, label: definition?.label ?? key, level, impliedBy, suppressedBy: null, definition });
    for (const included of definition?.includes ?? []) add(included, null, definition?.label ?? key);
  };
  for (const condition of active) {
    const definition = findDnd5eCondition(condition.key);
    const level = definition?.maxLevel
      ? Math.min(Math.max(condition.level ?? 1, 1), definition.maxLevel)
      : null;
    add(condition.key, level, null);
  }

  for (const condition of conditions) {
    condition.label = condition.level ? `${condition.label} ${condition.level}` : condition.label;
  }
  for (const condition of conditions) {
    const immune = conditions.find((other) =>
      other.definition?.mechanics.conditionImmunities?.includes(condition.key),
    );
    if (immune) condition.suppressedBy = immune.label;
  }

  const savingThrows = Object.fromEntries(
    ABILITIES.map((ability) => [ability, { autoFail: [] as string[], rolls: [] as ConditionRollSource[] }]),
  ) as Dnd5eConditionEffects['savingThrows'];
  const effects: Dnd5eConditionEffects = {
    conditions,
    exhaustionLevel: 0,
    d20Penalty: 0,
    speedZero: [],
    speedReductionFeet: 0,
    attackRolls: [],
    attacksAgainst: [],
    abilityChecks: [],
    initiative: [],
    savingThrows,
    incapacitated: [],
    autoCritWithin5ft: [],
    resistAllDamage: [],
    dead: false,
  };

  for (const condition of conditions) {
    const mechanics = condition.definition?.mechanics;
    if (!mechanics || condition.suppressedBy) continue;
    const source = condition.label;
    if (condition.key === 'exhaustion') {
      const level = condition.level ?? 1;
      effects.exhaustionLevel = level;
      effects.d20Penalty = 2 * level;
      effects.speedReductionFeet = 5 * level;
      effects.dead = level >= 6;
    }
    effects.attackRolls.push(...withSource(mechanics.attackRolls, source));
    effects.attacksAgainst.push(...withSource(mechanics.attacksAgainst, source));
    effects.abilityChecks.push(...withSource(mechanics.abilityChecks, source));
    effects.initiative.push(...withSource(mechanics.abilityChecks, source), ...withSource(mechanics.initiative, source));
    for (const save of mechanics.savingThrows ?? []) {
      for (const ability of save.abilities) {
        if (save.mode === 'auto_fail') savingThrows[ability].autoFail.push(source);
        else savingThrows[ability].rolls.push({ mode: save.mode, source });
      }
    }
    if (mechanics.speedZero) effects.speedZero.push(source);
    if (mechanics.incapacitated) effects.incapacitated.push(source);
    if (mechanics.autoCritWithin5ft) effects.autoCritWithin5ft.push(source);
    if (mechanics.resistAllDamage) effects.resistAllDamage.push(source);
  }
  return effects;
}

/**
 * Resultado das vantagens e desvantagens que valem sempre (sem situação específica): as duas
 * juntas se anulam, como manda a regra.
 */
export function netRollMode(sources: readonly ConditionRollSource[]): RollMode | 'cancelled' | null {
  const unconditional = sources.filter((source) => !source.qualifier);
  const advantage = unconditional.some((source) => source.mode === 'advantage');
  const disadvantage = unconditional.some((source) => source.mode === 'disadvantage');
  if (advantage && disadvantage) return 'cancelled';
  if (advantage) return 'advantage';
  if (disadvantage) return 'disadvantage';
  return null;
}

export const rollModeLabels: Record<RollMode, string> = {
  advantage: 'Vantagem',
  disadvantage: 'Desvantagem',
};

/** Abreviação para selos pequenos ("Vant." / "Desv."). */
export const rollModeShortLabels: Record<RollMode, string> = {
  advantage: 'Vant.',
  disadvantage: 'Desv.',
};

/** Frases como "Desvantagem (Envenenado, Caído)" ou "Vantagem com a fonte do medo à vista (Amedrontado)". */
export function describeRollSources(sources: readonly ConditionRollSource[]): string[] {
  const groups = new Map<string, { mode: RollMode; qualifier?: string; sources: string[] }>();
  for (const source of sources) {
    const id = `${source.mode}|${source.qualifier ?? ''}`;
    const group = groups.get(id) ?? { mode: source.mode, ...(source.qualifier ? { qualifier: source.qualifier } : {}), sources: [] };
    if (!group.sources.includes(source.source)) group.sources.push(source.source);
    groups.set(id, group);
  }
  return [...groups.values()].map(
    (group) =>
      `${rollModeLabels[group.mode]}${group.qualifier ? ` ${group.qualifier}` : ''} (${group.sources.join(', ')})`,
  );
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Deslocamento efetivo na unidade da ficha (metros ou pés), nunca negativo. */
export function effectiveSpeed(speed: number, unit: 'm' | 'ft', effects: Dnd5eConditionEffects): number {
  if (effects.speedZero.length > 0) return 0;
  const reduction = unit === 'ft' ? effects.speedReductionFeet : (effects.speedReductionFeet / 5) * 1.5;
  return Math.max(0, roundOne(speed - reduction));
}

/**
 * Valor passivo (10 + bônus) com as condições: +5 com vantagem e −5 com desvantagem nos testes
 * de atributo. A Exaustão não afeta valores passivos, que não são rolagens.
 */
export function passiveWithConditions(passive: number, effects: Dnd5eConditionEffects): number {
  const mode = netRollMode(effects.abilityChecks);
  if (mode === 'advantage') return passive + 5;
  if (mode === 'disadvantage') return passive - 5;
  return passive;
}

export interface ConditionEffectLine {
  /** Ex.: "Jogadas de ataque". */
  label: string;
  /** Ex.: "Desvantagem (Envenenado)". */
  detail: string;
  /** Destaque para efeitos graves (morte, incapacitação, falha automática). */
  severe?: boolean;
}

/** Linhas legíveis com tudo o que as condições ativas mudam na ficha. */
export function describeDnd5eConditionEffects(effects: Dnd5eConditionEffects): ConditionEffectLine[] {
  const lines: ConditionEffectLine[] = [];
  if (effects.dead) {
    lines.push({ label: 'Morte', detail: 'Exaustão no nível 6: o personagem morre.', severe: true });
  }
  if (effects.incapacitated.length > 0) {
    lines.push({
      label: 'Ações',
      detail: `Nenhuma ação, ação bônus ou reação; concentração interrompida; não fala (${effects.incapacitated.join(', ')}).`,
      severe: true,
    });
  }
  if (effects.d20Penalty > 0) {
    lines.push({
      label: 'Testes de d20',
      detail: `−${effects.d20Penalty} em ataques, testes de atributo e de resistência (Exaustão ${effects.exhaustionLevel}).`,
    });
  }
  if (effects.speedZero.length > 0) {
    lines.push({ label: 'Deslocamento', detail: `0, sem poder aumentar (${effects.speedZero.join(', ')}).` });
  } else if (effects.speedReductionFeet > 0) {
    const meters = (effects.speedReductionFeet / 5) * 1.5;
    lines.push({
      label: 'Deslocamento',
      detail: `−${meters.toLocaleString('pt-BR')} m (Exaustão ${effects.exhaustionLevel}).`,
    });
  }
  if (effects.attackRolls.length > 0) {
    lines.push({ label: 'Seus ataques', detail: describeRollSources(effects.attackRolls).join('; ') });
  }
  if (effects.attacksAgainst.length > 0 || effects.autoCritWithin5ft.length > 0) {
    const parts = describeRollSources(effects.attacksAgainst);
    if (effects.autoCritWithin5ft.length > 0) {
      parts.push(`acertos a até 1,5 m são críticos (${effects.autoCritWithin5ft.join(', ')})`);
    }
    lines.push({ label: 'Ataques contra você', detail: parts.join('; ') });
  }
  if (effects.abilityChecks.length > 0) {
    lines.push({ label: 'Testes de atributo e perícias', detail: describeRollSources(effects.abilityChecks).join('; ') });
  }
  const initiativeOnly = effects.initiative.filter(
    (source) => !effects.abilityChecks.some((check) => check.source === source.source && check.mode === source.mode),
  );
  if (initiativeOnly.length > 0) {
    lines.push({ label: 'Iniciativa', detail: describeRollSources(initiativeOnly).join('; ') });
  }
  const saves: string[] = [];
  const autoFail = new Map<string, Ability[]>();
  for (const ability of ABILITIES) {
    for (const source of effects.savingThrows[ability].autoFail) {
      autoFail.set(source, [...(autoFail.get(source) ?? []), ability]);
    }
  }
  for (const [source, abilities] of autoFail) {
    saves.push(`${abilities.map((ability) => abilityLabels[ability].abbreviation).join(' e ')}: falha automática (${source})`);
  }
  for (const ability of ABILITIES) {
    const rolls = effects.savingThrows[ability].rolls;
    if (rolls.length > 0) saves.push(`${abilityLabels[ability].abbreviation}: ${describeRollSources(rolls).join('; ')}`);
  }
  if (saves.length > 0) {
    lines.push({ label: 'Testes de resistência', detail: saves.join('; '), severe: autoFail.size > 0 });
  }
  if (effects.resistAllDamage.length > 0) {
    lines.push({ label: 'Dano recebido', detail: `Resistência a todo dano (${effects.resistAllDamage.join(', ')}).` });
  }
  for (const condition of effects.conditions) {
    if (condition.suppressedBy) {
      lines.push({ label: condition.label, detail: `Sem efeito: imunidade (${condition.suppressedBy}).` });
    }
  }
  return lines;
}

/**
 * Ajustes ao terminar um Descanso Longo: o SRD remove 1 nível de Exaustão (e a condição
 * termina quando o nível chega a 0).
 */
export function dnd5eLongRestConditionChanges(
  conditions: readonly { id: string; key: string; level: number | null }[],
): { update: { id: string; level: number }[]; remove: string[] } {
  const update: { id: string; level: number }[] = [];
  const remove: string[] = [];
  for (const condition of conditions) {
    if (condition.key !== 'exhaustion') continue;
    const level = (condition.level ?? 1) - 1;
    if (level <= 0) remove.push(condition.id);
    else update.push({ id: condition.id, level });
  }
  return { update, remove };
}

/** Condições que continuam quando outras terminam (Inconsciente → Caído), sem repetir. */
export function dnd5eConditionsLeftAfter(
  removedKeys: readonly string[],
  remainingKeys: readonly string[],
): string[] {
  const result: string[] = [];
  for (const key of removedKeys) {
    for (const left of findDnd5eCondition(key)?.leaves ?? []) {
      if (!remainingKeys.includes(left) && !result.includes(left)) result.push(left);
    }
  }
  return result;
}
