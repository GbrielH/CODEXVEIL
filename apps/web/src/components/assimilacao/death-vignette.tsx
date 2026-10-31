'use client';

import { Skull } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const subscribeNothing = () => () => undefined;

/**
 * Personagem com Saúde zerada: bordas da tela em vinheta vermelha pulsando e um selo "Morte".
 * Vai para o `body` (o conteúdo da página tem transformações que prenderiam o `fixed`).
 */
export function DeathVignette() {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[80]">
      <div className="absolute inset-0 animate-pulse shadow-[inset_0_0_120px_40px_rgb(160_20_30/0.55)] motion-reduce:animate-none" />
      <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ember-900/90 px-4 py-1.5 font-display text-sm text-ember-300 ring-1 ring-ember-400/60">
        <Skull className="h-4 w-4" />
        Morte
      </div>
    </div>,
    document.body,
  );
}

/** Aviso dentro do cartão de Saúde. */
export function DeathNotice() {
  return (
    <div
      role="alert"
      className="mb-3 flex items-center gap-3 rounded-lg bg-ember-900/70 p-3 ring-1 ring-ember-400/60"
    >
      <Skull className="h-6 w-6 shrink-0 text-ember-300" aria-hidden="true" />
      <div>
        <p className="font-display text-lg text-ember-300">Você morreu</p>
        <p className="text-xs text-fg-secondary">
          A Saúde chegou a zero. Converse com o mestre sobre o destino do personagem.
        </p>
      </div>
    </div>
  );
}
