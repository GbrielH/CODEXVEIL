'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Estado de formulário que sobrevive a recarregar a página: guarda o rascunho no `sessionStorage`
 * da aba até ser salvo. No celular, escolher uma imagem abre a galeria/câmera e o Android pode
 * fechar a aba em segundo plano; sem isso, tudo o que não tinha sido salvo se perdia.
 * Devolve `[valor, alterar, limpar, recuperado]`; `limpar()` apaga o rascunho depois de salvar.
 */
export function useDraftState<T>(key: string, initial: T) {
  const storageKey = `codexveil:rascunho:${key}`;
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const touched = useRef(false);

  // Restaura depois de montar (o servidor não tem o rascunho: evita diferença na hidratação).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.sessionStorage.getItem(storageKey);
        if (saved) {
          setValue(JSON.parse(saved) as T);
          setRestored(true);
        }
      } catch {
        // Rascunho ilegível: segue com o que veio do servidor.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (!touched.current) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Sem armazenamento: o formulário segue funcionando sem rascunho.
    }
  }, [storageKey, value]);

  const update = useCallback((next: T | ((current: T) => T)) => {
    touched.current = true;
    setValue(next);
  }, []);
  const clear = useCallback(() => {
    touched.current = false;
    setRestored(false);
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Nada a limpar.
    }
  }, [storageKey]);

  return [value, update, clear, restored] as const;
}
