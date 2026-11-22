-- =============================================================================
-- Aura "Vírus Retrô" e imagem própria no crítico (2026-11-22)
--
--   * Nova aura `retro` (desktop antigo cheio de pop-ups e um assistente virtual).
--   * A conta de criador pode enviar uma imagem sua para o crítico de uma aura. O arquivo fica na
--     pasta dos dados (`users/{conta}/dice/`), que já tem as regras certas: só o dono envia e
--     apaga, quem divide campanha lê. O perfil guarda só o caminho em `preferences.auraArt`.
--   * Som próprio do crítico: `users/{conta}/sounds/{arquivo}` (MP3, OGG, WAV ou M4A). O bucket
--     passa a aceitar esses tipos; as regras das outras pastas continuam exigindo imagem no nome.
--   * A limpeza de órfãos passa a contar essas imagens e sons como em uso.
-- =============================================================================

alter table public.user_dice drop constraint user_dice_aura_check;
alter table public.user_dice
  add constraint user_dice_aura_check check (
    aura is null or aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton',
      'cosmic', 'tarot', 'glitch', 'ink', 'abyss', 'time', 'gold', 'frog', 'vampire', 'bard',
      'rainbow', 'poison', 'cat', 'meteor', 'party', 'wind', 'ritual', 'claw', 'necro', 'pirate',
      'samurai', 'kaiju', 'cyber', 'werewolf', 'siren', 'alchemy', 'ghost', 'haki', 'cthulhu',
      'heaven', 'purple', 'wheel', 'capture', 'darklord', 'notebook', 'orbs', 'sakura', 'phoenix',
      'kitsune', 'mirror', 'aurora', 'zombie', 'sungod', 'tarrasque', 'sans', 'hollow', 'doom',
      'zoro', 'blackhole', 'fullmetal', 'sahur', 'spider', 'akatsuki', 'hisoka', 'valorant',
      'league', 'mario', 'foxy', 'retro'
    )
  );

alter table public.dice_aura_grants drop constraint dice_aura_grants_aura_check;
alter table public.dice_aura_grants
  add constraint dice_aura_grants_aura_check check (
    aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton',
      'cosmic', 'tarot', 'glitch', 'ink', 'abyss', 'time', 'gold', 'frog', 'vampire', 'bard',
      'rainbow', 'poison', 'cat', 'meteor', 'party', 'wind', 'ritual', 'claw', 'necro', 'pirate',
      'samurai', 'kaiju', 'cyber', 'werewolf', 'siren', 'alchemy', 'ghost', 'haki', 'cthulhu',
      'heaven', 'purple', 'wheel', 'capture', 'darklord', 'notebook', 'orbs', 'sakura', 'phoenix',
      'kitsune', 'mirror', 'aurora', 'zombie', 'sungod', 'tarrasque', 'sans', 'hollow', 'doom',
      'zoro', 'blackhole', 'fullmetal', 'sahur', 'spider', 'akatsuki', 'hisoka', 'valorant',
      'league', 'mario', 'foxy', 'retro'
    )
  );

create or replace function public.list_orphan_media(p_min_age_hours integer default 24, p_limit integer default 1000)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  with referenced(path) as (
    select cover_path from public.campaigns where cover_path is not null
    union select portrait_path from public.characters where portrait_path is not null
    union select token_path from public.characters where token_path is not null
    union select image_path from public.creatures where image_path is not null
    union select cover_path from public.sessions where cover_path is not null
    union select data ->> 'path' from public.session_blocks where type = 'image' and data ->> 'path' <> ''
    union select image_path from public.session_maps where image_path is not null
    union select layer.value ->> 'path'
      from public.session_maps m, jsonb_array_elements(m.images) as layer(value)
    union select image_path from public.map_tokens where image_path is not null
    union select image_path from public.campaign_notes where image_path is not null
    union select image_path from public.tavern_messages where image_path is not null
    union select item.value ->> 'path'
      from public.campaign_boards b, jsonb_array_elements(b.items) as item(value)
      where item.value ->> 'type' = 'image'
    union select preferences -> 'dice' ->> 'image' from public.profiles
      where preferences -> 'dice' ->> 'image' is not null
    union select image_path from public.user_dice where image_path is not null
    union select image_path from public.session_highlights where image_path is not null
    union select image_path from public.campaign_handouts where image_path is not null
    union select art.value from public.profiles p, jsonb_each_text(p.preferences -> 'auraArt') as art(key, value)
      where jsonb_typeof(p.preferences -> 'auraArt') = 'object'
    union select snd.value from public.profiles p, jsonb_each_text(p.preferences -> 'auraSound') as snd(key, value)
      where jsonb_typeof(p.preferences -> 'auraSound') = 'object'
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'campaign-media'
    and o.created_at < now() - make_interval(hours => greatest(p_min_age_hours, 1))
    and not exists (select 1 from referenced r where r.path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

update storage.buckets
  set allowed_mime_types = array[
    'image/png', 'image/jpeg', 'image/webp',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'
  ]
  where id = 'campaign-media';

create function private.aura_sound_owner(p_name text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) = 'users'
      and split_part(p_name, '/', 3) = 'sounds'
      and split_part(p_name, '/', 5) = ''
      and coalesce(split_part(p_name, '/', 4) ~ '^[A-Za-z0-9_-]{1,80}\.(mp3|ogg|wav|m4a)$', false)
    then private.try_uuid(split_part(p_name, '/', 2))
  end;
$$;

revoke all on function private.aura_sound_owner(text) from public;
grant execute on function private.aura_sound_owner(text) to authenticated, service_role;

create policy "Sons do crítico: o dono envia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-media' and private.aura_sound_owner(name) = (select auth.uid()));

create policy "Sons do crítico: o dono apaga"
  on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-media' and private.aura_sound_owner(name) = (select auth.uid()));

create policy "Sons do crítico: o dono e os colegas de campanha ouvem"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-media'
    and private.aura_sound_owner(name) is not null
    and (
      private.aura_sound_owner(name) = (select auth.uid())
      or private.shares_campaign_with(private.aura_sound_owner(name))
    )
  );
