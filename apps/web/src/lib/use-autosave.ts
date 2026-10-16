'use client';

import { Autosaver, type AutosaveState } from '@codexveil/database';
import { useCallback, useEffect, useState } from 'react';

interface UseAutosaveOptions<T> {
  initial: T;
  version: number;
  save: (value: T, expectedVersion: number) => Promise<number>;
  validate?: (value: T) => string | null;
  delayMs?: number;
}

/**
 * Liga o `Autosaver` compartilhado ao estado do React. Ao sair da tela (navegação interna)
 * as alterações pendentes são enviadas; ao fechar a aba com algo não confirmado pelo
 * servidor, o navegador pede confirmação.
 */
export function useAutosave<T>({ initial, version, save, validate, delayMs }: UseAutosaveOptions<T>) {
  const [value, setValue] = useState<T>(initial);
  const [state, setState] = useState<AutosaveState>({
    status: 'saved',
    message: null,
    version,
    lastSavedAt: null,
  });
  const [saver] = useState(
    () => new Autosaver<T>({ initial, version, save, validate, delayMs, onState: setState }),
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (saver.hasUnsavedChanges) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      void saver.flush();
    };
  }, [saver]);

  const update = useCallback(
    (updater: (previous: T) => T) => {
      const next = updater(saver.value);
      setValue(next);
      saver.update(next);
    },
    [saver],
  );

  const reset = useCallback(
    (next: T, nextVersion: number) => {
      saver.reset(next, nextVersion);
      setValue(next);
    },
    [saver],
  );

  return {
    value,
    state,
    update,
    reset,
    retry: useCallback(() => saver.retry(), [saver]),
    flush: useCallback(() => saver.flush(), [saver]),
    overwrite: useCallback((serverVersion: number) => saver.overwrite(serverVersion), [saver]),
    adoptVersion: useCallback((nextVersion: number) => saver.adoptVersion(nextVersion), [saver]),
    hasUnsavedChanges: () => saver.hasUnsavedChanges,
  };
}
