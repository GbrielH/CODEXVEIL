import { describe, expect, it } from 'vitest';
import { buildT20Content } from './content';
import { t20MissingOriginItems, t20OriginItemSlots } from './origin-items';

const weapon = (
  key: string,
  name: string,
  category: string,
  attack: 'corpo' | 'distancia',
  price = 'T$ 10',
) => ({
  kind: 'equipment',
  key,
  name,
  data: {
    group: 'arma',
    category,
    price,
    spaces: '1',
    damage: '1d6',
    critical: 'x2',
    range: attack === 'distancia' ? 'Médio' : '—',
    damageType: 'Corte',
    attack,
  },
});
const gear = (key: string, name: string, price = 'T$ 5') => ({
  kind: 'equipment',
  key,
  name,
  data: { group: 'item', category: 'Equipamento de Aventura', price, spaces: '1', text: '' },
});

const content = buildT20Content([
  {
    book: { id: 't20', name: 'Tormenta20' },
    entries: [
      weapon('adaga', 'Adaga', 'simples', 'corpo', 'T$ 2'),
      weapon('arco-curto', 'Arco curto', 'simples', 'distancia', 'T$ 30'),
      weapon('espada-longa', 'Espada longa', 'marciais', 'corpo', 'T$ 15'),
      weapon('flechas', 'Flechas (20)', 'simples', 'distancia', 'T$ 1'),
      gear('gazua', 'Gazua'),
      gear('estojo', 'Estojo de disfarces', 'T$ 50'),
      gear('barraca', 'Barraca', 'T$ 10'),
    ],
  },
]);

const slots = (items: string) => t20OriginItemSlots(content, { items });

describe('Tormenta20 — itens da origem na criação', () => {
  it('itens fixos entram com o catálogo; quantidades e observações são lidas', () => {
    const result = slots(
      'Barraca, 20 flechas, uma ferramenta pesada (mesmas estatísticas de uma maça).',
    );
    expect(result.map((slot) => slot.kind)).toEqual(['fixed', 'fixed', 'fixed']);
    expect(result[0]).toMatchObject({ name: 'Barraca', quantity: 1 });
    expect(result[1]).toMatchObject({ name: 'Flechas', quantity: 20 });
    expect(result[2]).toMatchObject({
      name: 'Ferramenta pesada',
      note: 'mesmas estatísticas de uma maça',
    });
  });

  it('"X ou Y" e armas por categoria viram escolha (sem munição)', () => {
    const [disguise] = slots('Estojo de disfarces ou gazua.');
    expect(disguise).toMatchObject({ kind: 'choice' });
    expect(disguise?.kind === 'choice' && disguise.options.map((option) => option.name)).toEqual([
      'Estojo de disfarces',
      'Gazua',
    ]);
    const [ranged] = slots('Uma arma simples ou marcial de ataque à distância.');
    expect(ranged?.kind === 'choice' && ranged.options.map((option) => option.name)).toEqual([
      'Arco curto',
    ]);
  });

  it('"de até T$ N" usa o catálogo até o preço e aceita texto livre; mestre e ofício pedem texto', () => {
    const [upTo] = slots('Um item estrangeiro de até T$ 10.');
    expect(upTo?.kind === 'choice' && upTo.allowFree).toBe(true);
    expect(
      upTo?.kind === 'choice' && upTo.options.every((option) => !option.name.startsWith('Arco')),
    ).toBe(true);
    expect(slots('Um ou mais itens (somando até T$ 500), aprovados pelo mestre.')).toMatchObject([
      { kind: 'free', optional: true },
    ]);
    const [craft] = slots('Instrumentos de ofício (qualquer).');
    expect(craft).toMatchObject({
      kind: 'free',
      template: 'Instrumentos de ofício ({})',
      optional: false,
    });
  });

  it('só a primeira frase lista itens; "como…" e "ou outro…" não são escolhas', () => {
    const result = slots(
      'Um símbolo de sua herança, como um anel de sinete ou manto cerimonial. Enquanto estiver com esse item, você pode ser reconhecido.',
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'fixed', name: 'Símbolo de sua herança' });
    expect(slots('Tatuagem ou outro adereço de sua gangue.')).toMatchObject([{ kind: 'fixed' }]);
  });

  it('aponta as escolhas que faltam', () => {
    const result = slots('Estojo de disfarces ou gazua, barraca.');
    expect(t20MissingOriginItems(result, {})).toHaveLength(1);
    expect(t20MissingOriginItems(result, { item1: 'gazua' })).toEqual([]);
  });
});
