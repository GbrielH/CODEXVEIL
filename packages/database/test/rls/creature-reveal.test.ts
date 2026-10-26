import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, createCampaign } from '../support/fixtures';
import { TestDatabase } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

describe('ficha da criatura liberada por partes', () => {
  it('o jogador só recebe as partes liberadas, de registros revelados; só o mestre escolhe', async () => {
    const gm = await db.createUser('mestre-revelar@example.com');
    const player = await db.createUser('jogador-revelar@example.com');
    const outsider = await db.createUser('fora-revelar@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);
    const creature = await db.as(gm, (s) =>
      s.one<{ id: string }>(`insert into public.creatures (campaign_id, kind, name) values ($1, 'monster', 'Dragão') returning id`, [campaign.id]),
    );
    await db.as(gm, (s) =>
      s.query(
        `update public.creature_gm_data set stats = '{"armorClass": 19, "hitPoints": 200, "actions": [{"name":"Sopro"}]}'::jsonb, secrets = 'fraco a prata' where creature_id = $1`,
        [creature.id],
      ),
    );
    const revealed = () =>
      db.as(player, (s) => s.one<{ stats: Record<string, unknown> }>(`select public.creature_revealed_stats($1) as stats`, [creature.id]));

    // Oculto do grupo: nada, mesmo com partes marcadas.
    await db.as(gm, (s) => s.query(`update public.creatures set revealed_stats = '{armorClass}' where id = $1`, [creature.id]));
    expect((await revealed()).stats).toEqual({});

    // Revelado: só a CA.
    await db.as(gm, (s) => s.query(`update public.creatures set visibility = 'members' where id = $1`, [creature.id]));
    expect((await revealed()).stats).toEqual({ armorClass: 19 });

    // Liberar mais e ocultar de novo.
    await db.as(gm, (s) => s.query(`update public.creatures set revealed_stats = '{armorClass,actions}' where id = $1`, [creature.id]));
    expect((await revealed()).stats).toEqual({ armorClass: 19, actions: [{ name: 'Sopro' }] });
    await db.as(gm, (s) => s.query(`update public.creatures set revealed_stats = '{}' where id = $1`, [creature.id]));
    expect((await revealed()).stats).toEqual({});

    // Jogador não escolhe o que é liberado; quem é de fora não recebe nada.
    const changed = await db.as(player, (s) => s.query(`update public.creatures set revealed_stats = '{hitPoints}' where id = $1 returning id`, [creature.id]));
    expect(changed).toEqual([]);
    expect((await db.as(outsider, (s) => s.one<{ stats: unknown }>(`select public.creature_revealed_stats($1) as stats`, [creature.id]))).stats).toEqual({});
    // Segredos e o resto da ficha continuam fora do alcance do jogador.
    expect(await db.as(player, (s) => s.query(`select secrets from public.creature_gm_data`))).toEqual([]);
  });
});
