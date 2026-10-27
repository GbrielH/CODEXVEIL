import { describe, expect, it } from 'vitest';
import { buildT20Content } from './content';
import { applyT20Grant, applyT20ItemGrant, listT20Grants, listT20ItemGrants } from './grants';
import { parseT20Sheet } from './sheet';

const spell = (key: string, name: string, circle: number, type = 'arcana') => ({
  kind: 'spell',
  key,
  name,
  data: { type, circle, school: 'Ilusão', text: 'Efeito.' },
});

const content = buildT20Content([
  {
    book: { id: 't20', name: 'Tormenta20' },
    entries: [
      spell('luz', 'Luz', 1, 'universal'),
      spell('sono', 'Sono', 1),
      spell('criar-ilusao', 'Criar Ilusão', 1),
      spell('enfeiticar', 'Enfeitiçar', 1),
      spell('bola-de-fogo', 'Bola de Fogo', 2),
      spell('curar', 'Curar Ferimentos', 1, 'divina'),
      { kind: 'equipment', key: 'bomba', name: 'Bomba', data: { group: 'item', category: 'Alquímicos — Preparados', price: 'T$ 50', text: 'Explode.' } },
      { kind: 'equipment', key: 'acido', name: 'Ácido', data: { group: 'item', category: 'Alquímicos — Preparados', price: 'T$ 10', text: 'Corrói.' } },
      { kind: 'equipment', key: 'espada', name: 'Espada longa', data: { group: 'arma', category: 'marciais', price: 'T$ 15', text: '' } },
      { kind: 'equipment', key: 'certeira', name: 'Certeira', data: { group: 'melhoria', category: 'armas', price: 'T$ 300', text: '+1 no ataque.' } },
      { kind: 'feat', key: 'esquiva', name: 'Esquiva', data: { group: 'combate', text: '+2 na Defesa.' } },
      { kind: 'feat', key: 'furia-divina', name: 'Fúria Divina', data: { group: 'concedidos', text: '…' } },
    ],
  },
]);

describe('escolhas concedidas (T20)', () => {
  it('Centelha Mágica pede uma magia de 1º círculo; depois de escolher, some', () => {
    const sheet = parseT20Sheet({ powers: [{ key: 'centelha', name: 'Centelha Mágica', source: 'Poder geral' }] });
    const [grant] = listT20Grants(content, sheet);
    expect(grant?.kind).toBe('spell');
    expect(grant?.missing).toBe(1);
    expect(grant?.options.map((option) => option.name)).not.toContain('Bola de Fogo');
    expect(grant?.options.map((option) => option.name)).toContain('Curar Ferimentos');

    const sono = grant!.options.find((option) => option.name === 'Sono')!;
    const applied = applyT20Grant(sheet, grant!, [sono.id]);
    if ('error' in applied) throw new Error(applied.error);
    expect(applied.sheet.spells.known).toEqual([{ key: sono.id, name: 'Sono', source: 'Centelha Mágica', circle: 1, type: 'arcana' }]);
    expect(applied.abilities[0]).toMatchObject({ kind: 'spell', name: 'Sono', source: 'Centelha Mágica' });
    expect(listT20Grants(content, applied.sheet)).toEqual([]);
  });

  it('Sílfide escolhe duas da lista; Suraggel aggelus aprende Luz; golem escolhe um poder geral', () => {
    const silfide = listT20Grants(content, parseT20Sheet({ identity: { race: 'Sílfide' } }));
    expect(silfide[0]?.missing).toBe(2);
    expect(silfide[0]?.options.map((option) => option.name)).toEqual(['Criar Ilusão', 'Enfeitiçar', 'Luz', 'Sono']);

    const aggelus = listT20Grants(content, parseT20Sheet({ identity: { race: 'Suraggel', raceVariant: 'aggelus' } }));
    expect(aggelus[0]?.options.map((option) => option.name)).toEqual(['Luz']);

    const golem = listT20Grants(content, parseT20Sheet({ identity: { race: 'Golem' } }));
    expect(golem[0]).toMatchObject({ kind: 'power', missing: 1 });
    expect(golem[0]?.options.map((option) => option.name)).toEqual(['Esquiva']);
  });

  it('exige a quantidade certa', () => {
    const sheet = parseT20Sheet({ identity: { race: 'Sílfide' } });
    const [grant] = listT20Grants(content, sheet);
    expect(applyT20Grant(sheet, grant!, [grant!.options[0]!.id])).toEqual({ error: 'Escolha 2.' });
  });

  it('Protótipo: depois da escolha, pede os itens e para quando eles estão no inventário', () => {
    expect(listT20ItemGrants(content, ['Protótipo'], [])).toEqual([]);
    const [alchemy] = listT20ItemGrants(content, ['Protótipo (10 itens alquímicos)'], []);
    expect(alchemy?.options.map((item) => item.name)).toEqual(['Ácido', 'Bomba']);
    const bomba = alchemy!.options.find((item) => item.name === 'Bomba')!.id;
    const acido = alchemy!.options.find((item) => item.name === 'Ácido')!.id;
    expect(applyT20ItemGrant(alchemy!, { quantities: { [bomba]: 3 } })).toEqual({ error: 'Escolha 10 itens (agora: 3).' });
    const ok = applyT20ItemGrant(alchemy!, { quantities: { [bomba]: 5, [acido]: 5 } });
    expect('items' in ok && ok.items.map((item) => [item.name, item.quantity, item.notes])).toEqual([
      ['Bomba', 5, 'Protótipo'],
      ['Ácido', 5, 'Protótipo'],
    ]);
    expect(listT20ItemGrants(content, ['Protótipo (10 itens alquímicos)'], ['Protótipo'])).toEqual([]);

    const [superior] = listT20ItemGrants(content, ['Protótipo (Item superior)'], []);
    const made = applyT20ItemGrant(superior!, { baseId: superior!.options[0]!.id, upgradeId: superior!.upgrades[0]!.id });
    expect('items' in made && made.items[0]?.name).toBe('Espada longa superior (Certeira)');
  });
});
