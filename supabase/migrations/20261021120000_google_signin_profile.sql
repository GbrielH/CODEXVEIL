-- Login com Google (2026-10-21): o perfil novo usa o nome enviado pelo Google (`full_name` ou
-- `name`) quando não houver `display_name` (o cadastro por e-mail continua enviando
-- `display_name`).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := btrim(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      ''
    ),
    '[[:cntrl:]]', '', 'g'
  ));
  v_name := left(v_name, 40);
  if char_length(v_name) < 2 then
    v_name := 'Aventureiro';
  end if;

  insert into public.profiles (id, display_name) values (new.id, v_name);
  return new;
end;
$$;
