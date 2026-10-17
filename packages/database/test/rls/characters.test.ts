import { applyDamage, applyHealing, type TrackValue } from '@codexveil/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, createCampaign, createCharacter, createTable, resourceId } from '../support/fixtures';
import { TestDatabase, admin, expectSqlError, type TestUser } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

async function visibleCharacters(user: TestUser, campaignId: string): Promise<string[]> {
  const rows = await db.as(user, (s) =>
    s.query<{ name: string }>(
      `select name from public.characters where campaign_id = $1 order by name`,
      [campaignId],
    ),
  );
  return rows.map((row) => row.name);
}

async function setCampaignFlags(
  campaignId: string,
  flags: { party_sheets_visible?: boolean; players_can_edit_sheets?: boolean },
) {
  for (const [column, value] of Object.entries(flags)) {
    await db.as(admin, (s) =>
      s.query(`update public.campaigns set ${column} = $1 where id = $2`, [value, campaignId]),
    );
  }
}

async function adjust(user: TestUser, resource: string, operation: string, amount: number) {
  return db.as(user, (s) =>
    s.one<{ current: number; max: number | null; temp: number }>(
      `select current, max, temp from public.adjust_character_resource($1, $2, $3)`,
      [resource, operation, amount],
    ),
  );
}

describe('criação', () => {
  it('cria personagem com trilhas iniciais de forma atômica', async () => {
    const { player, campaign } = await createTable(db);
    const id = await createCharacter(db, player, campaign.id);
    const resources = await db.as(player, (s) =>
      s.query<{ key: string }>(
        `select key from public.character_resources where character_id = $1 order by sort_order`,
        [id],
      ),
    );
    expect(resources.map((r) => r.key)).toEqual(['hp', 'hit_dice_d8', 'ki']);
  });

  it('não vincula personagem a campanha da qual o dono não participa', async () => {
    const { campaign, outsider } = await createTable(db);
    await expectSqlError(createCharacter(db, outsider, campaign.id), '42501');
  });

  it('exige o mesmo sistema da campanha', async () => {
    const { player, campaign } = await createTable(db);
    await db.as(admin, (s) =>
      s.exec(`insert into public.rpg_systems (id, name, short_name) values ('outro', 'Outro sistema', 'Outro')`),
    );
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`select public.create_character('X', 'outro', $1)`, [campaign.id]),
      ),
      '22023',
    );
  });

  it('não cria personagem em nome de outra pessoa', async () => {
    const { player, otherPlayer } = await createTable(db);
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`insert into public.characters (name, system_id, owner_id) values ('X', 'dnd5e', $1)`, [
          otherPlayer.id,
        ]),
      ),
      '42501',
    );
  });
});

