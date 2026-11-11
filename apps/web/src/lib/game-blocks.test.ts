import { describe, expect, it } from 'vitest';
import { gameBlocks } from './game-blocks';

describe('gameBlocks', () => {
  it.each(['dnd5e', 'tormenta20', 'triangle-agency'])('mantém os blocos comuns em %s', (system) => {
    expect(gameBlocks(system, 'player')).toEqual([
      'map',
      'character',
      'initiative',
      'dice',
      'feed',
      'session',
    ]);
  });

  it('reserva ferramentas privadas para o mestre', () => {
    expect(gameBlocks('dnd5e', 'gm')).toContain('gm-tools');
    expect(gameBlocks('dnd5e', 'player')).not.toContain('gm-tools');
  });

  it('inclui cartas e eventos apenas no Assimilação', () => {
    expect(gameBlocks('assimilacao', 'player')).toContain('assimilation-cards');
    expect(gameBlocks('triangle-agency', 'player')).not.toContain('assimilation-cards');
  });
});
