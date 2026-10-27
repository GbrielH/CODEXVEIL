import { describe, expect, it } from 'vitest';
import { parseT20CampaignRules, t20CampaignIssues } from './campaign-rules';

const character = (level: number, sourcebooks: string[] = []) => ({
  name: 'Kaya',
  sheet: { identity: { race: 'Kliren', classes: [{ level }], sourcebooks } },
});

describe('Tormenta20 — vincular ficha pronta a uma campanha', () => {
  it('libera quando nível e livros batem com as regras do mestre', () => {
    const rules = parseT20CampaignRules({ startingLevel: 3, sourcebooks: ['t20-jda'] });
    expect(t20CampaignIssues(character(3, ['t20-jda']), rules)).toEqual([]);
  });

  it('aponta nível diferente do inicial e livros não liberados', () => {
    const rules = parseT20CampaignRules({ startingLevel: 3, sourcebooks: [] });
    const issues = t20CampaignIssues(character(1, ['t20-jda']), rules, {
      't20-jda': 'Tormenta20 JdA',
    });
    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain('suba o personagem do 1º para o 3º');
    expect(issues[1]).toContain('Tormenta20 JdA');
  });
});
