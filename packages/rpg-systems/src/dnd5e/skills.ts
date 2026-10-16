import type { Ability } from './abilities';

export const SKILLS = [
  'acrobatics',
  'animal_handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight_of_hand',
  'stealth',
  'survival',
] as const;
export type Skill = (typeof SKILLS)[number];

export const skillDefinitions: Record<Skill, { label: string; ability: Ability }> = {
  acrobatics: { label: 'Acrobacia', ability: 'dex' },
  animal_handling: { label: 'Adestrar Animais', ability: 'wis' },
  arcana: { label: 'Arcanismo', ability: 'int' },
  athletics: { label: 'Atletismo', ability: 'str' },
  deception: { label: 'Enganação', ability: 'cha' },
  history: { label: 'História', ability: 'int' },
  insight: { label: 'Intuição', ability: 'wis' },
  intimidation: { label: 'Intimidação', ability: 'cha' },
  investigation: { label: 'Investigação', ability: 'int' },
  medicine: { label: 'Medicina', ability: 'wis' },
  nature: { label: 'Natureza', ability: 'int' },
  perception: { label: 'Percepção', ability: 'wis' },
  performance: { label: 'Atuação', ability: 'cha' },
  persuasion: { label: 'Persuasão', ability: 'cha' },
  religion: { label: 'Religião', ability: 'int' },
  sleight_of_hand: { label: 'Prestidigitação', ability: 'dex' },
  stealth: { label: 'Furtividade', ability: 'dex' },
  survival: { label: 'Sobrevivência', ability: 'wis' },
};

export const PROFICIENCY_LEVELS = ['none', 'half', 'proficient', 'expertise'] as const;
export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

export const proficiencyLevelLabels: Record<ProficiencyLevel, string> = {
  none: 'Sem proficiência',
  half: 'Meia proficiência',
  proficient: 'Proficiente',
  expertise: 'Especialização',
};

/** Parcela do bônus de proficiência aplicada a cada nível (meia proficiência arredonda para baixo). */
export function proficiencyContribution(level: ProficiencyLevel, proficiencyBonus: number): number {
  switch (level) {
    case 'none':
      return 0;
    case 'half':
      return Math.floor(proficiencyBonus / 2);
    case 'proficient':
      return proficiencyBonus;
    case 'expertise':
      return proficiencyBonus * 2;
  }
}
