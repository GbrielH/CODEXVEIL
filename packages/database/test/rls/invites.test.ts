import { INVITE_CODE_ALPHABET, isInviteRejectionReason } from '@codexveil/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTable } from '../support/fixtures';
import { TestDatabase, admin, expectSqlError, type TestUser } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

interface InviteRow {
  id: string;
  code: string;
  max_uses: number | null;
  uses_count: number;
  created_by: string;
}

interface RpcResult {
  ok: boolean;
  reason?: string | null;
  campaignId?: string | null;
  campaign?: { id: string; name: string; ownerName: string; memberCount: number };
}

async function createInvite(
  gm: TestUser,
  campaignId: string,
  options: { maxUses?: number | null; email?: string | null; days?: number } = {},
): Promise<InviteRow> {
  return db.as(gm, (s) =>
    s.one<InviteRow>(
      `insert into public.campaign_invites (campaign_id, invited_email, max_uses, expires_at)
       values ($1, $2, $3, now() + make_interval(days => $4))
       returning id, code, max_uses, uses_count, created_by`,
      [campaignId, options.email ?? null, options.maxUses === undefined ? 1 : options.maxUses, options.days ?? 7],
    ),
  );
}

async function accept(user: TestUser, code: string): Promise<RpcResult> {
  const row = await db.as(user, (s) =>
    s.one<{ result: RpcResult }>(`select public.accept_campaign_invite($1) as result`, [code]),
  );
  return row.result;
}

async function preview(user: TestUser, code: string): Promise<RpcResult> {
  const row = await db.as(user, (s) =>
    s.one<{ result: RpcResult }>(`select public.get_invite_preview($1) as result`, [code]),
  );
  return row.result;
}

describe('criação de convites', () => {
  it('o código é gerado no servidor, com o alfabeto seguro', async () => {
    const { gm, campaign } = await createTable(db);
    const invite = await createInvite(gm, campaign.id);
    expect(invite.code).toMatch(new RegExp(`^[${INVITE_CODE_ALPHABET}]{12}$`));
    expect(invite.created_by).toBe(gm.id);
    expect(invite.uses_count).toBe(0);
  });

  it('o cliente não escolhe o código nem os contadores', async () => {
    const { gm, campaign } = await createTable(db);
    await expectSqlError(
      db.as(gm, (s) =>
        s.query(
          `insert into public.campaign_invites (campaign_id, code, expires_at)
           values ($1, 'AAAAAAAAAAAA', now() + interval '1 day')`,
          [campaign.id],
        ),
      ),
      '42501',
    );
    await expectSqlError(
      db.as(gm, (s) =>
        s.query(
          `insert into public.campaign_invites (campaign_id, uses_count, expires_at)
           values ($1, 5, now() + interval '1 day')`,
          [campaign.id],
        ),
      ),
      '42501',
    );
  });

  it('códigos diferentes a cada convite', async () => {
    const { gm, campaign } = await createTable(db);
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add((await createInvite(gm, campaign.id)).code);
    }
    expect(codes.size).toBe(20);
  });

  it('jogadores e estranhos não criam nem veem convites', async () => {
    const { gm, player, outsider, campaign } = await createTable(db);
    await createInvite(gm, campaign.id);
    for (const user of [player, outsider]) {
      await expectSqlError(createInvite(user, campaign.id), '42501');
      const visible = await db.as(user, (s) =>
        s.query(`select * from public.campaign_invites where campaign_id = $1`, [campaign.id]),
      );
      expect(visible).toHaveLength(0);
    }
  });

  it('a validade máxima é de 30 dias', async () => {
    const { gm, campaign } = await createTable(db);
    await expectSqlError(createInvite(gm, campaign.id, { days: 31 }), '23514');
  });

  it('convites pessoais são sempre de uso único', async () => {
    const { gm, campaign } = await createTable(db);
    const invite = await createInvite(gm, campaign.id, { email: 'Pessoa@Exemplo.com', maxUses: null });
    expect(invite.max_uses).toBe(1);
  });
});

