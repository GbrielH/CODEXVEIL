-- Iluminação do mapa, fontes de luz e visão no escuro. O mestre configura; membros recebem os
-- valores somente junto do mapa/token que já podem ver pelas políticas existentes.

create function private.are_valid_map_lights(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare v_item jsonb;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 100 or pg_column_size(p_value) > 32768 then return false; end if;
  for v_item in select value from jsonb_array_elements(p_value)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'id') <> 'string'
       or v_item ->> 'kind' not in ('torch', 'lantern')
       or jsonb_typeof(v_item -> 'x') <> 'number'
       or jsonb_typeof(v_item -> 'y') <> 'number'
       or jsonb_typeof(v_item -> 'brightRadius') <> 'number'
       or jsonb_typeof(v_item -> 'dimRadius') <> 'number'
       or (v_item ->> 'x')::numeric not between 0 and 200
       or (v_item ->> 'y')::numeric not between 0 and 200
       or (v_item ->> 'brightRadius')::numeric not between 0 and 200
       or (v_item ->> 'dimRadius')::numeric not between (v_item ->> 'brightRadius')::numeric and 200 then
      return false;
    end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;

revoke all on function private.are_valid_map_lights(jsonb) from public;
grant execute on function private.are_valid_map_lights(jsonb) to authenticated, service_role;

alter table public.session_maps
  add column illumination text not null default 'bright' check (illumination in ('bright', 'dim', 'dark')),
  add column lights jsonb not null default '[]'::jsonb check (private.are_valid_map_lights(lights));

alter table public.map_tokens
  add column darkvision_radius integer not null default 0 check (darkvision_radius between 0 and 200),
  add column light_bright_radius integer not null default 0 check (light_bright_radius between 0 and 200),
  add column light_dim_radius integer not null default 0 check (light_dim_radius between light_bright_radius and 200);

grant update (illumination, lights) on table public.session_maps to authenticated;
grant update (darkvision_radius, light_bright_radius, light_dim_radius) on table public.map_tokens to authenticated;
