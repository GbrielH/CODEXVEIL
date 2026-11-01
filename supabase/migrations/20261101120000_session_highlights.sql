-- Melhores Momentos (Fase 3, 2026-11-01): cenas marcantes de cada sessão, tiradas da transcrição
-- por IA (Gemini, plano gratuito) ou criadas pelo mestre. Sem gasto com imagens: cada momento
-- traz o prompt pronto para a IA de imagem que o grupo preferir; o mestre envia a imagem gerada.

create table public.session_highlights (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 4000),
  quotes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(quotes) = 'array' and jsonb_array_length(quotes) <= 20),
  transcript_segment_ids uuid[] not null default '{}',
  character_ids uuid[] not null default '{}',
  location text not null default '' check (char_length(location) <= 200),
  mood text not null default '' check (char_length(mood) <= 120),
  image_prompt text not null default '' check (char_length(image_prompt) <= 4000),
  image_path text,
  status text not null default 'done' check (status in ('pending', 'generating', 'done', 'failed')),
  source text not null default 'ai' check (source in ('ai', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.session_highlights is 'Melhores momentos de cada sessão (IA ou mestre), com o prompt da imagem.';
create index session_highlights_session_idx on public.session_highlights (session_id, created_at);
create index session_highlights_campaign_idx on public.session_highlights (campaign_id, created_at desc);

create trigger session_highlights_set_updated_at
  before update on public.session_highlights
  for each row execute function private.set_updated_at();

-- A campanha vem da sessão (o cliente não escolhe).
create function private.fill_session_highlight()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select s.campaign_id into new.campaign_id from public.sessions s where s.id = new.session_id;
  if new.campaign_id is null then
    raise exception 'Sessão não encontrada.' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.fill_session_highlight() from public;
create trigger session_highlights_fill before insert on public.session_highlights
  for each row execute function private.fill_session_highlight();

-- Uso registrado de cada geração (custo estimado: tokens; imagens não são geradas aqui).
create table public.highlight_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  status text not null check (status in ('done', 'failed')),
  model text not null default '',
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  moments integer not null default 0,
  error text not null default '',
  created_at timestamptz not null default now()
);
create index highlight_runs_session_idx on public.highlight_runs (session_id, created_at desc);

alter table public.session_highlights enable row level security;
alter table public.highlight_runs enable row level security;

create policy "Momentos: a mesa vê"
  on public.session_highlights for select to authenticated
  using (private.is_campaign_member(campaign_id));
create policy "Momentos: o mestre cria"
  on public.session_highlights for insert to authenticated
  with check (exists (
    select 1 from public.sessions s where s.id = session_id and private.is_campaign_gm(s.campaign_id)
  ));
create policy "Momentos: o mestre altera"
  on public.session_highlights for update to authenticated
  using (private.is_campaign_gm(campaign_id))
  with check (private.is_campaign_gm(campaign_id));
create policy "Momentos: o mestre apaga"
  on public.session_highlights for delete to authenticated
  using (private.is_campaign_gm(campaign_id));

create policy "Uso dos momentos: o mestre vê"
  on public.highlight_runs for select to authenticated
  using (private.is_campaign_gm(campaign_id));
create policy "Uso dos momentos: o mestre registra"
  on public.highlight_runs for insert to authenticated
  with check (private.is_campaign_gm(campaign_id));

revoke all on table public.session_highlights, public.highlight_runs from anon, authenticated;
grant select, delete on table public.session_highlights to authenticated;
grant insert (session_id, title, summary, quotes, transcript_segment_ids, character_ids, location, mood, image_prompt, image_path, status, source)
  on table public.session_highlights to authenticated;
grant update (title, summary, quotes, transcript_segment_ids, character_ids, location, mood, image_prompt, image_path, status)
  on table public.session_highlights to authenticated;
grant select, insert on table public.highlight_runs to authenticated;
grant all on table public.session_highlights, public.highlight_runs to service_role;

-- A limpeza de órfãos passa a contar as imagens dos momentos.
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
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'campaign-media'
    and o.created_at < now() - make_interval(hours => greatest(p_min_age_hours, 1))
    and not exists (select 1 from referenced r where r.path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;
