/**
 * Regras de criação de personagens que o mestre define para uma campanha de D&D 5e.
 * Ficam em `campaigns.character_rules` (JSON) e são lidas pelo assistente de criação.
 */
import { z } from 'zod';
import { ABILITY_SCORE_METHODS, abilityScoreMethodLabels } from './creation/draft';
import { findSourcebook, isSourcebookId } from './sourcebooks';

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
  /** Livros oficiais liberados além do SRD (ids de `DND5E_SOURCEBOOKS`); vazio = sistema base. */
  sourcebooks: z.array(z.string().refine(isSourcebookId, 'Livro desconhecido.')).max(80).default([]),
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
    sourcebooks: [...new Set(pick('sourcebooks'))],
  };
}

export function describeDnd5eCampaignRules(rules: Dnd5eCampaignRules): string[] {
  const methods = rules.abilityScoreMethods.map((method) => abilityScoreMethodLabels[method].name.toLowerCase());
  return [
    `Personagens começam no ${rules.startingLevel}º nível.`,
    `Atributos: ${methods.join(', ')}.`,
    rules.allowEvilAlignments ? 'Alinhamentos malignos permitidos.' : 'Sem alinhamentos malignos.',
    rules.sourcebooks.length === 0
      ? 'Sistema base: só o conteúdo do SRD 5.2.1.'
      : `Livros liberados: ${rules.sourcebooks.map((id) => findSourcebook(id)?.name ?? id).join(', ')}. São livros pagos, vendidos na página oficial; o conteúdo deles entra à mão na ficha.`,
  ];
}

/**
 * O que impede um personagem pronto de entrar numa campanha (regras do mestre e dados
 * obrigatórios). Lista vazia = pode entrar. As mensagens dizem o que mudar na ficha.
 */
export function dnd5eCampaignIssues(
  character: { name: string; sheet: { identity: { species: string; background: string; alignment: string; classes: { name: string; level: number }[] } } },
  rules: Dnd5eCampaignRules,
): string[] {
  const issues: string[] = [];
  const identity = character.sheet.identity;
  if (!character.name.trim()) issues.push('Dê um nome ao personagem.');
  if (!identity.species.trim()) issues.push('Escolha a espécie (aba Personagem).');
  if (!identity.background.trim()) issues.push('Escolha o antecedente (aba Personagem).');
  if (identity.classes.some((entry) => !entry.name.trim())) issues.push('Toda classe precisa de nome (aba Personagem).');
  const level = Math.min(20, identity.classes.reduce((total, entry) => total + entry.level, 0));
  if (level > rules.startingLevel) {
    issues.push(`O personagem está no ${level}º nível e a campanha começa no ${rules.startingLevel}º: reduza os níveis das classes ou peça ao mestre para mudar a regra.`);
  } else if (level < rules.startingLevel) {
    issues.push(`A campanha começa no ${rules.startingLevel}º nível: suba o personagem do ${level}º para o ${rules.startingLevel}º antes de entrar.`);
  }
  if (!rules.allowEvilAlignments && /\b(mau|maligno|evil)\b/i.test(identity.alignment)) {
    issues.push(`O mestre não permite alinhamentos malignos: troque o alinhamento (${identity.alignment}).`);
  }
  return issues;
}
