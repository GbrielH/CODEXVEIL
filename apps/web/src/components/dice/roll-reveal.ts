'use client';

/**
 * Segura a revelação do resultado até os dados 3D pararem: o mural e o cartão "última rolagem"
 * só mostram o número depois que a caixinha (ou a mesa grande) termina a animação.
 *
 *   * `expectRoll`: o mural viu uma rolagem nova; esconde por até 2 s esperando a caixinha pegá-la.
 *   * `rollingRoll`: a caixinha começou a animar; esconde por até 9 s.
 *   * `revealRoll`: os dados pararam; libera.
 */
import { useSyncExternalStore } from 'react';

const hidden = new Map<string, number>();
const revealed = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

function hold(key: string, ms: number) {
  if (revealed.has(key)) return;
  window.clearTimeout(hidden.get(key));
  hidden.set(
    key,
    window.setTimeout(() => revealRoll(key), ms),
  );
  emit();
}

/** Há dados 3D na página (a caixinha marca o documento)? Sem eles, nada é segurado. */
function diceOnPage(): boolean {
  const page = document.documentElement.dataset;
  return page.diceTray === 'on' || page.diceTable === 'on';
}

export function expectRoll(key: string) {
  if (!diceOnPage() || hidden.has(key)) return;
  hold(key, 2_000);
}

export function rollingRoll(key: string) {
  hold(key, 9_000);
}

export function revealRoll(key: string) {
  window.clearTimeout(hidden.get(key));
  const changed = hidden.delete(key);
  revealed.add(key);
  if (changed) emit();
}

/** Espera os dados desta rolagem pararem (ou desiste em 9 s). */
export function waitRevealed(key: string): Promise<void> {
  if (revealed.has(key) || !diceOnPage()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(done, 9_000);
    function done() {
      window.clearTimeout(timer);
      listeners.delete(check);
      resolve();
    }
    function check() {
      if (revealed.has(key)) done();
    }
    listeners.add(check);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Versão do estado (muda a cada rolagem segurada ou liberada) e a consulta de quem está oculto. */
export function useHiddenRolls(): (key: string) => boolean {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return (key: string) => hidden.has(key);
}
