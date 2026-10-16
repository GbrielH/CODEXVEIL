/**
 * Convites de campanha.
 *
 * Os códigos são gerados no banco (função `private.generate_invite_code`) com aleatoriedade
 * forte; o cliente nunca escolhe o código. Aqui ficam apenas formatação, normalização e
 * regras de validade usadas pela interface. A aceitação é validada no servidor pela função
 * `accept_campaign_invite`, que devolve um dos códigos de `InviteRejectionReason`.
 */

/** 32 símbolos sem caracteres ambíguos (sem I, O, 0 e 1). Cada símbolo carrega 5 bits. */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 12;
export const INVITE_DEFAULT_TTL_DAYS = 7;
export const INVITE_MAX_TTL_DAYS = 30;
export const INVITE_MAX_USES_LIMIT = 50;

const CODE_PATTERN = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

/** Remove separadores e espaços e converte para maiúsculas. */
export function normalizeInviteCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidInviteCode(input: string): boolean {
  return CODE_PATTERN.test(normalizeInviteCode(input));
}

/** Exibe o código em grupos de quatro: `ABCD-EFGH-JKLM`. */
export function formatInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  return normalized.match(/.{1,4}/g)?.join('-') ?? normalized;
}

export interface InviteState {
  expiresAt: Date;
  revokedAt: Date | null;
  declinedAt: Date | null;
  /** `null` = usos ilimitados até expirar. */
  maxUses: number | null;
  usesCount: number;
}

export type InviteStatus = 'active' | 'expired' | 'revoked' | 'declined' | 'exhausted';

export function getInviteStatus(invite: InviteState, now: Date = new Date()): InviteStatus {
  if (invite.revokedAt) return 'revoked';
  if (invite.declinedAt) return 'declined';
  if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) return 'exhausted';
  if (invite.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'active';
}

export const inviteStatusLabels: Record<InviteStatus, string> = {
  active: 'Ativo',
  expired: 'Expirado',
  revoked: 'Revogado',
  declined: 'Recusado',
  exhausted: 'Esgotado',
};

/** Motivos de recusa devolvidos pelas funções do banco ao validar um convite. */
export const INVITE_REJECTION_REASONS = [
  'not_authenticated',
  'invalid_code',
  'not_found',
  'expired',
  'revoked',
  'declined',
  'exhausted',
  'already_member',
  'email_mismatch',
  'campaign_archived',
] as const;
export type InviteRejectionReason = (typeof INVITE_REJECTION_REASONS)[number];

export const inviteRejectionMessages: Record<InviteRejectionReason, string> = {
  not_authenticated: 'Entre na sua conta para aceitar o convite.',
  invalid_code: 'O código informado não tem o formato de um convite do Codexveil.',
  not_found: 'Convite não encontrado. Confira o código com o mestre da campanha.',
  expired: 'Este convite expirou. Peça um novo convite ao mestre.',
  revoked: 'Este convite foi cancelado pelo mestre.',
  declined: 'Este convite já foi recusado.',
  exhausted: 'Este convite já atingiu o limite de usos.',
  already_member: 'Você já participa desta campanha.',
  email_mismatch: 'Este convite foi enviado para outro e-mail.',
  campaign_archived: 'A campanha foi arquivada e não aceita novos participantes.',
};

export function isInviteRejectionReason(value: unknown): value is InviteRejectionReason {
  return (
    typeof value === 'string' && (INVITE_REJECTION_REASONS as readonly string[]).includes(value)
  );
}

/** Data de expiração a partir de agora, limitada ao máximo permitido. */
export function computeInviteExpiry(days: number, now: Date = new Date()): Date {
  const clamped = Math.min(Math.max(Math.trunc(days), 1), INVITE_MAX_TTL_DAYS);
  return new Date(now.getTime() + clamped * 24 * 60 * 60 * 1000);
}
