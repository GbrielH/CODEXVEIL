/**
 * Hooks de dados do app: carregamento com estados explícitos, autosave e tempo real.
 * A lógica (salvamento com versão, assinaturas) é a mesma da web, vinda de
 * @codexveil/database; aqui só a ligamos ao React Native.
 */
import {
  Autosaver,
  subscribeToChanges,
  type AutosaveState,
  type RealtimeBinding,
  type RealtimeStatus,
} from '@codexveil/database';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { AppState } from 'react-native';
import { failureMessage } from './errors';
import { getSupabase } from './supabase';

interface AsyncState<T> {
  /** Chave da última resposta recebida (`null` antes da primeira). */
  settledKey: string | null;
  baseKey: string | null;
  data: T | null;
  error: string | null;
}

/** Carrega dados com estados de carregamento, erro e atualização (puxar para recarregar). */
export function useAsyncData<T>(load: () => Promise<T>, key: string) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${key}#${attempt}`;
  const [state, setState] = useState<AsyncState<T>>({ settledKey: null, baseKey: null, data: null, error: null });
  const run = useEffectEvent(load);

  useEffect(() => {
    let active = true;
    run().then(
      (data) => {
        if (active) setState({ settledKey: requestKey, baseKey: key, data, error: null });
      },
      (cause: unknown) => {
        if (active) {
          setState((current) => ({
            settledKey: requestKey,
            baseKey: key,
            data: current.baseKey === key ? current.data : null,
            error: failureMessage(cause),
          }));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [requestKey, key]);

  const settled = state.settledKey === requestKey;
  const data = state.baseKey === key ? state.data : null;
  return {
    data,
    error: settled ? state.error : null,
    loading: !settled && data === null,
    refreshing: !settled && data !== null,
    reload: useCallback(() => setAttempt((value) => value + 1), []),
    /** Atualiza os dados localmente após uma alteração confirmada pelo servidor. */
    mutate: (update: (current: T) => T) =>
      setState((current) => (current.data === null ? current : { ...current, data: update(current.data) })),
  };
}

export function useAutosave<T>(options: {
  initial: T;
  version: number;
  save: (value: T, expectedVersion: number) => Promise<number>;
  validate?: (value: T) => string | null;
}) {
  const [value, setValue] = useState<T>(options.initial);
  const [state, setState] = useState<AutosaveState>({ status: 'saved', message: null, version: options.version, lastSavedAt: null });
  const [saver] = useState(
    () =>
      new Autosaver<T>({
        initial: options.initial,
        version: options.version,
        save: options.save,
        validate: options.validate,
        onState: setState,
      }),
  );

  // Ao sair da tela ou mandar o app para segundo plano, envia o que estiver pendente.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void saver.flush();
    });
    return () => {
      subscription.remove();
      void saver.flush();
    };
  }, [saver]);

  return {
    value,
    state,
    update: (updater: (previous: T) => T) => {
      const next = updater(saver.value);
      setValue(next);
      saver.update(next);
    },
    reset: (next: T, version: number) => {
      saver.reset(next, version);
      setValue(next);
    },
    retry: () => saver.retry(),
    overwrite: (version: number) => saver.overwrite(version),
    hasUnsavedChanges: () => saver.hasUnsavedChanges,
  };
}

export function useRealtimeRefresh(channelName: string, bindings: readonly RealtimeBinding[], onChange: () => void): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const handle = useEffectEvent(onChange);
  const bindingsKey = JSON.stringify(bindings);

  useEffect(() => {
    const parsed = JSON.parse(bindingsKey) as RealtimeBinding[];
    const unsubscribe = subscribeToChanges(getSupabase(), channelName, parsed, { onChange: () => handle(), onStatus: setStatus });
    // Ao voltar para o app, recarrega: eventos podem ter sido perdidos em segundo plano.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') handle();
    });
    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, [channelName, bindingsKey]);

  return status;
}
