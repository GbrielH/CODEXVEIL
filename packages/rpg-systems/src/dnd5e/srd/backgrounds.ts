/**
 * Antecedentes do SRD 5.2.1.
 */
import { activeDnd5eBookContent } from '../books/active';
import type { BackgroundDefinition } from './types';

export const SRD_BACKGROUNDS: readonly BackgroundDefinition[] = [
  {
    id: 'acolyte',
    name: 'Acólito',
    summary: 'Serviu num templo, realizando ritos sagrados e estudando a fé.',
    abilities: ['int', 'wis', 'cha'],
    feat: 'magic_initiate',
    magicInitiateList: 'cleric',
    skills: ['insight', 'religion'],
    tool: 'calligraphers_supplies',
    equipment: [
      {
        id: 'A',
        items: [
          { item: 'calligraphers_supplies' },
          { item: 'book', name: 'Livro (orações)' },
          { item: 'holy_symbol' },
          { item: 'parchment', quantity: 10 },
          { item: 'robe' },
        ],
        gold: 8,
      },
      { id: 'B', items: [], gold: 50 },
    ],
  },
  {
    id: 'criminal',
    name: 'Criminoso',
    summary: 'Ganhou a vida nos becos, com furtos, contrabando e golpes.',
    abilities: ['dex', 'con', 'int'],
    feat: 'alert',
    skills: ['sleight_of_hand', 'stealth'],
    tool: 'thieves_tools',
    equipment: [
      {
        id: 'A',
        items: [
          { item: 'dagger', quantity: 2 },
          { item: 'thieves_tools' },
          { item: 'crowbar' },
          { item: 'pouch', quantity: 2 },
          { item: 'travelers_clothes' },
        ],
        gold: 16,
      },
      { id: 'B', items: [], gold: 50 },
    ],
  },
  {
    id: 'sage',
    name: 'Sábio',
    summary: 'Passou os anos formativos entre bibliotecas, mestres e tomos antigos.',
    abilities: ['con', 'int', 'wis'],
    feat: 'magic_initiate',
    magicInitiateList: 'wizard',
    skills: ['arcana', 'history'],
    tool: 'calligraphers_supplies',
    equipment: [
      {
        id: 'A',
        items: [
          { item: 'quarterstaff' },
          { item: 'calligraphers_supplies' },
          { item: 'book', name: 'Livro (história)' },
          { item: 'parchment', quantity: 8 },
          { item: 'robe' },
        ],
        gold: 8,
      },
      { id: 'B', items: [], gold: 50 },
    ],
  },
  {
    id: 'soldier',
    name: 'Soldado',
    summary: 'Treinou para a guerra e aprendeu a sobreviver no campo de batalha.',
    abilities: ['str', 'dex', 'con'],
    feat: 'savage_attacker',
    skills: ['athletics', 'intimidation'],
    tool: { choice: 'gaming_set' },
    equipment: [
      {
        id: 'A',
        items: [
          { item: 'spear' },
          { item: 'shortbow' },
          { item: 'arrows', quantity: 20 },
          { item: 'dice', choice: 'gaming_set' },
          { item: 'healers_kit' },
          { item: 'quiver' },
          { item: 'travelers_clothes' },
        ],
        gold: 14,
      },
      { id: 'B', items: [], gold: 50 },
    ],
  },
];

export function findBackground(id: string): BackgroundDefinition | undefined {
  return SRD_BACKGROUNDS.find((background) => background.id === id) ?? activeDnd5eBookContent().backgrounds.find((background) => background.id === id);
}

/** Antecedentes do SRD e dos livros liberados. */
export function listBackgrounds(): readonly BackgroundDefinition[] {
  const books = activeDnd5eBookContent().backgrounds;
  return books.length ? [...SRD_BACKGROUNDS, ...books] : SRD_BACKGROUNDS;
}