describe('aceite de convites', () => {
  it('um novo jogador entra na campanha pelo código', async () => {
    const { gm, campaign } = await createTable(db);
    const newcomer = await db.createUser('Novata');
    const invite = await createInvite(gm, campaign.id);

    const info = await preview(newcomer, invite.code.toLowerCase().replace(/(.{4})/g, '$1-'));
    expect(info.ok).toBe(true);
    expect(info.campaign?.name).toBe('A Cripta do Véu');
    expect(info.campaign?.ownerName).toBe('Mestre');

    const result = await accept(newcomer, invite.code);
    expect(result).toEqual({ ok: true, campaignId: campaign.id });

    const membership = await db.as(newcomer, (s) =>
      s.one<{ role: string }>(
        `select role from public.campaign_members where campaign_id = $1 and user_id = $2`,
        [campaign.id, newcomer.id],
      ),
    );
    expect(membership.role).toBe('player');
  });

  it('não pode ser reutilizado além do limite', async () => {
    const { gm, campaign } = await createTable(db);
    const first = await db.createUser('Primeira');
    const second = await db.createUser('Segunda');
    const invite = await createInvite(gm, campaign.id, { maxUses: 1 });
    expect((await accept(first, invite.code)).ok).toBe(true);
    expect(await accept(second, invite.code)).toMatchObject({ ok: false, reason: 'exhausted' });
  });

  it('convite ilimitado aceita vários jogadores até expirar', async () => {
    const { gm, campaign } = await createTable(db);
    const invite = await createInvite(gm, campaign.id, { maxUses: null });
    for (const name of ['A1', 'B2', 'C3']) {
      expect((await accept(await db.createUser(name), invite.code)).ok).toBe(true);
    }
  });

  it('informa quando o usuário já participa', async () => {
    const { gm, player, campaign } = await createTable(db);
    const invite = await createInvite(gm, campaign.id);
    expect(await accept(player, invite.code)).toMatchObject({
      ok: false,
      reason: 'already_member',
      campaignId: campaign.id,
    });
  });

  it('recusa convites expirados, revogados e inexistentes', async () => {
    const { gm, campaign } = await createTable(db);
    const user = await db.createUser('Atrasada');

    const expired = await createInvite(gm, campaign.id);
    await db.as(admin, (s) =>
      s.query(
        `update public.campaign_invites set created_at = now() - interval '10 days',
           expires_at = now() - interval '1 hour' where id = $1`,
        [expired.id],
      ),
    );
    expect(await accept(user, expired.code)).toMatchObject({ ok: false, reason: 'expired' });

    const revoked = await createInvite(gm, campaign.id);
    await db.as(gm, (s) => s.query(`select public.revoke_campaign_invite($1)`, [revoked.id]));
    expect(await accept(user, revoked.code)).toMatchObject({ ok: false, reason: 'revoked' });

    expect(await accept(user, 'ZZZZ-ZZZZ-ZZZZ')).toMatchObject({ ok: false, reason: 'not_found' });
    expect(await accept(user, "x' or 1=1 --")).toMatchObject({ ok: false, reason: 'invalid_code' });
  });

  it('a prévia de convites inválidos não revela a campanha', async () => {
    const { gm, campaign } = await createTable(db);
    const user = await db.createUser('Curiosa');
    const revoked = await createInvite(gm, campaign.id);
    await db.as(gm, (s) => s.query(`select public.revoke_campaign_invite($1)`, [revoked.id]));
    const info = await preview(user, revoked.code);
    expect(info).toEqual({ ok: false, reason: 'revoked' });
  });

  it('jogador não revoga convites', async () => {
    const { gm, player, campaign } = await createTable(db);
    const invite = await createInvite(gm, campaign.id);
    await expectSqlError(
      db.as(player, (s) => s.query(`select public.revoke_campaign_invite($1)`, [invite.id])),
      'P0002',
    );
  });

  it('campanha arquivada não aceita novos participantes', async () => {
    const { gm, campaign } = await createTable(db);
    const invite = await createInvite(gm, campaign.id);
    await db.as(gm, (s) => s.query(`select public.archive_campaign($1)`, [campaign.id]));
    const late = await db.createUser('Tardia');
    const result = await accept(late, invite.code);
    expect(result.ok).toBe(false);
    expect(['revoked', 'campaign_archived']).toContain(result.reason);
  });

  it('todos os motivos de recusa são conhecidos pelo domínio', async () => {
    const { gm, campaign } = await createTable(db);
    const user = await db.createUser('Validadora');
    const invite = await createInvite(gm, campaign.id);
    await db.as(gm, (s) => s.query(`select public.revoke_campaign_invite($1)`, [invite.id]));
    const result = await accept(user, invite.code);
    expect(isInviteRejectionReason(result.reason)).toBe(true);
  });
});

describe('convites pessoais', () => {
  it('só a conta com o e-mail verificado aceita e vê o convite pendente', async () => {
    const { gm, campaign } = await createTable(db);
    const invitee = await db.createUser('Convidada', { email: 'convidada@exemplo.com' });
    const intruder = await db.createUser('Intrusa', { email: 'intrusa@exemplo.com' });
    const invite = await createInvite(gm, campaign.id, { email: 'Convidada@Exemplo.com' });

    const pending = await db.as(invitee, (s) =>
      s.one<{ invites: { code: string; campaignName: string }[] }>(
        `select public.get_my_pending_invites() as invites`,
      ),
    );
    expect(pending.invites).toHaveLength(1);
    expect(pending.invites[0]?.campaignName).toBe('A Cripta do Véu');

    const intruderPending = await db.as(intruder, (s) =>
      s.one<{ invites: unknown[] }>(`select public.get_my_pending_invites() as invites`),
    );
    expect(intruderPending.invites).toEqual([]);

    expect(await accept(intruder, invite.code)).toMatchObject({ ok: false, reason: 'email_mismatch' });
    expect((await accept(invitee, invite.code)).ok).toBe(true);
  });

  it('e-mail não confirmado não basta para aceitar', async () => {
    const { gm, campaign } = await createTable(db);
    const unverified = await db.createUser('Sem Confirmar', {
      email: 'semconfirmar@exemplo.com',
      emailConfirmed: false,
    });
    const invite = await createInvite(gm, campaign.id, { email: 'semconfirmar@exemplo.com' });
    expect(await accept(unverified, invite.code)).toMatchObject({
      ok: false,
      reason: 'email_mismatch',
    });
  });

  it('a pessoa convidada pode recusar', async () => {
    const { gm, campaign } = await createTable(db);
    const invitee = await db.createUser('Recusa', { email: 'recusa@exemplo.com' });
    const invite = await createInvite(gm, campaign.id, { email: 'recusa@exemplo.com' });
    const declined = await db.as(invitee, (s) =>
      s.one<{ result: RpcResult }>(`select public.decline_campaign_invite($1) as result`, [invite.code]),
    );
    expect(declined.result.ok).toBe(true);
    expect(await accept(invitee, invite.code)).toMatchObject({ ok: false, reason: 'declined' });
  });
});
