import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addBlock, createCharacter, createSession, createTable } from '../support/fixtures';
import { TestDatabase, expectSqlError, type TestUser } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

async function blockTexts(user: TestUser, sessionId: string): Promise<string[]> {
  const rows = await db.as(user, (s) =>
    s.query<{ text: string }>(
      `select data ->> 'text' as text from public.session_blocks where session_id = $1 order by position`,
      [sessionId],
    ),
  );
  return rows.map((row) => row.text);
}

describe('sessões e roteiros', () => {
  it('jogadores não veem sessões não publicadas nem seus blocos públicos', async () => {
    const { gm, player, campaign } = await createTable(db);
    const draft = await createSession(db, gm, campaign.id, { title: 'A traição do duque' });
    await addBlock(db, gm, draft, campaign.id, { type: 'paragraph', data: { text: 'Abertura' } });

    const sessions = await db.as(player, (s) =>
      s.query(`select title from public.sessions where id = $1`, [draft]),
    );
    expect(sessions).toHaveLength(0);
    expect(await blockTexts(player, draft)).toEqual([]);
  });

  it('jogadores recebem apenas blocos públicos de sessões publicadas', async () => {
    const { gm, coGm, player, campaign } = await createTable(db);
    const session = await createSession(db, gm, campaign.id, { published: true });
    await addBlock(db, gm, session, campaign.id, {
      type: 'paragraph',
      data: { text: 'A névoa cobre a cripta.' },
      position: 1,
    });
    await addBlock(db, gm, session, campaign.id, {
      type: 'gm_note',
      data: { text: 'O padre é o necromante.' },
      visibility: 'gm',
      position: 2,
    });
    await addBlock(db, gm, session, campaign.id, {
      type: 'paragraph',
      data: { text: 'Armadilha no terceiro degrau.' },
      visibility: 'gm',
      position: 3,
    });

    expect(await blockTexts(player, session)).toEqual(['A névoa cobre a cripta.']);
    expect(await blockTexts(coGm, session)).toHaveLength(3);

    // Mesmo pedindo explicitamente pelos blocos secretos, nada é devolvido.
    const forced = await db.as(player, (s) =>
      s.query(`select * from public.session_blocks where session_id = $1 and visibility = 'gm'`, [session]),
    );
    expect(forced).toEqual([]);
  });

  it('nota privada do mestre não pode ser tornada pública', async () => {
    const { gm, campaign } = await createTable(db);
    const session = await createSession(db, gm, campaign.id);
    const note = await addBlock(db, gm, session, campaign.id, {
      type: 'gm_note',
      data: { text: 'Segredo' },
      visibility: 'gm',
    });
    await expectSqlError(
      db.as(gm, (s) =>
        s.query(`update public.session_blocks set visibility = 'members' where id = $1`, [note]),
      ),
      '23514',
    );
  });

  it('o banco rejeita dados de bloco malformados e HTML como estrutura', async () => {
    const { gm, campaign } = await createTable(db);
    const session = await createSession(db, gm, campaign.id);
    await expectSqlError(
      addBlock(db, gm, session, campaign.id, { type: 'paragraph', data: { html: '<script>x</script>' } }),
      '23514',
    );
    await expectSqlError(
      addBlock(db, gm, session, campaign.id, { type: 'list', data: { style: 'bulleted', items: [1, 2] } }),
      '23514',
    );
    await expectSqlError(
      addBlock(db, gm, session, campaign.id, { type: 'npc_ref', data: { creatureId: 'abc', note: null } }),
      '23514',
    );
  });

  it('jogador não cria nem altera blocos, mesmo informando IDs válidos', async () => {
    const { gm, player, campaign } = await createTable(db);
    const session = await createSession(db, gm, campaign.id, { published: true });
    const block = await addBlock(db, gm, session, campaign.id, {
      type: 'paragraph',
      data: { text: 'Original' },
    });
    await expectSqlError(
      addBlock(db, player, session, campaign.id, { type: 'paragraph', data: { text: 'Intruso' } }),
      '42501',
    );
    const updated = await db.as(player, (s) =>
      s.query(
        `update public.session_blocks set data = '{"text":"Alterado"}' where id = $1 returning id`,
        [block],
      ),
    );
    expect(updated).toHaveLength(0);
  });

  it('bloco não pode apontar para sessão de outra campanha', async () => {
    const tableA = await createTable(db);
    const tableB = await createTable(db);
    const sessionB = await createSession(db, tableB.gm, tableB.campaign.id);
    await expectSqlError(
      addBlock(db, tableA.gm, sessionB, tableA.campaign.id, { type: 'paragraph', data: { text: 'x' } }),
      '23503',
    );
    await expectSqlError(
      addBlock(db, tableA.gm, sessionB, tableB.campaign.id, { type: 'paragraph', data: { text: 'x' } }),
      '42501',
    );
  });

  it('numera as sessões e permite só uma em andamento por campanha', async () => {
    const { gm, campaign } = await createTable(db);
    const first = await createSession(db, gm, campaign.id, { title: 'Um' });
    const second = await createSession(db, gm, campaign.id, { title: 'Dois' });
    const numbers = await db.as(gm, (s) =>
      s.query<{ number: number }>(
        `select number from public.sessions where id in ($1, $2) order by number`,
        [first, second],
      ),
    );
    expect(numbers.map((row) => row.number)).toEqual([1, 2]);

    await db.as(gm, (s) =>
      s.query(`update public.sessions set status = 'in_progress' where id = $1`, [first]),
    );
    await expectSqlError(
      db.as(gm, (s) => s.query(`update public.sessions set status = 'in_progress' where id = $1`, [second])),
      '23505',
    );
  });

  it('duplica uma sessão com seus blocos, sem publicar a cópia', async () => {
    const { gm, campaign } = await createTable(db);
    const session = await createSession(db, gm, campaign.id, { title: 'Original', published: true });
    await addBlock(db, gm, session, campaign.id, { type: 'heading', data: { text: 'Ato I' }, position: 1 });
    await addBlock(db, gm, session, campaign.id, {
      type: 'gm_note',
      data: { text: 'Segredo' },
      visibility: 'gm',
      position: 2,
    });
    const copy = await db.as(gm, (s) =>
      s.one<{ id: string }>(`select public.duplicate_session($1) as id`, [session]),
    );
    const meta = await db.as(gm, (s) =>
      s.one<{ title: string; is_published: boolean }>(
        `select title, is_published from public.sessions where id = $1`,
        [copy.id],
      ),
    );
    expect(meta).toEqual({ title: 'Original (cópia)', is_published: false });
    expect(await blockTexts(gm, copy.id)).toEqual(['Ato I', 'Segredo']);
  });

  it('reordena blocos exigindo a lista completa', async () => {
    const { gm, player, campaign } = await createTable(db);
    const session = await createSession(db, gm, campaign.id, { published: true });
    const a = await addBlock(db, gm, session, campaign.id, { type: 'paragraph', data: { text: 'A' }, position: 1 });
    const b = await addBlock(db, gm, session, campaign.id, { type: 'paragraph', data: { text: 'B' }, position: 2 });
    await db.as(gm, (s) => s.query(`select public.reorder_session_blocks($1, $2::uuid[])`, [session, [b, a]]));
    expect(await blockTexts(gm, session)).toEqual(['B', 'A']);

    await expectSqlError(
      db.as(gm, (s) => s.query(`select public.reorder_session_blocks($1, $2::uuid[])`, [session, [a]])),
      '22023',
    );
    // O jogador enxerga os blocos públicos, mas o RLS impede a alteração: erro explícito.
    await expectSqlError(
      db.as(player, (s) => s.query(`select public.reorder_session_blocks($1, $2::uuid[])`, [session, [a, b]])),
      '42501',
    );
    expect(await blockTexts(gm, session)).toEqual(['B', 'A']);
  });
});

