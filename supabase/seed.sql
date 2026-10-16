-- =============================================================================
-- SEED DE DESENVOLVIMENTO — dados fictícios para ambiente LOCAL.
--
-- Executado apenas por `supabase db reset` / `supabase start` na máquina do
-- desenvolvedor. Nunca é aplicado em produção (migrações não incluem este arquivo).
-- Todos os registros são identificados com o prefixo [DEMO].
--
-- Contas locais (senha: Codexveil123):
--   mestre.demo@codexveil.dev   — mestre da campanha de demonstração
--   jogadora.demo@codexveil.dev — jogadora da campanha de demonstração
-- =============================================================================

do $$
declare
  v_gm uuid := '00000000-0000-4000-8000-0000000000a1';
  v_player uuid := '00000000-0000-4000-8000-0000000000a2';
  v_campaign uuid := '00000000-0000-4000-8000-0000000000c1';
  v_session uuid := '00000000-0000-4000-8000-0000000000d1';
  v_npc uuid := '00000000-0000-4000-8000-0000000000e1';
  v_monster uuid := '00000000-0000-4000-8000-0000000000e2';
  v_character uuid := '00000000-0000-4000-8000-0000000000f1';
  v_user record;
begin
  for v_user in
    select * from (values
      (v_gm, 'mestre.demo@codexveil.dev', '[DEMO] Mestre'),
      (v_player, 'jogadora.demo@codexveil.dev', '[DEMO] Jogadora')
    ) as u(id, email, name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user.id, 'authenticated', 'authenticated',
      v_user.email, extensions.crypt('Codexveil123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', v_user.name),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user.id, v_user.id::text,
      jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;

  insert into public.campaigns (id, owner_id, system_id, name, description)
  values (
    v_campaign, v_gm, 'dnd5e', '[DEMO] A Cripta do Véu',
    'Campanha de demonstração para desenvolvimento local.'
  );

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign, v_player, 'player');

  insert into public.creatures (id, campaign_id, kind, name, subtitle, description, visibility, created_by)
  values
    (v_npc, v_campaign, 'npc', '[DEMO] Padre Aldric', 'Guardião da capela',
     'Um sacerdote de voz mansa que conhece a história da cripta.', 'members', v_gm),
    (v_monster, v_campaign, 'monster', '[DEMO] Carniçal da Névoa', 'Morto-vivo',
     'Criatura pálida que se esconde na névoa.', 'gm', v_gm);

  update public.creature_gm_data
  set secrets = 'Aldric é o necromante que desperta os mortos.',
      notes = 'Revelar apenas no terceiro ato.'
  where creature_id = v_npc;

  update public.creature_gm_data
  set stats = '{"schemaVersion":1,"size":"medium","creatureType":"Morto-vivo","armorClass":12,"hitPoints":22,"hitPointFormula":"5d8","challengeRating":"1"}'::jsonb
  where creature_id = v_monster;

  insert into public.characters (id, owner_id, campaign_id, system_id, name, sheet)
  values (
    v_character, v_player, v_campaign, 'dnd5e', '[DEMO] Lyra Vesper',
    '{"schemaVersion":1,"identity":{"species":"Elfa","background":"Sábia","classes":[{"name":"Maga","subclass":"","level":3,"hitDie":"d6"}]},"abilities":{"str":8,"dex":14,"con":12,"int":16,"wis":12,"cha":10},"skills":{"arcana":{"proficiency":"proficient","bonus":0},"history":{"proficiency":"proficient","bonus":0}},"savingThrows":{"int":{"proficient":true,"bonus":0},"wis":{"proficient":true,"bonus":0}},"spellcasting":{"ability":"int","saveDcBonus":0,"attackBonus":0}}'::jsonb
  );

  insert into public.character_resources (character_id, key, label, current, max, recovery, display, sort_order)
  values
    (v_character, 'hp', 'Pontos de vida', 14, 14, 'long_rest', 'health', 0),
    (v_character, 'hit_dice_d6', 'Dados de vida (d6)', 3, 3, 'long_rest', 'pool', 10),
    (v_character, 'spell_slot_1', 'Espaços de magia — 1º círculo', 4, 4, 'long_rest', 'pool', 40),
    (v_character, 'spell_slot_2', 'Espaços de magia — 2º círculo', 2, 2, 'long_rest', 'pool', 41),
    (v_character, 'death_save_successes', 'Sucessos contra a morte', 0, 3, 'manual', 'checkboxes', 20),
    (v_character, 'death_save_failures', 'Falhas contra a morte', 0, 3, 'manual', 'checkboxes', 21),
    (v_character, 'currency_sp', 'Peças de prata', 12, null, 'manual', 'pool', 201),
    (v_character, 'currency_gp', 'Peças de ouro', 15, null, 'manual', 'pool', 203);

  insert into public.character_items (character_id, name, category, quantity, weight)
  values
    (v_character, '[DEMO] Grimório', 'gear', 1, 3),
    (v_character, '[DEMO] Poção de cura', 'consumable', 2, 0.5);

  insert into public.sessions (id, campaign_id, title, status, is_published, recap, created_by)
  values (
    v_session, v_campaign, '[DEMO] A névoa sobre a capela', 'planned', true,
    'O grupo chegou à vila de Brumafria e ouviu falar da capela abandonada.', v_gm
  );

  insert into public.session_blocks (session_id, campaign_id, type, position, visibility, data, created_by)
  values
    (v_session, v_campaign, 'heading', 1024, 'members', '{"text":"Ato I — A névoa"}', v_gm),
    (v_session, v_campaign, 'paragraph', 2048, 'members',
     '{"text":"A névoa cobre a estrada até a capela. Sinos tocam sozinhos."}', v_gm),
    (v_session, v_campaign, 'gm_note', 3072, 'gm',
     '{"text":"Os sinos são tocados pelo carniçal escondido na torre."}', v_gm),
    (v_session, v_campaign, 'npc_ref', 4096, 'members',
     jsonb_build_object('creatureId', v_npc::text, 'note', 'Recebe o grupo na porta.'), v_gm),
    (v_session, v_campaign, 'monster_ref', 5120, 'gm',
     jsonb_build_object('creatureId', v_monster::text, 'note', null), v_gm),
    (v_session, v_campaign, 'checklist', 6144, 'gm',
     '{"items":[{"id":"1","text":"Apresentar a vila","checked":false},{"id":"2","text":"Pista do diário","checked":false}]}', v_gm);

  insert into public.campaign_notes (campaign_id, author_id, title, body, visibility, is_pinned)
  values
    (v_campaign, v_gm, '[DEMO] Mapa de Brumafria', 'Vila, capela, cemitério e a estrada do norte.', 'members', true),
    (v_campaign, v_gm, '[DEMO] Segredos do mestre', 'O diário do padre está sob o altar.', 'gm', false);
end;
$$;
