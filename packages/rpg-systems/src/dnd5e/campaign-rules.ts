/**
 * Regras de criação de personagens que o mestre define para uma campanha de D&D 5e.
 * Ficam em `campaigns.character_rules` (JSON) e são lidas pelo assistente de criação.
 */
import { z } from 'zod';
import { ABILITY_SCORE_METHODS, abilityScoreMethodLabels } from './creation/draft';

export const dnd5eCampaignRulesSchema = z.object({
  /** Nível com que os personagens começam (o SRD recomenda o 1º, ou o 3º para grupos experientes). */
  startingLevel: z
    .number({ error: 'Informe o nível inicial.' })
    .int('Use um número inteiro.')
    .min(1, 'O nível inicial mínimo é 1.')
    .max(20, 'O nível inicial máximo é 20.')
    .default(1),
  /** Métodos de geração de atributos permitidos. */
  abilityScoreMethods: z
    .array(z.enum(ABILITY_SCORE_METHODS))
    .min(1, 'Permita pelo menos um método de atributos.')
    .default([...ABILITY_SCORE_METHODS]),
  /** O SRD pressupõe personagens não malignos; o mestre pode liberar. */
  allowEvilAlignments: z.boolean().default(false),
});

export type Dnd5eCampaignRules = z.output<typeof dnd5eCampaignRulesSchema>;
export type Dnd5eCampaignRulesInput = z.input<typeof dnd5eCampaignRulesSchema>;

export function defaultDnd5eCampaignRules(): Dnd5eCampaignRules {
  return dnd5eCampaignRulesSchema.parse({});
}

/** Lê as regras gravadas no banco. Campos ausentes ou inválidos voltam ao padrão, sem lançar. */
export function parseDnd5eCampaignRules(data: unknown): Dnd5eCampaignRules {
  const defaults = defaultDnd5eCampaignRules();
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return defaults;
  const record = data as Record<string, unknown>;
  const pick = <K extends keyof Dnd5eCampaignRules>(key: K): Dnd5eCampaignRules[K] => {
    const parsed = dnd5eCampaignRulesSchema.shape[key].safeParse(record[key]);
    return parsed.success ? (parsed.data as Dnd5eCampaignRules[K]) : defaults[key];
  };
  return {
    startingLevel: pick('startingLevel'),
    abilityScoreMethods: [...new Set(pick('abilityScoreMethods'))],
    allowEvilAlignments: pick('allowEvilAlignments'),
  };
}

export function describeDnd5eCampaignRules(rules: Dnd5eCampaignRules): string[] {
  const methods = rules.abilityScoreMethods.map((method) => abilityScoreMethodLabels[method].name.toLowerCase());
  return [
    `Personagens começam no ${rules.startingLevel}º nível.`,
    `Atributos: ${methods.join(', ')}.`,
    rules.allowEvilAlignments ? 'Alinhamentos malignos permitidos.' : 'Sem alinhamentos malignos.',
  ];
}
