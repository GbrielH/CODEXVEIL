import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, createCampaign, createCharacter } from '../support/fixtures';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

describe('NPCs com ficha completa', () => {
  it('ficam fora de "Meus personagens" até o mestre adicioná-los', async () => {
    const gm = await db.createUser('mestre-npc@example.com');
    const player = await db.createUser('jogador-npc@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);
    const npc = await createCharacter(db, gm, null, 'Velha Morgana');
    await createCharacter(db, gm, null, 'Herói do mestre');

    await db.as(gm, (s) =>
      s.query(`select public.set_character_npc_campaign($1, $2)`, [npc, campaign.id]),
    );
    // Mesmo filtro de `listMyCharacters`.
    const mine = () =>
      db.as(gm, (s) =>
        s.query<{ name: string }>(
          `select name from public.characters where owner_id = auth.uid() and (npc_campaign_id is null or npc_listed) order by name`,
        ),
      );
    expect(await mine()).toEqual([{ name: 'Herói do mestre' }]);

    await db.as(gm, (s) => s.query(`select public.set_character_npc_listed($1, true)`, [npc]));
    expect(await mine()).toHaveLength(2);

    // Só o dono muda; ficha que não é NPC não pode ser marcada.
    await expectSqlError(
      db.as(player, (s) => s.query(`select public.set_character_npc_listed($1, false)`, [npc])),
      '42501',
    );
    const own = await createCharacter(db, player, null, 'Aria');
    await expectSqlError(
      db.as(player, (s) => s.query(`select public.set_character_npc_listed($1, true)`, [own])),
      '42501',
    );
  });
});
