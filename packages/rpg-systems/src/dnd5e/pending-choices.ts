/**
 * Escolhas que ficaram só no texto de talentos, traços de espécie e antecedentes ("uma perícia à
 * sua escolha", "um talento à escolha", "dois truques à escolha"…), sobretudo de livros
 * importados e de fichas antigas. A ficha mostra um cartão "Escolhas pendentes" com seletor; o que
 * é escolhido vai para a ficha e a escolha fica registrada em `sheet.choices`.
 */
import type { AbilityEntryTemplate } from '../types';
import { ABILITIES, abilityLabels, type Ability } from './abilities';
import { dnd5eSpellEntry } from './level-up';
import type { Dnd5eSheet } from './sheet';
import { SKILLS, skillDefinitions } from './skills';
import { ALL_TOOLS } from './srd/equipment';
import { findFeat, listFeats } from './srd/feats';
import { SRD_LANGUAGES } from './srd/languages';
import { findSpell, listSpells } from './srd/spells';

export type Dnd5eChoiceKind =
  'skill' | 'language' | 'tool' | 'feat' | 'cantrip' | 'spell' | 'ability';

export interface Dnd5ePendingChoice {
  /** Estável: nome da habilidade + tipo + posição no texto. */
  key: string;
  kind: Dnd5eChoiceKind;
  count: number;
  /** Habilidade da ficha que concede a escolha. */
  source: string;
  /** Trecho do texto que pede a escolha. */
  text: string;
  /** Magias: círculo pedido. */
  spellLevel?: number;
  /** Talentos: categoria citada ("de origem", "geral"…). */
  featCategory?: string;
}

export const dnd5eChoiceKindLabels: Record<Dnd5eChoiceKind, string> = {
  skill: 'Perícia',
  language: 'Idioma',
  tool: 'Ferramenta',
  feat: 'Talento',
  cantrip: 'Truque',
  spell: 'Magia',
  ability: 'Atributo +1',
};

const NUMBERS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4 };
const count = (word: string) => NUMBERS[plain(word)] ?? (Number(word) || 1);

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

const CHOICE = String.raw`(?:[aà]\s+(?:sua\s+)?escolha|de\s+sua\s+escolha|escolhid[ao]s?\s+por\s+voc[eê])`;
const NUM = String.raw`(um|uma|dois|duas|tr[eê]s|quatro|\d)`;
const PATTERNS: { kind: Dnd5eChoiceKind; regex: RegExp }[] = [
  { kind: 'skill', regex: new RegExp(String.raw`${NUM}\s+per[ií]cias?\s+${CHOICE}`, 'gi') },
  { kind: 'language', regex: new RegExp(String.raw`${NUM}\s+idiomas?(?:\s+adicionais)?\s+${CHOICE}`, 'gi') },
  {
    kind: 'tool',
    regex: new RegExp(
      String.raw`${NUM}\s+(?:tipos?\s+de\s+)?(?:ferramentas?|instrumentos?\s+musica(?:l|is)|kits?)(?:\s+de\s+artes[aã]o)?\s+${CHOICE}`,
      'gi',
    ),
  },
  {
    kind: 'feat',
    regex: new RegExp(
      String.raw`(um)\s+talento(?:\s+(?:de\s+)?(origem|geral|estilo de luta))?\s+${CHOICE}`,
      'gi',
    ),
  },
  { kind: 'cantrip', regex: new RegExp(String.raw`${NUM}\s+truques?\s+${CHOICE}`, 'gi') },
  {
    kind: 'spell',
    regex: new RegExp(String.raw`${NUM}\s+magias?\s+de\s+(\d)º\s+c[ií]rculo\s+${CHOICE}`, 'gi'),
  },
  { kind: 'ability', regex: new RegExp(String.raw`(um)\s+atributo\s+${CHOICE}\s*\+1`, 'gi') },
];

/** Traços do SRD que o assistente de criação já resolve (o texto não guarda o que foi escolhido). */
const HANDLED_BY_WIZARD = [
  'habil',
  'versatil',
  'habilidoso',
  'skilled',
  'iniciado em magia',
  'magic initiate',
  'linhagem elfica',
  'legado infero',
  'ancestralidade draconica',
];

/** O texto já registra o que foi escolhido (a criação acrescenta "Proficiências: …", "Magias: …"). */
const RESOLVED_MARK =
  /\b(Profici[eê]ncias|Magias|Escolhas?|Lista|Idiomas|Ferramentas|Talento|Atributo):\s+\S/;

export function listDnd5ePendingChoices(
  sheet: Dnd5eSheet,
  entries: readonly { name: string; kind: string; description: string }[],
): Dnd5ePendingChoice[] {
  const choices: Dnd5ePendingChoice[] = [];
  for (const entry of entries) {
    if (entry.kind === 'spell' || entry.kind === 'attack') continue;
    const name = plain(entry.name);
    if (HANDLED_BY_WIZARD.some((handled) => name.startsWith(handled))) continue;
    if (RESOLVED_MARK.test(entry.description)) continue;
    let position = 0;
    for (const { kind, regex } of PATTERNS) {
      for (const match of entry.description.matchAll(regex)) {
        const key = `${name}:${kind}:${position++}`.slice(0, 200);
        if (sheet.choices[key]) continue;
        const choice: Dnd5ePendingChoice = {
          key,
          kind,
          count: count(match[1] ?? '1'),
          source: entry.name,
          text: match[0],
        };
        if (kind === 'spell') choice.spellLevel = Number(match[2]);
        if (kind === 'feat' && match[2]) choice.featCategory = match[2].toLowerCase();
        choices.push(choice);
      }
    }
  }
  return choices;
}

