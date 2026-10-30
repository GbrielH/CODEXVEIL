/**
 * Dados especiais do Assimilação RPG. As faces trazem símbolos em vez de números:
 * Sucesso, Adaptação e Pressão. Rola-se uma pilha de d6 (Instinto) e d10 (Conhecimento ou
 * Prática) e mantém-se o dado mais vantajoso ("jogar e manter").
 *
 * As faces seguem a Tabela de Conversão de Dados do livro (dados numéricos → símbolos).
 */

export type AssimilacaoDie = 'd6' | 'd10' | 'd12';
/** `sucesso` (A no livro), `adaptacao` (B) e `pressao` (C). */
export type AssimilacaoSymbol = 'sucesso' | 'adaptacao' | 'pressao';

export interface FaceCount {
  sucesso: number;
  adaptacao: number;
  pressao: number;
}

const face = (sucesso: number, adaptacao: number, pressao: number): FaceCount => ({
  sucesso,
  adaptacao,
  pressao,
});
const BLANK = face(0, 0, 0);

/** Faces em ordem (face 1 do dado numérico = índice 0). */
export const ASSIMILACAO_FACES: Record<AssimilacaoDie, readonly FaceCount[]> = {
  d6: [BLANK, BLANK, face(0, 0, 1), face(0, 0, 1), face(0, 1, 1), face(1, 0, 0)],
  d10: [
    BLANK,
    BLANK,
    face(0, 0, 1),
    face(0, 0, 1),
    face(0, 1, 1),
    face(1, 0, 0),
    face(2, 0, 0),
    face(1, 1, 0),
    face(1, 1, 1),
    face(2, 0, 1),
  ],
  // As faces 11 e 12 do d12 vêm de uma leitura da tabela do livro: conferir com o dado físico.
  d12: [
    BLANK,
    BLANK,
    face(0, 0, 1),
    face(0, 0, 1),
    face(0, 1, 1),
    face(1, 0, 0),
    face(2, 0, 0),
    face(1, 1, 0),
    face(1, 1, 1),
    face(2, 0, 1),
    face(1, 2, 0),
    face(0, 0, 3),
  ],
};

export const SIDES: Record<AssimilacaoDie, number> = { d6: 6, d10: 10, d12: 12 };

export interface RolledDie {
  die: AssimilacaoDie;
  /** Face numérica sorteada (1 a 6, 10 ou 12). */
  value: number;
  result: FaceCount;
}

export interface DicePool {
  d6: number;
  d10: number;
  d12: number;
}

/** Sorteio injetável nos testes: devolve um inteiro de 1 a `sides`. */
export type DieRandom = (sides: number) => number;
const defaultRandom: DieRandom = (sides) => 1 + Math.floor(Math.random() * sides);

export function rollDie(die: AssimilacaoDie, random: DieRandom = defaultRandom): RolledDie {
  const value = random(SIDES[die]);
  return { die, value, result: ASSIMILACAO_FACES[die][value - 1] ?? BLANK };
}

export function rollPool(pool: DicePool, random: DieRandom = defaultRandom): RolledDie[] {
  const dice: RolledDie[] = [];
  for (const die of ['d6', 'd10', 'd12'] as const) {
    for (let index = 0; index < pool[die]; index += 1) dice.push(rollDie(die, random));
  }
  return dice;
}

export function sumFaces(faces: readonly FaceCount[]): FaceCount {
  return faces.reduce(
    (total, current) =>
      face(
        total.sucesso + current.sucesso,
        total.adaptacao + current.adaptacao,
        total.pressao + current.pressao,
      ),
    BLANK,
  );
}

/**
 * Sugestão de dados a manter: prioriza Sucessos, depois Adaptações, e evita Pressões.
 * A escolha final é de quem rolou (às vezes vale abrir mão de um Sucesso para fugir da Pressão).
 */
export function suggestKeep(dice: readonly RolledDie[], keep: number): number[] {
  const score = (result: FaceCount) =>
    result.sucesso * 100 + result.adaptacao * 10 - result.pressao * 15;
  return dice
    .map((die, index) => ({ index, score: score(die.result) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, keep))
    .map((entry) => entry.index);
}

/** Dano: rola d10 e cada símbolo da face (qualquer um) vale 1 ponto. */
export function damageFromDice(dice: readonly RolledDie[]): number {
  return dice.reduce(
    (total, die) => total + die.result.sucesso + die.result.adaptacao + die.result.pressao,
    0,
  );
}
