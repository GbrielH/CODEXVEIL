/**
 * Bônus fixos que a ficha de D&D 5e aplica sozinha, com a origem de cada um, para o cartão
 * "Bônus automáticos" (como no Tormenta20). Os valores já estão somados em `computeDnd5eDerived`;
 * esta lista só explica de onde vêm.
 */
import type { Dnd5eDerived } from './derived';
import { classLevel, hasSubclass } from './equipment-effects';
import type { Dnd5eSheet } from './sheet';

export type Dnd5eBonusArea = 'ca' | 'deslocamento' | 'iniciativa' | 'pv' | 'pericias';

export interface Dnd5eAutomaticBonus {
  area: Dnd5eBonusArea;
  /** Texto curto do efeito (ex.: "+2 PV por nível"). */
  effect: string;
  /** De onde vem (talento, classe, espécie, item). */
  source: string;
}

export const dnd5eBonusAreaLabels: Record<Dnd5eBonusArea, string> = {
  ca: 'Classe de Armadura',
  deslocamento: 'Deslocamento',
  iniciativa: 'Iniciativa',
  pv: 'Pontos de Vida',
  pericias: 'Perícias',
};

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/^talento:\s*/, '')
    .trim();

/** "Rótulo: detalhe" das notas de CA e deslocamento vira efeito + origem. */
function split(note: string, area: Dnd5eBonusArea): Dnd5eAutomaticBonus {
  const index = note.indexOf(':');
  return index > 0
    ? { area, source: note.slice(0, index).trim(), effect: note.slice(index + 1).trim() }
    : { area, source: note, effect: '' };
}

export function listDnd5eAutomaticBonuses(
  sheet: Dnd5eSheet,
  derived: Pick<Dnd5eDerived, 'armorClassBreakdown' | 'speedNotes' | 'proficiencyBonus'>,
  features: readonly string[] = [],
): Dnd5eAutomaticBonus[] {
  const bonuses: Dnd5eAutomaticBonus[] = [];
  const names = features.map(plain);

  // CA: tudo além da base "Sem armadura" (armadura, escudo, Defesa sem Armadura, itens, Estilo de Luta).
  for (const note of derived.armorClassBreakdown) {
    if (/^sem armadura:/i.test(note)) continue;
    bonuses.push(split(note, 'ca'));
  }
  // Deslocamento: o que muda a base da espécie.
  for (const note of derived.speedNotes) {
    if (/^(espécie|base):/i.test(note)) continue;
    bonuses.push(split(note, 'deslocamento'));
  }
  if (names.some((name) => name === 'alerta' || name === 'alert')) {
    bonuses.push({
      area: 'iniciativa',
      effect: `+${derived.proficiencyBonus} (proficiência)`,
      source: 'Alerta (talento)',
    });
  }

  // PV por nível: Robusto, Tenacidade Anã e Resiliência Dracônica.
  // Mesma regra da criação (`hitPointBonusPerLevel`): Anão do SRD 2024 ou Anão da Colina (2014).
  const species = sheet.identity.species;
  if (
    /colina|hill/i.test(species) ||
    (/^(an[aã]o|dwarf)\b/i.test(species) && !/montanha|mountain/i.test(species))
  ) {
    bonuses.push({ area: 'pv', effect: '+1 PV por nível', source: 'Tenacidade Anã (espécie)' });
  }
  if (names.some((name) => /\b(robusto|tough)\b/.test(name))) {
    bonuses.push({ area: 'pv', effect: '+2 PV por nível', source: 'Robusto (talento)' });
  }
  if (classLevel(sheet, 'Feiticeiro', 'Sorcerer') >= 3 && hasSubclass(sheet, 'dracon')) {
    bonuses.push({
      area: 'pv',
      effect: '+1 PV por nível de feiticeiro',
      source: 'Resiliência Dracônica (feiticeiro)',
    });
  }

  // Pau para Toda Obra (Bardo 2º): metade da proficiência nos testes sem proficiência.
  if (classLevel(sheet, 'Bardo', 'Bard') >= 2) {
    bonuses.push({
      area: 'pericias',
      effect: `+${Math.floor(derived.proficiencyBonus / 2)} nos testes de atributo sem proficiência`,
      source: 'Pau para Toda Obra (bardo)',
    });
  }
  return bonuses;
}
