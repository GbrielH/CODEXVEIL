import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCharacter, createSession, createTable } from '../support/fixtures';
import { TestDatabase, admin, expectSqlError, service } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

interface RollRow {
  id: string;
  total: number;
  modifier: number;
  mode: string;
  expression: string;
  roller_name: string;
  dice: { sign: number; count: number; sides: number; values: number[]; kept: number[] }[];
}

describe('itens da campanha', () => {
  it('o mestre cria itens; jogadores só veem os revelados e não criam', async () => {
    const { gm, player, outsider, campaign } = await createTable(db);
    await db.as(gm, (s) =>
      s.query(
        `insert into public.campaign_items (campaign_id, name, category, rarity, description, visibility)
         values ($1, 'Lâmina do Eclipse', 'weapon', 'Raro', 'Forjada na lua nova.', 'gm'),
                ($1, 'Poção Amarga', 'consumable', 'Comum', '', 'members')`,
        [campaign.id],
      ),
    );
    const seen = await db.as(player, (s) =>
      s.query<{ name: string }>(`select name from public.campaign_items where campaign_id = $1 order by name`, [campaign.id]),
    );
    expect(seen.map((row) => row.name)).toEqual(['Poção Amarga']);
    expect(await db.as(outsider, (s) => s.query(`select 1 from public.campaign_items`))).toEqual([]);

    await expectSqlError(
      db.as(player, (s) =>
        s.query(`insert into public.campaign_items (campaign_id, name) values ($1, 'Item roubado')`, [campaign.id]),
      ),
      '42501',
    );
    const updated = await db.as(player, (s) =>
      s.query(`update public.campaign_items set name = 'Mudado' where campaign_id = $1 returning id`, [campaign.id]),
    );
    expect(updated).toEqual([]);
  });

  it('o mestre entrega um item ao inventário do personagem do jogador', async () => {
    const { gm, player, campaign } = await createTable(db);
    const characterId = await createCharacter(db, player, campaign.id, 'Lyra');
    await db.as(gm, (s) =>
      s.query(
        `insert into public.character_items (character_id, name, category, description)
         values ($1, 'Bag of Holding', 'gear', 'Espaço extradimensional.')`,
        [characterId],
      ),
    );
    const items = await db.as(player, (s) =>
      s.query<{ name: string }>(`select name from public.character_items where character_id = $1`, [characterId]),
    );
    expect(items.map((row) => row.name)).toContain('Bag of Holding');
  });
});

