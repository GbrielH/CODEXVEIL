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

/**
 * O que impede um personagem pronto de entrar numa campanha de Tormenta20 (lista vazia = pode
 * entrar), com o que mudar na ficha: nome, raça, classe, nível inicial e livros liberados.
 */
export function t20CampaignIssues(
  character: {
    name: string;
    sheet: {
      identity: { race: string; classes: { level: number }[]; sourcebooks?: readonly string[] };
    };
  },
  rules: T20CampaignRules,
  bookNames: Readonly<Record<string, string>> = {},
): string[] {
  const issues: string[] = [];
  const identity = character.sheet.identity;
  if (!character.name.trim()) issues.push('Dê um nome ao personagem.');
  if (!identity.race.trim()) issues.push('A ficha não tem raça.');
  if (identity.classes.length === 0) issues.push('A ficha não tem classe.');
  const level = identity.classes.reduce((total, entry) => total + entry.level, 0);
  if (identity.classes.length > 0 && level > rules.startingLevel) {
    issues.push(
      `O personagem está no ${level}º nível e a campanha começa no ${rules.startingLevel}º: peça ao mestre para mudar a regra.`,
    );
  } else if (identity.classes.length > 0 && level < rules.startingLevel) {
    issues.push(
      `A campanha começa no ${rules.startingLevel}º nível: suba o personagem do ${level}º para o ${rules.startingLevel}º antes de entrar.`,
    );
  }
  const extraBooks = (identity.sourcebooks ?? []).filter(
    (book) => !rules.sourcebooks.includes(book),
  );
  if (extraBooks.length > 0) {
    issues.push(
      `A ficha usa livros que o mestre não liberou: ${extraBooks.map((book) => bookNames[book] ?? book).join(', ')}. Peça ao mestre para liberá-los.`,
    );
  }
  return issues;
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
