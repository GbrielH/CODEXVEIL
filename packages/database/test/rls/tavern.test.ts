import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, createCampaign } from '../support/fixtures';
import { TestDatabase, admin, expectSqlError } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

type User = Awaited<ReturnType<TestDatabase['createUser']>>;
const befriend = async (a: User, b: User) => {
  const { friend_code } = await db.as(b, (s) => s.one<{ friend_code: string }>(`select friend_code from public.profiles where id = $1`, [b.id]));
  await db.as(a, (s) => s.query(`select public.request_friend($1)`, [friend_code]));
  const { id } = await db.as(b, (s) => s.one<{ id: string }>(`select id from public.friendships where addressee_id = $1 and requester_id = $2`, [b.id, a.id]));
  await db.as(b, (s) => s.query(`select public.accept_friend($1)`, [id]));
};

describe('Taverna', () => {
  it('campanha: só participantes leem e escrevem', async () => {
    const gm = await db.createUser('mestre-taverna@example.com');
    const player = await db.createUser('jogador-taverna@example.com');
    const outsider = await db.createUser('fora-taverna@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);

    await db.as(player, (s) => s.query(`insert into public.tavern_messages (campaign_id, body) values ($1, 'Rodada de hidromel!')`, [campaign.id]));
    const read = (who: User) =>
      db.as(who, (s) => s.query<{ body: string }>(`select body from public.tavern_messages where campaign_id = $1`, [campaign.id]));
    expect((await read(gm)).map((row) => row.body)).toEqual(['Rodada de hidromel!']);
    expect(await read(outsider)).toEqual([]);
    await expectSqlError(
      db.as(outsider, (s) => s.query(`insert into public.tavern_messages (campaign_id, body) values ($1, 'oi')`, [campaign.id])),
      '42501',
    );
  });

  it('direta: só entre amigos e só os dois leem', async () => {
    const ana = await db.createUser('ana-taverna@example.com');
    const bia = await db.createUser('bia-taverna@example.com');
    const caio = await db.createUser('caio-taverna@example.com');
    await expectSqlError(db.as(ana, (s) => s.query(`insert into public.tavern_messages (recipient_id, body) values ($1, 'oi')`, [bia.id])), '42501');
    await befriend(ana, bia);
    await db.as(ana, (s) => s.query(`insert into public.tavern_messages (recipient_id, body) values ($1, 'Bora jogar?')`, [bia.id]));
    const read = (who: User) => db.as(who, (s) => s.query<{ body: string }>(`select body from public.tavern_messages where recipient_id is not null`));
    expect((await read(bia)).map((row) => row.body)).toEqual(['Bora jogar?']);
    expect(await read(caio)).toEqual([]);
  });

  it('mensagens com mais de 24 horas somem e são apagadas', async () => {
    const gm = await db.createUser('mestre-velho@example.com');
    const campaign = await createCampaign(db, gm);
    await db.as(admin, (s) =>
      s.query(`insert into public.tavern_messages (campaign_id, sender_id, body, created_at) values ($1, $2, 'Velha', now() - interval '25 hours')`, [
        campaign.id,
        gm.id,
      ]),
    );
    const visible = () => db.as(gm, (s) => s.query<{ body: string }>(`select body from public.tavern_messages where campaign_id = $1`, [campaign.id]));
    expect(await visible()).toEqual([]);
    await db.as(gm, (s) => s.query(`insert into public.tavern_messages (campaign_id, body) values ($1, 'Nova')`, [campaign.id]));
    const all = await db.as(admin, (s) => s.query<{ body: string }>(`select body from public.tavern_messages where campaign_id = $1`, [campaign.id]));
    expect(all.map((row) => row.body)).toEqual(['Nova']);
  });

  it('imagens seguem quem lê a mensagem; o Tomo responde a pedido de quem chamou', async () => {
    const gm = await db.createUser('mestre-imagem@example.com');
    const player = await db.createUser('jogador-imagem@example.com');
    const outsider = await db.createUser('fora-imagem@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);
    const path = `tavern/${campaign.id}/mapa.webp`;
    const canWrite = (who: User) => db.as(who, (s) => s.one<{ ok: boolean }>(`select private.can_write_campaign_media($1) as ok`, [path]));
    const canRead = (who: User) => db.as(who, (s) => s.one<{ ok: boolean }>(`select private.can_read_campaign_media($1) as ok`, [path]));
    expect((await canWrite(player)).ok).toBe(true);
    expect((await canWrite(outsider)).ok).toBe(false);

    await db.as(player, (s) => s.query(`insert into public.tavern_messages (campaign_id, body, image_path) values ($1, '', $2)`, [campaign.id, path]));
    expect((await canRead(gm)).ok).toBe(true);
    expect((await canRead(outsider)).ok).toBe(false);

    await db.as(player, (s) => s.query(`select public.tavern_tomo_reply($1, null, 'Saudações, aventureiros!')`, [campaign.id]));
    const tomo = await db.as(gm, (s) =>
      s.query<{ from_tomo: boolean; sender_id: string }>(`select from_tomo, sender_id from public.tavern_messages where campaign_id = $1 and from_tomo`, [campaign.id]),
    );
    expect(tomo).toEqual([{ from_tomo: true, sender_id: player.id }]);
    await expectSqlError(db.as(outsider, (s) => s.query(`select public.tavern_tomo_reply($1, null, 'oi')`, [campaign.id])), '42501');
  });
});
