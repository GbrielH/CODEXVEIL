/**
 * Assinaturas do Supabase Realtime (Postgres Changes), compartilhadas por web e mobile.
 *
 * Os eventos são usados apenas como SINAL para recarregar dados pelas consultas normais:
 * o Realtime aplica o RLS a cada assinante, mas eventos de DELETE trazem só a chave e
 * recarregar garante que a tela mostre exatamente o que o banco permite ver.
 *
 * Somente as tabelas publicadas na migração de Realtime geram eventos.
 *
 * O canal fica SUBSCRIBED antes de o servidor terminar de assinar o Postgres; mudanças nesse
 * intervalo não geram eventos (confirmado contra o Supabase real). Por isso o estado só vira
 * `live` com a mensagem de sistema do Postgres Changes, e nesse momento os dados são
 * recarregados uma vez para cobrir o que mudou desde a consulta inicial.
 */
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import type { CodexveilClient } from './client';

export type RealtimeTable =
  | 'campaign_members'
  | 'characters'
  | 'character_resources'
  | 'character_conditions'
  | 'session_entities'
  | 'encounters'
  | 'encounter_combatants';

export interface RealtimeBinding {
  table: RealtimeTable;
  /** Filtro do Postgres Changes, ex.: `character_id=eq.<uuid>`. */
  filter?: string;
}

/** `live`: conectado; `connecting`: aguardando; `offline`: desconectado, tentando novamente. */
export type RealtimeStatus = 'connecting' | 'live' | 'offline';

export interface RealtimeSubscriptionOptions {
  /** Chamado (agrupado) quando há mudanças — e sempre que a assinatura fica pronta, para ressincronizar. */
  onChange: () => void;
  onStatus?: (status: RealtimeStatus) => void;
  /** Janela para agrupar rajadas de eventos numa única recarga. */
  debounceMs?: number;
  /** Quanto esperar pela confirmação do Postgres Changes antes de considerar a assinatura pronta. */
  readyTimeoutMs?: number;
}

/** Mensagem de sistema enviada pelo Realtime ao concluir (ou recusar) a assinatura do Postgres. */
interface SystemMessage {
  extension?: string;
  status?: string;
  message?: string;
}

/** Assina as tabelas informadas e devolve a função que encerra a assinatura. */
export function subscribeToChanges(
  client: CodexveilClient,
  channelName: string,
  bindings: readonly RealtimeBinding[],
  options: RealtimeSubscriptionOptions,
): () => void {
  const debounceMs = options.debounceMs ?? 250;
  const readyTimeoutMs = options.readyTimeoutMs ?? 5000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let subscribed = false;
  let postgresReady = false;
  let live = false;
  let disposed = false;

  const schedule = () => {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (!disposed) options.onChange();
    }, debounceMs);
  };

  const clearReadyTimer = () => {
    if (readyTimer) clearTimeout(readyTimer);
    readyTimer = undefined;
  };

  const markLive = () => {
    clearReadyTimer();
    if (disposed || !subscribed || live) return;
    live = true;
    options.onStatus?.('live');
    // Eventos anteriores à assinatura ficar pronta (ou perdidos numa queda) não chegam.
    schedule();
  };

  const markOffline = () => {
    clearReadyTimer();
    postgresReady = false;
    live = false;
    if (!disposed) options.onStatus?.('offline');
  };

  let channel = client.channel(channelName);
  channel = channel.on('system', {}, (payload: SystemMessage | undefined) => {
    if (disposed || payload?.extension !== 'postgres_changes') return;
    if (payload.status === 'ok') {
      postgresReady = true;
      markLive();
    } else {
      console.warn(
        `[codexveil] Realtime recusou a assinatura de "${channelName}"`,
        payload.message,
      );
      markOffline();
    }
  });
  for (const binding of bindings) {
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: binding.table,
        ...(binding.filter ? { filter: binding.filter } : {}),
      },
      schedule,
    );
  }

  options.onStatus?.('connecting');
  channel.subscribe((status) => {
    if (disposed) return;
    if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
      subscribed = true;
      live = false;
      if (postgresReady) {
        markLive();
      } else {
        // Salvaguarda: se a confirmação do Postgres não chegar, considera pronta mesmo assim.
        clearReadyTimer();
        readyTimer = setTimeout(markLive, readyTimeoutMs);
      }
    } else {
      // CHANNEL_ERROR, TIMED_OUT ou CLOSED: o cliente do Supabase tenta reconectar sozinho.
      subscribed = false;
      markOffline();
    }
  });

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    clearReadyTimer();
    void client.removeChannel(channel);
  };
}
