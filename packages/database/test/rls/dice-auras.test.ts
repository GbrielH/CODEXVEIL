import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestDatabase, admin, expectSqlError } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

describe('auras dos dados (somente criadores)', () => {
  it('só a conta de criador grava aura; ninguém liga a própria flag', async () => {
    const creator = await db.createUser('Criador');
    const player = await db.createUser('Jogador');
    await db.as(admin, (s) =>
      s.query(`update public.profiles set creator_features = true where id = $1`, [creator.id]),
    );

    // Ninguém liga a própria flag (a coluna não está entre as que o usuário pode alterar).
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`update public.profiles set creator_features = true where id = $1`, [player.id]),
      ),
      '42501',
    );

    // Dados salvos: criador grava; jogador recebe recusa; aura inválida também é recusada.
    const saved = await db.as(creator, (s) =>
      s.one<{ aura: string }>(
        `insert into public.user_dice (name, aura) values ('Rubro', 'blood') returning aura`,
      ),
    );
    expect(saved.aura).toBe('blood');
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`insert into public.user_dice (name, aura) values ('X', 'storm')`),
      ),
      '42501',
    );
    await expectSqlError(
      db.as(creator, (s) =>
        s.query(`insert into public.user_dice (name, aura) values ('X', 'fogo')`),
      ),
      '23514',
    );
    // Auras novas (engrenagens, floresta, fogo, dragão) também valem para o criador.
    for (const aura of [
      'gears',
      'forest',
      'fire',
      'skeleton',
      'cosmic',
      'tarot',
      'glitch',
      'ink',
      'abyss',
      'time',
      'gold',
      'frog',
      'vampire',
      'bard',
      'rainbow',
      'poison',
      'cat',
      'meteor',
      'party',
      'wind',
      'ritual',
    ]) {
      const row = await db.as(creator, (s) =>
        s.one<{ aura: string }>(
          `insert into public.user_dice (name, aura) values ('Novo', $1) returning aura, id`,
          [aura],
        ),
      );
      expect(row.aura).toBe(aura);
      // Apaga em seguida (há limite de 12 dados salvos por conta).
      await db.as(creator, (s) =>
        s.query(`delete from public.user_dice where id = $1`, [(row as { id?: string }).id]),
      );
    }

    // Preferências: a aura some para quem não é criador e fica para o criador.
    const prefs = JSON.stringify({ dice: { color: '#112233', aura: 'holy' } });
    const playerPrefs = await db.as(player, (s) =>
      s.one<{ aura: string | null }>(
        `update public.profiles set preferences = $2::jsonb where id = $1 returning preferences #>> '{dice,aura}' as aura`,
        [player.id, prefs],
      ),
    );
    expect(playerPrefs.aura).toBeNull();
    const creatorPrefs = await db.as(creator, (s) =>
      s.one<{ aura: string | null }>(
        `update public.profiles set preferences = $2::jsonb where id = $1 returning preferences #>> '{dice,aura}' as aura`,
        [creator.id, prefs],
      ),
    );
    expect(creatorPrefs.aura).toBe('holy');
  });
});
