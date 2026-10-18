import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCharacter, createSession, createTable } from '../support/fixtures';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

/** Mesa em combate: Lyra (jogadora) começa, depois o Goblin. */
async function setupFight(options: { inProgress?: boolean } = {}) {
  const table = await createTable(db);
  const { gm, player, campaign } = table;
  const session = await db.as(gm, (s) =>
    s.one<{ id: string }>(
      `insert into public.sessions (campaign_id, title, is_published, status) values ($1, 'Luta', true, $2) returning id`,
      [campaign.id, options.inProgress === false ? 'planned' : 'in_progress'],
    ),
  );
  const lyra = await createCharacter(db, player, campaign.id, 'Lyra');
  const goblin = await db.as(gm, (s) =>
    s.one<{ id: string }>(`insert into public.session_entities (session_id, campaign_id, kind, name) values ($1, $2, 'monster', 'Goblin') returning id`, [
      session.id,
      campaign.id,
    ]),
  );
  const encounter = await db.as(gm, (s) =>
    s.one<{ id: string }>(`insert into public.encounters (session_id, campaign_id, name) values ($1, $2, 'Emboscada') returning id`, [session.id, campaign.id]),
  );
  const [lyraCombatant, goblinCombatant] = await db.as(gm, (s) =>
    s.query<{ id: string }>(
      `insert into public.encounter_combatants (encounter_id, campaign_id, character_id, session_entity_id, initiative)
       values ($1, $2, $3, null, 18), ($1, $2, null, $4, 10) returning id`,
      [encounter.id, campaign.id, lyra, goblin.id],
    ),
  );
  await db.as(gm, (s) =>
    s.query(`update public.encounters set status = 'active', round = 1, active_combatant_id = $2 where id = $1`, [encounter.id, lyraCombatant?.id]),
  );
  return { ...table, session: session.id, lyra, encounter: encounter.id, lyraCombatant: lyraCombatant?.id ?? '', goblinCombatant: goblinCombatant?.id ?? '' };
}

describe('sessão em andamento', () => {
  it('jogadores só rolam dados com a sessão iniciada; o mestre rola sempre', async () => {
    const { gm, player, campaign } = await createTable(db);
    await createSession(db, gm, campaign.id, { published: true });
    await expectSqlError(db.as(player, (s) => s.query(`select public.roll_dice($1, '1d20')`, [campaign.id])), 'CVSES');
    await db.as(gm, (s) => s.query(`select public.roll_dice($1, '1d20')`, [campaign.id]));
  });

  it('informa aos membros se a sessão começou, mesmo sem ela estar publicada', async () => {
    const { gm, player, outsider, campaign } = await createTable(db);
    const flag = (user: typeof gm) =>
      db.as(user, (s) => s.one<{ playing: boolean }>(`select public.campaign_session_in_progress($1) as playing`, [campaign.id]));
    expect((await flag(player)).playing).toBe(false);
    await db.as(gm, (s) =>
      s.query(`insert into public.sessions (campaign_id, title, is_published, status) values ($1, 'Secreta', false, 'in_progress')`, [campaign.id]),
    );
    expect((await flag(player)).playing).toBe(true);
    expect((await flag(outsider)).playing).toBe(false);
  });
});

