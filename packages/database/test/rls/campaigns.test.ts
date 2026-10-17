import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, createCampaign, createCharacter, createTable } from '../support/fixtures';
import { TestDatabase, admin, anon, expectSqlError, service } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

describe('perfis', () => {
  it('são criados automaticamente no cadastro, com nome saneado', async () => {
    const user = await db.createUser('  Thalia\u0007 ');
    const profile = await db.as(user, (s) =>
      s.one<{ display_name: string }>(`select display_name from public.profiles where id = $1`, [
        user.id,
      ]),
    );
    expect(profile.display_name).toBe('Thalia');
  });

  it('usam um nome padrão quando o informado é inválido', async () => {
    const user = await db.createUser('x');
    const profile = await db.as(user, (s) =>
      s.one<{ display_name: string }>(`select display_name from public.profiles where id = $1`, [
        user.id,
      ]),
    );
    expect(profile.display_name).toBe('Aventureiro');
  });

  it('só são visíveis ao próprio usuário e a quem divide uma campanha', async () => {
    const { gm, player, outsider } = await createTable(db);
    const seenByPlayer = await db.as(player, (s) =>
      s.query(`select id from public.profiles where id = $1`, [gm.id]),
    );
    const seenByOutsider = await db.as(outsider, (s) =>
      s.query(`select id from public.profiles where id = $1`, [gm.id]),
    );
    expect(seenByPlayer).toHaveLength(1);
    expect(seenByOutsider).toHaveLength(0);
  });

  it('o usuário altera apenas o próprio perfil e campos permitidos', async () => {
    const { gm, player } = await createTable(db);
    const updated = await db.as(player, (s) =>
      s.query(`update public.profiles set display_name = 'Hackeado' where id = $1 returning id`, [
        gm.id,
      ]),
    );
    expect(updated).toHaveLength(0);

    await expectSqlError(
      db.as(player, (s) =>
        s.query(`update public.profiles set created_at = now() where id = $1`, [player.id]),
      ),
      '42501',
    );
  });

  it('não aceita avatar fora da pasta do próprio usuário', async () => {
    const { gm, player } = await createTable(db);
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`update public.profiles set avatar_path = $1 where id = $2`, [
          `${gm.id}/foto.png`,
          player.id,
        ]),
      ),
      '42501',
    );
  });
});

describe('acesso anônimo', () => {
  it('não lê nenhum dado privado', async () => {
    for (const table of ['campaigns', 'profiles', 'characters', 'sessions', 'campaign_notes']) {
      await expectSqlError(
        db.as(anon, (s) => s.query(`select * from public.${table}`)),
        '42501',
      );
    }
  });

  it('não executa funções da API', async () => {
    await expectSqlError(
      db.as(anon, (s) => s.query(`select public.accept_campaign_invite('ABCDEFGHJKLM')`)),
      '42501',
    );
  });

  it('pode listar os sistemas de RPG suportados', async () => {
    const systems = await db.as(anon, (s) => s.query(`select id from public.rpg_systems`));
    expect(systems).toEqual([{ id: 'dnd5e' }]);
  });
});

