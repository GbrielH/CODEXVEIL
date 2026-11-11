export type GameBlock =
  | 'map'
  | 'character'
  | 'initiative'
  | 'dice'
  | 'feed'
  | 'session'
  | 'gm-tools'
  | 'assimilation-cards';

/** Blocos da central, sem inventar substitutos para recursos que um sistema não possui. */
export function gameBlocks(systemId: string, role: 'gm' | 'player'): GameBlock[] {
  const common: GameBlock[] = ['map', 'initiative', 'dice', 'feed', 'session'];
  if (role === 'player') common.splice(1, 0, 'character');
  if (role === 'gm') common.push('gm-tools');
  if (systemId === 'assimilacao') common.push('assimilation-cards');
  return common;
}
