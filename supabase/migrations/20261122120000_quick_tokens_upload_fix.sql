-- Token rápido (correção 2): a regra de envio conferia `campaigns.status` lendo a tabela com o RLS
-- do jogador, que não enxerga a linha por ali, e o envio era sempre recusado. A campanha ativa já é
-- conferida por add_my_quick_token / set_my_quick_token_image; aqui fica só caminho + participante.
drop policy "Tokens rápidos: participante envia a própria imagem" on storage.objects;

create policy "Tokens rápidos: participante envia a própria imagem"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'campaign-media'
    and split_part(name, '/', 1) = 'campaigns'
    and split_part(name, '/', 3) = 'maps'
    and split_part(name, '/', 4) like 'quick-' || (select auth.uid()) || '-%'
    and private.is_campaign_member(private.try_uuid(split_part(name, '/', 2)))
  );
