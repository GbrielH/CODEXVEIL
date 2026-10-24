/**
 * Converte as entradas dos livros (como vêm do banco) para o formato das regras de criação:
 * classes, subclasses, espécies, antecedentes, talentos e magias.
 *
 * Livros de 2014 entram nas regras do SRD 5.2.1 (2024) seguindo a orientação do Livro do
 * Jogador de 2024 para conteúdo antigo:
 * - espécies não dão aumentos de atributo (eles vêm do antecedente);
 * - antecedentes antigos permitem aumentar quaisquer atributos e escolher um talento de origem;
 * - habilidades de subclasse de 1º ou 2º nível chegam no 3º, quando a classe ganha a subclasse;
 * - talentos gerais exigem o 4º nível.
 */
import { ABILITIES, abilityLabels, type Ability } from '../abilities';
import { SRD_SPELLS } from '../srd/spells';
import { SRD_SPELL_NAMES_PT } from '../srd/spell-names-pt';
import {
  CLASS_IDS,
  type BackgroundDefinition,
  type ClassDefinition,
  type FeatDefinition,
  type SpeciesDefinition,
} from '../srd/types';
import type { BookRef, BookSpell, BookSubclass, Dnd5eBookContent } from './active';
import { equipmentFromText } from './equipment-text';
import { languagesFromText } from './languages-text';
import { safeBookEntryData } from './pack';

export interface BookContentSource {
  book: BookRef;
  entries: readonly { kind: string; key: string; name: string; data: unknown }[];
}

/** Normaliza nomes para comparação: sem acentos, caixa ou pontuação. */
export function normalizeBookName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SRD_BY_NAME = new Map<string, string>();
for (const spell of SRD_SPELLS) SRD_BY_NAME.set(normalizeBookName(spell.name), spell.name);
for (const [en, pt] of Object.entries(SRD_SPELL_NAMES_PT))
  SRD_BY_NAME.set(normalizeBookName(pt), en);

/**
 * Nomes das traduções brasileiras dos livros de 2014 que diferem da tradução do SRD 5.2.1 (só os
 * nomes, para ligar as tabelas de magias das subclasses à magia certa).
 */
const SPELL_NAME_ALIASES: Record<string, string> = {
  'auxilio divino': 'Aid',
  'farol de esperanca': 'Beacon of Hope',
  malogro: 'Blight',
  'falsa vitalidade': 'False Life',
  'cupula antivida': 'Antilife Shell',
  'palavra de cura em massa': 'Mass Healing Word',
  remeter: 'Sending',
  'pequena cabana de leomund': 'Tiny Hut',
  'aura de devocao': 'Aura of Life',
  'toque necrotico': 'Chill Touch',
  'crescimento de plantas': 'Plant Growth',
  'escudo ardente': 'Fire Shield',
  'raio guiador': 'Guiding Bolt',
  celeridade: 'Haste',
  'pele rochosa': 'Stoneskin',
  'pele de pedra': 'Stoneskin',
  similaridade: 'Seeming',
  'circulo de teleporte': 'Teleportation Circle',
  'tempestade glacial': 'Ice Storm',
  'dificultar deteccao': 'Nondetection',
  'caminhar em arvores': 'Tree Stride',
  'caminhar em': 'Tree Stride',
};
/** O mesmo, entre livros: o nome usado numa tabela de subclasse e o da magia no livro de magias. */
const BOOK_SPELL_ALIASES: Record<string, string> = {
  'vinha esmagadora': 'vinha sufocante',
  'invocar barragem': 'conjurar rajada',
  'banimento destruidor': 'punicao banidora',
};
for (const [pt, en] of Object.entries(SPELL_NAME_ALIASES)) {
  if (SRD_SPELLS.some((spell) => spell.name === en) && !SRD_BY_NAME.has(pt))
    SRD_BY_NAME.set(pt, en);
}

/** Nome sem artigos e preposições, para casar traduções ("contra o Bem e o Mal" = "contra Bem e Mal"). */
function looseSpellName(name: string): string {
  return normalizeBookName(name)
    .split(' ')
    .filter(
      (word) =>
        !['o', 'a', 'os', 'as', 'e', 'de', 'do', 'da', 'dos', 'das', 'of', 'the', 'and'].includes(
          word,
        ),
    )
    .join(' ');
}

