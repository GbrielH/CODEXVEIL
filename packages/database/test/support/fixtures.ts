import { admin, type TestDatabase, type TestUser } from './pglite';

export interface CampaignRow {
  id: string;
  owner_id: string;
  name: string;
  status: 'active' | 'archived';
}

export async function createCampaign(
  db: TestDatabase,
  gm: TestUser,
  name = 'Campanha de Teste',
): Promise<CampaignRow> {
  return db.as(gm, (s) =>
    s.one<CampaignRow>(
      `insert into public.campaigns (name, system_id) values ($1, 'dnd5e')
       returning id, owner_id, name, status`,
      [name],
    ),
  );
}

/** Adiciona participação diretamente (atalho de preparação; o fluxo real usa convites). */
export async function addMember(
  db: TestDatabase,
  campaignId: string,
  user: TestUser,
  role: 'gm' | 'player' = 'player',
): Promise<void> {
  await db.as(admin, (s) =>
    s.query(
      `insert into public.campaign_members (campaign_id, user_id, role) values ($1, $2, $3)`,
      [campaignId, user.id, role],
    ),
  );
}

export const defaultResources = [
  { key: 'hp', label: 'Pontos de vida', current: 20, max: 20, recovery: 'long_rest', display: 'health', sortOrder: 0 },
  { key: 'hit_dice_d8', label: 'Dados de vida (d8)', current: 3, max: 3, recovery: 'long_rest', display: 'pool', sortOrder: 10 },
  { key: 'ki', label: 'Ki', current: 2, max: 2, recovery: 'short_rest', display: 'pool', sortOrder: 20 },
];

export async function createCharacter(
  db: TestDatabase,
  owner: TestUser,
  campaignId: string | null,
  name = 'Aria',
): Promise<string> {
  const row = await db.as(owner, (s) =>
    s.one<{ id: string }>(
      `select public.create_character($1, 'dnd5e', $2, $3::jsonb, $4::jsonb) as id`,
      [name, campaignId, JSON.stringify({ schemaVersion: 1 }), JSON.stringify(defaultResources)],
    ),
  );
  return row.id;
}

export async function resourceId(db: TestDatabase, characterId: string, key: string): Promise<string> {
  const row = await db.as(admin, (s) =>
    s.one<{ id: string }>(
      `select id from public.character_resources where character_id = $1 and key = $2`,
      [characterId, key],
    ),
  );
  return row.id;
}

export async function createSession(
  db: TestDatabase,
  gm: TestUser,
  campaignId: string,
  options: { title?: string; published?: boolean } = {},
): Promise<string> {
  const row = await db.as(gm, (s) =>
    s.one<{ id: string }>(
      `insert into public.sessions (campaign_id, title, is_published) values ($1, $2, $3) returning id`,
      [campaignId, options.title ?? 'Sessão 1', options.published ?? false],
    ),
  );
  return row.id;
}

export async function addBlock(
  db: TestDatabase,
  gm: TestUser,
  sessionId: string,
  campaignId: string,
  block: { type: string; data: unknown; visibility?: 'members' | 'gm'; position?: number },
): Promise<string> {
  const row = await db.as(gm, (s) =>
    s.one<{ id: string }>(
      `insert into public.session_blocks (session_id, campaign_id, type, position, visibility, data)
       values ($1, $2, $3::public.session_block_type, $4, $5::public.content_visibility, $6::jsonb)
       returning id`,
      [
        sessionId,
        campaignId,
        block.type,
        block.position ?? 1024,
        block.visibility ?? 'members',
        JSON.stringify(block.data),
      ],
    ),
  );
  return row.id;
}

/** Cenário padrão: mestre responsável, co-mestre, dois jogadores e um estranho. */
export async function createTable(db: TestDatabase) {
  const gm = await db.createUser('Mestre');
  const coGm = await db.createUser('Co-mestre');
  const player = await db.createUser('Jogadora');
  const otherPlayer = await db.createUser('Jogador');
  const outsider = await db.createUser('Estranho');
  const campaign = await createCampaign(db, gm, 'A Cripta do Véu');
  await addMember(db, campaign.id, coGm, 'gm');
  await addMember(db, campaign.id, player);
  await addMember(db, campaign.id, otherPlayer);
  return { gm, coGm, player, otherPlayer, outsider, campaign };
}
