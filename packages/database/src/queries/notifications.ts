/**
 * Notificações push do app. O aparelho é registrado pela função `register_push_token`; o aviso
 * de sessão agendada é enviado pela Edge Function `notify-session`, que confere se quem pediu
 * é mestre da campanha e se a data ainda não foi avisada.
 */
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';

export const PUSH_PLATFORMS = ['android', 'ios'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export async function registerPushToken(client: CodexveilClient, token: string, platform: PushPlatform): Promise<void> {
  const { error } = await client.rpc('register_push_token', { p_token: token, p_platform: platform });
  if (error) throw toAppError(error);
}

/** Remove o aparelho da conta atual (ao sair da conta ou desligar as notificações). */
export async function unregisterPushToken(client: CodexveilClient, token: string): Promise<void> {
  const { error } = await client.from('push_tokens').delete().eq('token', token);
  if (error) throw toAppError(error);
}

export interface SessionNotification {
  scheduledFor: string;
  recipients: number;
  sentAt: string;
}

/** Último aviso enviado sobre a sessão (só mestres leem). */
export async function getSessionNotification(client: CodexveilClient, sessionId: string): Promise<SessionNotification | null> {
  const { data, error } = await client
    .from('session_notifications')
    .select('scheduled_for, recipients, sent_at')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data ? { scheduledFor: data.scheduled_for, recipients: data.recipients, sentAt: data.sent_at } : null;
}

export interface NotifySessionResult {
  /** Aparelhos que receberam o aviso. */
  sent: number;
  /** Motivo de não ter enviado (sessão não publicada, sem data, data já avisada…). */
  skipped?: string;
}

/**
 * Pede ao servidor o aviso de sessão agendada para os participantes da campanha. Não falha a
 * operação do mestre: devolve `null` se o serviço de notificações estiver indisponível.
 */
export async function notifySessionScheduled(client: CodexveilClient, sessionId: string): Promise<NotifySessionResult | null> {
  try {
    const response = await client.functions.invoke<NotifySessionResult>('notify-session', { body: { sessionId } });
    if (response.error) return null;
    return response.data;
  } catch {
    return null;
  }
}