const SRD_BY_LOOSE_NAME = new Map<string, string>();
for (const [key, value] of SRD_BY_NAME) SRD_BY_LOOSE_NAME.set(looseSpellName(key), value);

/** Nome original da magia do SRD que corresponde ao nome (em inglês ou português), se houver. */
export function srdSpellNameFor(name: string): string | undefined {
  return SRD_BY_NAME.get(normalizeBookName(name)) ?? SRD_BY_LOOSE_NAME.get(looseSpellName(name));
}

export function bookEntityId(bookId: string, key: string): string {
  return `${bookId}:${key}`;
}

const SIZE_LABELS = { small: 'Pequeno', medium: 'Médio' } as const;
const WEAPON_LABELS: Record<ClassDefinition['weapons']['martial'], string> = {
  all: 'Armas simples e marciais',
  light: 'Armas simples e marciais com a propriedade Leve',
  finesse_or_light: 'Armas simples e marciais com Acuidade ou Leve',
  none: 'Armas simples',
};

function armorLabel(armor: readonly string[]): string {
  if (armor.length === 0) return 'Nenhuma';
  const kinds = (['light', 'medium', 'heavy'] as const).filter((kind) => armor.includes(kind));
  const names = { light: 'leves', medium: 'médias', heavy: 'pesadas' } as const;
  const parts: string[] = [];
  if (kinds.length === 3) parts.push('Todas as armaduras');
  else if (kinds.length > 0)
    parts.push(`Armaduras ${kinds.map((kind) => names[kind]).join(' e ')}`);
  if (armor.includes('shield')) parts.push(parts.length > 0 ? 'escudos' : 'Escudos');
  return parts.join(' e ');
}

/** Conjunto padrão sugerido: 15 e 14 nos atributos principais, Constituição em seguida. */
function suggestedArray(primary: readonly Ability[]): Record<Ability, number> {
  const order = [...new Set<Ability>([...primary, 'con', 'dex', 'wis', 'str', 'cha', 'int'])];
  const values = [15, 14, 13, 12, 10, 8];
  return Object.fromEntries(order.map((ability, index) => [ability, values[index] ?? 8])) as Record<
    Ability,
    number
  >;
}

const isSrdClass = (id: string) => (CLASS_IDS as readonly string[]).includes(id);

/** Monta o conteúdo usado pelas regras a partir dos livros liberados, na ordem recebida. */
/** Idiomas do traço "Idiomas" da raça; sem esse traço, vale a regra de 2024 (dois padrão). */
function speciesLanguages(traits: readonly { name: string; description: string }[]) {
  const trait = traits.find((entry) => /^idiomas?$/i.test(entry.name.trim()));
  if (!trait) return {};
  const parsed = languagesFromText(trait.description);
  return parsed.fixed.length || parsed.choices ? { bookLanguages: parsed } : {};
}

