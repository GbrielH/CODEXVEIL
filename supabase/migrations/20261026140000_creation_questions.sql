-- =============================================================================
-- Perguntas do mestre para a criação de personagem (2026-10-26).
--   * `campaigns.creation_questions`: perguntas que o mestre define (0 a 20). Todas são
--     obrigatórias para quem cria (ou vincula) um personagem na campanha.
--   * `character_answers`: respostas, vistas só pelo dono do personagem e pelo mestre.
--   * A obrigatoriedade fica no banco: uma verificação adiada (fim da transação) recusa o
--     personagem que entra numa campanha com perguntas sem responder todas.
--   * `create_character` e `set_character_campaign` recebem as respostas e gravam na mesma
--     transação.
-- =============================================================================

create function private.valid_questions(p_questions text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_questions) <= 20
    and not exists (
      select 1 from unnest(p_questions) as q
      where char_length(btrim(q)) = 0 or char_length(q) > 300
    );
$$;

alter table public.campaigns
  add column creation_questions text[] not null default '{}'
    check (private.valid_questions(creation_questions));

comment on column public.campaigns.creation_questions is
  'Perguntas obrigatórias que os jogadores respondem ao criar personagem na campanha.';

grant insert (creation_questions), update (creation_questions) on table public.campaigns to authenticated;

create table public.character_answers (
  character_id uuid primary key references public.characters (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- [{ "question": "...", "answer": "..." }]: a pergunta vai junto, para continuar legível se o
  -- mestre mudar a lista depois.
  answers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) <= 20 and pg_column_size(answers) <= 65536),
  updated_at timestamptz not null default now()
);

comment on table public.character_answers is
  'Respostas do jogador às perguntas do mestre; só o dono do personagem e o mestre leem.';

create trigger character_answers_set_updated_at
  before update on public.character_answers
  for each row execute function private.set_updated_at();

alter table public.character_answers enable row level security;

create policy "Respostas: dono do personagem e mestre leem"
  on public.character_answers for select to authenticated
  using (
    exists (select 1 from public.characters c where c.id = character_id and c.owner_id = (select auth.uid()))
    or private.is_campaign_gm(campaign_id)
  );

create policy "Respostas: o dono responde"
  on public.character_answers for insert to authenticated
  with check (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.owner_id = (select auth.uid()) and c.campaign_id = campaign_id
    )
  );

create policy "Respostas: o dono altera"
  on public.character_answers for update to authenticated
  using (exists (select 1 from public.characters c where c.id = character_id and c.owner_id = (select auth.uid())))
  with check (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.owner_id = (select auth.uid()) and c.campaign_id = campaign_id
    )
  );

revoke all on table public.character_answers from anon, authenticated;
grant select, insert, update on table public.character_answers to authenticated;
grant all on table public.character_answers to service_role;

-- Todas as perguntas atuais da campanha têm resposta não vazia?
create function private.answers_complete(p_character_id uuid, p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.campaigns cp, unnest(cp.creation_questions) as q(question)
    where cp.id = p_campaign_id
      and not exists (
        select 1
        from public.character_answers ca, jsonb_array_elements(ca.answers) as a
        where ca.character_id = p_character_id
          and ca.campaign_id = p_campaign_id
          and a ->> 'question' = q.question
          and char_length(btrim(coalesce(a ->> 'answer', ''))) > 0
      )
  );
$$;

create function private.require_creation_answers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.campaign_id is not null
     and (tg_op = 'INSERT' or new.campaign_id is distinct from old.campaign_id)
     and not private.answers_complete(new.id, new.campaign_id) then
    raise exception 'Responda a todas as perguntas do mestre para entrar na campanha.'
      using errcode = '23514', hint = 'CVQUE';
  end if;
  return null;
end;
$$;

-- Adiada: as respostas são gravadas depois do personagem, na mesma transação.
create constraint trigger characters_require_creation_answers
  after insert or update of campaign_id on public.characters
  deferrable initially deferred
  for each row execute function private.require_creation_answers();

