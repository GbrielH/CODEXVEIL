'use client';

import { useEffect, useState } from 'react';
import { failureMessage } from '@/lib/client-errors';

interface AsyncState<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Carrega dados no navegador com estados explícitos de carregamento (`data === null`),
 * erro e nova tentativa. Respostas antigas são descartadas quando a chave muda.
 */
export function useAsyncData<T>(load: () => Promise<T>, errorMessage: string, key: string) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${key}#${attempt}`;
  const [state, setState] = useState<AsyncState<T>>({ key: requestKey, data: null, error: null });

  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (active) setState({ key: requestKey, data, error: null });
      },
      (cause: unknown) => {
        if (active) setState({ key: requestKey, data: null, error: failureMessage(cause, errorMessage) });
      },
    );
    return () => {
      active = false;
    };
    // `load` muda a cada renderização; a chave identifica quando recarregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const current = state.key === requestKey;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    reload: () => setAttempt((value) => value + 1),
  };
}
