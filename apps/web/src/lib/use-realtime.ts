'use client';

import { subscribeToChanges, type RealtimeBinding, type RealtimeStatus } from '@codexveil/database';
import { useEffect, useEffectEvent, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Recarrega dados quando o banco avisa que algo mudou (Supabase Realtime) e também quando
 * a janela volta ao foco ou a conexão volta — assim a tela se recupera de quedas.
 * Devolve o estado da conexão para a interface informar "ao vivo" ou "reconectando".
 */
export function useRealtimeRefresh(
  channelName: string,
  bindings: readonly RealtimeBinding[],
  onChange: () => void,
  enabled = true,
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const handleChange = useEffectEvent(onChange);
  const bindingsKey = JSON.stringify(bindings);

  useEffect(() => {
    if (!enabled) return;
    const parsed = JSON.parse(bindingsKey) as RealtimeBinding[];
    const unsubscribe = subscribeToChanges(getSupabaseBrowserClient(), channelName, parsed, {
      onChange: () => handleChange(),
      onStatus: setStatus,
    });

    const resync = () => handleChange();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resync();
    };
    window.addEventListener('online', resync);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      window.removeEventListener('online', resync);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [channelName, bindingsKey, enabled]);

  return enabled ? status : 'offline';
}
