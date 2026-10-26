import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, createCampaign } from '../support/fixtures';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

type User = Awaited<ReturnType<TestDatabase['createUser']>>;
const codeOf = (user: User) =>
  db.as(user, (s) => s.one<{ friend_code: string }>(`select friend_code from public.profiles where id = $1`, [user.id]));
const request = (user: User, code: string) =>
  db.as(user, (s) => s.one<{ r: { ok: boolean; status?: string; reason?: string } }>(`select public.request_friend($1) as r`, [code]));

describe('amigos, convite direto e ficha compartilhada', () => {
  it('pedido por código, aceite e perfil visível só entre amigos', async () => {
    const ana = await db.createUser('ana-amigos');
    const bia = await db.createUser('bia-amigos');
    const caio = await db.createUser('caio-amigos');
    const { friend_code } = await codeOf(bia);
    expect(friend_code).toMatch(/^[A-Z2-9]{8}$/);

    // Antes: Ana não vê o perfil de Bia.
    expect(await db.as(ana, (s) => s.query(`select id from public.profiles where id = $1`, [bia.id]))).toEqual([]);

    expect((await request(ana, friend_code.toLowerCase())).r).toEqual({ ok: true, status: 'pending' });
    expect((await request(ana, 'XXXXXXXX')).r.reason).toBe('not_found');
    // Com o pedido, os nomes aparecem; Caio continua sem ver.
    expect(await db.as(ana, (s) => s.query(`select id from public.profiles where id = $1`, [bia.id]))).toHaveLength(1);
    expect(await db.as(caio, (s) => s.query(`select id from public.profiles where id = $1`, [bia.id]))).toEqual([]);

    // Só a destinatária aceita.
    const { id } = await db.as(ana, (s) => s.one<{ id: string }>(`select id from public.friendships`));
    await expectSqlError(db.as(ana, (s) => s.query(`select public.accept_friend($1)`, [id])), 'P0002');
    await db.as(bia, (s) => s.query(`select public.accept_friend($1)`, [id]));
    expect((await db.as(ana, (s) => s.one<{ status: string }>(`select status from public.friendships`))).status).toBe('accepted');
    expect(await db.as(caio, (s) => s.query(`select id from public.friendships`))).toEqual([]);
  });

  it('o mestre convida um amigo direto; só ele aceita; o e-mail não aparece', async () => {
    const gm = await db.createUser('mestre-amigos');
    const friend = await db.createUser('amigo-convite');
    const stranger = await db.createUser('estranho-convite');
    const campaign = await createCampaign(db, gm);
    await request(gm, (await codeOf(friend)).friend_code);
    const { id } = await db.as(friend, (s) => s.one<{ id: string }>(`select id from public.friendships`));
    await db.as(friend, (s) => s.query(`select public.accept_friend($1)`, [id]));

    await expectSqlError(db.as(gm, (s) => s.query(`select public.invite_friend_to_campaign($1, $2)`, [campaign.id, stranger.id])), '42501');
    await db.as(gm, (s) => s.query(`select public.invite_friend_to_campaign($1, $2)`, [campaign.id, friend.id]));
    const invite = await db.as(gm, (s) => s.one<{ code: string; invited_email: string | null }>(`select code, invited_email from public.campaign_invites`));
    expect(invite.invited_email).toBeNull();

    const pending = await db.as(friend, (s) => s.one<{ r: unknown[] }>(`select public.get_my_pending_invites() as r`));
    expect(pending.r).toHaveLength(1);
    const stolen = await db.as(stranger, (s) => s.one<{ r: { ok: boolean } }>(`select public.accept_campaign_invite($1) as r`, [invite.code]));
    expect(stolen.r.ok).toBe(false);
    const accepted = await db.as(friend, (s) => s.one<{ r: { ok: boolean } }>(`select public.accept_campaign_invite($1) as r`, [invite.code]));
    expect(accepted.r.ok).toBe(true);
  });

  it('ficha compartilhada: o amigo vê (sem editar); deixa de ver ao desfazer a amizade', async () => {
    const owner = await db.createUser('dono-ficha');
    const friend = await db.createUser('amigo-ficha');
    const other = await db.createUser('outro-ficha');
    const gm = await db.createUser('mestre-ficha');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, other);
    await request(owner, (await codeOf(friend)).friend_code);
    const { id: friendshipId } = await db.as(friend, (s) => s.one<{ id: string }>(`select id from public.friendships`));
    await db.as(friend, (s) => s.query(`select public.accept_friend($1)`, [friendshipId]));

    const { id } = await db.as(owner, (s) => s.one<{ id: string }>(`select public.create_character('Lyra', 'dnd5e') as id`));
    const see = (who: User) => db.as(who, (s) => s.query(`select id from public.characters where id = $1`, [id]));
    expect(await see(friend)).toEqual([]);

    // Só com amigos; só o dono compartilha.
    await expectSqlError(db.as(owner, (s) => s.query(`insert into public.character_shares (character_id, user_id) values ($1, $2)`, [id, other.id])), '42501');
    await expectSqlError(db.as(friend, (s) => s.query(`insert into public.character_shares (character_id, user_id) values ($1, $2)`, [id, friend.id])), '42501');
    await db.as(owner, (s) => s.query(`insert into public.character_shares (character_id, user_id) values ($1, $2)`, [id, friend.id]));

    expect(await see(friend)).toHaveLength(1);
    expect(await see(other)).toEqual([]);
    const edited = await db.as(friend, (s) => s.query(`update public.characters set name = 'X' where id = $1 returning id`, [id]));
    expect(edited).toEqual([]);

    await db.as(owner, (s) => s.query(`delete from public.friendships`));
    expect(await see(friend)).toEqual([]);
  });
});
