-- Vários dados por jogador (2026-10-31): "Meus dados" guarda uma coleção de dados (desenho, cores,
-- fonte) e cada personagem pode usar um deles. Quem divide campanha com o dono vê os dados dele
-- (para desenhar as rolagens na mesa). O dado padrão continua em `profiles.preferences.dice`.

create table public.user_dice (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  image_path text check (image_path is null or private.dice_image_owner(image_path) = owner_id),
  number_color text check (number_color is null or number_color ~ '^#[0-9a-fA-F]{6}$'),
  font text check (font is null or font in ('classic', 'modern', 'machine', 'display')),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_dice is 'Dados personalizados de cada jogador ("Meus dados").';

create index user_dice_owner_idx on public.user_dice (owner_id, created_at);

create trigger user_dice_set_updated_at
  before update on public.user_dice
  for each row execute function private.set_updated_at();

-- No máximo 12 dados por pessoa.
create function private.user_dice_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.user_dice d where d.owner_id = new.owner_id) >= 12 then
    raise exception 'Limite de 12 dados salvos.' using errcode = 'CVLIM';
  end if;
  return new;
end;
$$;
revoke all on function private.user_dice_limit() from public;
create trigger user_dice_limit before insert on public.user_dice
  for each row execute function private.user_dice_limit();

alter table public.user_dice enable row level security;

create policy "Dados salvos: dono e colegas de campanha leem"
  on public.user_dice for select to authenticated
  using (owner_id = (select auth.uid()) or private.shares_campaign_with(owner_id));
create policy "Dados salvos: dono cria"
  on public.user_dice for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Dados salvos: dono altera"
  on public.user_dice for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Dados salvos: dono apaga"
  on public.user_dice for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke all on table public.user_dice from anon, authenticated;
grant select, delete on table public.user_dice to authenticated;
grant insert (name, image_path, number_color, font, color) on table public.user_dice to authenticated;
grant update (name, image_path, number_color, font, color) on table public.user_dice to authenticated;
grant all on table public.user_dice to service_role;

-- Dado do personagem: um dos dados salvos do dono do personagem.
alter table public.characters
  add column dice_id uuid references public.user_dice (id) on delete set null;

create function private.check_character_dice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.dice_id is not null and not exists (
    select 1 from public.user_dice d where d.id = new.dice_id and d.owner_id = new.owner_id
  ) then
    raise exception 'O dado precisa ser do dono do personagem.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.check_character_dice() from public;
create trigger characters_check_dice before insert or update of dice_id on public.characters
  for each row execute function private.check_character_dice();

grant update (dice_id) on table public.characters to authenticated;

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
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'campaign-media'
    and o.created_at < now() - make_interval(hours => greatest(p_min_age_hours, 1))
    and not exists (select 1 from referenced r where r.path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- O rosto do grupo passa a trazer o dado do personagem (a mesa desenha as rolagens com ele).
drop function public.list_party_faces(uuid);
create function public.list_party_faces(p_campaign_id uuid)
returns table (id uuid, name text, owner_id uuid, owner_name text, portrait_path text, dice_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.owner_id, p.display_name, c.portrait_path, c.dice_id
  from public.characters c
  left join public.profiles p on p.id = c.owner_id
  where c.campaign_id = p_campaign_id
    and private.is_campaign_member(p_campaign_id)
  order by c.name;
$$;

revoke all on function public.list_party_faces(uuid) from public, anon;
grant execute on function public.list_party_faces(uuid) to authenticated, service_role;