/** Atributos que podem receber o +1 (todos; o texto do talento limita, o jogador confere). */
export const DND5E_ABILITY_CHOICES: readonly Ability[] = ABILITIES;

/** Aplica na ficha uma escolha de perícia, idioma, ferramenta ou atributo e a registra. */
export function applyDnd5eChoice(
  sheet: Dnd5eSheet,
  choice: Dnd5ePendingChoice,
  picks: readonly string[],
): Dnd5eSheet {
  const next: Dnd5eSheet = {
    ...sheet,
    choices: { ...sheet.choices, [choice.key]: [...picks].slice(0, 10) },
  };
  const append = (current: string, values: readonly string[]) => {
    const parts = current.split(/;\s*/).filter(Boolean);
    for (const value of values)
      if (!parts.some((part) => plain(part) === plain(value))) parts.push(value);
    return parts.join('; ').slice(0, 300);
  };
  if (choice.kind === 'skill') {
    const skills = { ...next.skills };
    for (const pick of picks) {
      const current = skills[pick as keyof typeof skills];
      if (current && current.proficiency !== 'expertise')
        skills[pick as keyof typeof skills] = { ...current, proficiency: 'proficient' };
    }
    next.skills = skills;
  } else if (choice.kind === 'language') {
    next.proficiencies = {
      ...next.proficiencies,
      languages: append(next.proficiencies.languages, picks),
    };
  } else if (choice.kind === 'tool') {
    next.proficiencies = { ...next.proficiencies, tools: append(next.proficiencies.tools, picks) };
  } else if (choice.kind === 'ability') {
    const abilities = { ...next.abilities };
    for (const pick of picks) {
      const ability = pick as Ability;
      if (ABILITIES.includes(ability)) abilities[ability] = Math.min(30, abilities[ability] + 1);
    }
    next.abilities = abilities;
  }
  return next;
}

export interface Dnd5eChoiceOption {
  value: string;
  label: string;
}

/** Opções do seletor de uma escolha (sem o que a ficha já tem). */
export function dnd5eChoiceOptions(
  choice: Dnd5ePendingChoice,
  sheet: Dnd5eSheet,
  knownNames: readonly string[] = [],
): Dnd5eChoiceOption[] {
  const known = new Set(knownNames.map(plain));
  switch (choice.kind) {
    case 'skill':
      return SKILLS.filter(
        (skill) =>
          sheet.skills[skill].proficiency === 'none' || sheet.skills[skill].proficiency === 'half',
      ).map((skill) => ({ value: skill, label: skillDefinitions[skill].label }));
    case 'language': {
      const have = plain(sheet.proficiencies.languages);
      return SRD_LANGUAGES.filter((language) => !have.includes(plain(language.name))).map(
        (language) => ({
          value: language.name,
          label: language.rarity === 'rare' ? `${language.name} (raro)` : language.name,
        }),
      );
    }
    case 'tool': {
      const have = plain(sheet.proficiencies.tools);
      return ALL_TOOLS.filter((tool) => !have.includes(plain(tool.name))).map((tool) => ({
        value: tool.name,
        label: tool.name,
      }));
    }
    case 'ability':
      return ABILITIES.filter((ability) => sheet.abilities[ability] < 30).map((ability) => ({
        value: ability,
        label: `${abilityLabels[ability].name} (${sheet.abilities[ability]})`,
      }));
    case 'feat': {
      const category =
        choice.featCategory === 'origem'
          ? 'origin'
          : choice.featCategory === 'geral'
            ? 'general'
            : choice.featCategory === 'estilo de luta'
              ? 'fighting_style'
              : null;
      return listFeats()
        .filter(
          (feat) =>
            (!category || feat.category === category) &&
            (feat.repeatable || !known.has(plain(feat.name))),
        )
        .map((feat) => ({
          value: feat.id,
          label: feat.book ? `${feat.name} (${feat.book})` : feat.name,
        }));
    }
    case 'cantrip':
    case 'spell': {
      const level = choice.kind === 'cantrip' ? 0 : (choice.spellLevel ?? 1);
      return listSpells()
        .filter((spell) => spell.level === level && !known.has(plain(spell.name)))
        .map((spell) => ({ value: spell.name, label: spell.name }));
    }
  }
}

/** Entradas novas da ficha (talento ou magia) para escolhas de talento, truque e magia. */
export function dnd5eChoiceEntries(
  choice: Dnd5ePendingChoice,
  picks: readonly string[],
  sortOrder = 9500,
): AbilityEntryTemplate[] {
  if (choice.kind === 'feat') {
    return picks.flatMap((id, index) => {
      const feat = findFeat(id);
      return feat
        ? [
            {
              kind: 'feat' as const,
              name: feat.name,
              source: choice.source.slice(0, 120),
              description: feat.description.slice(0, 8000),
              data: {},
              sortOrder: sortOrder + index,
            },
          ]
        : [];
    });
  }
  if (choice.kind === 'cantrip' || choice.kind === 'spell') {
    return picks.flatMap((name, index) => {
      const spell = findSpell(name);
      return spell ? [dnd5eSpellEntry(spell, choice.source, sortOrder + index)] : [];
    });
  }
  return [];
}
