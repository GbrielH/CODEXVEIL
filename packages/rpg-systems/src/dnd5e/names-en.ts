import { comparableName } from './books/dedupe';

/**
 * Nome original (inglês) das classes e raças, pelo nome em português (SRD 5.2 e livros de 2014),
 * para mostrar pequeno ao lado e para a busca nos dois idiomas.
 */
const ENGLISH_NAMES: Record<string, string> = {
  // Classes
  barbaro: 'Barbarian',
  bardo: 'Bard',
  clerigo: 'Cleric',
  druida: 'Druid',
  guerreiro: 'Fighter',
  monge: 'Monk',
  paladino: 'Paladin',
  patrulheiro: 'Ranger',
  guardiao: 'Ranger',
  ladino: 'Rogue',
  feiticeiro: 'Sorcerer',
  bruxo: 'Warlock',
  mago: 'Wizard',
  artifice: 'Artificer',
  // Raças do SRD e do Livro do Jogador
  draconato: 'Dragonborn',
  anao: 'Dwarf',
  elfo: 'Elf',
  gnomo: 'Gnome',
  // "pequenino" e "tiferino" já incluem Halfling e Tiefling (sinônimos em `comparableName`).
  golias: 'Goliath',
  pequenino: 'Halfling',
  humano: 'Human',
  orc: 'Orc',
  tiferino: 'Tiefling',
  'meio elfo': 'Half-Elf',
  'meio orc': 'Half-Orc',
  // Monstros do Multiverso
  aarakocra: 'Aarakocra',
  aasimar: 'Aasimar',
  bugurso: 'Bugbear',
  centauro: 'Centaur',
  duergar: 'Duergar',
  duplicantes: 'Changeling',
  eladrin: 'Eladrin',
  'elfo marinho': 'Sea Elf',
  fada: 'Fairy',
  firbolg: 'Firbolg',
  'genasi da agua': 'Water Genasi',
  'genasi do ar': 'Air Genasi',
  'genasi do fogo': 'Fire Genasi',
  'genasi da terra': 'Earth Genasi',
  githyanki: 'Githyanki',
  githzerai: 'Githzerai',
  'gnomo das profundezas': 'Deep Gnome',
  goblin: 'Goblin',
  hobgoblin: 'Hobgoblin',
  kenku: 'Kenku',
  kobold: 'Kobold',
  laparlonj: 'Harengon',
  minotauro: 'Minotaur',
  morfos: 'Shifter',
  reptante: 'Lizardfolk',
  satiro: 'Satyr',
  'shadar kai': 'Shadar-kai',
  tabaxi: 'Tabaxi',
  tortuga: 'Tortle',
  tritao: 'Triton',
  'yuan ti': 'Yuan-ti',
};

/** Nome em inglês, quando é diferente do português; `undefined` se não houver ou for igual. */
export function englishName(name: string): string | undefined {
  const english = ENGLISH_NAMES[comparableName(name)];
  // Compara sem os sinônimos de tradução: "Pequenino" mostra "Halfling", mas "Halfling" não repete.
  const bare = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  return english && bare(english) !== bare(name) ? english : undefined;
}

/** A busca encontra pelo nome em português ou em inglês, sem acento e sem maiúsculas. */
export function matchesNameSearch(name: string, query: string): boolean {
  const wanted = comparableName(query);
  if (!wanted) return true;
  const plain = (text: string) => comparableName(text).replace(/ /g, '');
  const target = wanted.replace(/ /g, '');
  return [name, ENGLISH_NAMES[comparableName(name)] ?? ''].some((candidate) => candidate && plain(candidate).includes(target));
}
