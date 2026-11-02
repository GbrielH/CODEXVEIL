-- Endurece a autorização da call antes do teste ao vivo.
-- Convite ou entrada recusada permitem localizar a sala, mas não ler participantes/transcrição
-- nem convidar terceiros. O registro de uso dos Momentos deriva a campanha da sessão.

create function private.can_access_call_content(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.call_rooms r
    where r.id = p_room_id and r.owner_id = (select auth.uid())
  ) or exists (
    select 1
    from public.call_participants p
    where p.room_id = p_room_id
      and p.user_id = (select auth.uid())
      and p.status = 'approved'
  );
$$;
revoke all on function private.can_access_call_content(uuid) from public;
grant execute on function private.can_access_call_content(uuid) to authenticated;

drop policy "Call: dono e convidado veem o convite" on public.call_invites;
create policy "Call: convidado e participantes aprovados veem o convite"
  on public.call_invites for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_access_call_content(room_id)
  );

drop policy "Call: quem participa vê os participantes" on public.call_participants;
create policy "Call: aprovados veem participantes e cada um vê a própria entrada"
  on public.call_participants for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_access_call_content(room_id)
  );

drop policy "Transcrição: quem esteve na sala e o mestre leem" on public.transcript_segments;
create policy "Transcrição: aprovados na sala e o mestre leem"
  on public.transcript_segments for select to authenticated
  using (private.can_access_call_content(room_id) or private.can_edit_transcript(room_id));

create or replace function public.invite_to_call(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_access_call_content(p_room_id) then
    raise exception 'Só quem já entrou na sala pode convidar.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Pessoa não encontrada.' using errcode = 'P0002';
  end if;
  insert into public.call_invites (room_id, user_id, invited_by)
  values (p_room_id, p_user_id, (select auth.uid()))
  on conflict do nothing;
end;
$$;

-- Impede que o dono vincule a sala a uma sessão alheia depois da criação.
drop policy "Call: o dono altera a sala" on public.call_rooms;
create policy "Call: o dono altera a sala"
  on public.call_rooms for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (
      session_id is null
      or exists (
        select 1 from public.sessions s
        where s.id = session_id and s.campaign_id = campaign_id
      )
    )
  );

create function private.fill_highlight_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select s.campaign_id into new.campaign_id
  from public.sessions s
  where s.id = new.session_id;
  if new.campaign_id is null then
    raise exception 'Sessão não encontrada.' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.fill_highlight_run() from public;
create trigger highlight_runs_fill
  before insert on public.highlight_runs
  for each row execute function private.fill_highlight_run();

-- O app precisa distinguir o dono real de outro mestre da campanha para mostrar os controles.
drop function public.find_call_room(text);
create function public.find_call_room(p_ref text)
returns table (
  id uuid, slug text, code text, title text, access_mode text, status text,
  owner_id uuid, owner_name text, campaign_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.slug, r.code, r.title, r.access_mode, r.status, r.owner_id, p.display_name, c.name
  from public.call_rooms r
  join public.profiles p on p.id = r.owner_id
  left join public.campaigns c on c.id = r.campaign_id
  where (select auth.uid()) is not null
    and (r.slug = lower(btrim(p_ref)) or r.code = upper(btrim(p_ref)));
$$;
revoke all on function public.find_call_room(text) from public, anon;
grant execute on function public.find_call_room(text) to authenticated;
