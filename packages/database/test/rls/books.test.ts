import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, createCampaign } from '../support/fixtures';
import { TestDatabase, expectSqlError, type TestUser } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

async function importBook(owner: TestUser, bookKey: string, ready = true): Promise<string> {
  const pack = await db.as(owner, (s) =>
    s.one<{ id: string }>(
      `insert into public.book_packs (book_key, name, category) values ($1, 'Guia de Teste', 'player') returning id`,
      [bookKey],
    ),
  );
  await db.as(owner, (s) =>
    s.query(
      `insert into public.book_entries (pack_id, kind, key, name, data)
       values ($1, 'species', 'povo-teste', 'Povo de Teste', '{"summary":"Inventado."}'::jsonb),
              ($1, 'monster', 'fera-teste', 'Fera de Teste', '{"ac":12}'::jsonb)`,
      [pack.id],
    ),
  );
  if (ready) await db.as(owner, (s) => s.query(`update public.book_packs set is_ready = true where id = $1`, [pack.id]));
  return pack.id;
}

async function releaseBooks(gm: TestUser, campaignId: string, books: string[]) {
  await db.as(gm, (s) =>
    s.query(`update public.campaigns set character_rules = jsonb_build_object('sourcebooks', $2::jsonb) where id = $1`, [
      campaignId,
      JSON.stringify(books),
    ]),
  );
}