describe('rolagens de dados', () => {
  it('o servidor rola, soma e grava; ninguém grava um resultado escolhido', async () => {
    const { player, campaign } = await createTable(db);
    const roll = await db.as(player, (s) =>
      s.one<RollRow>(`select * from public.roll_dice($1, ' 2d6 + 1d4 + 3 ', 'Dano da espada')`, [campaign.id]),
    );
    expect(roll.expression).toBe('2d6+1d4+3');
    expect(roll.modifier).toBe(3);
    expect(roll.dice.map((group) => [group.count, group.sides, group.values.length])).toEqual([
      [2, 6, 2],
      [1, 4, 1],
    ]);
    const sum = roll.dice.flatMap((group) => group.kept).reduce((total, value) => total + value, 0);
    expect(roll.total).toBe(sum + 3);
    expect(roll.roller_name).toBe('Jogadora');

    await expectSqlError(
      db.as(player, (s) =>
        s.query(
          `insert into public.dice_rolls (campaign_id, user_id, roller_name, expression, dice, total)
           values ($1, $2, 'Jogadora', '1d20', '[]', 20)`,
          [campaign.id, player.id],
        ),
      ),
      '42501',
    );
    await expectSqlError(
      db.as(player, (s) => s.query(`update public.dice_rolls set total = 99 where id = $1`, [roll.id])),
      '42501',
    );
  });

  it('vantagem rola dois d20 e fica com o maior; desvantagem, com o menor', async () => {
    const { player, campaign } = await createTable(db);
    for (let attempt = 0; attempt < 5; attempt++) {
      const best = await db.as(player, (s) => s.one<RollRow>(`select * from public.roll_dice($1, '1d20+2', '', 'advantage')`, [campaign.id]));
      expect(best.mode).toBe('advantage');
      expect(best.dice[0]?.values).toHaveLength(2);
      expect(best.dice[0]?.kept).toEqual([Math.max(...(best.dice[0]?.values ?? []))]);
      expect(best.total).toBe(Math.max(...(best.dice[0]?.values ?? [])) + 2);

      const worst = await db.as(player, (s) => s.one<RollRow>(`select * from public.roll_dice($1, 'd20', '', 'disadvantage')`, [campaign.id]));
      expect(worst.dice[0]?.kept).toEqual([Math.min(...(worst.dice[0]?.values ?? []))]);
    }
    // Sem d20, a vantagem não se aplica.
    const plain = await db.as(player, (s) => s.one<RollRow>(`select * from public.roll_dice($1, '2d6', '', 'advantage')`, [campaign.id]));
    expect(plain.mode).toBe('normal');
  });

  it('recusa expressões inválidas e quem não participa da campanha', async () => {
    const { player, outsider, campaign } = await createTable(db);
    for (const expression of ['', 'abc', '1d1', '101d6', '1d20; drop table x', '5', '1d6+1d6+1d6+1d6+1d6+1d6+1d6+1d6+1d6+1d6+1d6']) {
      await expectSqlError(db.as(player, (s) => s.query(`select public.roll_dice($1, $2)`, [campaign.id, expression])), '22023');
    }
    await expectSqlError(db.as(outsider, (s) => s.query(`select public.roll_dice($1, '1d20')`, [campaign.id])), '42501');
  });

  it('rolagens secretas só aparecem para quem rolou e para os mestres', async () => {
    const { gm, coGm, player, otherPlayer, outsider, campaign } = await createTable(db);
    const open = await db.as(player, (s) => s.one<RollRow>(`select * from public.roll_dice($1, '1d20', 'Percepção')`, [campaign.id]));
    const secret = await db.as(player, (s) =>
      s.one<RollRow>(`select * from public.roll_dice($1, '1d20', 'Furtividade', 'normal', 'gm')`, [campaign.id]),
    );
    const visible = async (user: typeof gm) =>
      (await db.as(user, (s) => s.query<{ id: string }>(`select id from public.dice_rolls where campaign_id = $1`, [campaign.id]))).map(
        (row) => row.id,
      );
    expect(await visible(gm)).toEqual(expect.arrayContaining([open.id, secret.id]));
    expect(await visible(coGm)).toEqual(expect.arrayContaining([open.id, secret.id]));
    expect(await visible(player)).toEqual(expect.arrayContaining([open.id, secret.id]));
    expect(await visible(otherPlayer)).toEqual([open.id]);
    expect(await visible(outsider)).toEqual([]);
  });

  it('rola pelo personagem do jogador, mas não pelo de outro', async () => {
    const { gm, player, otherPlayer, campaign } = await createTable(db);
    const lyra = await createCharacter(db, player, campaign.id, 'Lyra');
    const roll = await db.as(player, (s) =>
      s.one<RollRow>(`select * from public.roll_dice($1, '1d20+5', 'Ataque', 'normal', 'members', $2)`, [campaign.id, lyra]),
    );
    expect(roll.roller_name).toBe('Lyra');
    await expectSqlError(
      db.as(otherPlayer, (s) => s.query(`select public.roll_dice($1, '1d20', '', 'normal', 'members', $2)`, [campaign.id, lyra])),
      '42501',
    );
    // O mestre pode rolar por qualquer personagem da mesa.
    const byGm = await db.as(gm, (s) =>
      s.one<RollRow>(`select * from public.roll_dice($1, '1d20', '', 'normal', 'gm', $2)`, [campaign.id, lyra]),
    );
    expect(byGm.roller_name).toBe('Lyra');
  });

  it('guarda só as 200 rolagens mais recentes de cada campanha', async () => {
    const { player, campaign } = await createTable(db);
    for (let index = 0; index < 205; index++) {
      await db.as(player, (s) => s.query(`select public.roll_dice($1, '1d4')`, [campaign.id]));
    }
    const count = await db.as(admin, (s) =>
      s.one<{ count: number }>(`select count(*)::int as count from public.dice_rolls where campaign_id = $1`, [campaign.id]),
    );
    expect(count.count).toBe(200);
  });
});

