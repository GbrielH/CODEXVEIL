import { describe, expect, it } from 'vitest';
import { advanceTurn, orderCombatants, rewindTurn, startCombat, type Combatant } from './initiative';

const make = (id: string, initiative: number | null, tiebreaker = 0, isDefeated = false) =>
  ({ id, name: id, initiative, tiebreaker, isDefeated }) satisfies Combatant;

describe('ordem de iniciativa', () => {
  it('ordena por iniciativa, desempate e nome; sem iniciativa vai para o fim', () => {
    const ordered = orderCombatants([
      make('Goblin', 12, 2),
      make('Aria', 18),
      make('Borin', null),
      make('Lobo', 12, 3),
    ]);
    expect(ordered.map((c) => c.id)).toEqual(['Aria', 'Lobo', 'Goblin', 'Borin']);
  });
});

describe('controle de turnos', () => {
  const ordered = [make('A', 20), make('B', 15), make('C', 10)];

  it('inicia na rodada 1 com o primeiro combatente', () => {
    expect(startCombat(ordered)).toEqual({ round: 1, activeCombatantId: 'A' });
  });

  it('avança turnos e inicia nova rodada ao fechar a volta', () => {
    let state = startCombat(ordered);
    state = advanceTurn(ordered, state);
    expect(state).toEqual({ round: 1, activeCombatantId: 'B' });
    state = advanceTurn(ordered, advanceTurn(ordered, state));
    expect(state).toEqual({ round: 2, activeCombatantId: 'A' });
  });

  it('pula combatentes derrotados', () => {
    const withDefeated = [make('A', 20), make('B', 15, 0, true), make('C', 10)];
    expect(advanceTurn(withDefeated, { round: 1, activeCombatantId: 'A' })).toEqual({
      round: 1,
      activeCombatantId: 'C',
    });
  });

  it('volta turnos sem passar da primeira rodada', () => {
    expect(rewindTurn(ordered, { round: 2, activeCombatantId: 'A' })).toEqual({
      round: 1,
      activeCombatantId: 'C',
    });
    expect(rewindTurn(ordered, { round: 1, activeCombatantId: 'A' })).toEqual({
      round: 1,
      activeCombatantId: 'A',
    });
  });

  it('sem combatentes ativos não há turno', () => {
    const allDown = [make('A', 20, 0, true)];
    expect(advanceTurn(allDown, { round: 3, activeCombatantId: 'A' }).activeCombatantId).toBeNull();
  });
});
