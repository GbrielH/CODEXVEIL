-- Complemento de 20261021100000_creature_size.sql: `creatures` usa permissões por coluna, então
-- o porte precisa ser liberado para criar e editar (o RLS continua exigindo o mestre).
grant insert (size) on table public.creatures to authenticated;
grant update (size) on table public.creatures to authenticated;
