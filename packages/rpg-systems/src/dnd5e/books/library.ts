/**
 * Monstros e itens mágicos dos livros no formato da biblioteca da campanha: o bloco de
 * estatísticas (`Dnd5eStatBlock`) e os itens da campanha, para exibir e para o mestre copiar.
 */
import { ABILITIES } from '../abilities';
import { isChallengeRating } from '../progression';
import { dnd5eStatBlockSchema, type CreatureSize, type Dnd5eStatBlock } from '../stat-block';
import { normalizeBookName } from './content';
import type { BookEntryData } from './pack';

const SIZE_WORDS: Record<string, CreatureSize> = {
  miudo: 'tiny',
  tiny: 'tiny',
  pequeno: 'small',
  small: 'small',
  medio: 'medium',
  medium: 'medium',
  grande: 'large',
  large: 'large',
  enorme: 'huge',
  huge: 'huge',
  imenso: 'gargantuan',
  colossal: 'gargantuan',
  gargantuan: 'gargantuan',
};

/** Primeiro tamanho reconhecido no texto ("Médio ou Pequeno" → médio). */
export function bookCreatureSize(text: string): CreatureSize {
  for (const word of normalizeBookName(text).split(' ')) {
    const size = SIZE_WORDS[word];
    if (size) return size;
  }
  return 'medium';
}

/** Nível de desafio no formato do Codexveil ("1/2", "5"); `0` se não der para ler. */
export function bookChallengeRating(text: string): string {
  const value = text
    .trim()
    .replace('½', '1/2')
    .replace('¼', '1/4')
    .replace('⅛', '1/8')
    .split(/[\s(]/)[0]
    ?.trim();
  return value && isChallengeRating(value) ? value : '0';
}

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const toEntries = (entries: readonly { name: string; description: string }[]) =>
  entries
    .slice(0, 40)
    .map((entry) => ({ name: clip(entry.name, 80), description: clip(entry.description, 4000) }));

export function bookMonsterToStatBlock(data: BookEntryData<'monster'>): Dnd5eStatBlock {
  return dnd5eStatBlockSchema.parse({
    size: bookCreatureSize(data.size),
    creatureType: clip(data.type, 60),
    alignment: clip(data.alignment, 40),
    armorClass: data.ac,
    armorNote: clip(data.acNote, 80),
    hitPoints: Math.max(1, data.hp),
    hitPointFormula: clip(data.hpFormula, 40),
    speed: clip(data.speed, 120),
    abilities: Object.fromEntries(ABILITIES.map((ability) => [ability, data.abilities[ability]])),
    savingThrows: clip(data.savingThrows, 200),
    skills: clip(data.skills, 300),
    damageResistances: clip(
      [data.resistances, data.vulnerabilities ? `Vulnerável: ${data.vulnerabilities}` : '']
        .filter(Boolean)
        .join('; '),
      300,
    ),
    damageImmunities: clip(data.damageImmunities, 300),
    conditionImmunities: clip(data.conditionImmunities, 300),
    senses: clip(data.senses, 200),
    languages: clip(data.languages, 200),
    challengeRating: bookChallengeRating(data.cr),
    traits: toEntries(data.traits),
    actions: toEntries(data.actions),
    bonusActions: toEntries(data.bonusActions),
    reactions: toEntries(data.reactions),
    legendaryActions: toEntries(data.legendaryActions),
  });
}

const ITEM_CATEGORY_WORDS: [RegExp, 'weapon' | 'armor' | 'consumable'][] = [
  [/\b(arma|weapon|municao|ammunition)\b/, 'weapon'],
  [/\b(armadura|armor|escudo|shield)\b/, 'armor'],
  [/\b(pocao|potion|pergaminho|scroll)\b/, 'consumable'],
];

/** Item mágico do livro no formato dos itens da campanha (oculto dos jogadores). */
export function bookMagicItemToCampaignItem(
  name: string,
  data: BookEntryData<'magic_item'>,
  bookName: string,
) {
  const type = normalizeBookName(data.type);
  const category = ITEM_CATEGORY_WORDS.find(([pattern]) => pattern.test(type))?.[1] ?? 'gear';
  return {
    name: clip(name, 120),
    category,
    rarity: clip([data.type, data.rarity].filter(Boolean).join(', '), 60),
    requiresAttunement: data.attunement.trim() !== '',
    weight: null,
    value: '',
    description: clip(
      [
        data.attunement ? `Sintonização: ${data.attunement}` : '',
        ...data.description,
        `Fonte: ${bookName}.`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      8000,
    ),
    visibility: 'gm' as const,
  };
}
