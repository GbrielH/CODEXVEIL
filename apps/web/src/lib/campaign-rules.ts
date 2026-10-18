/**
 * Leitura das regras de criação de personagens enviadas pelos formulários de campanha.
 * Cada sistema de RPG tem seus campos; o conteúdo é validado pelo módulo do sistema.
 */
import { findSystem } from '@codexveil/rpg-systems';
import type { FieldErrors } from '@codexveil/validation';

/** Campos do formulário (prefixo `rules.`) convertidos no formato do sistema. */
function rawRules(systemId: string, formData: FormData): Record<string, unknown> {
  switch (systemId) {
    case 'dnd5e':
      return {
        startingLevel: Number(formData.get('rules.startingLevel') ?? 1),
        abilityScoreMethods: formData.getAll('rules.abilityScoreMethods').map(String),
        allowEvilAlignments: formData.get('rules.allowEvilAlignments') === 'on',
        sourcebooks: formData.get('rules.sourcebookMode') === 'expanded' ? formData.getAll('rules.sourcebooks').map(String) : [],
      };
    default:
      return {};
  }
}

export type RulesResult = { ok: true; rules: Record<string, unknown> } | { ok: false; fieldErrors: FieldErrors };

export function readCampaignRules(systemId: string, formData: FormData): RulesResult {
  const system = findSystem(systemId);
  if (!system) return { ok: true, rules: {} };
  const parsed = system.campaignRulesSchema.safeParse(rawRules(systemId, formData));
  if (parsed.success) return { ok: true, rules: parsed.data as Record<string, unknown> };
  const fieldErrors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = `rules.${issue.path.map(String).join('.')}`;
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, fieldErrors };
}