export function buildDnd5eBookContent(sources: readonly BookContentSource[]): Dnd5eBookContent {
  const classes: ClassDefinition[] = [];
  const classKeys = new Map<string, string>();
  const subclasses: BookSubclass[] = [];
  const species: SpeciesDefinition[] = [];
  const backgrounds: BackgroundDefinition[] = [];
  const feats: FeatDefinition[] = [];
  const spells = new Map<string, BookSpell>();
  const srdSpellLists = new Map<string, Set<string>>();
  const pendingLists: { list: string; name: string }[] = [];

  const addSrdList = (srdName: string, lists: readonly string[]) => {
    const original = SRD_SPELLS.find((spell) => spell.name === srdName);
    const extra = lists.filter((list) => !original?.classes.includes(list));
    if (extra.length === 0) return;
    const set = srdSpellLists.get(srdName) ?? new Set<string>();
    for (const list of extra) set.add(list);
    srdSpellLists.set(srdName, set);
  };

  // Classes primeiro: subclasses e magias de outros livros podem apontar para elas.
  for (const { book, entries } of sources) {
    for (const entry of entries) {
      if (entry.kind !== 'class') continue;
      const data = safeBookEntryData('class', entry.data);
      if (!data) continue;
      const id = bookEntityId(book.id, entry.key);
      if (classKeys.has(entry.key)) continue;
      classKeys.set(entry.key, id);
      classes.push({
        id,
        name: entry.name,
        book: book.name,
        summary: data.summary,
        primaryAbilities: data.primaryAbilities,
        primaryAbilityLabel: data.primaryAbilities
          .map((ability) => abilityLabels[ability].name)
          .join(' e '),
        complexity: 'Média',
        hitDie: data.hitDie,
        savingThrows: data.savingThrows,
        skillChoices: { count: data.skillChoices.count, options: data.skillChoices.options },
        weapons: data.weapons,
        weaponLabel: WEAPON_LABELS[data.weapons.martial],
        armor: data.armor,
        armorLabel: armorLabel(data.armor),
        tools: data.tools ? [data.tools] : [],
        // Opção A: o equipamento do livro; opção B: o ouro inicial no lugar dele.
        equipment: data.equipment
          ? [
              { id: 'A', ...equipmentFromText(data.equipment) },
              { id: 'B', items: [], gold: data.startingGold },
            ]
          : [{ id: 'A', items: [], gold: data.startingGold }],
        standardArray: suggestedArray(data.primaryAbilities),
        asiLevels: data.asiLevels,
        features: data.features,
        subclass: { id: '', name: '', description: '', features: [] },
        ...(data.spellcasting
          ? {
              spellcasting: {
                ability: data.spellcasting.ability,
                list: data.spellcasting.list,
                progression: data.spellcasting.progression,
                cantrips: data.spellcasting.cantrips,
                prepared: data.spellcasting.prepared,
              },
            }
          : {}),
        resources: [],
      });
    }
  }
  const resolveClassId = (classId: string) =>
    isSrdClass(classId) ? classId : (classKeys.get(classId) ?? classId);

  for (const { book, entries } of sources) {
    for (const entry of entries) {
      const id = bookEntityId(book.id, entry.key);
      switch (entry.kind) {
        case 'subclass': {
          const data = safeBookEntryData('subclass', entry.data);
          if (!data) break;
          const classId = resolveClassId(data.classId);
          // Classes do SRD (2024) ganham a subclasse no 3º nível.
          const shift = isSrdClass(classId);
          subclasses.push({
            id,
            classId,
            name: entry.name,
            book: book.name,
            description: data.summary,
            features: data.features.map((feature) =>
              shift && feature.level < 3
                ? {
                    ...feature,
                    level: 3,
                    description:
                      `${feature.description}\n\n(No livro, ${feature.level}º nível.)`.trim(),
                  }
                : feature,
            ),
            alwaysPrepared: data.alwaysPrepared.map((group) => ({
              level: shift ? Math.max(3, group.level) : group.level,
              spells: group.spells.map((name) => srdSpellNameFor(name) ?? name),
            })),
          });
          break;
        }
        case 'species': {
          const data = safeBookEntryData('species', entry.data);
          if (!data) break;
          species.push({
            id,
            name: entry.name,
            book: book.name,
            summary: data.summary,
            sizes: data.sizes,
            sizeLabel: data.sizes.map((size) => SIZE_LABELS[size]).join(' ou '),
            speed: data.speed,
            traits: data.traits,
            ...speciesLanguages(data.traits),
            ...(data.lineage
              ? {
                  lineage: {
                    label: data.lineage.label,
                    options: data.lineage.options.map((option) => ({
                      id: option.id,
                      name: option.name,
                      description: option.description,
                      ...(option.speed ? { speed: option.speed } : {}),
                    })),
                  },
                }
              : {}),
            ...(data.cantrips.length
              ? {
                  cantrips: data.cantrips.map((name) => srdSpellNameFor(name) ?? name),
                  spellcastingAbilityChoice: true,
                }
              : {}),
          });
          break;
        }
        case 'background': {
          const data = safeBookEntryData('background', entry.data);
          if (!data) break;
          const details = [
            data.summary,
            data.tools ? `Ferramentas: ${data.tools}.` : '',
            data.languages ? `Idiomas: ${data.languages}.` : '',
            data.feature?.name ? `${data.feature.name}: ${data.feature.description}` : '',
          ].filter(Boolean);
          backgrounds.push({
            id,
            name: entry.name,
            book: book.name,
            summary: details.join('\n\n'),
            abilities: ABILITIES,
            feat: '',
            skills: data.skills,
            ...(data.tools ? { tool: data.tools } : {}),
            ...(data.languages ? { bookLanguages: languagesFromText(data.languages) } : {}),
            equipment: data.equipment
              ? [
                  { id: 'A', ...equipmentFromText(data.equipment) },
                  { id: 'B', items: [], gold: 50 },
                ]
              : [{ id: 'A', items: [], gold: 50 }],
          });
          break;
        }
        case 'feat': {
          const data = safeBookEntryData('feat', entry.data);
          if (!data) break;
          const minLevel = data.minLevel ?? (data.category === 'general' ? 4 : undefined);
          feats.push({
            id,
            name: entry.name,
            book: book.name,
            category: data.category,
            description: data.prerequisite
              ? `Pré-requisito: ${data.prerequisite}. ${data.description}`
              : data.description,
            ...(data.repeatable ? { repeatable: true } : {}),
            ...(minLevel ? { minLevel } : {}),
            ...(data.minScore ? { minScore: data.minScore } : {}),
            ...(data.abilityIncrease.length ? { abilityIncrease: data.abilityIncrease } : {}),
          });
          break;
        }
        case 'spell': {
          const data = safeBookEntryData('spell', entry.data);
          if (!data) break;
          const srdName = srdSpellNameFor(data.original) ?? srdSpellNameFor(entry.name);
          if (srdName) {
            addSrdList(srdName, data.classes);
            break;
          }
          const key = normalizeBookName(entry.name);
          const existing = spells.get(key);
          if (existing) {
            spells.set(key, {
              ...existing,
              classes: [...new Set([...existing.classes, ...data.classes])],
            });
            break;
          }
          spells.set(key, {
            name: entry.name,
            level: data.level,
            school: data.school,
            classes: data.classes,
            castingTime: data.castingTime,
            range: data.range,
            components: data.components,
            duration: data.duration,
            ...(data.concentration ? { concentration: true } : {}),
            ...(data.ritual ? { ritual: true } : {}),
            description: data.description,
            book,
          });
          break;
        }
        case 'spell_list': {
          const data = safeBookEntryData('spell_list', entry.data);
          if (!data) break;
          for (const spell of data.spells) pendingLists.push({ list: data.list, name: spell.name });
          break;
        }
        default:
          break;
      }
    }
  }

  // Listas acrescentadas (ex.: listas expandidas do Caldeirão de Tasha, lista do artífice).
  for (const { list, name } of pendingLists) {
    const srdName = srdSpellNameFor(name);
    if (srdName) {
      addSrdList(srdName, [list]);
      continue;
    }
    const key = normalizeBookName(name);
    const spell = spells.get(key);
    if (spell && !spell.classes.includes(list))
      spells.set(key, { ...spell, classes: [...spell.classes, list] });
  }

  // Magias sempre preparadas que não são do SRD: usa o nome da magia do livro (as tabelas das
  // subclasses vêm em minúsculas e às vezes com outra tradução).
  const bookByLoose = new Map(
    [...spells.values()].map((spell) => [looseSpellName(spell.name), spell.name]),
  );
  const resolve = (name: string) =>
    SRD_SPELLS.some((spell) => spell.name === name)
      ? name
      : (bookByLoose.get(looseSpellName(name)) ??
        bookByLoose.get(looseSpellName(BOOK_SPELL_ALIASES[normalizeBookName(name)] ?? '')) ??
        srdSpellNameFor(name) ??
        name);
  for (const subclass of subclasses) {
    if (subclass.alwaysPrepared)
      subclass.alwaysPrepared = subclass.alwaysPrepared.map((group) => ({
        ...group,
        spells: group.spells.map(resolve),
      }));
  }
  for (const entry of species) {
    if (entry.cantrips) entry.cantrips = entry.cantrips.map(resolve);
  }

  return {
    books: sources.map((source) => source.book),
    classes,
    subclasses,
    species,
    backgrounds,
    feats,
    spells: [...spells.values()].sort(
      (a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'),
    ),
    srdSpellLists: Object.fromEntries([...srdSpellLists].map(([name, set]) => [name, [...set]])),
  };
}
