import type DiceBox from '@3d-dice/dice-box-threejs';
import type { DiceAura } from '@codexveil/validation';
import { criticalAuraBurst, diceScreenPositions, startDiceAura } from './aura-fx';

/** Quanto tempo os dados de uma rolagem ficam na mesa antes de sumir. */
export const DICE_LIFETIME_MS = 12_000;

/**
 * Limite para esperar os dados pararem: um dado apoiado na borda ou a aba em segundo plano
 * (animação pausada) deixariam a rolagem presa em "Rolando…" para sempre.
 */
const SETTLE_TIMEOUT_MS = 6_000;

/** Partes internas da biblioteca usadas para tirar só os dados de uma rolagem. */
interface DiceBoxInternals {
  diceList: { body?: unknown }[];
  scene: { remove(object: unknown): void };
  world: { removeBody(body: unknown): void };
  renderer: { render(scene: unknown, camera: unknown): void; domElement?: HTMLCanvasElement };
  camera: unknown;
}

/**
 * Joga os dados sem apagar os que já estão na mesa (a rolagem de outra pessoa não some com a
 * sua) e, depois de `lifetimeMs`, tira só os dados desta rolagem.
 */
export async function throwDice(
  box: DiceBox,
  notation: string,
  lifetimeMs = DICE_LIFETIME_MS,
  options: { aura?: DiceAura | null; critical?: boolean } = {},
): Promise<void> {
  const internals = box as unknown as DiceBoxInternals;
  const before = new Set(internals.diceList ?? []);
  // Aura (contas de criador): partículas saindo dos dados desta rolagem enquanto rolam.
  const host = internals.renderer?.domElement?.parentElement ?? null;
  const stopAura =
    options.aura && host
      ? startDiceAura(host, options.aura, () =>
          diceScreenPositions(
            box,
            (internals.diceList ?? []).filter((die) => !before.has(die)),
          ),
        )
      : null;
  let timer = 0;
  await Promise.race([
    (box as unknown as { add(text: string): Promise<unknown> }).add(notation),
    new Promise((resolve) => {
      timer = window.setTimeout(resolve, SETTLE_TIMEOUT_MS);
    }),
  ]).finally(() => window.clearTimeout(timer));
  const mine = (internals.diceList ?? []).filter((die) => !before.has(die));
  if (stopAura) window.setTimeout(stopAura, 1_500);
  if (options.aura && options.critical) criticalAuraBurst(options.aura);
  window.setTimeout(() => {
    for (const die of mine) {
      const index = internals.diceList.indexOf(die);
      if (index < 0) continue;
      internals.diceList.splice(index, 1);
      internals.scene.remove(die);
      if (die.body) internals.world.removeBody(die.body);
    }
    internals.renderer.render(internals.scene, internals.camera);
  }, lifetimeMs);
}

/** A mesa grande avisa quando os dados de uma rolagem param (o "Crítico!" espera por ela). */
export const TABLE_SETTLED_EVENT = 'codexveil:dados-mesa-parados';
