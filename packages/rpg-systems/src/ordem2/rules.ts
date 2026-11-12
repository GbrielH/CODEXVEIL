/**
 * Regras do Ordem Paranormal RPG 2 (playtests): testes de dois dados, passos, críticos,
 * dado de pavor, lesões, traumas, falhas críticas e desafios de acesso. Os textos das
 * tabelas são resumos do Codexveil; o texto integral fica no pacote do livro do usuário.
 */
import {
  ORDEM2_DICE,
  ordem2SkillDie,
  type Ordem2Attribute,
  type Ordem2Die,
  type Ordem2Sheet,
  type Ordem2Tier,
} from './sheet';

/** DT padrão dos testes do playtest. */
export const ORDEM2_DEFAULT_DC = 7;
/** Alcance longo, cobertura leve, alvo caído (à distância), alcançar do jeito arriscado. */
export const ORDEM2_DC_STEP = 3;
/** Máximo de dados por teste e quantos deles somam no resultado. */
export const ORDEM2_MAX_DICE = 4;
export const ORDEM2_MAX_SUMMED = 3;

const STEPS: readonly Ordem2Die[] = [4, 6, 8, 10, 12];

/**
 * Sobe (`delta > 0`) ou desce um dado em passos: d4 < d6 < d8 < d10 < d12. Não passa de d4
 * nem de d12; só efeitos paranormais levam um d12 a d20 (`allowD20`).
 */
export function stepDie(die: Ordem2Die, delta: number, allowD20 = false): Ordem2Die {
  if (die === 20) return delta < 0 ? stepDie(12, delta + 1) : 20;
  const index = STEPS.indexOf(die);
  const target = index + Math.trunc(delta);
  if (target >= STEPS.length) return allowD20 ? 20 : 12;
  return STEPS[Math.max(0, target)]!;
}

export interface Ordem2TestDice {
  /** Faces de cada dado do teste, na ordem atributo, perícia, bônus. */
  dice: Ordem2Die[];
  /** Dado de pavor rolado junto (não soma; anula resultados menores). */
  fearDie: Ordem2Die | 0;
  /** Passos que não couberam (os dois dados já no limite). */
  wastedSteps: number;
}

export interface Ordem2TestOptions {
  /** Aumentos (positivos) e reduções (negativas) de passo somados. */
  steps?: number;
  /** Dados extras (+1d6 de Mirar, Defender-se, relações…). */
  bonusDice?: readonly Ordem2Die[];
  /** Usa o dado de pavor da ficha (padrão: sim, se houver). */
  fear?: boolean;
  allowD20?: boolean;
}

/**
 * Monta os dados de um teste: o dado do atributo, o da perícia e os bônus (no máximo quatro).
 * Aumentos de passo vão primeiro para o menor dos dois dados; reduções, para o maior — o
 * jogador fica com o resultado mais provável, como o livro descreve para a ajuda.
 */
export function ordem2TestDice(
  attributeDie: Ordem2Die,
  skillDie: Ordem2Die,
  options: Ordem2TestOptions & { fearDie?: Ordem2Die | 0 } = {},
): Ordem2TestDice {
  const pair: [Ordem2Die, Ordem2Die] = [attributeDie, skillDie];
  let steps = Math.trunc(options.steps ?? 0);
  let wasted = 0;
  while (steps !== 0) {
    const up = steps > 0;
    const order = pair[0] <= pair[1] ? [0, 1] : [1, 0];
    const index = up ? order[0]! : order[1]!;
    const other = index === 0 ? 1 : 0;
    const next = stepDie(pair[index]!, up ? 1 : -1, options.allowD20);
    if (next !== pair[index]) pair[index] = next;
    else {
      const fallback = stepDie(pair[other], up ? 1 : -1, options.allowD20);
      if (fallback !== pair[other]) pair[other] = fallback;
      else wasted += 1;
    }
    steps += up ? -1 : 1;
  }
  const dice = [...pair, ...(options.bonusDice ?? [])].slice(0, ORDEM2_MAX_DICE);
  return { dice, fearDie: options.fearDie ?? 0, wastedSteps: wasted };
}

/** Os dados de um teste da ficha (atributo-base da perícia ou outro escolhido pelo mestre). */
export function ordem2SheetTest(
  sheet: Ordem2Sheet,
  skill: string,
  options: Ordem2TestOptions & { attribute?: Ordem2Attribute; aptitudeField?: string } = {},
): Ordem2TestDice {
  return ordem2TestDice(
    sheet.attributes[options.attribute ?? ordem2SkillAttribute(skill)],
    ordem2SkillDie(sheet, skill, options.aptitudeField),
    { ...options, fearDie: options.fear === false ? 0 : sheet.fearDie },
  );
}

