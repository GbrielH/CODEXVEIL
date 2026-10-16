import {
  computeInviteExpiry,
  getInviteStatus,
  INVITE_REJECTION_REASONS,
  type InviteRejectionReason,
  type InviteStatus,
} from '@codexveil/domain';
import type { InviteCreate } from '@codexveil/validation';
import { z } from 'zod';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';

export interface CampaignInvite {
  id: string;
  code: string;
  invitedEmail: string | null;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string;
  createdAt: string;
  status: InviteStatus;
}

const INVITE_COLUMNS =
  'id, code, invited_email, max_uses, uses_count, expires_at, revoked_at, declined_at, created_at' as const;

export async function listCampaignInvites(
  client: CodexveilClient,
  campaignId: string,
): Promise<CampaignInvite[]> {
  const { data, error } = await client
    .from('campaign_invites')
    .select(INVITE_COLUMNS)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw toAppError(error);
  const now = new Date();
  return data.map((row) => ({
    id: row.id,
    code: row.code,
    invitedEmail: row.invited_email,
    maxUses: row.max_uses,
    usesCount: row.uses_count,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    status: getInviteStatus(
      {
        expiresAt: new Date(row.expires_at),
        revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
        declinedAt: row.declined_at ? new Date(row.declined_at) : null,
        maxUses: row.max_uses,
        usesCount: row.uses_count,
      },
      now,
    ),
  }));
}

/** Cria um convite; o código é sempre gerado pelo banco. */
export async function createCampaignInvite(
  client: CodexveilClient,
  campaignId: string,
  input: InviteCreate,
): Promise<{ id: string; code: string }> {
  const { data, error } = await client
    .from('campaign_invites')
    .insert({
      campaign_id: campaignId,
      invited_email: input.invitedEmail,
      max_uses: input.invitedEmail ? 1 : input.maxUses,
      expires_at: computeInviteExpiry(input.expiresInDays).toISOString(),
    })
    .select('id, code')
    .single();
  if (error) throw toAppError(error);
  return data;
}

export async function revokeCampaignInvite(client: CodexveilClient, inviteId: string): Promise<void> {
  const { error } = await client.rpc('revoke_campaign_invite', { p_invite_id: inviteId });
  if (error) throw toAppError(error);
}

// --- Respostas das funções de convite (JSON validado antes de chegar à interface) ---

const reasonSchema = z.enum(INVITE_REJECTION_REASONS);

const previewSchema = z.union([
  z.object({
    ok: z.boolean(),
    reason: reasonSchema.nullable().optional(),
    expiresAt: z.string(),
    isPersonal: z.boolean(),
    campaign: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      systemId: z.string(),
      ownerName: z.string().nullable(),
      memberCount: z.number(),
    }),
  }),
  z.object({ ok: z.literal(false), reason: reasonSchema }),
]);
export type InvitePreview = z.infer<typeof previewSchema>;

const acceptSchema = z.object({
  ok: z.boolean(),
  reason: reasonSchema.optional(),
  campaignId: z.string().nullable().optional(),
});
export type InviteAcceptResult =
  | { ok: true; campaignId: string }
  | { ok: false; reason: InviteRejectionReason; campaignId: string | null };

const pendingSchema = z.array(
  z.object({
    code: z.string(),
    campaignId: z.string(),
    campaignName: z.string(),
    systemId: z.string(),
    ownerName: z.string(),
    expiresAt: z.string(),
  }),
);
export type PendingInvite = z.infer<typeof pendingSchema>[number];

function parseRpc<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw toAppError(new Error(`Resposta inesperada do servidor: ${parsed.error.message}`));
  }
  return parsed.data;
}

export async function getInvitePreview(client: CodexveilClient, code: string): Promise<InvitePreview> {
  const { data, error } = await client.rpc('get_invite_preview', { p_code: code });
  if (error) throw toAppError(error);
  return parseRpc(previewSchema, data);
}

export async function acceptCampaignInvite(
  client: CodexveilClient,
  code: string,
): Promise<InviteAcceptResult> {
  const { data, error } = await client.rpc('accept_campaign_invite', { p_code: code });
  if (error) throw toAppError(error);
  const result = parseRpc(acceptSchema, data);
  if (result.ok && result.campaignId) return { ok: true, campaignId: result.campaignId };
  return { ok: false, reason: result.reason ?? 'not_found', campaignId: result.campaignId ?? null };
}

export async function declineCampaignInvite(client: CodexveilClient, code: string): Promise<void> {
  const { error } = await client.rpc('decline_campaign_invite', { p_code: code });
  if (error) throw toAppError(error);
}

export async function getMyPendingInvites(client: CodexveilClient): Promise<PendingInvite[]> {
  const { data, error } = await client.rpc('get_my_pending_invites');
  if (error) throw toAppError(error);
  return parseRpc(pendingSchema, data);
}
