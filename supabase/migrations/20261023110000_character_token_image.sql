-- Imagem de token do personagem (2026-10-23), usada na grade da sessão. Sem ela, o mapa usa o
-- retrato. Mesmo bucket e pasta do retrato (characters/{id}/...).
alter table public.characters
  add column token_path text
  constraint characters_token_path check (
    token_path is null
    or (char_length(token_path) <= 300 and token_path like 'characters/' || id::text || '/%')
  );

grant update (token_path) on table public.characters to authenticated;
