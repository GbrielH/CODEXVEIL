/**
 * Assinaturas do Supabase Realtime (Postgres Changes), compartilhadas por web e mobile.
 *
 * Os eventos são usados apenas como SINAL para recarregar dados pelas consultas normais:
 * o Realtime aplica o RLS a cada assinante, mas eventos de DELETE trazem só a chave e
 * recarregar garante que a tela mostre exatamente o que o banco permite ver.
 *
 * Somente as tabelas publicadas na migração de Realtime geram eventos.
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
  /** Chamado (agrupado) quando há mudanças — e após reconectar, para ressincronizar. */
  onChange: () => void;
  onStatus?: (status: RealtimeStatus) => void;
  /** Janela para agrupar rajadas de eventos numa única recarga. */
  debounceMs?: number;
}

/** Assina as tabelas informadas e devolve a função que encerra a assinatura. */
export function subscribeToChanges(
  client: CodexveilClient,
  channelName: string,
  bindings: readonly RealtimeBinding[],
  options: RealtimeSubscriptionOptions,
): () => void {
  const debounceMs = options.debounceMs ?? 250;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let wasLive = false;
  let disposed = false;

  const schedule = () => {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (!disposed) options.onChange();
    }, debounceMs);
  };

  let channel = client.channel(channelName);
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
      options.onStatus?.('live');
      // Após uma queda, eventos podem ter sido perdidos: recarrega tudo.
      if (wasLive) schedule();
      wasLive = true;
    } else {
      // CHANNEL_ERROR, TIMED_OUT ou CLOSED: o cliente do Supabase tenta reconectar sozinho.
      options.onStatus?.('offline');
    }
  });

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    void client.removeChannel(channel);
  };
}
