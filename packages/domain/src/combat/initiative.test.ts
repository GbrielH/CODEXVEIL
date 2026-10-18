import { describe, expect, it } from 'vitest';
import { advanceTurn, moveInTurnOrder, orderCombatants, orderTurns, parseTurnEconomy, rewindTurn, startCombat, turnBudget, type Combatant } from './initiative';

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

describe('ordem dos turnos', () => {
  const people = [
    { id: 'a', name: 'Bruna', initiative: 10, tiebreaker: 0, isDefeated: false, sortOrder: 20 },
    { id: 'b', name: 'Aldo', initiative: 18, tiebreaker: 0, isDefeated: false, sortOrder: 30 },
    { id: 'c', name: 'Caio', initiative: 5, tiebreaker: 0, isDefeated: false, sortOrder: 10 },
  ];

  it('segue a iniciativa ou a ordem do mestre', () => {
    expect(orderTurns(people, 'initiative').map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
    expect(orderTurns(people, 'manual').map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
  });

  it('move um participante e renumera a ordem manual', () => {
    const ordered = orderTurns(people, 'manual');
    expect(moveInTurnOrder(ordered, 'b', -1)).toEqual([
      { id: 'c', sortOrder: 10 },
      { id: 'b', sortOrder: 20 },
      { id: 'a', sortOrder: 30 },
    ]);
    expect(moveInTurnOrder(ordered, 'c', -1)).toEqual([]);
  });

  it('lê o que já foi usado no turno', () => {
    expect(parseTurnEconomy({ action: true, reaction: 'sim' })).toEqual({ action: true, bonusAction: false, reaction: false, movement: false });
    expect(parseTurnEconomy(null)).toEqual({ action: false, bonusAction: false, reaction: false, movement: false });
  });
});

describe('orçamento do turno', () => {
  it('conta ações usadas e as extras concedidas', () => {
    expect(turnBudget([])).toEqual({ action: 1, bonus_action: 1, movement: 1, reaction: 1 });
    expect(
      turnBudget([
        { kind: 'action', grantsAction: false },
        { kind: 'free', grantsAction: true },
        { kind: 'bonus_action', grantsAction: false },
      ]),
    ).toEqual({ action: 1, bonus_action: 0, movement: 1, reaction: 1 });
  });
});