describe('criação guiada (inventário e habilidades iniciais)', () => {
  const items = [
    { name: 'Cota de malha', category: 'armor', quantity: 1, weight: 27.5, description: '', notes: '', isEquipped: true, sortOrder: 0 },
    { name: 'Azagaia', category: 'weapon', quantity: 8, weight: 1, description: '', notes: '', isEquipped: false, sortOrder: 1 },
  ];
  const abilities = [
    { kind: 'class_feature', name: 'Fúria', source: 'Bárbaro 1º nível', description: 'Resumo', data: {}, resourceKey: 'ki', sortOrder: 0 },
    { kind: 'spell', name: 'Bless', source: 'Clérigo · SRD 5.2', description: '', data: { circle: 1 }, sortOrder: 1 },
    { kind: 'attack', name: 'Espada grande', source: 'Arma marcial', description: '', data: { damage: '2d6' }, sortOrder: 2 },
  ];

  function createFull(owner: TestUser, campaignId: string | null) {
    return db.as(owner, (s) =>
      s.one<{ id: string }>(
        `select public.create_character('Brienne', 'dnd5e', $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb) as id`,
        [
          campaignId,
          JSON.stringify({ schemaVersion: 1 }),
          JSON.stringify([{ key: 'ki', label: 'Fúria', current: 2, max: 2, recovery: 'long_rest', display: 'pool', sortOrder: 100 }]),
          JSON.stringify(items),
          JSON.stringify(abilities),
        ],
      ),
    );
  }

  it('grava inventário e habilidades na mesma transação, ligando a trilha pela chave', async () => {
    const { player, campaign } = await createTable(db);
    const { id } = await createFull(player, campaign.id);
    const savedItems = await db.as(player, (s) =>
      s.query<{ name: string; quantity: number; weight: string; is_equipped: boolean }>(
        `select name, quantity, weight::text, is_equipped from public.character_items where character_id = $1 order by sort_order`,
        [id],
      ),
    );
    expect(savedItems).toEqual([
      { name: 'Cota de malha', quantity: 1, weight: '27.50', is_equipped: true },
      { name: 'Azagaia', quantity: 8, weight: '1.00', is_equipped: false },
    ]);
    const savedAbilities = await db.as(player, (s) =>
      s.query<{ name: string; kind: string; linked: boolean }>(
        `select a.name, a.kind::text as kind, (a.resource_id = r.id) as linked
         from public.character_abilities a left join public.character_resources r on r.character_id = a.character_id and r.key = 'ki'
         where a.character_id = $1 order by a.sort_order`,
        [id],
      ),
    );
    expect(savedAbilities.map((row) => [row.name, row.kind])).toEqual([
      ['Fúria', 'class_feature'],
      ['Bless', 'spell'],
      ['Espada grande', 'attack'],
    ]);
    expect(savedAbilities[0]?.linked).toBe(true);
  });

  it('com a ficha travada pelo mestre, o jogador ainda cria o personagem completo', async () => {
    const { player, campaign } = await createTable(db);
    await setCampaignFlags(campaign.id, { players_can_edit_sheets: false });
    const { id } = await createFull(player, campaign.id);
    const count = await db.as(player, (s) =>
      s.one<{ total: number }>(`select count(*)::int as total from public.character_abilities where character_id = $1`, [id]),
    );
    expect(count.total).toBe(3);
    // Depois da criação, a construção volta a ser exclusiva do mestre.
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`insert into public.character_abilities (character_id, kind, name) values ($1, 'feat', 'Sortudo')`, [id]),
      ),
      '42501',
    );
  });

  it('rejeita listas grandes demais', async () => {
    const { player } = await createTable(db);
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`select public.create_character('X', 'dnd5e', null, '{}'::jsonb, '[]'::jsonb, $1::jsonb)`, [
          JSON.stringify(Array.from({ length: 201 }, (_, index) => ({ name: `Item ${index}` }))),
        ]),
      ),
      '22023',
    );
  });
});

