import { describe, expect, it } from 'vitest';
import {
  ordem2AssistSteps,
  ordem2Balanced,
  ordem2BalanceDice,
  ordem2ControlFear,
  ordem2Damage,
  ordem2Expression,
  ordem2GainFear,
  ordem2InjuryRow,
  ordem2LockAttempts,
  ordem2LockHints,
  ordem2RepeatedDc,
  ordem2SheetTest,
  ordem2SkillPenalty,
  ordem2TestDice,
  ordem2TraumaRow,
  resolveOrdem2Test,
  stepDie,
} from './rules';
import {
  createDefaultOrdem2Sheet,
  ordem2SkillLabel,
  ordem2SkillsFor,
  type Ordem2Die,
} from './sheet';
import { parseOrdem2BookPack } from './books/pack';

const DICE: Ordem2Die[] = [4, 6, 8, 10, 12];

describe('Ordem Paranormal 2: dados e passos', () => {
  it('sobe e desce passos entre d4 e d12', () => {
    expect(stepDie(6, -1)).toBe(4);
    expect(stepDie(10, 1)).toBe(12);
    expect(stepDie(4, -3)).toBe(4);
    expect(stepDie(12, 1)).toBe(12);
    expect(stepDie(12, 1, true)).toBe(20);
  });

  it('aumentos vão para o menor dado e reduções para o maior', () => {
    expect(ordem2TestDice(10, 6, { steps: 1 }).dice).toEqual([10, 8]);
    expect(ordem2TestDice(10, 6, { steps: -1 }).dice).toEqual([8, 6]);
    expect(ordem2TestDice(12, 12, { steps: 2 }).wastedSteps).toBe(2);
    expect(ordem2TestDice(6, 6, { bonusDice: [6, 6, 6] }).dice).toHaveLength(4);
  });

  it('monta a expressão para o rolador', () => {
    expect(ordem2Expression([8, 6])).toBe('1d8+1d6');
    expect(ordem2Expression([6, 6, 10])).toBe('1d10+2d6');
  });

  it('usa o atributo-base e o dado de pavor da ficha', () => {
    const sheet = { ...createDefaultOrdem2Sheet(), fearDie: 6 as const };
    sheet.attributes.fisico = 10;
    sheet.skills.luta = { die: 8, modifier: 0 };
    expect(ordem2SheetTest(sheet, 'luta')).toEqual({ dice: [10, 8], fearDie: 6, wastedSteps: 0 });
    expect(ordem2SheetTest(sheet, 'luta', { fear: false }).fearDie).toBe(0);
  });
});

describe('Ordem Paranormal 2: testes', () => {
  it('soma e compara com a DT 7', () => {
    const result = resolveOrdem2Test([3, 5]);
    expect(result.total).toBe(8);
    expect(result.success).toBe(true);
    expect(result.high).toBe(5);
    expect(result.low).toBe(3);
  });

  it('com quatro dados soma só os três maiores', () => {
    expect(resolveOrdem2Test([1, 6, 4, 5]).total).toBe(15);
  });

  it('crítico com dois dados iguais de 6 ou mais, mesmo abaixo da DT', () => {
    expect(resolveOrdem2Test([6, 6], { dc: 20 }).success).toBe(true);
    expect(resolveOrdem2Test([5, 5]).critical).toBe(false);
  });

  it('falha crítica com todos os dados em 1', () => {
    const result = resolveOrdem2Test([1, 1], { dc: 2 });
    expect(result.fumble).toBe(true);
    expect(result.success).toBe(false);
  });

  it('dado de pavor: os três exemplos do livro', () => {
    expect(resolveOrdem2Test([7, 2], { fear: 4 }).total).toBe(7);
    const second = resolveOrdem2Test([3, 1], { fear: 5 });
    expect(second.total).toBe(0);
    expect(second.fumble).toBe(true);
    expect(resolveOrdem2Test([6, 5], { fear: 3 }).total).toBe(11);
    expect(resolveOrdem2Test([6, 5], { fear: 1 }).fearEnds).toBe(true);
  });

  it('dano RA + arma, e no crítico soma a segunda rolagem', () => {
    expect(ordem2Damage(resolveOrdem2Test([6, 3]), 'RA+3')).toBe(9);
    expect(ordem2Damage(resolveOrdem2Test([6, 3]), 'RB')).toBe(3);
    expect(ordem2Damage(resolveOrdem2Test([8, 8, 2]), 'RA+1')).toBe(17);
  });

  it('modificador fixo de lesões entra no total', () => {
    const sheet = { ...createDefaultOrdem2Sheet(), injuries: ['tendao'] };
    expect(ordem2SkillPenalty(sheet, 'acrobacia')).toBe(-2);
    expect(resolveOrdem2Test([4, 4], { modifier: -2 }).total).toBe(6);
  });

  it('DT de testes repetidos: 7, 10, 13', () => {
    expect([0, 1, 2].map(ordem2RepeatedDc)).toEqual([7, 10, 13]);
  });
});

