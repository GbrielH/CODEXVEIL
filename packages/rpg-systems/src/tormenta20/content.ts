/**
 * Conteúdo de jogo do Tormenta20 montado a partir dos livros importados (pacotes do usuário ou
 * liberados na campanha). Cada item ganha o id `livro:chave`; nomes repetidos entre livros ficam
 * só com a versão do primeiro livro.
 */
import {
  safeT20BookEntryData,
  type T20BookEntryData,
  type T20BookEntryKind,
} from './books/pack';

export interface T20ContentSource {
  book: { id: string; name: string };
  entries: readonly { kind: string; key: string; name: string; data: unknown }[];
}

export type T20Item<K extends T20BookEntryKind> = T20BookEntryData<K> & { id: string; name: string; book: string };

export interface T20Content {
  books: { id: string; name: string }[];
  races: T20Item<'species'>[];
  classes: T20Item<'class'>[];
  origins: T20Item<'background'>[];
  deities: T20Item<'deity'>[];
  powers: T20Item<'feat'>[];
  spells: T20Item<'spell'>[];
  equipment: T20Item<'equipment'>[];
  magicItems: T20Item<'magic_item'>[];
  threats: T20Item<'monster'>[];
}

export const EMPTY_T20_CONTENT: T20Content = {
  books: [],
  races: [],
  classes: [],
  origins: [],
  deities: [],
  powers: [],
  spells: [],
  equipment: [],
  magicItems: [],
  threats: [],
};

const KIND_FIELD: Record<Exclude<T20BookEntryKind, 'section'>, keyof Omit<T20Content, 'books'>> = {
  species: 'races',
  class: 'classes',
  background: 'origins',
  deity: 'deities',
  feat: 'powers',
  spell: 'spells',
  equipment: 'equipment',
  magic_item: 'magicItems',
  monster: 'threats',
};

export function plainT20(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function buildT20Content(sources: readonly T20ContentSource[]): T20Content {
  const content: T20Content = { ...EMPTY_T20_CONTENT, books: [] };
  for (const field of Object.values(KIND_FIELD)) (content as unknown as Record<string, unknown[]>)[field] = [];
  const seen = new Set<string>();
  for (const { book, entries } of sources) {
    content.books.push(book);
    for (const entry of entries) {
      const field = KIND_FIELD[entry.kind as Exclude<T20BookEntryKind, 'section'>];
      if (!field) continue;
      const data = safeT20BookEntryData(entry.kind as T20BookEntryKind, entry.data);
      if (!data) continue;
      // Poderes de classe podem repetir o nome em classes diferentes (dono faz parte da chave).
      const owner = entry.kind === 'feat' ? (data as T20BookEntryData<'feat'>).owners.join('|') : '';
      const dedupe = `${entry.kind}|${owner}|${plainT20(entry.name)}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      (content[field] as unknown[]).push({ ...data, id: `${book.id}:${entry.key}`, name: entry.name, book: book.name });
    }
  }
  return content;
}

export function findT20Race(content: T20Content, id: string) {
  return content.races.find((entry) => entry.id === id);
}
export function findT20Class(content: T20Content, id: string) {
  return content.classes.find((entry) => entry.id === id);
}
export function findT20Origin(content: T20Content, id: string) {
  return content.origins.find((entry) => entry.id === id);
}
export function findT20Deity(content: T20Content, id: string) {
  return content.deities.find((entry) => entry.id === id);
}
export function findT20PowerByName(content: T20Content, name: string, owner?: string) {
  const key = plainT20(name);
  const matches = content.powers.filter((power) => plainT20(power.name) === key);
  return (owner ? matches.find((power) => power.owners.some((entry) => plainT20(entry) === plainT20(owner))) : undefined) ?? matches[0];
}

/** Poderes de uma classe (lista "Poderes de X"). */
export function t20ClassPowers(content: T20Content, className: string) {
  const key = plainT20(className);
  return content.powers.filter((power) => power.group === 'classe' && power.owners.some((owner) => plainT20(owner) === key));
}

/** Poderes gerais (combate, destino, magia, Tormenta) — os concedidos dependem da devoção. */
export function t20GeneralPowers(content: T20Content) {
  return content.powers.filter((power) => ['combate', 'destino', 'magia', 'tormenta'].includes(power.group));
}

/** Poderes concedidos de uma divindade. */
export function t20GrantedPowers(content: T20Content, deityName: string) {
  const deity = content.deities.find((entry) => plainT20(entry.name) === plainT20(deityName));
  const names = new Set((deity?.grantedPowers ?? []).map(plainT20));
  return content.powers.filter((power) => power.group === 'concedidos' && names.has(plainT20(power.name)));
}
