-- Grupo com fichas ocultas (2026-10-31): mesmo quando o mestre esconde as fichas dos outros
-- jogadores, quem participa da campanha vê o nome e o retrato de cada personagem — só isso.
create function public.list_party_faces(p_campaign_id uuid)
returns table (id uuid, name text, owner_id uuid, owner_name text, portrait_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.owner_id, p.display_name, c.portrait_path
  from public.characters c
  left join public.profiles p on p.id = c.owner_id
  where c.campaign_id = p_campaign_id
    and private.is_campaign_member(p_campaign_id)
  order by c.name;
$$;

revoke all on function public.list_party_faces(uuid) from public, anon;
grant execute on function public.list_party_faces(uuid) to authenticated, service_role;

-- O retrato (e o token) dos personagens da campanha fica legível para todos os participantes,
-- mesmo com as fichas ocultas: a imagem não revela nada da ficha.
create policy "Retratos: participantes da campanha do personagem leem"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-media'
    and split_part(name, '/', 1) = 'characters'
    and exists (
      select 1 from public.characters c
      where c.id = private.try_uuid(split_part(name, '/', 2))
        and c.campaign_id is not null
        and private.is_campaign_member(c.campaign_id)
    )
  );
