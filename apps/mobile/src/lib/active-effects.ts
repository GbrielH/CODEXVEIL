import { useSyncExternalStore } from 'react';

/**
 * Fúria ligada no jogo, por personagem (0 = desligada; no Tormenta20, o bônus escolhido). Fica em
 * memória enquanto o app está aberto: é estado da cena, não da ficha.
 */
const rage = new Map<string, number>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRage(characterId: string): [number, (value: number) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => rage.get(characterId) ?? 0,
    () => 0,
  );
  return [
    value,
    (next) => {
      rage.set(characterId, next);
      for (const listener of listeners) listener();
    },
  ];
}
