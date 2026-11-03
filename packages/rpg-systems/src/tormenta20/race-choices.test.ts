import { describe, expect, it } from 'vitest';
import { buildT20Content } from './content';
import {
  createT20Draft,
  t20DraftIssues,
  t20RaceChoiceOptions,
  t20RaceModifiers,
  type T20Draft,
} from './creation';

// Golem desperto (Ameaças de Arton): For +1, Car –1, mais chassi e tamanho.
const content = buildT20Content([
  {
    book: { id: 't20-ameacas', name: 'Ameaças de Arton' },
    entries: [
      {
        kind: 'species',
        key: 'golem-desperto',
        name: 'Golem desperto',
        data: {
          summary: '',
          attributes: { for: 1, car: -1 },
          choices: [
            {
              name: 'Chassi',
              options: [
                { name: 'Ferro', attributes: { for: 1, con: 1 }, speed: 6, text: 'Ferro.' },
                {
                  name: 'Bronze',
                  attributeChoice: { count: 2, value: 1 },
                  text: 'Bronze.',
                },
              ],
            },
            {
              name: 'Tamanho',
              options: [
                { name: 'Pequeno', attributes: { des: 1 }, size: 'pequeno' },
                { name: 'Médio' },
                { name: 'Grande', attributes: { des: -1 }, size: 'grande' },
              ],
            },
          ],
        },
      },
    ],
  },
]);
const race = content.races[0]!;
const draft = (patch: Partial<T20Draft>): T20Draft => ({
  ...createT20Draft(),
  raceId: race.id,
  ...patch,
});

describe('escolhas da raça (T20)', () => {
  it('soma os atributos das opções escolhidas', () => {
    const golem = draft({ raceChoices: { Chassi: ['Ferro'], Tamanho: ['Pequeno'] } });
    expect(t20RaceModifiers(content, golem)).toMatchObject({ for: 2, con: 1, des: 1, car: -1 });
    expect(t20RaceChoiceOptions(race, golem).map((option) => option.name)).toEqual([
      'Ferro',
      'Pequeno',
    ]);
  });

  it('aplica a escolha de atributos da opção (chassi de bronze)', () => {
    const golem = draft({
      raceChoices: { Chassi: ['Bronze'], Tamanho: ['Médio'] },
      raceOptionAttributeChoices: ['sab', 'int'],
    });
    expect(t20RaceModifiers(content, golem)).toMatchObject({ for: 1, sab: 1, int: 1, car: -1 });
  });

  it('pede as escolhas que faltam', () => {
    const fields = (d: T20Draft) => t20DraftIssues(content, d).map((issue) => issue.path);
    expect(fields(draft({ raceChoices: { Chassi: ['Ferro'] } }))).toContain('raceChoices');
    expect(fields(draft({ raceChoices: { Chassi: ['Bronze'], Tamanho: ['Médio'] } }))).toContain(
      'raceOptionAttributeChoices',
    );
    expect(fields(draft({ raceChoices: { Chassi: ['Ferro'], Tamanho: ['Médio'] } }))).not.toContain(
      'raceChoices',
    );
  });
});
