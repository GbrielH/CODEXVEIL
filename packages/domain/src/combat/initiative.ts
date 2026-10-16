/**
 * Ordem de iniciativa e controle de turnos de um encontro.
 * Regras genéricas: cada sistema define como a iniciativa é rolada; aqui só ordenamos
 * e avançamos turnos.
 */

export interface Combatant {
  id: string;
  name: string;
  /** `null` enquanto a iniciativa não foi informada. */
  initiative: number | null;
  /** Critério de desempate (ex.: modificador de Destreza); maior vence. */
  tiebreaker: number;
  isDefeated: boolean;
}

export interface TurnState {
  round: number;
  activeCombatantId: string | null;
}

/** Ordena por iniciativa (maior primeiro, sem iniciativa ao final), desempate e nome. */
export function orderCombatants<T extends Combatant>(combatants: readonly T[]): T[] {
  return [...combatants].sort((a, b) => {
    if (a.initiative === null && b.initiative !== null) return 1;
    if (b.initiative === null && a.initiative !== null) return -1;
    const byInitiative = (b.initiative ?? 0) - (a.initiative ?? 0);
    if (byInitiative !== 0) return byInitiative;
    const byTiebreaker = b.tiebreaker - a.tiebreaker;
    if (byTiebreaker !== 0) return byTiebreaker;
    return a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);
  });
}

function firstActive(ordered: readonly Combatant[]): Combatant | undefined {
  return ordered.find((combatant) => !combatant.isDefeated);
}

/** Inicia o combate na rodada 1 com o primeiro combatente ativo. */
export function startCombat(ordered: readonly Combatant[]): TurnState {
  return { round: 1, activeCombatantId: firstActive(ordered)?.id ?? null };
}

/** Passa para o próximo combatente ativo; ao fechar a volta, inicia nova rodada. */
export function advanceTurn(ordered: readonly Combatant[], state: TurnState): TurnState {
  const active = ordered.filter((combatant) => !combatant.isDefeated);
  if (active.length === 0) return { ...state, activeCombatantId: null };

  const currentIndex = ordered.findIndex((c) => c.id === state.activeCombatantId);
  for (let step = 1; step <= ordered.length; step++) {
    const index = (currentIndex + step) % ordered.length;
    const candidate = ordered[index];
    if (candidate && !candidate.isDefeated) {
      const wrapped = currentIndex === -1 || index <= currentIndex;
      return {
        round: wrapped && currentIndex !== -1 ? state.round + 1 : Math.max(state.round, 1),
        activeCombatantId: candidate.id,
      };
    }
  }
  return state;
}

/** Volta ao combatente ativo anterior; ao passar do primeiro, retorna à rodada anterior. */
export function rewindTurn(ordered: readonly Combatant[], state: TurnState): TurnState {
  const currentIndex = ordered.findIndex((c) => c.id === state.activeCombatantId);
  if (currentIndex === -1) return state;
  for (let step = 1; step <= ordered.length; step++) {
    const index = (currentIndex - step + ordered.length) % ordered.length;
    const candidate = ordered[index];
    if (candidate && !candidate.isDefeated) {
      const wrapped = index >= currentIndex;
      if (wrapped && state.round <= 1) return state;
      return { round: wrapped ? state.round - 1 : state.round, activeCombatantId: candidate.id };
    }
  }
  return state;
}
