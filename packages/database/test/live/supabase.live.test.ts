/**
 * Teste de integração contra um projeto Supabase REAL (Auth, PostgREST, Storage e Realtime).
 *
 * Os testes de RLS com PGlite executam SQL direto; este arquivo exercita as mesmas consultas de
 * `@codexveil/database` que web e mobile usam, passando pelo supabase-js e pelos serviços reais.
 *
 * Só roda quando as três variáveis abaixo estão definidas (fora disso é ignorado):
 *   CODEXVEIL_LIVE_SUPABASE_URL      URL do projeto
 *   CODEXVEIL_LIVE_PUBLISHABLE_KEY   chave publicável (a mesma dos apps)
 *   CODEXVEIL_LIVE_SECRET_KEY        chave secreta, usada SOMENTE para criar e apagar os
 *                                    usuários temporários (nunca vai para os apps)
 *
 * Cria três contas temporárias já confirmadas (mestre, jogador e estranho), percorre os fluxos
 * principais e, no fim, apaga os arquivos enviados e as contas, o que remove em cascata
 * campanhas, personagens e todo o resto.
 */
import { isAppError, type AppError } from '@codexveil/domain';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CodexveilClient } from '../../src/client';
import {
  acceptCampaignInvite,
  addSceneEntity,
  adjustCharacterResource,
  CAMPAIGN_MEDIA_BUCKET,
  characterPortraitPath,
  createCampaign,
  createCampaignInvite,
  createCampaignNote,
  createCharacter,
  createCreature,
  createSession,
  createSessionBlock,
  creatureImagePath,
  getCampaign,
  getCharacter,
  getCreature,
  getInvitePreview,
  getSession,
  listCampaignMembers,
  listCampaignNotes,
  listCharacterResources,
  listCreatures,
  listMyCampaigns,
  listSceneEntities,
  listSessionBlocks,
  listSessions,
  saveCharacterSheet,
  setCharacterPortrait,
  setCreatureImage,
  setCreatureVisibility,
  signedMediaUrls,
  subscribeToChanges,
  updateCreatureGmData,
  updateSession,
} from '../../src/index';
import type { Database } from '../../src/types.gen';

const url = process.env.CODEXVEIL_LIVE_SUPABASE_URL;
const publishableKey = process.env.CODEXVEIL_LIVE_PUBLISHABLE_KEY;
const secretKey = process.env.CODEXVEIL_LIVE_SECRET_KEY;
const live = Boolean(url && publishableKey && secretKey);

/** PNG 1×1 transparente. */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

interface LiveUser {
  id: string;
  email: string;
  client: CodexveilClient;
}

const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const password = `Live${runId}9x`;
const createdUserIds: string[] = [];
const uploaded: { bucket: string; path: string }[] = [];