describe('mestres e personagens', () => {
  it('mestre e co-mestre não criam personagens na própria campanha', async () => {
    const { gm, coGm, campaign } = await createTable(db);
    await expectSqlError(createCharacter(db, gm, campaign.id), 'CVGMC');
    await expectSqlError(createCharacter(db, coGm, campaign.id), 'CVGMC');
  });

  it('mestre não vincula uma ficha pessoal à própria campanha', async () => {
    const { gm, campaign } = await createTable(db);
    const personal = await createCharacter(db, gm, null, 'Ficha pessoal');
    await expectSqlError(
      db.as(gm, (s) => s.query(`select public.set_character_campaign($1, $2)`, [personal, campaign.id])),
      'CVGMC',
    );
  });

  it('mestre de uma campanha pode jogar em outra', async () => {
    const { gm } = await createTable(db);
    const other = await createTable(db);
    await addMember(db, other.campaign.id, gm);
    const id = await createCharacter(db, gm, other.campaign.id, 'Convidado');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('visibilidade das fichas', () => {
  it('jogadores veem o grupo por padrão; estranhos não veem nada', async () => {
    const { player, otherPlayer, outsider, campaign } = await createTable(db);
    await createCharacter(db, player, campaign.id, 'Aria');
    await createCharacter(db, otherPlayer, campaign.id, 'Borin');
    expect(await visibleCharacters(player, campaign.id)).toEqual(['Aria', 'Borin']);
    expect(await visibleCharacters(outsider, campaign.id)).toEqual([]);
  });

  it('com fichas do grupo ocultas, jogador vê só a própria; mestre vê todas', async () => {
    const { gm, player, otherPlayer, campaign } = await createTable(db);
    await createCharacter(db, player, campaign.id, 'Aria');
    const borin = await createCharacter(db, otherPlayer, campaign.id, 'Borin');
    await setCampaignFlags(campaign.id, { party_sheets_visible: false });

    expect(await visibleCharacters(player, campaign.id)).toEqual(['Aria']);
    expect(await visibleCharacters(gm, campaign.id)).toEqual(['Aria', 'Borin']);

    const hidden = await db.as(player, (s) =>
      s.query(`select * from public.character_resources where character_id = $1`, [borin]),
    );
    expect(hidden).toHaveLength(0);
  });

  it('personagem sem campanha é privado', async () => {
    const { gm, player } = await createTable(db);
    const solo = await createCharacter(db, player, null, 'Solo');
    const seen = await db.as(gm, (s) => s.query(`select id from public.characters where id = $1`, [solo]));
    expect(seen).toHaveLength(0);
  });
});

describe('edição', () => {
  it('jogador não altera a ficha de outro jogador (nem com o UUID correto)', async () => {
    const { player, otherPlayer, campaign } = await createTable(db);
    const borin = await createCharacter(db, otherPlayer, campaign.id, 'Borin');

    const updated = await db.as(player, (s) =>
      s.query(`update public.characters set name = 'Roubado' where id = $1 returning id`, [borin]),
    );
    expect(updated).toHaveLength(0);

    await expectSqlError(adjust(player, await resourceId(db, borin, 'hp'), 'damage', 5), 'P0002');

    await expectSqlError(
      db.as(player, (s) =>
        s.query(`insert into public.character_items (character_id, name) values ($1, 'Item plantado')`, [
          borin,
        ]),
      ),
      '42501',
    );
  });

  it('mestre edita fichas da campanha; dono edita a própria', async () => {
    const { gm, player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    const byGm = await db.as(gm, (s) =>
      s.query(`update public.characters set name = 'Aria, a Bruxa' where id = $1 returning id`, [aria]),
    );
    expect(byGm).toHaveLength(1);
    const byOwner = await db.as(player, (s) =>
      s.query(`update public.characters set name = 'Aria' where id = $1 returning id`, [aria]),
    );
    expect(byOwner).toHaveLength(1);
  });

  it('com fichas travadas, o dono não altera a construção, mas altera vida e inventário', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    await setCampaignFlags(campaign.id, { players_can_edit_sheets: false });

    const sheetUpdate = await db.as(player, (s) =>
      s.query(`update public.characters set sheet = '{"x":1}' where id = $1 returning id`, [aria]),
    );
    expect(sheetUpdate).toHaveLength(0);

    const hp = await adjust(player, await resourceId(db, aria, 'hp'), 'damage', 3);
    expect(hp.current).toBe(17);

    await db.as(player, (s) =>
      s.query(`insert into public.character_items (character_id, name) values ($1, 'Corda')`, [aria]),
    );
  });

  it('com fichas travadas, o jogador gerencia moedas, mas não cria habilidades', async () => {
    const { player, gm, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    await setCampaignFlags(campaign.id, { players_can_edit_sheets: false });

    // Moedas são trilhas de recurso (estado de jogo), criadas na primeira alteração.
    const coin = await db.as(player, (s) =>
      s.one<{ id: string }>(
        `insert into public.character_resources (character_id, key, label, current, max, recovery, display, sort_order)
         values ($1, 'currency_gp', 'Peças de ouro', 30, null, 'manual', 'pool', 203) returning id`,
        [aria],
      ),
    );
    expect((await adjust(player, coin.id, 'spend', 12)).current).toBe(18);
    expect((await adjust(player, coin.id, 'set_current', 250)).current).toBe(250);

    // Habilidades fazem parte da construção da ficha, travada pelo mestre.
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`insert into public.character_abilities (character_id, kind, name) values ($1, 'feat', 'Sortudo')`, [aria]),
      ),
      '42501',
    );

    await db.as(gm, (s) =>
      s.query(`insert into public.character_abilities (character_id, kind, name) values ($1, 'feat', 'Sortudo')`, [aria]),
    );
  });

  it('versão e dono não são alterados diretamente pelo cliente', async () => {
    const { player, otherPlayer, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    for (const assignment of ['version = 99', `owner_id = '${otherPlayer.id}'`, "system_id = 'dnd5e'"]) {
      await expectSqlError(
        db.as(player, (s) => s.query(`update public.characters set ${assignment} where id = $1`, [aria])),
        '42501',
      );
    }
  });

  it('controle otimista: gravação com versão antiga não afeta linhas', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    const first = await db.as(player, (s) =>
      s.query<{ version: number }>(
        `update public.characters set sheet = '{"schemaVersion":1,"a":1}' where id = $1 and version = 1 returning version`,
        [aria],
      ),
    );
    expect(first).toEqual([{ version: 2 }]);
    const stale = await db.as(player, (s) =>
      s.query(
        `update public.characters set sheet = '{"schemaVersion":1,"a":2}' where id = $1 and version = 1 returning version`,
        [aria],
      ),
    );
    expect(stale).toHaveLength(0);
  });

  it('mudanças de vida não alteram a versão da ficha, mas sinalizam o personagem', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    const before = await db.as(admin, (s) =>
      s.one<{ version: number; live_updated_at: string }>(
        `select version, live_updated_at from public.characters where id = $1`,
        [aria],
      ),
    );
    await adjust(player, await resourceId(db, aria, 'hp'), 'damage', 1);
    const after = await db.as(admin, (s) =>
      s.one<{ version: number; live_updated_at: string }>(
        `select version, live_updated_at from public.characters where id = $1`,
        [aria],
      ),
    );
    expect(after.version).toBe(before.version);
    expect(new Date(after.live_updated_at).getTime()).toBeGreaterThan(
      new Date(before.live_updated_at).getTime(),
    );
  });

  it('somente o dono exclui o personagem', async () => {
    const { gm, player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    const byGm = await db.as(gm, (s) =>
      s.query(`delete from public.characters where id = $1 returning id`, [aria]),
    );
    expect(byGm).toHaveLength(0);
  });
});

describe('operações atômicas de recursos', () => {
  it('seguem exatamente as regras do domínio', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    const hp = await resourceId(db, aria, 'hp');

    let expected: TrackValue = { current: 20, max: 20, temp: 0 };
    await adjust(player, hp, 'set_temp', 5);
    expected = { ...expected, temp: 5 };

    for (const [operation, amount] of [
      ['damage', 3],
      ['damage', 8],
      ['heal', 4],
      ['damage', 100],
      ['heal', 50],
    ] as const) {
      const actual = await adjust(player, hp, operation, amount);
      expected = operation === 'damage' ? applyDamage(expected, amount) : applyHealing(expected, amount);
      expect(actual, `${operation} ${amount}`).toEqual(expected);
    }
  });

  it('alterações simultâneas de mestre e jogador não se perdem', async () => {
    const { gm, player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    const hp = await resourceId(db, aria, 'hp');
    await Promise.all([
      adjust(gm, hp, 'damage', 7),
      adjust(player, hp, 'damage', 2),
      adjust(gm, hp, 'heal', 1),
    ]);
    const final = await db.as(player, (s) =>
      s.one<{ current: number }>(`select current from public.character_resources where id = $1`, [hp]),
    );
    expect(final.current).toBe(20 - 7 - 2 + 1);
  });

  it('rejeita quantidades negativas e operações desconhecidas', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    const hp = await resourceId(db, aria, 'hp');
    await expectSqlError(adjust(player, hp, 'damage', -5), '22023');
    await expectSqlError(adjust(player, hp, 'explodir', 5), '22023');
  });

  it('descansos restauram conforme a recuperação de cada trilha', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    const hp = await resourceId(db, aria, 'hp');
    const ki = await resourceId(db, aria, 'ki');
    await adjust(player, hp, 'damage', 10);
    await adjust(player, hp, 'set_temp', 4);
    await adjust(player, ki, 'spend', 2);

    await db.as(player, (s) => s.query(`select public.take_character_rest($1, 'short_rest')`, [aria]));
    const afterShort = await db.as(player, (s) =>
      s.query<{ key: string; current: number; temp: number }>(
        `select key, current, temp from public.character_resources where character_id = $1 and key in ('hp','ki') order by key`,
        [aria],
      ),
    );
    expect(afterShort).toEqual([
      { key: 'hp', current: 10, temp: 4 },
      { key: 'ki', current: 2, temp: 0 },
    ]);

    await db.as(player, (s) => s.query(`select public.take_character_rest($1, 'long_rest')`, [aria]));
    const hpAfterLong = await db.as(player, (s) =>
      s.one<{ current: number; temp: number }>(
        `select current, temp from public.character_resources where id = $1`,
        [hp],
      ),
    );
    expect(hpAfterLong).toEqual({ current: 20, temp: 0 });
  });

  it('quantidade de itens nunca fica negativa', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    const item = await db.as(player, (s) =>
      s.one<{ id: string }>(
        `insert into public.character_items (character_id, name, quantity) values ($1, 'Poção', 2) returning id`,
        [aria],
      ),
    );
    const result = await db.as(player, (s) =>
      s.one<{ quantity: number }>(`select quantity from public.adjust_item_quantity($1, -5)`, [item.id]),
    );
    expect(result.quantity).toBe(0);
  });
});