describe('campanhas', () => {
  it('criar campanha torna o criador mestre responsável', async () => {
    const gm = await db.createUser('Criadora');
    const campaign = await createCampaign(db, gm);
    const membership = await db.as(gm, (s) =>
      s.one<{ role: string }>(
        `select role from public.campaign_members where campaign_id = $1 and user_id = $2`,
        [campaign.id, gm.id],
      ),
    );
    expect(campaign.owner_id).toBe(gm.id);
    expect(membership.role).toBe('gm');
  });

  it('regras de criação: o mestre define, o jogador só lê, e precisam ser um objeto pequeno', async () => {
    const { gm, player, campaign } = await createTable(db);
    const initial = await db.as(player, (s) =>
      s.one<{ character_rules: unknown }>(`select character_rules from public.campaigns where id = $1`, [campaign.id]),
    );
    expect(initial.character_rules).toEqual({});

    const rules = { startingLevel: 3, abilityScoreMethods: ['point_buy'], allowEvilAlignments: false };
    await db.as(gm, (s) =>
      s.query(`update public.campaigns set character_rules = $1::jsonb where id = $2`, [JSON.stringify(rules), campaign.id]),
    );
    const updated = await db.as(player, (s) =>
      s.one<{ character_rules: unknown }>(`select character_rules from public.campaigns where id = $1`, [campaign.id]),
    );
    expect(updated.character_rules).toEqual(rules);

    // O jogador não altera (o RLS filtra a linha) e o banco recusa o que não é objeto.
    await db.as(player, (s) =>
      s.query(`update public.campaigns set character_rules = '{"startingLevel":20}'::jsonb where id = $1`, [campaign.id]),
    );
    const unchanged = await db.as(gm, (s) =>
      s.one<{ character_rules: { startingLevel: number } }>(`select character_rules from public.campaigns where id = $1`, [campaign.id]),
    );
    expect(unchanged.character_rules.startingLevel).toBe(3);
    await expectSqlError(
      db.as(gm, (s) => s.query(`update public.campaigns set character_rules = '[1, 2]'::jsonb where id = $1`, [campaign.id])),
      '23514',
    );
  });

  it('não permite criar campanha em nome de outra pessoa', async () => {
    const attacker = await db.createUser('Atacante');
    const victim = await db.createUser('Vítima');
    await expectSqlError(
      db.as(attacker, (s) =>
        s.query(`insert into public.campaigns (name, system_id, owner_id) values ('X X', 'dnd5e', $1)`, [
          victim.id,
        ]),
      ),
      '42501',
    );
  });

  it('não permite criar campanha arquivada nem com sistema inexistente', async () => {
    const gm = await db.createUser('Mestre');
    await expectSqlError(
      db.as(gm, (s) =>
        s.query(`insert into public.campaigns (name, system_id) values ('Mesa', 'gurps')`),
      ),
      '23503',
    );
    await expectSqlError(
      db.as(gm, (s) =>
        s.query(`insert into public.campaigns (name, system_id, status) values ('Mesa', 'dnd5e', 'archived')`),
      ),
      '42501',
    );
  });

  it('usuário não acessa campanha alheia alterando o UUID', async () => {
    const { campaign, outsider } = await createTable(db);
    const rows = await db.as(outsider, (s) =>
      s.query(`select * from public.campaigns where id = $1`, [campaign.id]),
    );
    expect(rows).toHaveLength(0);

    const members = await db.as(outsider, (s) =>
      s.query(`select * from public.campaign_members where campaign_id = $1`, [campaign.id]),
    );
    expect(members).toHaveLength(0);
  });

  it('usuário não edita nem exclui campanha da qual não participa', async () => {
    const { campaign, outsider } = await createTable(db);
    const updated = await db.as(outsider, (s) =>
      s.query(`update public.campaigns set name = 'Invadida' where id = $1 returning id`, [
        campaign.id,
      ]),
    );
    const deleted = await db.as(outsider, (s) =>
      s.query(`delete from public.campaigns where id = $1 returning id`, [campaign.id]),
    );
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  it('jogador não edita a campanha; co-mestre edita', async () => {
    const { campaign, player, coGm } = await createTable(db);
    const byPlayer = await db.as(player, (s) =>
      s.query(`update public.campaigns set name = 'Do jogador' where id = $1 returning id`, [
        campaign.id,
      ]),
    );
    const byCoGm = await db.as(coGm, (s) =>
      s.query(`update public.campaigns set name = 'Do co-mestre' where id = $1 returning id`, [
        campaign.id,
      ]),
    );
    expect(byPlayer).toHaveLength(0);
    expect(byCoGm).toHaveLength(1);
  });

  it('status, dono e sistema não mudam por atualização direta', async () => {
    const { campaign, gm, player } = await createTable(db);
    for (const assignment of ["status = 'archived'", `owner_id = '${player.id}'`, "system_id = 'dnd5e'"]) {
      await expectSqlError(
        db.as(gm, (s) => s.query(`update public.campaigns set ${assignment} where id = $1`, [campaign.id])),
        '42501',
      );
    }
  });

  it('participantes não são inseridos diretamente pelo cliente', async () => {
    const { campaign, outsider } = await createTable(db);
    await expectSqlError(
      db.as(outsider, (s) =>
        s.query(
          `insert into public.campaign_members (campaign_id, user_id, role) values ($1, $2, 'gm')`,
          [campaign.id, outsider.id],
        ),
      ),
      '42501',
    );
  });

  it('somente o dono exclui a campanha', async () => {
    const { campaign, coGm, gm } = await createTable(db);
    const byCoGm = await db.as(coGm, (s) =>
      s.query(`delete from public.campaigns where id = $1 returning id`, [campaign.id]),
    );
    expect(byCoGm).toHaveLength(0);
    const byOwner = await db.as(gm, (s) =>
      s.query(`delete from public.campaigns where id = $1 returning id`, [campaign.id]),
    );
    expect(byOwner).toHaveLength(1);
  });
});

describe('arquivamento', () => {
  it('somente o dono arquiva; campanha arquivada fica somente leitura e preserva dados', async () => {
    const { campaign, gm, coGm, player } = await createTable(db);
    await expectSqlError(
      db.as(coGm, (s) => s.query(`select public.archive_campaign($1)`, [campaign.id])),
      '42501',
    );
    await db.as(gm, (s) => s.query(`select public.archive_campaign($1)`, [campaign.id]));

    const row = await db.as(player, (s) =>
      s.one<{ status: string; archived_at: string | null }>(
        `select status, archived_at from public.campaigns where id = $1`,
        [campaign.id],
      ),
    );
    expect(row.status).toBe('archived');
    expect(row.archived_at).not.toBeNull();

    const edited = await db.as(gm, (s) =>
      s.query(`update public.campaigns set name = 'Nova' where id = $1 returning id`, [campaign.id]),
    );
    expect(edited).toHaveLength(0);

    await expectSqlError(
      db.as(gm, (s) =>
        s.query(`insert into public.sessions (campaign_id, title) values ($1, 'Depois')`, [campaign.id]),
      ),
      '42501',
    );

    await db.as(gm, (s) => s.query(`select public.unarchive_campaign($1)`, [campaign.id]));
    const reopened = await db.as(gm, (s) =>
      s.query(`update public.campaigns set name = 'Reaberta' where id = $1 returning id`, [campaign.id]),
    );
    expect(reopened).toHaveLength(1);
  });
});

describe('gestão de participantes', () => {
  it('jogador não remove outros participantes', async () => {
    const { campaign, player, otherPlayer } = await createTable(db);
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`select public.remove_campaign_member($1, $2)`, [campaign.id, otherPlayer.id]),
      ),
      '42501',
    );
  });

  it('co-mestre remove jogadores, mas não outros mestres', async () => {
    const { campaign, coGm, gm, otherPlayer } = await createTable(db);
    await db.as(coGm, (s) =>
      s.query(`select public.remove_campaign_member($1, $2)`, [campaign.id, otherPlayer.id]),
    );
    await expectSqlError(
      db.as(coGm, (s) => s.query(`select public.remove_campaign_member($1, $2)`, [campaign.id, gm.id])),
      '42501',
    );
    const remaining = await db.as(gm, (s) =>
      s.query<{ user_id: string }>(`select user_id from public.campaign_members where campaign_id = $1`, [
        campaign.id,
      ]),
    );
    expect(remaining.map((r) => r.user_id)).not.toContain(otherPlayer.id);
  });

  it('quem não participa recebe "não encontrado" em vez de detalhes', async () => {
    const { campaign, outsider, player } = await createTable(db);
    await expectSqlError(
      db.as(outsider, (s) =>
        s.query(`select public.remove_campaign_member($1, $2)`, [campaign.id, player.id]),
      ),
      'P0002',
    );
  });

  it('ao sair, o jogador perde o acesso e leva o personagem consigo', async () => {
    const { campaign, player, gm } = await createTable(db);
    const characterId = await createCharacter(db, player, campaign.id);
    await db.as(player, (s) => s.query(`select public.leave_campaign($1)`, [campaign.id]));

    const visibleCampaign = await db.as(player, (s) =>
      s.query(`select id from public.campaigns where id = $1`, [campaign.id]),
    );
    expect(visibleCampaign).toHaveLength(0);

    const character = await db.as(player, (s) =>
      s.one<{ campaign_id: string | null }>(`select campaign_id from public.characters where id = $1`, [
        characterId,
      ]),
    );
    expect(character.campaign_id).toBeNull();

    const seenByGm = await db.as(gm, (s) =>
      s.query(`select id from public.characters where id = $1`, [characterId]),
    );
    expect(seenByGm).toHaveLength(0);
  });

  it('o mestre responsável não sai nem é removido', async () => {
    const { campaign, gm, coGm } = await createTable(db);
    await expectSqlError(
      db.as(gm, (s) => s.query(`select public.leave_campaign($1)`, [campaign.id])),
      '42501',
    );
    await expectSqlError(
      db.as(coGm, (s) => s.query(`select public.remove_campaign_member($1, $2)`, [campaign.id, gm.id])),
      '42501',
    );
  });

  it('somente o dono altera papéis e transfere a campanha para outro mestre', async () => {
    const { campaign, gm, coGm, player } = await createTable(db);
    await expectSqlError(
      db.as(coGm, (s) =>
        s.query(`select public.set_campaign_member_role($1, $2, 'gm')`, [campaign.id, player.id]),
      ),
      '42501',
    );
    await expectSqlError(
      db.as(gm, (s) =>
        s.query(`select public.transfer_campaign_ownership($1, $2)`, [campaign.id, player.id]),
      ),
      '42501',
    );
    await db.as(gm, (s) =>
      s.query(`select public.transfer_campaign_ownership($1, $2)`, [campaign.id, coGm.id]),
    );
    const row = await db.as(coGm, (s) =>
      s.one<{ owner_id: string }>(`select owner_id from public.campaigns where id = $1`, [campaign.id]),
    );
    expect(row.owner_id).toBe(coGm.id);
  });
});

