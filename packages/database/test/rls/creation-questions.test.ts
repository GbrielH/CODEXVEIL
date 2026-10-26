import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, createCampaign } from '../support/fixtures';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

const create = (campaignId: string, answers: unknown) =>
  `select public.create_character('Herói', 'dnd5e', '${campaignId}', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, ${
    answers === null ? 'null' : `'${JSON.stringify(answers)}'::jsonb`
  }) as id`;

describe('perguntas do mestre na criação de personagem', () => {
  it('exige todas as respostas; só o dono e o mestre leem', async () => {
    const gm = await db.createUser('mestre-perguntas@example.com');
    const player = await db.createUser('jogador-perguntas@example.com');
    const other = await db.createUser('outro-perguntas@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);
    await addMember(db, campaign.id, other);
    await db.as(gm, (s) =>
      s.query(`update public.campaigns set creation_questions = '{"Qual o maior medo do seu personagem?","De onde ele vem?"}' where id = $1`, [campaign.id]),
    );

    // Jogador não muda as perguntas.
    const changed = await db.as(player, (s) => s.query(`update public.campaigns set creation_questions = '{}' where id = $1 returning id`, [campaign.id]));
    expect(changed).toEqual([]);

    // Sem respostas, ou com uma em branco: recusado.
    await expectSqlError(db.as(player, (s) => s.query(create(campaign.id, null))), '23514');
    await expectSqlError(
      db.as(player, (s) =>
        s.query(create(campaign.id, [{ question: 'Qual o maior medo do seu personagem?', answer: 'Fogo' }, { question: 'De onde ele vem?', answer: '  ' }])),
      ),
      '23514',
    );

    // Completo: cria e grava as respostas.
    const answers = [
      { question: 'Qual o maior medo do seu personagem?', answer: 'Fogo' },
      { question: 'De onde ele vem?', answer: 'Das montanhas' },
    ];
    const { id } = await db.as(player, (s) => s.one<{ id: string }>(create(campaign.id, answers)));
    expect(id).toBeTruthy();

    const read = (who: typeof player) => db.as(who, (s) => s.query<{ answers: unknown }>(`select answers from public.character_answers where character_id = $1`, [id]));
    expect((await read(player))[0]?.answers).toEqual(answers);
    expect((await read(gm))[0]?.answers).toEqual(answers);
    expect(await read(other)).toEqual([]);
  });

  it('campanha sem perguntas cria normalmente; vincular depois também exige as respostas', async () => {
    const gm = await db.createUser('mestre-perguntas2@example.com');
    const player = await db.createUser('jogador-perguntas2@example.com');
    const open = await createCampaign(db, gm);
    const strict = await createCampaign(db, gm);
    await addMember(db, open.id, player);
    await addMember(db, strict.id, player);
    await db.as(gm, (s) => s.query(`update public.campaigns set creation_questions = '{"Por que ele luta?"}' where id = $1`, [strict.id]));

    const { id } = await db.as(player, (s) => s.one<{ id: string }>(create(open.id, null)));
    await expectSqlError(db.as(player, (s) => s.query(`select public.set_character_campaign($1, $2)`, [id, strict.id])), '23514');
    await db.as(player, (s) =>
      s.query(`select public.set_character_campaign_with_answers($1, $2, $3::jsonb)`, [id, strict.id, JSON.stringify([{ question: 'Por que ele luta?', answer: 'Vingança' }])]),
    );
    expect(await db.as(gm, (s) => s.query(`select 1 from public.character_answers where character_id = $1`, [id]))).toHaveLength(1);
  });
});
