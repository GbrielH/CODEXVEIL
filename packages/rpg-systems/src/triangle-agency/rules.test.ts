import { describe, expect, it } from 'vitest';
import { createDefaultTriangleAgencySheet } from './sheet';
import {
  conflictWinner,
  creationIssues,
  qualityBurnout,
  rechargeQualityAssurances,
  resolveTriangleRoll,
  spendQualityAssurances,
} from './rules';

describe('Triangle Agency', () => {
  it('resolve sucesso, Caos e Triscendência com 6d4', () => {
    expect(resolveTriangleRoll([3, 3, 3, 1, 2, 4])).toMatchObject({
      success: true,
      transcendence: true,
      stability: true,
      chaos: 0,
    });
    expect(resolveTriangleRoll([3, 1, 2, 4, 1, 2])).toMatchObject({
      success: true,
      chaos: 5,
    });
    expect(resolveTriangleRoll([1, 1, 2, 2, 4, 4], 0, 2)).toMatchObject({
      success: false,
      chaos: 8,
    });
  });

  it('aplica GQs antes do Burnout e preserva a Estabilidade em três 3s finais', () => {
    expect(resolveTriangleRoll([3, 3, 1, 1, 2, 4], 2, 1)).toMatchObject({
      adjustedThrees: 4,
      finalThrees: 3,
      stability: true,
      chaos: 0,
    });
  });

  it('gasta, detecta Burnout e recarrega Garantias de Qualidade', () => {
    const base = createDefaultTriangleAgencySheet();
    base.qualityAssurances.maximum.atencao = 3;
    base.qualityAssurances.current.atencao = 2;
    const spent = spendQualityAssurances(base, 'atencao', 9);
    expect(spent.spent).toBe(2);
    expect(qualityBurnout(spent.sheet, 'atencao')).toBe(1);
    expect(rechargeQualityAssurances(spent.sheet).qualityAssurances.current.atencao).toBe(3);
  });

  it('encerra conflito somente com 6+ e liderança isolada', () => {
    expect(conflictWinner([6, 5])).toBe(0);
    expect(conflictWinner([6, 6])).toBeNull();
    expect(conflictWinner([5, 2])).toBeNull();
  });

  it('valida o ARC e as 9 GQs de integração sem impor regras de outro sistema', () => {
    const sheet = createDefaultTriangleAgencySheet();
    expect(creationIssues(sheet)).toContain('Selecione a Anomalia.');
    sheet.arc = { anomaly: 'Sussurro', reality: 'Cuidador', competency: 'RP', competencyTitle: '' };
    sheet.anomalousAbilities = [
      { name: 'A', quality: 'atencao', notes: '' },
      { name: 'B', quality: 'empatia', notes: '' },
      { name: 'C', quality: 'presenca', notes: '' },
    ];
    sheet.relationships = ['A', 'B', 'C'].map((name) => ({
      name,
      description: '',
      connection: 0,
      bonus: '',
    }));
    sheet.qualityAssurances.maximum.atencao = 3;
    sheet.qualityAssurances.maximum.empatia = 3;
    sheet.qualityAssurances.maximum.presenca = 3;
    expect(creationIssues(sheet)).toEqual([]);
  });
});