describe('biblioteca de NPCs e monstros', () => {
  it('dados secretos nunca chegam aos jogadores', async () => {
    const { gm, player, campaign } = await createTable(db);
    const creature = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.creatures (campaign_id, kind, name, description, visibility)
         values ($1, 'npc', 'Padre Aldric', 'Um padre gentil.', 'members') returning id`,
        [campaign.id],
      ),
    );
    await db.as(gm, (s) =>
      s.query(`update public.creature_gm_data set secrets = 'É o necromante.' where creature_id = $1`, [
        creature.id,
      ]),
    );

    const publicProfile = await db.as(player, (s) =>
      s.query(`select name, description from public.creatures where id = $1`, [creature.id]),
    );
    expect(publicProfile).toEqual([{ name: 'Padre Aldric', description: 'Um padre gentil.' }]);

    const secrets = await db.as(player, (s) =>
      s.query(`select * from public.creature_gm_data where creature_id = $1`, [creature.id]),
    );
    expect(secrets).toEqual([]);
  });

  it('registros ocultos não aparecem para jogadores até serem revelados', async () => {
    const { gm, player, campaign } = await createTable(db);
    const monster = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.creatures (campaign_id, kind, name) values ($1, 'monster', 'Lich') returning id`,
        [campaign.id],
      ),
    );
    const hidden = await db.as(player, (s) =>
      s.query(`select id from public.creatures where id = $1`, [monster.id]),
    );
    expect(hidden).toHaveLength(0);

    await db.as(gm, (s) =>
      s.query(`update public.creatures set visibility = 'members' where id = $1`, [monster.id]),
    );
    const revealed = await db.as(player, (s) =>
      s.query(`select id from public.creatures where id = $1`, [monster.id]),
    );
    expect(revealed).toHaveLength(1);
  });

  it('jogador não cria registros nem altera estatísticas', async () => {
    const { gm, player, campaign } = await createTable(db);
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`insert into public.creatures (campaign_id, kind, name) values ($1, 'npc', 'Falso')`, [
          campaign.id,
        ]),
      ),
      '42501',
    );
    const creature = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.creatures (campaign_id, kind, name, visibility) values ($1, 'npc', 'Guarda', 'members') returning id`,
        [campaign.id],
      ),
    );
    const changed = await db.as(player, (s) =>
      s.query(`update public.creature_gm_data set stats = '{"hp":1}' where creature_id = $1 returning creature_id`, [
        creature.id,
      ]),
    );
    expect(changed).toHaveLength(0);
  });
});

describe('cena e combate', () => {
  async function setupScene() {
    const table = await createTable(db);
    const session = await createSession(db, table.gm, table.campaign.id);
    const creature = await db.as(table.gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.creatures (campaign_id, kind, name) values ($1, 'monster', 'Goblin') returning id`,
        [table.campaign.id],
      ),
    );
    const insertEntity = (name: string) =>
      db.as(table.gm, (s) =>
        s.one<{ id: string }>(
          `insert into public.session_entities (session_id, campaign_id, creature_id, kind, name, hp_current, hp_max)
           values ($1, $2, $3, 'monster', $4, 7, 7) returning id`,
          [session, table.campaign.id, creature.id, name],
        ),
      );
    const goblinA = await insertEntity('Goblin 1');
    const goblinB = await insertEntity('Goblin 2');
    return { ...table, session, creature, goblinA: goblinA.id, goblinB: goblinB.id };
  }

  it('instâncias são independentes entre si e do registro-base', async () => {
    const { gm, goblinA, goblinB } = await setupScene();
    const hit = await db.as(gm, (s) =>
      s.one<{ hp_current: number }>(
        `select hp_current from public.adjust_session_entity_hp($1, 'damage', 5)`,
        [goblinA],
      ),
    );
    expect(hit.hp_current).toBe(2);
    const other = await db.as(gm, (s) =>
      s.one<{ hp_current: number }>(`select hp_current from public.session_entities where id = $1`, [goblinB]),
    );
    expect(other.hp_current).toBe(7);
  });

  it('a cena e os encontros são exclusivos dos mestres', async () => {
    const { gm, player, session, campaign, goblinA } = await setupScene();
    const encounter = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.encounters (session_id, campaign_id, name) values ($1, $2, 'Emboscada') returning id`,
        [session, campaign.id],
      ),
    );
    await db.as(gm, (s) =>
      s.query(
        `insert into public.encounter_combatants (encounter_id, campaign_id, session_entity_id, initiative)
         values ($1, $2, $3, 14)`,
        [encounter.id, campaign.id, goblinA],
      ),
    );

    for (const table of ['session_entities', 'encounters', 'encounter_combatants']) {
      const rows = await db.as(player, (s) => s.query(`select * from public.${table}`));
      expect(rows, table).toEqual([]);
    }
    await expectSqlError(
      db.as(player, (s) => s.query(`select * from public.adjust_session_entity_hp($1, 'heal', 5)`, [goblinA])),
      'P0002',
    );
  });

  it('personagens só entram em combates da própria campanha', async () => {
    const { gm, session, campaign } = await setupScene();
    const elsewhere = await createTable(db);
    const stranger = await createCharacter(db, elsewhere.player, elsewhere.campaign.id, 'Forasteira');
    const encounter = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.encounters (session_id, campaign_id) values ($1, $2) returning id`,
        [session, campaign.id],
      ),
    );
    await expectSqlError(
      db.as(gm, (s) =>
        s.query(
          `insert into public.encounter_combatants (encounter_id, campaign_id, character_id) values ($1, $2, $3)`,
          [encounter.id, campaign.id, stranger],
        ),
      ),
      '22023',
    );
  });

  it('a versão do encontro sobe a cada mudança de turno', async () => {
    const { gm, session, campaign } = await setupScene();
    const encounter = await db.as(gm, (s) =>
      s.one<{ id: string; version: number }>(
        `insert into public.encounters (session_id, campaign_id) values ($1, $2) returning id, version`,
        [session, campaign.id],
      ),
    );
    const advanced = await db.as(gm, (s) =>
      s.query<{ version: number }>(
        `update public.encounters set round = 1, status = 'active' where id = $1 and version = $2 returning version`,
        [encounter.id, encounter.version],
      ),
    );
    expect(advanced).toEqual([{ version: 2 }]);

    // Dois mestres avançando o turno ao mesmo tempo: o segundo usa a versão antiga e
    // não altera nada (a interface recarrega e avisa do conflito).
    const stale = await db.as(gm, (s) =>
      s.query(
        `update public.encounters set round = 2 where id = $1 and version = $2 returning version`,
        [encounter.id, encounter.version],
      ),
    );
    expect(stale).toHaveLength(0);
  });
});