describe('limites de plano', () => {
  it('são aplicados no banco quando configurados', async () => {
    await db.as(admin, (s) =>
      s.exec(
        `insert into public.plans (id, name, max_owned_campaigns, max_owned_characters, max_members_per_campaign)
         values ('teste-limitado', 'Limitado (teste)', 1, 1, 2)`,
      ),
    );
    const user = await db.createUser('Limitada');
    await db.as(service, (s) =>
      s.query(`insert into public.user_plans (user_id, plan_id) values ($1, 'teste-limitado')`, [user.id]),
    );

    await createCampaign(db, user, 'Primeira');
    const message = await expectSqlError(createCampaign(db, user, 'Segunda'), 'CVLIM');
    expect(message).toMatch(/limite/i);

    await createCharacter(db, user, null, 'Um');
    await expectSqlError(createCharacter(db, user, null, 'Dois'), 'CVLIM');
  });

  it('o usuário não altera o próprio plano', async () => {
    const user = await db.createUser('Esperta');
    await expectSqlError(
      db.as(user, (s) =>
        s.query(`insert into public.user_plans (user_id, plan_id) values ($1, 'free')`, [user.id]),
      ),
      '42501',
    );
  });

  it('o plano gratuito padrão não impõe limites', async () => {
    const plan = await db.as(admin, (s) =>
      s.one<Record<string, unknown>>(`select * from public.plans where id = 'free'`),
    );
    expect(plan.max_owned_campaigns).toBeNull();
    expect(plan.max_owned_characters).toBeNull();
  });
});

describe('isolamento entre campanhas', () => {
  it('participar de uma campanha não dá acesso a outra do mesmo mestre', async () => {
    const gm = await db.createUser('Mestre Multiplo');
    const player = await db.createUser('Jogador Fiel');
    const first = await createCampaign(db, gm, 'Primeira mesa');
    const second = await createCampaign(db, gm, 'Segunda mesa');
    await addMember(db, first.id, player);
    const visible = await db.as(player, (s) =>
      s.query<{ id: string }>(`select id from public.campaigns`),
    );
    expect(visible.map((row) => row.id)).toEqual([first.id]);
    expect(visible.map((row) => row.id)).not.toContain(second.id);
  });
});