describe('duração das condições', () => {
  async function applyCondition(user: TestUser, characterId: string, key: string, rounds: number | null) {
    await db.as(user, (s) =>
      s.query(
        `insert into public.character_conditions (character_id, key, rounds_remaining) values ($1, $2, $3)`,
        [characterId, key, rounds],
      ),
    );
  }

  async function conditionsOf(user: TestUser, characterId: string) {
    return db.as(user, (s) =>
      s.query<{ key: string; rounds_remaining: number | null }>(
        `select key, rounds_remaining from public.character_conditions where character_id = $1 order by key`,
        [characterId],
      ),
    );
  }

  async function tick(user: TestUser, characterId: string, rounds = 1) {
    const rows = await db.as(user, (s) =>
      s.query<{ key: string }>(`select key from public.tick_character_conditions($1, $2) as key order by key`, [
        characterId,
        rounds,
      ]),
    );
    return rows.map((row) => row.key);
  }

  it('passar rodadas diminui as durações e remove as que terminam', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    await applyCondition(player, aria, 'poisoned', 2);
    await applyCondition(player, aria, 'stunned', 1);
    await applyCondition(player, aria, 'prone', null);

    expect(await tick(player, aria)).toEqual(['stunned']);
    expect(await conditionsOf(player, aria)).toEqual([
      { key: 'poisoned', rounds_remaining: 1 },
      { key: 'prone', rounds_remaining: null },
    ]);
    expect(await tick(player, aria)).toEqual(['poisoned']);
    expect(await tick(player, aria, 50)).toEqual([]);
    expect(await conditionsOf(player, aria)).toEqual([{ key: 'prone', rounds_remaining: null }]);
  });

  it('várias rodadas de uma vez encerram tudo o que dura menos', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    await applyCondition(player, aria, 'blinded', 3);
    await applyCondition(player, aria, 'frightened', 10);
    expect(await tick(player, aria, 5)).toEqual(['blinded']);
    expect(await conditionsOf(player, aria)).toEqual([{ key: 'frightened', rounds_remaining: 5 }]);
  });

  it('o mestre passa rodadas; outro jogador e estranhos não', async () => {
    const { gm, player, otherPlayer, outsider, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    await applyCondition(player, aria, 'poisoned', 1);
    await expectSqlError(tick(otherPlayer, aria), 'P0002');
    await expectSqlError(tick(outsider, aria), 'P0002');
    expect(await tick(gm, aria)).toEqual(['poisoned']);
  });

  it('rejeita durações e quantidades de rodadas inválidas', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    await expectSqlError(applyCondition(player, aria, 'poisoned', 0), '23514');
    await expectSqlError(applyCondition(player, aria, 'poisoned', 10001), '23514');
    await expectSqlError(tick(player, aria, 0), '22023');
  });

  it('o jogador altera a duração das condições do próprio personagem', async () => {
    const { player, otherPlayer, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    await applyCondition(player, aria, 'poisoned', null);
    await db.as(player, (s) =>
      s.query(`update public.character_conditions set rounds_remaining = 4 where character_id = $1`, [aria]),
    );
    const blocked = await db.as(otherPlayer, (s) =>
      s.query(`update public.character_conditions set rounds_remaining = 1 where character_id = $1 returning id`, [aria]),
    );
    expect(blocked).toEqual([]);
    expect(await conditionsOf(player, aria)).toEqual([{ key: 'poisoned', rounds_remaining: 4 }]);
  });
});

