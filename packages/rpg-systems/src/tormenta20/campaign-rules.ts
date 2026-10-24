import { z } from 'zod';
import { T20_MAX_LEVEL, T20_MIN_LEVEL } from './sheet';

export const T20_ATTRIBUTE_METHODS = ['pontos', 'rolagem'] as const;
export type T20AttributeMethod = (typeof T20_ATTRIBUTE_METHODS)[number];

export const t20AttributeMethodLabels: Record<T20AttributeMethod, string> = {
  pontos: 'Pontos (10 pontos para distribuir)',
  rolagem: 'Rolagens (4d6, descarta o menor)',
};

export const t20CampaignRulesSchema = z.object({
  startingLevel: z.number().int().min(T20_MIN_LEVEL).max(T20_MAX_LEVEL).default(1),
  attributeMethods: z
    .array(z.enum(T20_ATTRIBUTE_METHODS))
    .min(1)
    .max(2)
    .default(['pontos', 'rolagem']),
  /** Livros liberados (ids dos livros, ex.: `t20-jda`): o conteúdo vem dos pacotes importados. */
  sourcebooks: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
});

export type T20CampaignRules = z.output<typeof t20CampaignRulesSchema>;

export function defaultT20CampaignRules(): T20CampaignRules {
  return t20CampaignRulesSchema.parse({});
}

export function parseT20CampaignRules(data: unknown): T20CampaignRules {
  const parsed = t20CampaignRulesSchema.safeParse(data ?? {});
  return parsed.success ? parsed.data : defaultT20CampaignRules();
}

export function describeT20CampaignRules(
  rules: T20CampaignRules,
  bookNames: Readonly<Record<string, string>> = {},
): string[] {
  const lines = [`Personagens começam no ${rules.startingLevel}º nível.`];
  lines.push(
    `Atributos: ${rules.attributeMethods.map((method) => t20AttributeMethodLabels[method].split(' (')[0]!.toLowerCase()).join(' ou ')}.`,
  );
  if (rules.sourcebooks.length > 0) {
    lines.push(`Livros: ${rules.sourcebooks.map((id) => bookNames[id] ?? id).join(', ')}.`);
  }
  return lines;
}
