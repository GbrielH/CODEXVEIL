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
 *
 * O canal entra com o token que o cliente do Realtime tiver naquele instante. No navegador e no
 * app a sessão é carregada de forma assíncrona (cookies ou armazenamento do aparelho); se a tela
 * assinar antes disso, o Realtime cria as assinaturas com o papel anônimo, que não lê as tabelas,
 * e recusa todas ("invalid column for filter"). Por isso o token do usuário é buscado
 * (`realtime.setAuth()`) antes de entrar no canal. Visto no navegador em 2026-10-17: a ficha
 * ficava "reconectando" para sempre.
 *
 * Cada assinatura também usa um tópico próprio: o supabase-js devolve o canal existente quando
 * o tópico se repete, e a remoção é assíncrona. Ao remontar a tela (React StrictMode em
 * desenvolvimento, ou sair e voltar rápido), a assinatura nova cairia no canal sendo encerrado.
 */
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import type { CodexveilClient } from './client';

let topicSequence = 0;

export type RealtimeTable =
  | 'campaign_members'
  | 'characters'
  | 'character_resources'
  | 'character_conditions'
  | 'session_entities'
  | 'encounters'
  | 'encounter_combatants'
  | 'dice_rolls'
  | 'campaign_turns'
  | 'turn_actions';

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

  topicSequence += 1;
  let channel = client.channel(`${channelName}:${topicSequence}`);
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
  void (async () => {
    try {
      await client.realtime.setAuth();
    } catch {
      // Sem um token novo, entra com o que o cliente tiver; uma recusa aparece como `offline`.
    }
    if (disposed) return;
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
  })();

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    clearReadyTimer();
    void client.removeChannel(channel);
  };
}
