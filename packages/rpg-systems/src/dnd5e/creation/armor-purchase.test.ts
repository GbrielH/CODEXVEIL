import { describe, expect, it } from 'vitest';
import {
  armorPurchases,
  listDnd5eChoices,
  validateDnd5eDraft,
  PERSONAL_SHEET_CONTEXT,
} from './choices';
import { startingEquipment } from './build';
import { createDnd5eDraft } from './draft';

describe('compra de armadura com o ouro inicial (regra oficial)', () => {
  const paladin = (selections: Record<string, string>) =>
    createDnd5eDraft({ classId: 'paladin', selections: { 'equipment.class': 'B', ...selections } });

  it('com o pacote de ouro, oferece só armaduras com treino e desconta o preço', () => {
    const draft = paladin({
      'equipment.buy_armor': 'chain_mail',
      'equipment.buy_shield': 'shield',
    });
    const armorSpec = listDnd5eChoices(draft).find((spec) => spec.id === 'equipment.buy_armor');
    expect(armorSpec?.kind).toBe('option');
    const ids =
      armorSpec && armorSpec.kind === 'option' ? armorSpec.options.map((option) => option.id) : [];
    expect(ids).toEqual(expect.arrayContaining(['none', 'chain_mail', 'plate', 'leather']));
    expect(armorPurchases(draft)).toEqual({ ids: ['chain_mail', 'shield'], cost: 85 });
    const equipment = startingEquipment(draft);
    expect(equipment.gold).toBe(150 - 85);
    expect(equipment.items.map((item) => item.catalogId)).toEqual(
      expect.arrayContaining(['chain_mail', 'shield']),
    );
  });

  it('não deixa comprar o que o ouro não paga', () => {
    const draft = paladin({ 'equipment.buy_armor': 'plate', 'equipment.buy_shield': 'none' });
    const issues = validateDnd5eDraft(draft, PERSONAL_SHEET_CONTEXT).filter(
      (issue) => issue.path === 'equipment.buy_armor',
    );
    expect(issues[0]?.message).toMatch(/1500 PO/);
  });

  it('com o pacote que já traz armadura, não aparece a compra', () => {
    const draft = createDnd5eDraft({ classId: 'paladin', selections: { 'equipment.class': 'A' } });
    expect(listDnd5eChoices(draft).some((spec) => spec.id === 'equipment.buy_armor')).toBe(false);
  });
});
