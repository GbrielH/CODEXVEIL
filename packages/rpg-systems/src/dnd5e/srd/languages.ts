/**
 * Idiomas e alinhamentos do SRD 5.2.1.
 */

export interface LanguageDefinition {
  id: string;
  name: string;
  rarity: 'standard' | 'rare';
}

export const SRD_LANGUAGES: readonly LanguageDefinition[] = [
  { id: 'common', name: 'Comum', rarity: 'standard' },
  { id: 'common_sign_language', name: 'Língua de Sinais Comum', rarity: 'standard' },
  { id: 'draconic', name: 'Dracônico', rarity: 'standard' },
  { id: 'dwarvish', name: 'Anão', rarity: 'standard' },
  { id: 'elvish', name: 'Élfico', rarity: 'standard' },
  { id: 'giant', name: 'Gigante', rarity: 'standard' },
  { id: 'gnomish', name: 'Gnômico', rarity: 'standard' },
  { id: 'goblin', name: 'Goblin', rarity: 'standard' },
  { id: 'halfling', name: 'Pequenino', rarity: 'standard' },
  { id: 'orc', name: 'Orc', rarity: 'standard' },
  { id: 'abyssal', name: 'Abissal', rarity: 'rare' },
  { id: 'celestial', name: 'Celestial', rarity: 'rare' },
  { id: 'deep_speech', name: 'Dialeto das Profundezas', rarity: 'rare' },
  { id: 'druidic', name: 'Druídico', rarity: 'rare' },
  { id: 'infernal', name: 'Infernal', rarity: 'rare' },
  { id: 'primordial', name: 'Primordial', rarity: 'rare' },
  { id: 'sylvan', name: 'Silvestre', rarity: 'rare' },
  { id: 'thieves_cant', name: 'Gíria de Ladrão', rarity: 'rare' },
  { id: 'undercommon', name: 'Subcomum', rarity: 'rare' },
];

/** Idiomas secretos que só são aprendidos pelas habilidades de classe correspondentes. */
export const CLASS_ONLY_LANGUAGES = ['druidic', 'thieves_cant'] as const;

export function languageName(id: string): string {
  return SRD_LANGUAGES.find((language) => language.id === id)?.name ?? id;
}

export const ALIGNMENTS = [
  { id: 'lawful_good', name: 'Leal e Bom', abbreviation: 'LB', evil: false },
  { id: 'neutral_good', name: 'Neutro e Bom', abbreviation: 'NB', evil: false },
  { id: 'chaotic_good', name: 'Caótico e Bom', abbreviation: 'CB', evil: false },
  { id: 'lawful_neutral', name: 'Leal e Neutro', abbreviation: 'LN', evil: false },
  { id: 'neutral', name: 'Neutro', abbreviation: 'N', evil: false },
  { id: 'chaotic_neutral', name: 'Caótico e Neutro', abbreviation: 'CN', evil: false },
  { id: 'lawful_evil', name: 'Leal e Mau', abbreviation: 'LM', evil: true },
  { id: 'neutral_evil', name: 'Neutro e Mau', abbreviation: 'NM', evil: true },
  { id: 'chaotic_evil', name: 'Caótico e Mau', abbreviation: 'CM', evil: true },
] as const;
export type AlignmentId = (typeof ALIGNMENTS)[number]['id'];

/** Opções de identidade da ficha (listas de seleção): a escolha atual entra se não estiver na lista. */
export function withCurrentOption(options: readonly string[], current: string): string[] {
  const list = [...options];
  if (current.trim() && !list.includes(current)) list.unshift(current);
  return list;
}
