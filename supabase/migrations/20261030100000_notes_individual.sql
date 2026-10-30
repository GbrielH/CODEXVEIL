-- =============================================================================
-- Anotações só individuais (2026-10-30): cada pessoa lê, edita e apaga só as próprias
-- anotações da campanha (o mestre também). As já compartilhadas passam a ser só do autor.
-- =============================================================================

update public.campaign_notes set visibility = 'author' where visibility <> 'author';

alter table public.campaign_notes alter column visibility set default 'author';
alter table public.campaign_notes
  add constraint campaign_notes_individual check (visibility = 'author');

drop policy "Anotações visíveis conforme a visibilidade" on public.campaign_notes;
create policy "Anotações: só o autor lê"
  on public.campaign_notes for select to authenticated
  using (author_id = (select auth.uid()) and private.is_campaign_member(campaign_id));

drop policy "Autor ou mestre remove anotações visíveis a todos" on public.campaign_notes;
create policy "Anotações: só o autor remove"
  on public.campaign_notes for delete to authenticated
  using (author_id = (select auth.uid()));

-- Imagens das anotações: também só o autor.
create or replace function private.can_read_campaign_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_notes n
    where n.id = p_note_id and n.author_id = (select auth.uid())
  );
$$;