describe('livros importados', () => {
  it('só o dono vê o livro até liberá-lo numa campanha; depois, só a mesa dessa campanha', async () => {
    const gm = await db.createUser('mestre-livros@example.com');
    const player = await db.createUser('jogador-livros@example.com');
    const outsider = await db.createUser('curioso-livros@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);
    const packId = await importBook(gm, 'guia-de-teste');

    const ownerView = await db.as(gm, (s) => s.query<{ name: string }>(`select name from public.book_entries order by name`));
    expect(ownerView.map((row) => row.name)).toEqual(['Fera de Teste', 'Povo de Teste']);
    expect(await db.as(player, (s) => s.query(`select 1 from public.book_entries`))).toEqual([]);
    expect(await db.as(player, (s) => s.query(`select 1 from public.book_packs`))).toEqual([]);

    await releaseBooks(gm, campaign.id, ['guia-de-teste']);
    expect(await db.as(player, (s) => s.query(`select id from public.book_packs`))).toEqual([{ id: packId }]);
    // O jogador lê o conteúdo de personagem; o monstro fica com os mestres.
    expect(await db.as(player, (s) => s.query(`select name from public.book_entries`))).toEqual([{ name: 'Povo de Teste' }]);
    expect(await db.as(outsider, (s) => s.query(`select 1 from public.book_entries`))).toEqual([]);

    // Retirar o livro da campanha corta o acesso.
    await releaseBooks(gm, campaign.id, []);
    expect(await db.as(player, (s) => s.query(`select 1 from public.book_entries`))).toEqual([]);
  });

  it('os mestres da campanha leem tudo; os jogadores não leem o texto de aventuras', async () => {
    const owner = await db.createUser('dono-aventura@example.com');
    const coGm = await db.createUser('comestre-aventura@example.com');
    const player = await db.createUser('jogador-aventura@example.com');
    const campaign = await createCampaign(db, owner);
    await addMember(db, campaign.id, coGm, 'gm');
    await addMember(db, campaign.id, player);
    const pack = await db.as(owner, (s) =>
      s.one<{ id: string }>(`insert into public.book_packs (book_key, name, category) values ('aventura-teste', 'Aventura', 'adventure') returning id`),
    );
    await db.as(owner, (s) =>
      s.query(
        `insert into public.book_entries (pack_id, kind, key, name, data)
         values ($1, 'section', 'capitulo-1', 'Capítulo 1', '{"order":0}'::jsonb),
                ($1, 'magic_item', 'espada-teste', 'Espada de Teste', '{}'::jsonb),
                ($1, 'feat', 'talento-teste', 'Talento de Teste', '{"description":""}'::jsonb)`,
        [pack.id],
      ),
    );
    await db.as(owner, (s) => s.query(`update public.book_packs set is_ready = true where id = $1`, [pack.id]));
    await releaseBooks(owner, campaign.id, ['aventura-teste']);

    const coGmView = await db.as(coGm, (s) => s.query<{ name: string }>(`select name from public.book_entries order by name`));
    expect(coGmView.map((row) => row.name)).toEqual(['Capítulo 1', 'Espada de Teste', 'Talento de Teste']);
    expect(await db.as(player, (s) => s.query(`select name from public.book_entries`))).toEqual([{ name: 'Talento de Teste' }]);
  });

  it('a mesa não vê livros incompletos e não altera o conteúdo', async () => {
    const gm = await db.createUser('mestre-livros-2@example.com');
    const player = await db.createUser('jogador-livros-2@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);
    const packId = await importBook(gm, 'livro-pela-metade', false);
    await releaseBooks(gm, campaign.id, ['livro-pela-metade']);
    expect(await db.as(player, (s) => s.query(`select 1 from public.book_entries`))).toEqual([]);

    await db.as(gm, (s) => s.query(`update public.book_packs set is_ready = true where id = $1`, [packId]));
    expect(await db.as(player, (s) => s.query(`select 1 from public.book_entries`))).toHaveLength(1);

    await expectSqlError(
      db.as(player, (s) =>
        s.query(`insert into public.book_entries (pack_id, kind, key, name) values ($1, 'feat', 'invasor', 'Invasor')`, [packId]),
      ),
      '42501',
    );
    expect(await db.as(player, (s) => s.query(`update public.book_entries set name = 'Mudado' where pack_id = $1 returning id`, [packId]))).toEqual([]);
    expect(await db.as(player, (s) => s.query(`delete from public.book_packs where id = $1 returning id`, [packId]))).toEqual([]);
  });

  it('um usuário não importa livros em nome de outro nem repete o mesmo livro', async () => {
    const owner = await db.createUser('dono-livros@example.com');
    const intruder = await db.createUser('intruso-livros@example.com');
    const packId = await importBook(owner, 'livro-unico');
    await expectSqlError(
      db.as(intruder, (s) =>
        s.query(`insert into public.book_entries (pack_id, kind, key, name) values ($1, 'feat', 'invasor', 'Invasor')`, [packId]),
      ),
      '42501',
    );
    await expectSqlError(
      db.as(owner, (s) => s.query(`insert into public.book_packs (book_key, name, category) values ('livro-unico', 'De novo', 'player')`)),
      '23505',
    );
    // Chaves fora do padrão são recusadas pelo banco.
    await expectSqlError(
      db.as(owner, (s) => s.query(`insert into public.book_packs (book_key, name, category) values ('Livro Ruim', 'Ruim', 'player')`)),
      '23514',
    );
    // Os contadores de espaço acompanham o conteúdo e não são alterados pelo cliente.
    const counters = await db.as(owner, (s) =>
      s.one<{ entry_total: number; content_bytes: string }>(`select entry_total, content_bytes from public.book_packs where id = $1`, [packId]),
    );
    expect(counters.entry_total).toBe(2);
    expect(Number(counters.content_bytes)).toBeGreaterThan(0);
    await expectSqlError(
      db.as(owner, (s) => s.query(`update public.book_packs set content_bytes = 0 where id = $1`, [packId])),
      '42501',
    );
    await db.as(owner, (s) => s.query(`delete from public.book_entries where pack_id = $1 and kind = 'monster'`, [packId]));
    const after = await db.as(owner, (s) => s.one<{ entry_total: number }>(`select entry_total from public.book_packs where id = $1`, [packId]));
    expect(after.entry_total).toBe(1);

    // Remover o livro remove o conteúdo.
    await db.as(owner, (s) => s.query(`delete from public.book_packs where id = $1`, [packId]));
    expect(await db.as(owner, (s) => s.query(`select 1 from public.book_entries where pack_id = $1`, [packId]))).toEqual([]);
  });
});
