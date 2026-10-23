-- Assistente de IA (2026-10-23): cota diária de perguntas por pessoa. A conversa em si não é
-- gravada; só a contagem do dia, para limitar o custo.
create table public.assistant_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  questions integer not null default 0 check (questions >= 0),
  primary key (user_id, day)
);

comment on table public.assistant_usage is 'Quantas perguntas cada pessoa fez ao assistente de IA em cada dia (UTC).';

alter table public.assistant_usage enable row level security;

create policy "Assistente: a pessoa lê o próprio uso"
  on public.assistant_usage for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.assistant_usage from anon, authenticated;
grant select on table public.assistant_usage to authenticated;

-- Consome uma pergunta da cota do dia. Devolve quantas restam, ou -1 se a cota acabou.
-- O limite fica fixo aqui (não vem do cliente).
create or replace function public.consume_assistant_question()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_limit constant integer := 30;
  uid uuid := auth.uid();
  used integer;
begin
  if uid is null then
    raise exception 'Sessão necessária.' using errcode = '42501';
  end if;
  insert into public.assistant_usage as u (user_id, day, questions)
  values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set questions = u.questions + 1
    where u.questions < daily_limit
  returning u.questions into used;
  if used is null then
    return -1;
  end if;
  return daily_limit - used;
end;
$$;

revoke all on function public.consume_assistant_question() from public, anon;
grant execute on function public.consume_assistant_question() to authenticated;