const SKILL_ATTRIBUTE: Record<string, Ordem2Attribute> = {
  acrobacia: 'fisico',
  animais: 'emocao',
  aptidao: 'mente',
  atletismo: 'fisico',
  crime: 'fisico',
  disciplina: 'emocao',
  enganacao: 'emocao',
  furtividade: 'fisico',
  intimidar: 'emocao',
  intuicao: 'emocao',
  luta: 'fisico',
  maquinas: 'mente',
  medicina: 'mente',
  metalurgia: 'mente',
  ocultismo: 'mente',
  percepcao: 'mente',
  persuasao: 'emocao',
  pesquisar: 'mente',
  pontaria: 'fisico',
  sobrevivencia: 'mente',
  tecnologia: 'mente',
  vigor: 'fisico',
};
export function ordem2SkillAttribute(skill: string): Ordem2Attribute {
  return SKILL_ATTRIBUTE[skill] ?? 'mente';
}

/** Expressão de dados para o rolador do servidor ("1d8+1d6", "2d6"). */
export function ordem2Expression(dice: readonly number[]): string {
  const counts = new Map<number, number>();
  for (const sides of dice) counts.set(sides, (counts.get(sides) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([sides, count]) => `${count}d${sides}`)
    .join('+');
}

export interface Ordem2TestResult {
  /** Valores dos dados do teste (sem o dado de pavor). */
  values: number[];
  /** Valores que sobraram depois do dado de pavor. */
  kept: number[];
  /** Os até três maiores, que somam no resultado. */
  summed: number[];
  total: number;
  /** Modificador fixo somado (lesões, traumas, cicatriz). */
  modifier: number;
  /** Rolagem alta e baixa entre os dados que contam (0 se nenhum sobrou). */
  high: number;
  low: number;
  critical: boolean;
  fumble: boolean;
  fear: number | null;
  /** Dado de pavor tirou 1: o efeito de medo termina. */
  fearEnds: boolean;
  /** `null` quando não há DT (teste oposto). */
  success: boolean | null;
}

/**
 * Resolve um teste: soma os três maiores dados, aplica o dado de pavor (anula resultados
 * menores que ele) e marca crítico (dois dados iguais com 6 ou mais) ou falha crítica (todos
 * os dados em 1, ou todos anulados pelo pavor). Crítico passa e falha crítica falha, qualquer
 * que seja a DT.
 */
export function resolveOrdem2Test(
  values: readonly number[],
  options: { dc?: number | null; fear?: number | null; modifier?: number } = {},
): Ordem2TestResult {
  const dc = options.dc === undefined ? ORDEM2_DEFAULT_DC : options.dc;
  const fear = options.fear ?? null;
  const modifier = Math.trunc(options.modifier ?? 0);
  if (!values.length) throw new Error('Um teste precisa de pelo menos um dado.');
  const kept = fear === null ? [...values] : values.filter((value) => value >= fear);
  const summed = [...kept].sort((a, b) => b - a).slice(0, ORDEM2_MAX_SUMMED);
  const total = Math.max(
    0,
    summed.reduce((sum, value) => sum + value, 0) + (summed.length ? modifier : 0),
  );
  const seen = new Map<number, number>();
  for (const value of kept) seen.set(value, (seen.get(value) ?? 0) + 1);
  const fumble = kept.length === 0 || values.every((value) => value === 1);
  const critical =
    !fumble && [...seen.entries()].some(([value, count]) => value >= 6 && count >= 2);
  return {
    values: [...values],
    kept,
    summed,
    total,
    modifier,
    high: summed[0] ?? 0,
    low: summed[summed.length - 1] ?? 0,
    critical,
    fumble,
    fear,
    fearEnds: fear === 1,
    success: dc === null ? null : critical ? true : fumble ? false : total >= dc,
  };
}

/**
 * Dano de um ataque: rolagem alta mais o modificador da arma ("RA+3"); "RB" usa a baixa.
 * No crítico soma também a segunda maior rolagem.
 */
export function ordem2Damage(result: Ordem2TestResult, formula: string): number {
  const match = /^\s*(RA|RB)\s*([+-]\s*\d+)?/i.exec(formula);
  const base = match?.[1]?.toUpperCase() === 'RB' ? result.low : result.high;
  const modifier = match?.[2] ? Number(match[2].replace(/\s+/g, '')) : 0;
  const extra = result.critical ? (result.summed[1] ?? 0) : 0;
  return Math.max(0, base + modifier + extra);
}

/** DT de testes repetidos na cena (lesão, trauma, ferimentos): 7, 10, 13… */
export function ordem2RepeatedDc(previousTests: number): number {
  return ORDEM2_DEFAULT_DC + ORDEM2_DC_STEP * Math.max(0, Math.trunc(previousTests));
}

/** Testes opostos: quem tirar mais vence; empate devolve `null`. */
export function ordem2OpposedWinner(a: Ordem2TestResult, b: Ordem2TestResult): 'a' | 'b' | null {
  if (a.total === b.total) return null;
  return a.total > b.total ? 'a' : 'b';
}

/** Aumentos de passo que a ação Ajuda fornece: d6/d8 = 1, d10/d12 = 2; d4 não ajuda. */
export function ordem2AssistSteps(skillDie: Ordem2Die): number {
  if (skillDie <= 4) return 0;
  return skillDie <= 8 ? 1 : 2;
}

export const ordem2TierBonus: Record<Ordem2Tier, number> = {
  iniciante: 0,
  veterano: 1,
  elite: 2,
  lenda: 3,
};

export interface Ordem2TableRow {
  key: string;
  min: number;
  max: number;
  label: string;
  text: string;
  /** Efeito permanente (fica anotado na ficha). */
  permanent?: boolean;
  /** Ajustes de perícia ou atributo (lesões e traumas). */
  skillModifiers?: Record<string, number>;
  attributeModifiers?: Partial<Record<Ordem2Attribute, number>>;
  /** Perde PV/PD máximos. */
  maxHitPoints?: number;
  maxDetermination?: number;
}

export function ordem2TableRow(table: readonly Ordem2TableRow[], roll: number): Ordem2TableRow {
  const last = table[table.length - 1]!;
  if (roll >= last.min) return last;
  return table.find((row) => roll >= row.min && roll <= row.max) ?? table[0]!;
}

/** Efeitos de falhas críticas (1d8). */
export const ORDEM2_FUMBLE_TABLE: readonly Ordem2TableRow[] = [
  {
    key: 'vexame',
    min: 1,
    max: 1,
    label: 'Vexame',
    text: 'Descreva a falha de forma vergonhosa. Sem efeito em regras.',
  },
  {
    key: 'machucado',
    min: 2,
    max: 2,
    label: 'Machucado',
    text: 'Físico diminui um passo até o fim da cena.',
  },
  {
    key: 'desatencao',
    min: 3,
    max: 3,
    label: 'Desatenção',
    text: 'Mente diminui um passo até o fim da cena.',
  },
  {
    key: 'irritacao',
    min: 4,
    max: 4,
    label: 'Irritação',
    text: 'Emoção diminui um passo até o fim da cena.',
  },
  { key: 'acidente', min: 5, max: 5, label: 'Acidente', text: 'Perde 1d4 PV.' },
  { key: 'frustracao', min: 6, max: 6, label: 'Frustração', text: 'Perde 1d4 PD.' },
  {
    key: 'perda',
    min: 7,
    max: 7,
    label: 'Perda',
    text: 'Um item carregado ou espaço de compra se perde.',
  },
  { key: 'nada', min: 8, max: 8, label: 'Nenhum efeito', text: 'Nenhum efeito adicional.' },
];

/** Resultado do teste de lesão (Físico + Vigor contra DT 7, +3 por teste na cena). */
export function ordem2InjuryTestOutcome(
  result: Ordem2TestResult,
): 'recupera' | 'moribundo' | 'lesao' | 'morte' {
  if (result.fumble) return 'morte';
  if (result.critical) return 'recupera';
  return result.success ? 'moribundo' : 'lesao';
}

/** Tabela de lesões (1d20, +1 por patamar acima de iniciante). */
export const ORDEM2_INJURY_TABLE: readonly Ordem2TableRow[] = [
  { key: 'morte-subita', min: 1, max: 4, label: 'Morte súbita', text: 'O personagem morre.' },
  {
    key: 'morte-lenta',
    min: 5,
    max: 9,
    label: 'Morte lenta',
    text: 'Recupera 1 PV e age mais uma rodada; ao fim dela, morre.',
  },
  {
    key: 'laceracao',
    min: 10,
    max: 10,
    label: 'Laceração profunda',
    text: 'Perde 2 PV máximos (acumula).',
    permanent: true,
    maxHitPoints: -2,
  },
  {
    key: 'sem-olho',
    min: 11,
    max: 11,
    label: 'Sem olho',
    text: '–1 em Percepção e Pontaria.',
    permanent: true,
    skillModifiers: { percepcao: -1, pontaria: -1 },
  },
  {
    key: 'sem-mao',
    min: 12,
    max: 12,
    label: 'Sem mão',
    text: 'Só empunha um item; tarefas de duas mãos sofrem redução de passo ou falham.',
    permanent: true,
  },
  {
    key: 'sem-pe',
    min: 13,
    max: 13,
    label: 'Sem pé',
    text: 'Duas reduções de passo para movimentar-se e em perseguições a pé.',
    permanent: true,
  },
  {
    key: 'tendao',
    min: 14,
    max: 14,
    label: 'Tendão comprometido',
    text: '–2 em Acrobacia.',
    permanent: true,
    skillModifiers: { acrobacia: -2 },
  },
  {
    key: 'musculo',
    min: 15,
    max: 15,
    label: 'Músculo comprometido',
    text: '–2 em Atletismo.',
    permanent: true,
    skillModifiers: { atletismo: -2 },
  },
  {
    key: 'orgao-interno',
    min: 16,
    max: 16,
    label: 'Órgão interno comprometido',
    text: '–2 em Vigor.',
    permanent: true,
    skillModifiers: { vigor: -2 },
  },
  {
    key: 'orgao-sensorial',
    min: 17,
    max: 17,
    label: 'Órgão sensorial comprometido',
    text: '–2 em Percepção.',
    permanent: true,
    skillModifiers: { percepcao: -2 },
  },
  {
    key: 'cicatriz',
    min: 18,
    max: 18,
    label: 'Cicatriz assustadora',
    text: '–2 em Persuasão e +1 em Intimidar.',
    permanent: true,
    skillModifiers: { persuasao: -2, intimidar: 1 },
  },
  {
    key: 'contusao',
    min: 19,
    max: 19,
    label: 'Contusão',
    text: 'Físico diminui um passo até o fim da cena.',
  },
  {
    key: 'adrenalina',
    min: 20,
    max: 99,
    label: 'Surto de adrenalina',
    text: 'Sem sequelas; recupera 1 PV.',
  },
];

/** Tabela de traumas (1d20, +1 por patamar acima de iniciante). */
export const ORDEM2_TRAUMA_TABLE: readonly Ordem2TableRow[] = [
  {
    key: 'colapso',
    min: 1,
    max: 4,
    label: 'Colapso total',
    text: 'A mente sucumbe; o personagem está fora de jogo.',
  },
  {
    key: 'tept',
    min: 5,
    max: 6,
    label: 'Estresse pós-traumático',
    text: '+1 em todo dano emocional sofrido.',
    permanent: true,
  },
  {
    key: 'degradacao',
    min: 7,
    max: 8,
    label: 'Degradação cognitiva',
    text: '–1 em Mente.',
    permanent: true,
    attributeModifiers: { mente: -1 },
  },
  {
    key: 'macula',
    min: 9,
    max: 10,
    label: 'Mácula psíquica',
    text: '–1 em Emoção.',
    permanent: true,
    attributeModifiers: { emocao: -1 },
  },
  {
    key: 'chaga',
    min: 11,
    max: 12,
    label: 'Chaga da alma',
    text: 'Perde 2 PD máximos.',
    permanent: true,
    maxDetermination: -2,
  },
  {
    key: 'retracao',
    min: 13,
    max: 14,
    label: 'Retração defensiva',
    text: '–2 em Persuasão e Intuição.',
    permanent: true,
    skillModifiers: { persuasao: -2, intuicao: -2 },
  },
  {
    key: 'panico',
    min: 15,
    max: 17,
    label: 'Pânico',
    text: 'Recebe um dado de pavor (ou ele sobe um passo).',
  },
  {
    key: 'estupor',
    min: 18,
    max: 19,
    label: 'Estupor catatônico',
    text: 'Perde a ação na próxima rodada.',
  },
  {
    key: 'animo',
    min: 20,
    max: 99,
    label: 'Injeção de ânimo',
    text: 'Sem sequelas; recupera 1 PD.',
  },
];

export function ordem2InjuryRow(d20: number, tier: Ordem2Tier): Ordem2TableRow {
  return ordem2TableRow(ORDEM2_INJURY_TABLE, d20 + ordem2TierBonus[tier]);
}
export function ordem2TraumaRow(d20: number, tier: Ordem2Tier): Ordem2TableRow {
  return ordem2TableRow(ORDEM2_TRAUMA_TABLE, d20 + ordem2TierBonus[tier]);
}

/** Modificadores fixos que lesões e traumas permanentes somam a uma perícia. */
export function ordem2SkillPenalty(sheet: Ordem2Sheet, skill: string): number {
  const rows = [
    ...sheet.injuries.map((key) => ORDEM2_INJURY_TABLE.find((row) => row.key === key)),
    ...sheet.traumas.map((key) => ORDEM2_TRAUMA_TABLE.find((row) => row.key === key)),
  ];
  return (
    (sheet.skills[skill]?.modifier ?? 0) +
    rows.reduce((sum, row) => sum + (row?.skillModifiers?.[skill] ?? 0), 0)
  );
}

/** Dado de pavor: recebe d6; se já tiver, sobe um passo. */
export function ordem2GainFear(current: Ordem2Die | 0): Ordem2Die {
  return current === 0 ? 6 : stepDie(current, 1);
}
/** Controlar o pavor (1 PD): o dado desce um passo; abaixo de d4 o pavor some. */
export function ordem2ControlFear(current: Ordem2Die | 0): Ordem2Die | 0 {
  if (current === 0 || current === 4) return 0;
  return stepDie(current, -1);
}
export const ORDEM2_CONTROL_FEAR_COST = 1;
/** Abraçar o pavor (5 PD): o dado de pavor vira um dado bônus nesse teste. */
export const ORDEM2_EMBRACE_FEAR_COST = 5;

/** Teste de equilíbrio: 2d10 iguais ou com 1 de diferença equilibram. */
export function ordem2Balanced(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1;
}
/** Dados de equilíbrio (sempre d4): metade da Acrobacia (d6 → 3 dados). */
export function ordem2BalanceDice(acrobacia: Ordem2Die): number {
  return Math.floor(acrobacia / 2);
}

/** Tentativas por rodada ao destrancar: Crime d4 = 1, d6 = 2 … d12 = 5. */
export function ordem2LockAttempts(crime: Ordem2Die): number {
  return Math.max(1, Math.min(5, crime / 2 - 1));
}
export type Ordem2LockHint = 'baixo' | 'alto' | 'exato';
/**
 * Resposta do mestre a uma tentativa: para cada posição, se o número da senha está abaixo
 * ("baixo"), acima ("alto") ou igual ao palpite. Exemplo do livro: senha 3-5-2, palpite
 * 4-5-1 → baixo, exato, alto.
 */
export function ordem2LockHints(
  secret: readonly number[],
  guess: readonly number[],
): Ordem2LockHint[] {
  return secret.map((value, index) => {
    const tried = guess[index] ?? 0;
    return tried === value ? 'exato' : value < tried ? 'baixo' : 'alto';
  });
}

/** Benefícios de invocar uma relação, por grau (uma vez por missão). */
export const ORDEM2_RELATION_BENEFITS: Record<1 | 2 | 3, readonly string[]> = {
  1: ['+1d6 num teste ligado à pessoa', 'Ao ajudá-la, +1d6 além do aumento de passo'],
  2: [
    '+1d8 num teste ligado à pessoa',
    'Ao ajudá-la, +1d8 além do aumento de passo',
    'Uma ação para motivá-la: recupera 2d4 PD',
  ],
  3: [
    '+1d12 num teste ligado à pessoa',
    'Ao ajudá-la, +1d12 além do aumento de passo',
    'Uma ação para motivá-la: recupera 2d6 PD',
    'Se ela estiver em perigo, uma ação extra para ajudá-la',
  ],
};
export const ordem2RelationDie: Record<1 | 2 | 3, Ordem2Die> = { 1: 6, 2: 8, 3: 12 };

/** Pontos de armadura: gastar 1 (ação livre) reduz um dano em 10. */
export const ORDEM2_ARMOR_REDUCTION = 10;

/** Fases da rodada de combate (não há iniciativa). */
export const ORDEM2_COMBAT_PHASES = [
  { key: 'geral', label: 'Fase geral', text: 'Qualquer ação, exceto ataques.' },
  { key: 'distancia', label: 'Ataques à distância', text: 'Disparos e arremessos.' },
  {
    key: 'corpo-a-corpo',
    label: 'Ataques corpo a corpo',
    text: 'Ataques corpo a corpo e manobras.',
  },
] as const;

/**
 * Pendências para concluir um personagem. O playtest só traz personagens prontos (sem regras de
 * criação): a ficha precisa do perfil e da vocação; os números vêm da ficha pronta ou do mestre.
 */
export function ordem2CreationIssues(sheet: Ordem2Sheet): string[] {
  const issues: string[] = [];
  if (!sheet.profile) issues.push('Escolha o perfil (Executor, Analista ou Vigilante).');
  if (!sheet.vocation.trim()) issues.push('Informe a vocação.');
  return issues;
}

export function isOrdem2Die(value: number): value is Ordem2Die {
  return (ORDEM2_DICE as readonly number[]).includes(value);
}
