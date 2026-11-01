import { describe, expect, it } from 'vitest';
import { parseT20StatBlock, t20ThreatLevel, t20ThreatSkillLine } from './stat-block';

describe('perícias da ameaça (T20)', () => {
  it('usa o ND como nível e soma metade do nível, atributo e treinamento', () => {
    expect(t20ThreatLevel('1/4')).toBe(1);
    expect(t20ThreatLevel('11')).toBe(11);
    const stats = parseT20StatBlock({ challenge: '11', attributes: { con: 3, des: 6, sab: 2 } });
    // ND 11: metade 5, treinamento +4.
    expect(t20ThreatSkillLine(stats, ['fortitude', 'reflexos', 'vontade'], ['reflexos'])).toBe(
      'Fortitude +8, Reflexos +15, Vontade +7',
    );
  });
});