-- Grava as respostas de um personagem do próprio usuário (usada pelas funções abaixo).
create function private.save_creation_answers(p_character_id uuid, p_campaign_id uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_campaign_id is null or p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    return;
  end if;
  if not exists (
    select 1 from public.characters c
    where c.id = p_character_id and c.owner_id = (select auth.uid()) and c.campaign_id = p_campaign_id
  ) then
    raise exception 'Personagem não encontrado.' using errcode = 'P0002';
  end if;
  insert into public.character_answers (character_id, campaign_id, answers)
  values (p_character_id, p_campaign_id, p_answers)
  on conflict (character_id) do update set campaign_id = excluded.campaign_id, answers = excluded.answers;
end;
$$;

-- create_character: agora também recebe as respostas.
drop function public.create_character(text, text, uuid, jsonb, jsonb, jsonb, jsonb);

create function public.create_character(
  p_name text,
  p_system_id text,
  p_campaign_id uuid default null,
  p_sheet jsonb default '{}'::jsonb,
  p_resources jsonb default '[]'::jsonb,
  p_items jsonb default '[]'::jsonb,
  p_abilities jsonb default '[]'::jsonb,
  p_answers jsonb default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(coalesce(p_resources, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_resources, '[]'::jsonb)) > 100 then
    raise exception 'Lista de recursos inválida.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 200 then
    raise exception 'Lista de itens inválida.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_abilities, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_abilities, '[]'::jsonb)) > 300 then
    raise exception 'Lista de habilidades inválida.' using errcode = '22023';
  end if;

  insert into public.characters (name, system_id, campaign_id, sheet)
  values (p_name, p_system_id, p_campaign_id, coalesce(p_sheet, '{}'::jsonb))
  returning id into v_id;

  perform private.save_creation_answers(v_id, p_campaign_id, p_answers);

  insert into public.character_resources
    (character_id, key, label, current, max, temp, recovery, display, sort_order)
  select
    v_id,
    r ->> 'key',
    r ->> 'label',
    coalesce((r ->> 'current')::integer, 0),
    (r ->> 'max')::integer,
    0,
    coalesce((r ->> 'recovery')::public.resource_recovery, 'manual'),
    coalesce(r ->> 'display', 'pool'),
    coalesce((r ->> 'sortOrder')::integer, 0)
  from jsonb_array_elements(coalesce(p_resources, '[]'::jsonb)) as r;

  insert into public.character_items
    (character_id, name, category, quantity, weight, description, notes, is_equipped, sort_order)
  select
    v_id,
    i ->> 'name',
    coalesce((i ->> 'category')::public.item_category, 'gear'),
    coalesce((i ->> 'quantity')::integer, 1),
    (i ->> 'weight')::numeric,
    coalesce(i ->> 'description', ''),
    coalesce(i ->> 'notes', ''),
    coalesce((i ->> 'isEquipped')::boolean, false),
    coalesce((i ->> 'sortOrder')::integer, 0)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as i;

  insert into public.character_abilities
    (character_id, kind, name, source, description, data, resource_id, sort_order)
  select
    v_id,
    (a ->> 'kind')::public.ability_entry_kind,
    a ->> 'name',
    coalesce(a ->> 'source', ''),
    coalesce(a ->> 'description', ''),
    coalesce(a -> 'data', '{}'::jsonb),
    (
      select r.id from public.character_resources r
      where r.character_id = v_id and r.key = a ->> 'resourceKey'
    ),
    coalesce((a ->> 'sortOrder')::integer, 0)
  from jsonb_array_elements(coalesce(p_abilities, '[]'::jsonb)) as a;

  return v_id;
end;
$$;

revoke all on function public.create_character(text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_character(text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

revoke all on function private.save_creation_answers(uuid, uuid, jsonb) from public;
grant execute on function private.save_creation_answers(uuid, uuid, jsonb) to authenticated;

-- Vincular um personagem existente a uma campanha também exige as respostas.
create function public.set_character_campaign_with_answers(p_character_id uuid, p_campaign_id uuid, p_answers jsonb)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  perform public.set_character_campaign(p_character_id, p_campaign_id);
  perform private.save_creation_answers(p_character_id, p_campaign_id, p_answers);
end;
$$;

revoke all on function public.set_character_campaign_with_answers(uuid, uuid, jsonb) from public, anon;
grant execute on function public.set_character_campaign_with_answers(uuid, uuid, jsonb) to authenticated;
