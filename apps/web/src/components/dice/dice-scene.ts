import type DiceBox from '@3d-dice/dice-box-threejs';

/** Quanto tempo os dados de uma rolagem ficam na mesa antes de sumir. */
export const DICE_LIFETIME_MS = 12_000;

/** Partes internas da biblioteca usadas para tirar só os dados de uma rolagem. */
interface DiceBoxInternals {
  diceList: { body?: unknown }[];
  scene: { remove(object: unknown): void };
  world: { removeBody(body: unknown): void };
  renderer: { render(scene: unknown, camera: unknown): void };
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
): Promise<void> {
  const internals = box as unknown as DiceBoxInternals;
  const before = new Set(internals.diceList ?? []);
  await (box as unknown as { add(text: string): Promise<unknown> }).add(notation);
  const mine = (internals.diceList ?? []).filter((die) => !before.has(die));
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
