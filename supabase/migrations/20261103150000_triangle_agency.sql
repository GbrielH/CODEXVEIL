-- Triangle Agency usa um módulo próprio. O texto do livro permanece no pacote privado gerado a
-- partir do exemplar do usuário; o banco registra apenas o sistema e as fichas em JSON.
insert into public.rpg_systems (id, name, short_name)
values ('triangle-agency', 'Triangle Agency', 'TA')
on conflict (id) do nothing;