describe('anotações', () => {
  it('respeitam a visibilidade escolhida pelo autor', async () => {
    const { gm, player, otherPlayer, campaign } = await createTable(db);
    const write = (user: TestUser, title: string, visibility: string) =>
      db.as(user, (s) =>
        s.query(
          `insert into public.campaign_notes (campaign_id, title, visibility) values ($1, $2, $3::public.content_visibility)`,
          [campaign.id, title, visibility],
        ),
      );
    await write(gm, 'Mapa do reino', 'members');
    await write(gm, 'Segredos do mestre', 'gm');
    await write(player, 'Diário de Aria', 'author');
    await write(player, 'Pergunta ao mestre', 'gm');

    const titles = async (user: TestUser) =>
      (
        await db.as(user, (s) =>
          s.query<{ title: string }>(
            `select title from public.campaign_notes where campaign_id = $1 order by title`,
            [campaign.id],
          ),
        )
      ).map((row) => row.title);

    expect(await titles(otherPlayer)).toEqual(['Mapa do reino']);
    expect(await titles(player)).toEqual(['Diário de Aria', 'Mapa do reino', 'Pergunta ao mestre']);
    expect(await titles(gm)).toEqual(['Mapa do reino', 'Pergunta ao mestre', 'Segredos do mestre']);
  });

  it('só o autor edita a própria anotação', async () => {
    const { gm, player, campaign } = await createTable(db);
    const note = await db.as(player, (s) =>
      s.one<{ id: string }>(
        `insert into public.campaign_notes (campaign_id, title) values ($1, 'Minha') returning id`,
        [campaign.id],
      ),
    );
    const byGm = await db.as(gm, (s) =>
      s.query(`update public.campaign_notes set title = 'Do mestre' where id = $1 returning id`, [note.id]),
    );
    expect(byGm).toHaveLength(0);
  });

  it('edição com versão desatualizada não sobrescreve a anotação', async () => {
    const { player, campaign } = await createTable(db);
    const note = await db.as(player, (s) =>
      s.one<{ id: string; version: number }>(
        `insert into public.campaign_notes (campaign_id, title) values ($1, 'Pistas') returning id, version`,
        [campaign.id],
      ),
    );
    const update = (title: string) =>
      db.as(player, (s) =>
        s.query<{ version: number }>(
          `update public.campaign_notes set title = $1 where id = $2 and version = $3 returning version`,
          [title, note.id, note.version],
        ),
      );
    expect(await update('Pistas (celular)')).toEqual([{ version: 2 }]);
    expect(await update('Pistas (computador)')).toHaveLength(0);
  });

  it('jogador não recebe dados secretos ao resolver referências de blocos públicos', async () => {
    const { gm, player, campaign } = await createTable(db);
    const hidden = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.creatures (campaign_id, kind, name, visibility) values ($1, 'npc', 'Traidor', 'gm') returning id`,
        [campaign.id],
      ),
    );
    const session = await createSession(db, gm, campaign.id, { published: true });
    await addBlock(db, gm, session, campaign.id, { type: 'npc_ref', data: { creatureId: hidden.id, note: null } });

    // O bloco público chega ao jogador, mas o nome do NPC oculto não (consulta usada pela interface).
    const blocks = await db.as(player, (s) => s.query(`select id from public.session_blocks where session_id = $1`, [session]));
    expect(blocks).toHaveLength(1);
    const names = await db.as(player, (s) => s.query(`select name from public.creatures where id = $1`, [hidden.id]));
    expect(names).toHaveLength(0);
  });
});
