import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestDatabase, type TestUser } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

async function importBook(owner: TestUser, summary = 'Inventado.'): Promise<string> {
  const pack = await db.as(owner, (s) =>
    s.one<{ id: string }>(
      `insert into public.book_packs (book_key, name, category) values ('guia-igual', 'Guia', 'player') returning id`,
    ),
  );
  await db.as(owner, (s) =>
    s.query(
      `insert into public.book_entries (pack_id, kind, key, name, data)
       values ($1, 'species', 'povo-teste', 'Povo de Teste', jsonb_build_object('summary', $2::text))`,
      [pack.id, summary],
    ),
  );
  await db.as(owner, (s) =>
    s.query(`select public.finish_book_import($1, '{"species":1}'::jsonb)`, [pack.id]),
  );
  return pack.id;
}

const entriesOf = (user: TestUser) =>
  db.as(user, (s) => s.query<{ pack_id: string }>(`select pack_id from public.book_entries`));

describe('livros: uma cópia por conteúdo', () => {
  it('o segundo exemplar igual aponta para o primeiro e herda o conteúdo se o primeiro for apagado', async () => {
    const ana = await db.createUser('ana-dedupe@example.com');
    const beto = await db.createUser('beto-dedupe@example.com');
    const caio = await db.createUser('caio-dedupe@example.com');
    const first = await importBook(ana);
    const second = await importBook(beto);
    const other = await importBook(caio, 'Outra edição.');

    const total = await db.as(ana, (s) =>
      s.one<{ count: string }>(`select count(*) from public.book_entries`),
    );
    expect(Number(total.count)).toBe(1);
    const beto_pack = await db.as(beto, (s) =>
      s.one<{ content_pack_id: string | null; is_ready: boolean }>(
        `select content_pack_id, is_ready from public.book_packs where id = $1`,
        [second],
      ),
    );
    expect(beto_pack).toEqual({ content_pack_id: first, is_ready: true });
    // Beto lê o conteúdo guardado no livro da Ana; o livro diferente do Caio continua separado.
    expect((await entriesOf(beto)).map((row) => row.pack_id)).toEqual([first]);
    expect((await entriesOf(caio)).map((row) => row.pack_id)).toEqual([other]);

    await db.as(ana, (s) => s.query(`delete from public.book_packs where id = $1`, [first]));
    expect((await entriesOf(beto)).map((row) => row.pack_id)).toEqual([second]);
    expect(await entriesOf(ana)).toEqual([]);
  });
});