describe('Ordem Paranormal 2: tabelas e desafios', () => {
  it('lesões e traumas somam o patamar', () => {
    expect(ordem2InjuryRow(4, 'iniciante').key).toBe('morte-subita');
    expect(ordem2InjuryRow(4, 'lenda').key).toBe('morte-lenta');
    expect(ordem2InjuryRow(19, 'elite').key).toBe('adrenalina');
    expect(ordem2TraumaRow(15, 'iniciante').key).toBe('panico');
  });

  it('pavor: ganha d6, sobe e se controla', () => {
    expect(ordem2GainFear(0)).toBe(6);
    expect(ordem2GainFear(6)).toBe(8);
    expect(ordem2ControlFear(6)).toBe(4);
    expect(ordem2ControlFear(4)).toBe(0);
  });

  it('fechaduras: exemplo do livro e tentativas por Crime', () => {
    expect(ordem2LockHints([3, 5, 2], [4, 5, 1])).toEqual(['baixo', 'exato', 'alto']);
    expect(DICE.map(ordem2LockAttempts)).toEqual([1, 2, 3, 4, 5]);
  });

  it('equilíbrio e ajuda', () => {
    expect(ordem2Balanced(5, 6)).toBe(true);
    expect(ordem2Balanced(5, 7)).toBe(false);
    expect(ordem2BalanceDice(6)).toBe(3);
    expect(DICE.map(ordem2AssistSteps)).toEqual([0, 1, 1, 2, 2]);
  });

  it('cada cenário tem 20 perícias', () => {
    expect(ordem2SkillsFor('moderno')).toHaveLength(20);
    expect(ordem2SkillsFor('medieval')).toHaveLength(20);
    expect(ordem2SkillLabel('pesquisar', 'medieval')).toBe('Inspecionar');
    expect(ordem2SkillLabel('ocultismo', 'medieval')).toBe('Bruxaria');
  });
});

describe('Ordem Paranormal 2: pacote do livro', () => {
  it('valida entradas e imagens', () => {
    const { pack, issues } = parseOrdem2BookPack({
      format: 'codexveil.ordem2.book',
      version: 1,
      book: { id: 'ordem2-beta', name: 'Playtest Beta', category: 'core' },
      entries: [
        {
          kind: 'point_of_interest',
          key: 'potes',
          name: 'Potes de argila',
          data: {
            mission: 'caverna',
            rows: [{ skill: 'Percepção', dc: 6, text: 'Parecem potes.' }],
          },
        },
        { kind: 'map', key: 'mapa', name: 'Mapa', data: { image: 'mapa-1' } },
        { kind: 'nada', key: 'x', name: 'x', data: {} },
      ],
      assets: [{ key: 'mapa-1', mime: 'image/jpeg', data: 'A'.repeat(32) }],
    });
    expect(pack.entries).toHaveLength(2);
    expect(pack.assets).toHaveLength(1);
    expect(issues).toHaveLength(1);
  });
});

describe('Ordem Paranormal 2: missão pronta em roteiro', () => {
  it('gera blocos do mestre com narração, criaturas, mapas e pontos de interesse', async () => {
    const { ordem2MissionBlocks } = await import('./books/mission');
    const { pack } = parseOrdem2BookPack({
      format: 'codexveil.ordem2.book',
      version: 1,
      book: { id: 'ordem2-beta', name: 'Beta', category: 'core' },
      entries: [
        {
          kind: 'mission',
          key: 'pantano',
          name: 'Pântano',
          data: { summary: 'Resumo.', body: 'Fim.', scenes: ['cena-1'] },
        },
        {
          kind: 'scene',
          key: 'cena-1',
          name: 'Cena 1',
          data: {
            mission: 'pantano',
            body: '## Início\n\n> Vocês ouvem passos.\n\nRegras da cena.',
            pointsOfInterest: ['carroca'],
            creatures: ['afogado'],
            maps: ['mapa'],
          },
        },
        {
          kind: 'point_of_interest',
          key: 'carroca',
          name: 'Carroça',
          data: {
            mission: 'pantano',
            description: 'Uma carroça.',
            rows: [{ skill: 'Percepção', dc: 6, text: 'Há mercadorias.' }],
            context: 'Segredo.',
          },
        },
        {
          kind: 'map',
          key: 'mapa',
          name: 'Mapa da ilhota',
          data: { image: 'a'.repeat(32) + '-jpg' },
        },
      ],
    });
    const blocks = ordem2MissionBlocks({
      mission: pack.entries[0] as never,
      entries: pack.entries,
      creatureIds: { afogado: '00000000-0000-0000-0000-000000000001' },
      mapImages: { mapa: 'campaigns/x/maps/a.jpg' },
    });
    const types = blocks.map((block) => block.content.type);
    expect(blocks.every((block) => block.visibility === 'gm')).toBe(true);
    expect(types).toContain('callout');
    expect(types).toContain('monster_ref');
    expect(types).toContain('image');
    expect(types).toContain('check');
    expect(types).toContain('gm_note');
    // Pronto para mestrar: narração, descrição, mapa e achados saem marcados para liberar.
    const revealable = blocks.filter((block) => block.revealable).map((block) => block.content.type);
    expect(revealable).toEqual(expect.arrayContaining(['callout', 'image', 'check']));
    expect(blocks.filter((block) => block.content.type === 'gm_note').every((block) => !block.revealable)).toBe(true);
    const check = blocks.find((block) => block.content.type === 'check');
    expect(check?.content).toEqual({ type: 'check', data: { skill: 'Percepção', dc: 6, expression: null, result: 'Há mercadorias.' } });
  });
});