function newClient(key: string): CodexveilClient {
  return createClient<Database>(url ?? '', key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function createLiveUser(admin: CodexveilClient, role: string): Promise<LiveUser> {
  const email = `codexveil-live-${runId}-${role}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `[TESTE] ${role}` },
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);

  const client = newClient(publishableKey ?? '');
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

async function expectAppError(promise: Promise<unknown>, code: AppError['code']): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(isAppError(error) ? error.code : error).toBe(code);
    return;
  }
  throw new Error(`Era esperado o erro "${code}", mas a operação foi concluída.`);
}

async function upload(user: LiveUser, bucket: string, path: string, type = 'image/png') {
  const result = await user.client.storage
    .from(bucket)
    .upload(path, new Blob([PNG], { type }), { contentType: type, upsert: false });
  if (!result.error) uploaded.push({ bucket, path });
  return result;
}

describe.skipIf(!live)('Supabase real (integração)', () => {
  let admin: CodexveilClient;
  let gm: LiveUser;
  let player: LiveUser;
  let stranger: LiveUser;
  let campaignId: string;
  let characterId: string;
  let sessionId: string;
  let hiddenCreatureId: string;

  beforeAll(async () => {
    admin = newClient(secretKey ?? '');
    gm = await createLiveUser(admin, 'mestre');
    player = await createLiveUser(admin, 'jogador');
    stranger = await createLiveUser(admin, 'estranho');
  });

  afterAll(async () => {
    if (!admin) return;
    for (const bucket of new Set(uploaded.map((file) => file.bucket))) {
      const paths = uploaded.filter((file) => file.bucket === bucket).map((file) => file.path);
      await admin.storage.from(bucket).remove(paths);
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it('usuário anônimo não lê dados privados', async () => {
    const anon = newClient(publishableKey ?? '');
    const { error } = await anon.from('campaigns').select('id');
    expect(error?.code).toBe('42501');
    const { data: systems } = await anon.from('rpg_systems').select('id');
    expect(systems?.map((system) => system.id)).toContain('dnd5e');
  });

  it('cria a campanha e o mestre entra como gm', async () => {
    campaignId = await createCampaign(gm.client, {
      name: `[TESTE] Campanha ${runId}`,
      description: '',
      systemId: 'dnd5e',
      characterRules: { startingLevel: 3, abilityScoreMethods: ['point_buy'], allowEvilAlignments: false },
    });
    const campaign = await getCampaign(gm.client, campaignId, gm.id);
    expect(campaign?.role).toBe('gm');
    expect(campaign?.characterRules).toEqual({ startingLevel: 3, abilityScoreMethods: ['point_buy'], allowEvilAlignments: false });
    expect(campaign?.isOwner).toBe(true);
    expect((await listMyCampaigns(gm.client, gm.id)).map((c) => c.id)).toContain(campaignId);
  });

  it('estranho não acessa a campanha pelo UUID', async () => {
    expect(await getCampaign(stranger.client, campaignId, stranger.id)).toBeNull();
    const { data } = await stranger.client.from('campaigns').select('id').eq('id', campaignId);
    expect(data).toEqual([]);
  });

  it('jogador entra pelo convite', async () => {
    const invite = await createCampaignInvite(gm.client, campaignId, {
      expiresInDays: 7,
      maxUses: 2,
      invitedEmail: null,
    });
    expect(invite.code).toMatch(/^[A-Z2-9]{12}$/);

    const preview = await getInvitePreview(player.client, invite.code);
    expect(preview.ok).toBe(true);
    const accepted = await acceptCampaignInvite(player.client, invite.code);
    expect(accepted).toEqual({ ok: true, campaignId });

    const members = await listCampaignMembers(player.client, campaignId, gm.id);
    expect(members.map((m) => [m.userId, m.role]).sort()).toEqual(
      [
        [gm.id, 'gm'],
        [player.id, 'player'],
      ].sort(),
    );
    expect(members.find((m) => m.userId === player.id)?.displayName).toBe('[TESTE] jogador');
  });

  it('mestre não cria personagem na própria campanha', async () => {
    await expectAppError(
      createCharacter(gm.client, { name: '[TESTE] Do mestre', systemId: 'dnd5e', campaignId, sheet: {}, resources: [] }),
      'forbidden',
    );
  });

  it('jogador cria o personagem completo; ficha com controle otimista', async () => {
    characterId = await createCharacter(player.client, {
      name: '[TESTE] Personagem',
      systemId: 'dnd5e',
      campaignId,
      sheet: {},
      resources: [
        {
          key: 'hp',
          label: 'Pontos de vida',
          current: 12,
          max: 12,
          recovery: 'long_rest',
          display: 'health',
          sortOrder: 0,
        },
        {
          key: 'class_rage',
          label: 'Fúria',
          current: 2,
          max: 2,
          recovery: 'long_rest',
          display: 'pool',
          sortOrder: 100,
        },
      ],
      items: [
        { name: '[TESTE] Machado grande', category: 'weapon', quantity: 1, weight: 3.5, description: '', notes: '', isEquipped: false, sortOrder: 0 },
      ],
      abilities: [
        { kind: 'class_feature', name: '[TESTE] Fúria', source: 'Bárbaro 1º nível', description: '', data: {}, resourceKey: 'class_rage', sortOrder: 0 },
      ],
    });
    const mine = await getCharacter(player.client, characterId, player.id);
    expect(mine?.version).toBe(1);
    const { data: features } = await player.client
      .from('character_abilities')
      .select('name, resource_id')
      .eq('character_id', characterId);
    expect(features).toHaveLength(1);
    expect(features?.[0]?.resource_id).not.toBeNull();
    expect(await getCharacter(gm.client, characterId, gm.id)).not.toBeNull();
    expect(await getCharacter(stranger.client, characterId, stranger.id)).toBeNull();

    const saved = await saveCharacterSheet(player.client, characterId, 1, {
      name: '[TESTE] Renomeado',
    });
    expect(saved.version).toBe(2);
    await expectAppError(
      saveCharacterSheet(player.client, characterId, 1, { name: 'Conflito' }),
      'conflict',
    );
    await expectAppError(
      saveCharacterSheet(stranger.client, characterId, 2, { name: 'Invasor' }),
      'not_found',
    );
  });

  it('dano aplicado pelo mestre chega ao jogador pelo Realtime', async () => {
    const [hp] = await listCharacterResources(player.client, characterId);
    expect(hp?.current).toBe(12);

    let changes = 0;
    let resolveLive: () => void = () => undefined;
    const isLive = new Promise<void>((resolve) => {
      resolveLive = resolve;
    });
    const unsubscribe = subscribeToChanges(
      player.client,
      `live-test-${runId}`,
      [{ table: 'character_resources', filter: `character_id=eq.${characterId}` }],
      {
        onChange: () => {
          changes += 1;
        },
        onStatus: (status) => {
          if (status === 'live') resolveLive();
        },
        debounceMs: 50,
      },
    );
    try {
      // "live" = Postgres Changes confirmado; a recarga automática dessa hora não conta.
      await isLive;
      await new Promise((resolve) => setTimeout(resolve, 300));
      changes = 0;
      const damaged = await adjustCharacterResource(gm.client, hp?.id ?? '', 'damage', 5);
      expect(damaged.current).toBe(7);

      const deadline = Date.now() + 15_000;
      while (changes === 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      expect(changes).toBeGreaterThan(0);
      expect((await listCharacterResources(player.client, characterId))[0]?.current).toBe(7);
    } finally {
      unsubscribe();
    }
  });

  it('segredos de NPCs só chegam ao mestre', async () => {
    hiddenCreatureId = await createCreature(gm.client, campaignId, {
      kind: 'npc',
      name: '[TESTE] Vilão',
      subtitle: '',
      description: '',
      visibility: 'gm',
    });
    await updateCreatureGmData(gm.client, hiddenCreatureId, {
      stats: {},
      notes: '',
      secrets: 'É o irmão do rei.',
    });

    expect(await listCreatures(player.client, campaignId)).toEqual([]);
    expect(await getCreature(player.client, hiddenCreatureId, true)).toBeNull();
    expect((await getCreature(gm.client, hiddenCreatureId, true))?.gm?.secrets).toBe(
      'É o irmão do rei.',
    );

    const revealedId = await createCreature(gm.client, campaignId, {
      kind: 'monster',
      name: '[TESTE] Lobo',
      subtitle: '',
      description: '',
      visibility: 'gm',
    });
    await setCreatureVisibility(gm.client, revealedId, 'members');
    const seen = await getCreature(player.client, revealedId, true);
    expect(seen?.name).toBe('[TESTE] Lobo');
    expect(seen?.gm).toBeNull();
  });

  it('roteiro: jogador só recebe blocos públicos de sessões publicadas', async () => {
    sessionId = await createSession(gm.client, campaignId, {
      title: '[TESTE] Sessão 1',
      scheduledAt: null,
      isPublished: false,
      mode: 'presencial',
      physicalDice: false,
    });
    await createSessionBlock(gm.client, {
      sessionId,
      campaignId,
      position: 1024,
      visibility: 'members',
      content: { type: 'paragraph', data: { text: 'A taverna está cheia.' } },
    });
    await createSessionBlock(gm.client, {
      sessionId,
      campaignId,
      position: 2048,
      visibility: 'gm',
      content: { type: 'gm_note', data: { text: 'O taverneiro é um espião.' } },
    });

    expect(await listSessions(player.client, campaignId)).toEqual([]);
    expect(await listSessionBlocks(player.client, sessionId)).toEqual([]);

    const session = await getSession(gm.client, sessionId);
    await updateSession(gm.client, sessionId, session?.version ?? 0, {
      title: '[TESTE] Sessão 1',
      scheduledAt: null,
      isPublished: true,
      mode: 'presencial',
      physicalDice: false,
      recap: '',
    });

    const playerBlocks = await listSessionBlocks(player.client, sessionId);
    expect(playerBlocks.map((block) => block.type)).toEqual(['paragraph']);
    expect((await listSessionBlocks(gm.client, sessionId)).map((block) => block.type)).toEqual([
      'paragraph',
      'gm_note',
    ]);
  });

  it('cena e anotações respeitam a visibilidade', async () => {
    await addSceneEntity(gm.client, {
      sessionId,
      campaignId,
      creatureId: hiddenCreatureId,
      kind: 'npc',
      name: '[TESTE] Vilão',
      hpMax: 20,
      armorClass: 14,
      initiativeBonus: 2,
    });
    expect(await listSceneEntities(gm.client, sessionId)).toHaveLength(1);
    expect(await listSceneEntities(player.client, sessionId)).toEqual([]);

    await createCampaignNote(gm.client, campaignId, {
      title: '[TESTE] Plano do mestre',
      body: '',
      visibility: 'gm',
      isPinned: false,
    });
    await createCampaignNote(player.client, campaignId, {
      title: '[TESTE] Diário do jogador',
      body: '',
      visibility: 'author',
      isPinned: false,
    });
    expect((await listCampaignNotes(player.client, campaignId)).map((n) => n.title)).toEqual([
      '[TESTE] Diário do jogador',
    ]);
    expect((await listCampaignNotes(gm.client, campaignId)).map((n) => n.title)).toEqual([
      '[TESTE] Plano do mestre',
    ]);
  });

  it('Storage: retratos, imagens ocultas e avatares desativados', async () => {
    const portrait = characterPortraitPath(characterId, 'retrato.png');
    expect((await upload(player, CAMPAIGN_MEDIA_BUCKET, portrait)).error).toBeNull();
    await setCharacterPortrait(player.client, characterId, portrait);
    const gmUrls = await signedMediaUrls(gm.client, [portrait]);
    expect((await fetch(gmUrls[portrait] ?? '')).status).toBe(200);
    expect(await signedMediaUrls(stranger.client, [portrait])).toEqual({});

    const secretImage = creatureImagePath(campaignId, 'vilao.png');
    expect((await upload(gm, CAMPAIGN_MEDIA_BUCKET, secretImage)).error).toBeNull();
    await setCreatureImage(gm.client, hiddenCreatureId, secretImage);
    expect(await signedMediaUrls(player.client, [secretImage])).toEqual({});
    expect(Object.keys(await signedMediaUrls(gm.client, [secretImage]))).toEqual([secretImage]);

    expect(
      (await upload(player, CAMPAIGN_MEDIA_BUCKET, creatureImagePath(campaignId, 'x.png'))).error,
    ).not.toBeNull();
    expect(
      (
        await upload(
          gm,
          CAMPAIGN_MEDIA_BUCKET,
          characterPortraitPath(characterId, 'svg.svg'),
          'image/svg+xml',
        )
      ).error,
    ).not.toBeNull();

    // Fotos de perfil foram removidas do produto: o envio é recusado até na própria pasta.
    expect((await upload(player, 'avatars', `${player.id}/avatar.png`)).error).not.toBeNull();
  });
});