describe('ações do turno', () => {
  it('registra a ação com alvo e rolagem e respeita o orçamento do turno', async () => {
    const { player, lyraCombatant, goblinCombatant } = await setupFight();
    const attack = await db.as(player, (s) =>
      s.one<{ kind: string; target_name: string; roll_total: number; actor_name: string }>(
        `select * from public.perform_turn_action($1, 'action', 'Ataque: Espada longa', $2, false, '1d20+5')`,
        [lyraCombatant, goblinCombatant],
      ),
    );
    expect(attack).toMatchObject({ kind: 'action', target_name: 'Goblin', actor_name: 'Lyra' });
    expect(attack.roll_total).toBeGreaterThanOrEqual(6);

    await expectSqlError(db.as(player, (s) => s.query(`select public.perform_turn_action($1, 'action', 'Outro ataque')`, [lyraCombatant])), 'CVTRN');
    // Surto de Ação concede uma ação extra.
    await db.as(player, (s) => s.query(`select public.perform_turn_action($1, 'free', 'Surto de Ação', null, true)`, [lyraCombatant]));
    await db.as(player, (s) => s.query(`select public.perform_turn_action($1, 'action', 'Outro ataque')`, [lyraCombatant]));
    await db.as(player, (s) => s.query(`select public.perform_turn_action($1, 'bonus_action', 'Fúria')`, [lyraCombatant]));
    await expectSqlError(db.as(player, (s) => s.query(`select public.perform_turn_action($1, 'bonus_action', 'Outra')`, [lyraCombatant])), 'CVTRN');
    await db.as(player, (s) => s.query(`select public.perform_turn_action($1, 'movement', 'Movimento')`, [lyraCombatant]));
    await expectSqlError(db.as(player, (s) => s.query(`select public.perform_turn_action($1, 'movement', 'Movimento')`, [lyraCombatant])), 'CVTRN');
  });

  it('com dados presenciais a ação não rola no app e guarda o resultado anotado', async () => {
    const { gm, player, session, campaign, lyraCombatant, goblinCombatant } = await setupFight();
    await db.as(gm, (s) => s.query(`update public.sessions set physical_dice = true where id = $1`, [session]));
    const state = await db.as(player, (s) => s.one<{ state: { playing: boolean; physicalDice: boolean } }>(`select public.campaign_session_state($1) as state`, [campaign.id]));
    expect(state.state).toEqual({ playing: true, physicalDice: true });
    const attack = await db.as(player, (s) =>
      s.one<{ roll_id: string | null; roll_total: number | null; roll_detail: string | null }>(
        `select * from public.perform_turn_action($1, 'action', 'Atacar: Machado', $2, false, '1d20+5', 'normal', 17)`,
        [lyraCombatant, goblinCombatant],
      ),
    );
    expect(attack).toMatchObject({ roll_id: null, roll_total: 17, roll_detail: 'Dado físico' });
  });

  it('fora da vez só cabe reação; ninguém age pelo personagem dos outros', async () => {
    const { player, otherPlayer, gm, lyraCombatant, goblinCombatant, encounter } = await setupFight();
    await expectSqlError(db.as(gm, (s) => s.query(`select public.perform_turn_action($1, 'action', 'Garra')`, [goblinCombatant])), 'CVTRN');
    await db.as(gm, (s) => s.query(`select public.perform_turn_action($1, 'reaction', 'Ataque de oportunidade', $2)`, [goblinCombatant, lyraCombatant]));
    await expectSqlError(db.as(otherPlayer, (s) => s.query(`select public.perform_turn_action($1, 'movement', 'Movimento')`, [lyraCombatant])), '42501');

    // A jogadora encerra o próprio turno; a vez passa ao Goblin.
    const next = await db.as(player, (s) => s.one<{ next_combatant_id: string; new_round: number }>(`select * from public.end_turn($1)`, [encounter]));
    expect(next).toMatchObject({ next_combatant_id: goblinCombatant, new_round: 1 });
    await expectSqlError(db.as(player, (s) => s.query(`select public.end_turn($1)`, [encounter])), '42501');
    const back = await db.as(gm, (s) => s.one<{ next_combatant_id: string; new_round: number }>(`select * from public.end_turn($1)`, [encounter]));
    expect(back).toMatchObject({ next_combatant_id: lyraCombatant, new_round: 2 });

    const log = await db.as(player, (s) => s.query<{ label: string }>(`select label from public.turn_actions where encounter_id = $1 order by created_at`, [encounter]));
    expect(log.map((row) => row.label)).toEqual(['Ataque de oportunidade']);
  });

  it('sem a sessão em andamento, jogadores não agem', async () => {
    const { player, lyraCombatant } = await setupFight({ inProgress: false });
    await expectSqlError(db.as(player, (s) => s.query(`select public.perform_turn_action($1, 'movement', 'Movimento')`, [lyraCombatant])), 'CVSES');
  });
});

describe('regras da mesa', () => {
  it('um personagem por jogador em cada campanha', async () => {
    const { player, campaign } = await createTable(db);
    await createCharacter(db, player, campaign.id, 'Primeiro');
    await expectSqlError(createCharacter(db, player, campaign.id, 'Segundo'), '23505');
    await createCharacter(db, player, null, 'Fora da campanha');
  });

  it('cada pessoa fixa uma anotação por campanha', async () => {
    const { player, campaign } = await createTable(db);
    await db.as(player, (s) => s.query(`insert into public.campaign_notes (campaign_id, title, is_pinned) values ($1, 'Pista', true)`, [campaign.id]));
    await expectSqlError(
      db.as(player, (s) => s.query(`insert into public.campaign_notes (campaign_id, title, is_pinned) values ($1, 'Outra', true)`, [campaign.id])),
      '23505',
    );
  });
});
