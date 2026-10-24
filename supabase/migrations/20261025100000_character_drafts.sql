-- Rascunhos de personagem (pedido de 2026-10-24): o jogador salva a criação incompleta e continua
-- depois, em qualquer aparelho. Só o dono vê e altera; o rascunho some ao criar o personagem.

create table public.character_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  system_id text not null references public.rpg_systems (id),
  campaign_id uuid references public.campaigns (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  -- Estado do assistente (rascunho, passo atual, rolagens), validado pelo módulo do sistema.
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.character_drafts is 'Criação de personagem salva incompleta (só o dono vê).';

create index character_drafts_owner_idx on public.character_drafts (owner_id, updated_at desc);

create trigger character_drafts_set_updated_at
  before update on public.character_drafts
  for each row execute function private.set_updated_at();

-- Até 20 rascunhos por pessoa.
create function private.character_drafts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('codexveil:character_drafts:' || new.owner_id::text, 0));
  if (select count(*) from public.character_drafts d where d.owner_id = new.owner_id) >= 20 then
    perform private.raise_limit_reached('maxCharacterDrafts');
  end if;
  if new.campaign_id is not null and not private.is_campaign_member(new.campaign_id) then
    raise exception 'Você não participa desta campanha.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.character_drafts_before_insert() from public;

create trigger character_drafts_before_insert
  before insert on public.character_drafts
  for each row execute function private.character_drafts_before_insert();

alter table public.character_drafts enable row level security;

create policy "Rascunhos: o dono lê"
  on public.character_drafts for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Rascunhos: o dono cria"
  on public.character_drafts for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Rascunhos: o dono altera"
  on public.character_drafts for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Rascunhos: o dono apaga"
  on public.character_drafts for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke all on table public.character_drafts from anon, authenticated;
grant select, insert, delete on table public.character_drafts to authenticated;
grant update (name, payload) on table public.character_drafts to authenticated;
grant all on table public.character_drafts to service_role;
