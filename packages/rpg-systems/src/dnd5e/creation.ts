/**
 * Criação rápida de personagem de D&D 5e: os dados mínimos para começar a jogar.
 * O restante (perícias, magias, inventário, história) é preenchido depois na ficha.
 */
import { z } from 'zod';
import type { ResourceTemplate } from '../types';
import { ABILITIES, ABILITY_SCORE_MAX, ABILITY_SCORE_MIN, DEFAULT_ABILITY_SCORE } from './abilities';
import { MAX_LEVEL, MIN_LEVEL } from './progression';
import { DND5E_RESOURCE_KEYS, dnd5eDefaultResources } from './resources';
import { HIT_DICE, parseDnd5eSheet, type Dnd5eSheet } from './sheet';

/** Conjunto padrão de valores de atributo do SRD 5.2, distribuído pelo jogador. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

const text = (max: number) =>
  z.string().trim().max(max, `Use no máximo ${max} caracteres.`).default('');

const abilityScore = z
  .number({ error: 'Informe um número.' })
  .int('Use um número inteiro.')
  .min(ABILITY_SCORE_MIN, `O mínimo é ${ABILITY_SCORE_MIN}.`)
  .max(ABILITY_SCORE_MAX, `O máximo é ${ABILITY_SCORE_MAX}.`)
  .default(DEFAULT_ABILITY_SCORE);

export const dnd5eCreationSchema = z.object({
  species: text(60),
  background: text(60),
  className: text(40),
  level: z
    .number({ error: 'Informe o nível.' })
    .int('Use um número inteiro.')
    .min(MIN_LEVEL, `O nível mínimo é ${MIN_LEVEL}.`)
    .max(MAX_LEVEL, `O nível máximo é ${MAX_LEVEL}.`)
    .default(1),
  hitDie: z.enum(HIT_DICE, { error: 'Escolha o dado de vida da classe.' }).default('d8'),
  abilities: z
    .object(
      Object.fromEntries(ABILITIES.map((ability) => [ability, abilityScore])) as Record<
        (typeof ABILITIES)[number],
        typeof abilityScore
      >,
    )
    .prefault({}),
  /** Vazio = usar a sugestão calculada pelas regras. */
  hitPointMax: z
    .number({ error: 'Informe um número.' })
    .int('Use um número inteiro.')
    .min(1, 'Os pontos de vida precisam ser pelo menos 1.')
    .max(9999, 'Valor alto demais.')
    .nullable()
    .default(null),
});

export type Dnd5eCreationInput = z.input<typeof dnd5eCreationSchema>;
export type Dnd5eCreation = z.output<typeof dnd5eCreationSchema>;

/** Monta a ficha e as trilhas iniciais a partir dos dados de criação já validados. */
export function buildDnd5eCharacter(input: Dnd5eCreation): {
  sheet: Dnd5eSheet;
  resources: ResourceTemplate[];
} {
  const sheet = parseDnd5eSheet({
    identity: {
      species: input.species,
      background: input.background,
      classes: [{ name: input.className, subclass: '', level: input.level, hitDie: input.hitDie }],
    },
    abilities: input.abilities,
  });

  const resources = dnd5eDefaultResources(sheet).map((resource) =>
    resource.key === DND5E_RESOURCE_KEYS.hitPoints && input.hitPointMax !== null
      ? { ...resource, current: input.hitPointMax, max: input.hitPointMax }
      : resource,
  );
  return { sheet, resources };
}
