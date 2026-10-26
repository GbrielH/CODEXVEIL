import {
  INVITE_DEFAULT_TTL_DAYS,
  INVITE_MAX_TTL_DAYS,
  INVITE_MAX_USES_LIMIT,
  isValidInviteCode,
  normalizeInviteCode,
} from '@codexveil/domain';
import { SYSTEM_IDS } from '@codexveil/rpg-systems';
import { z } from 'zod';
import { emailSchema, optionalText, requiredText } from './common';

export const systemIdSchema = z.enum(SYSTEM_IDS, { error: 'Escolha um sistema de RPG suportado.' });

/**
 * Regras de criação de personagens definidas pelo mestre. O conteúdo é validado pelo módulo
 * do sistema escolhido (`findSystem(id).campaignRulesSchema`); aqui só se exige um objeto.
 */
export const characterRulesSchema = z.record(z.string(), z.unknown());

/** Perguntas do mestre para a criação de personagem (todas obrigatórias para os jogadores). */
export const creationQuestionsSchema = z
  .array(z.string().trim().min(1, 'Escreva a pergunta ou remova a linha.').max(300, 'Cada pergunta pode ter até 300 caracteres.'))
  .max(20, 'No máximo 20 perguntas.');

/** Respostas do jogador: a pergunta vai junto (continua legível se o mestre mudar a lista). */
export const creationAnswersSchema = z
  .array(z.object({ question: z.string().max(300), answer: z.string().trim().min(1, 'Responda a todas as perguntas.').max(2000) }))
  .max(20);
export type CreationAnswers = z.output<typeof creationAnswersSchema>;

export const campaignCreateSchema = z.object({
  name: requiredText('o nome da campanha', 2, 80),
  description: optionalText(2000),
  systemId: systemIdSchema,
  characterRules: characterRulesSchema.default({}),
  creationQuestions: creationQuestionsSchema.default([]),
});
export type CampaignCreateInput = z.input<typeof campaignCreateSchema>;
export type CampaignCreate = z.output<typeof campaignCreateSchema>;

export const campaignUpdateSchema = z.object({
  name: requiredText('o nome da campanha', 2, 80),
  description: optionalText(2000),
  partySheetsVisible: z.boolean(),
  playersCanEditSheets: z.boolean(),
  /** Ausente = mantém as regras atuais. */
  characterRules: characterRulesSchema.optional(),
  /** Ausente = mantém as perguntas atuais. */
  creationQuestions: creationQuestionsSchema.optional(),
});
export type CampaignUpdate = z.output<typeof campaignUpdateSchema>;

export const inviteCreateSchema = z.object({
  expiresInDays: z
    .number({ error: 'Informe por quantos dias o convite vale.' })
    .int('Use um número inteiro de dias.')
    .min(1, 'O convite precisa valer por pelo menos 1 dia.')
    .max(INVITE_MAX_TTL_DAYS, `O convite pode valer no máximo ${INVITE_MAX_TTL_DAYS} dias.`)
    .default(INVITE_DEFAULT_TTL_DAYS),
  /** `null` = usos ilimitados até expirar. */
  maxUses: z
    .number()
    .int()
    .min(1, 'Permita pelo menos 1 uso.')
    .max(INVITE_MAX_USES_LIMIT, `Use no máximo ${INVITE_MAX_USES_LIMIT} usos.`)
    .nullable()
    .default(1),
  /** Convite pessoal: só a conta com este e-mail pode aceitar. */
  invitedEmail: emailSchema.nullable().default(null),
});
export type InviteCreateInput = z.input<typeof inviteCreateSchema>;
export type InviteCreate = z.output<typeof inviteCreateSchema>;

export const inviteCodeSchema = z
  .string({ error: 'Informe o código do convite.' })
  .transform(normalizeInviteCode)
  .refine(isValidInviteCode, 'Código de convite inválido. Confira com o mestre da campanha.');
