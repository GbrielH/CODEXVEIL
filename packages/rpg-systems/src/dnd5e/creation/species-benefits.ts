/**
 * Benefícios das raças dos livros de 2014 (Livro do Jogador e afins), que só vêm em texto nos
 * pacotes importados: aumentos de atributo (fixos ou à escolha), perícias e talento à escolha.
 * Exemplos: "Todos os seus valores de habilidade aumentam em 1" (Humano), "Dois valores de
 * habilidade, à sua escolha, aumentam em 1… proficiência em uma perícia à sua escolha… um
 * talento à sua escolha" (Humano variante), "Seu valor de Força aumenta em 2".
 */
import { ABILITIES, type Ability } from '../abilities';

export interface SpeciesBenefits {
  /** Aumentos fixos. */
  fixed: Partial<Record<Ability, number>>;
  /** Quantos atributos à escolha e quanto cada um aumenta. */
  choiceCount: number;
  choiceAmount: number;
  /** Perícias à escolha. */
  skillChoices: number;
  /** Um talento à escolha. */
  featChoice: boolean;
}

const NUMBERS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, tres: 3 };
const ABILITY_NAMES: Record<string, Ability> = {
  'força': 'str',
  destreza: 'dex',
  'constituição': 'con',
  'inteligência': 'int',
  sabedoria: 'wis',
  carisma: 'cha',
};

/** "1", "I" e "l" (o PDF troca o 1 por letras) e "um/uma". */
const AMOUNT = String.raw`(\d|i|l|um|uma)(?![\p{L}\d])`;
function amount(word: string): number {
  return /^(i|l|um|uma)$/.test(word) ? 1 : Number(word);
}

function count(word: string): number {
  return NUMBERS[word] ?? (Number.parseInt(word, 10) || 0);
}

export function parseSpeciesBenefits(text: string): SpeciesBenefits {
  const lower = text.toLowerCase();
  const result: SpeciesBenefits = { fixed: {}, choiceCount: 0, choiceAmount: 0, skillChoices: 0, featChoice: false };

  const all = new RegExp(String.raw`todos os seus valores de (?:habilidade|atributo)s? aumentam em ${AMOUNT}`, 'u').exec(lower);
  if (all) for (const ability of ABILITIES) result.fixed[ability] = amount(all[1]!);

  const choice = new RegExp(
    String.raw`(um|uma|dois|duas|três|tres|\d) (?:outros? )?valor(?:es)? de (?:habilidade|atributo)s?,?[^.]{0,40}?(?:à|a) sua escolha,?[^.]{0,20}?aumenta(?:m)? em ${AMOUNT}`,
    'u',
  ).exec(lower);
  if (choice) {
    result.choiceCount = count(choice[1]!);
    result.choiceAmount = amount(choice[2]!);
  }

  // "Seu valor de Força aumenta em 2" / "seus valores de Força e Constituição aumentam em 1".
  const fixedPattern = /(?:seu|o seu|seus|os seus) valor(?:es)? de ((?:força|destreza|constituição|inteligência|sabedoria|carisma)(?:(?:, | e )(?:força|destreza|constituição|inteligência|sabedoria|carisma))*) aumenta(?:m)? em (\d|i|l|um|uma)(?![\p{L}\d])/gu;
  for (const match of lower.matchAll(fixedPattern)) {
    for (const name of match[1]!.split(/, | e /)) {
      const ability = ABILITY_NAMES[name.trim()];
      if (ability) result.fixed[ability] = (result.fixed[ability] ?? 0) + amount(match[2]!);
    }
  }

  const skills = /proficiência em (um|uma|dois|duas|três|tres|\d) perícias?,? (?:à|a|de) sua escolha/.exec(lower);
  if (skills) result.skillChoices = count(skills[1]!);

  result.featChoice = /(?:um|1) talento (?:à|a|de) sua escolha/.test(lower);
  return result;
}

export function hasSpeciesBenefits(benefits: SpeciesBenefits): boolean {
  return Object.keys(benefits.fixed).length > 0 || benefits.choiceCount > 0 || benefits.skillChoices > 0 || benefits.featChoice;
}