describe('turnos', () => {
  async function setupEncounter() {
    const table = await createTable(db);
    const { gm, player, campaign } = table;
    const session = await createSession(db, gm, campaign.id, { published: true });
    const lyra = await createCharacter(db, player, campaign.id, 'Lyra');
    const goblin = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.session_entities (session_id, campaign_id, kind, name) values ($1, $2, 'monster', 'Goblin') returning id`,
        [session, campaign.id],
      ),
    );
    const lurker = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.session_entities (session_id, campaign_id, kind, name) values ($1, $2, 'monster', 'Espreitador') returning id`,
        [session, campaign.id],
      ),
    );
    const encounter = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.encounters (session_id, campaign_id, name, mode) values ($1, $2, 'Investigação na cripta', 'investigation') returning id`,
        [session, campaign.id],
      ),
    );
    const combatants = await db.as(gm, (s) =>
      s.query<{ id: string; name: string }>(
        `insert into public.encounter_combatants (encounter_id, campaign_id, character_id, session_entity_id, initiative, is_hidden)
         values ($1, $2, $3, null, 12, false), ($1, $2, null, $4, 15, false), ($1, $2, null, $5, 20, true)
         returning id, coalesce(character_id::text, session_entity_id::text) as name`,
        [encounter.id, campaign.id, lyra, goblin.id, lurker.id],
      ),
    );
    return { ...table, session, lyra, encounter: encounter.id, combatants };
  }

  interface TurnRow {
    mode: string;
    status: string;
    round: number;
    active_name: string | null;
    active_character_id: string | null;
    turn_order: { name: string; kind: string; current: boolean }[];
  }

  it('os jogadores veem o modo, a ordem e de quem é a vez, sem os ocultos', async () => {
    const { gm, player, outsider, campaign, encounter, combatants, lyra } = await setupEncounter();
    const lyraCombatant = combatants[0]?.id;
    await db.as(gm, (s) =>
      s.query(`update public.encounters set status = 'active', round = 1, active_combatant_id = $2 where id = $1`, [encounter, lyraCombatant]),
    );
    const turn = await db.as(player, (s) => s.one<TurnRow>(`select * from public.campaign_turns where campaign_id = $1`, [campaign.id]));
    expect(turn).toMatchObject({ mode: 'investigation', status: 'active', round: 1, active_name: 'Lyra', active_character_id: lyra });
    expect(turn.turn_order.map((entry) => [entry.name, entry.current])).toEqual([
      ['Goblin', false],
      ['Lyra', true],
    ]);
    expect(await db.as(outsider, (s) => s.query(`select 1 from public.campaign_turns`))).toEqual([]);
    // Os encontros continuam exclusivos do mestre.
    expect(await db.as(player, (s) => s.query(`select 1 from public.encounters`))).toEqual([]);
  });

  it('a vez de alguém oculto não revela o nome; a ordem manual vale para todos', async () => {
    const { gm, player, campaign, encounter, combatants } = await setupEncounter();
    const lurker = combatants[2]?.id;
    await db.as(gm, (s) =>
      s.query(`update public.encounters set status = 'active', round = 1, active_combatant_id = $2 where id = $1`, [encounter, lurker]),
    );
    let turn = await db.as(player, (s) => s.one<TurnRow>(`select * from public.campaign_turns where campaign_id = $1`, [campaign.id]));
    expect(turn.active_name).toBeNull();
    expect(turn.turn_order.some((entry) => entry.name === 'Espreitador')).toBe(false);

    await db.as(gm, (s) => s.query(`update public.encounters set order_mode = 'manual' where id = $1`, [encounter]));
    await db.as(gm, (s) => s.query(`update public.encounter_combatants set sort_order = 1 where id = $1`, [combatants[1]?.id]));
    await db.as(gm, (s) => s.query(`update public.encounter_combatants set sort_order = 2 where id = $1`, [combatants[0]?.id]));
    turn = await db.as(player, (s) => s.one<TurnRow>(`select * from public.campaign_turns where campaign_id = $1`, [campaign.id]));
    expect(turn.turn_order.map((entry) => entry.name)).toEqual(['Goblin', 'Lyra']);

    // Sem a ordem completa, os jogadores só sabem de quem é a vez.
    await db.as(gm, (s) => s.query(`update public.campaigns set players_see_turn_order = false where id = $1`, [campaign.id]));
    turn = await db.as(player, (s) => s.one<TurnRow>(`select * from public.campaign_turns where campaign_id = $1`, [campaign.id]));
    expect(turn.turn_order).toEqual([]);
  });

  it('o resumo some quando o encontro termina e jogadores não alteram o turno', async () => {
    const { gm, player, campaign, encounter, combatants } = await setupEncounter();
    const changed = await db.as(player, (s) =>
      s.query(`update public.encounter_combatants set turn_state = '{"action": true}' where id = $1 returning id`, [combatants[0]?.id]),
    );
    expect(changed).toEqual([]);
    await expectSqlError(
      db.as(player, (s) => s.query(`update public.campaign_turns set round = 9 where campaign_id = $1`, [campaign.id])),
      '42501',
    );
    await db.as(gm, (s) => s.query(`update public.encounters set status = 'ended' where id = $1`, [encounter]));
    expect(await db.as(player, (s) => s.query(`select 1 from public.campaign_turns where campaign_id = $1`, [campaign.id]))).toEqual([]);
  });
});

describe('notificações push', () => {
  const token = (suffix: string) => `ExponentPushToken[teste-${suffix}]`;

  it('cada conta registra e vê só os próprios aparelhos; o aparelho fica com a última conta', async () => {
    const { player, otherPlayer } = await createTable(db);
    await db.as(player, (s) => s.query(`select public.register_push_token($1, 'android')`, [token('a')]));
    await db.as(otherPlayer, (s) => s.query(`select public.register_push_token($1, 'android')`, [token('b')]));

    const mine = await db.as(player, (s) => s.query<{ token: string }>(`select token from public.push_tokens`));
    expect(mine.map((row) => row.token)).toEqual([token('a')]);

    // O mesmo aparelho, agora com outra conta.
    await db.as(otherPlayer, (s) => s.query(`select public.register_push_token($1, 'android')`, [token('a')]));
    expect(await db.as(player, (s) => s.query(`select token from public.push_tokens`))).toEqual([]);

    await expectSqlError(db.as(player, (s) => s.query(`select public.register_push_token('qualquer coisa', 'android')`)), '22023');
    await expectSqlError(
      db.as(player, (s) => s.query(`insert into public.push_tokens (token, user_id, platform) values ($1, $2, 'android')`, [token('c'), player.id])),
      '42501',
    );
  });

  it('os avisos de sessão são gravados só pela função do servidor', async () => {
    const { gm, player, campaign } = await createTable(db);
    const session = await createSession(db, gm, campaign.id, { published: true });
    await expectSqlError(
      db.as(gm, (s) => s.query(`insert into public.session_notifications (session_id, scheduled_for) values ($1, now())`, [session])),
      '42501',
    );
    await db.as(service, (s) =>
      s.query(`insert into public.session_notifications (session_id, scheduled_for, recipients) values ($1, now(), 3)`, [session]),
    );
    expect(await db.as(gm, (s) => s.query(`select recipients from public.session_notifications`))).toEqual([{ recipients: 3 }]);
    expect(await db.as(player, (s) => s.query(`select 1 from public.session_notifications`))).toEqual([]);
  });
});