describe('histórico e cópias de segurança', () => {
  it('guarda a versão anterior da ficha ao editar', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    await db.as(player, (s) =>
      s.query(`update public.characters set sheet = '{"schemaVersion":1,"x":1}' where id = $1`, [aria]),
    );
    await db.as(player, (s) =>
      s.query(`update public.characters set sheet = '{"schemaVersion":1,"x":2}' where id = $1`, [aria]),
    );
    const snapshots = await db.as(player, (s) =>
      s.query<{ sheet: unknown; version: number }>(
        `select sheet, version from public.character_snapshots where character_id = $1`,
        [aria],
      ),
    );
    // Rajadas de edição geram uma única cópia (a ficha antes da primeira alteração).
    expect(snapshots).toEqual([{ sheet: { schemaVersion: 1 }, version: 1 }]);
  });

  it('eventos são registrados em nome de quem os cria e não podem ser apagados', async () => {
    const { player, otherPlayer, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    await db.as(player, (s) =>
      s.query(
        `insert into public.character_events (character_id, kind, summary) values ($1, 'level_up', 'Subiu para o nível 2')`,
        [aria],
      ),
    );
    await expectSqlError(
      db.as(otherPlayer, (s) =>
        s.query(
          `insert into public.character_events (character_id, kind, summary) values ($1, 'note', 'Falso')`,
          [aria],
        ),
      ),
      '42501',
    );
    await expectSqlError(
      db.as(player, (s) => s.query(`delete from public.character_events where character_id = $1`, [aria])),
      '42501',
    );
  });
});

describe('isolamento', () => {
  it('mestre de outra campanha não acessa personagens desta', async () => {
    const { player, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    const otherGm = await db.createUser('Outro Mestre');
    await createCampaign(db, otherGm, 'Outra mesa');
    const seen = await db.as(otherGm, (s) =>
      s.query(`select id from public.characters where id = $1`, [aria]),
    );
    expect(seen).toHaveLength(0);
    await expectSqlError(adjust(otherGm, await resourceId(db, aria, 'hp'), 'damage', 1), 'P0002');
  });
});
