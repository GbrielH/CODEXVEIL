-- Token rápido (correção): o Storage grava a imagem e lê a linha de volta (INSERT ... RETURNING),
-- e o RLS exige leitura da linha nova. Antes de o token apontar para a imagem, o jogador não a lia
-- e o envio era recusado. Agora o participante lê as próprias imagens de token rápido.
create policy "Tokens rápidos: participante lê as próprias imagens"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-media'
    and split_part(name, '/', 1) = 'campaigns'
    and split_part(name, '/', 3) = 'maps'
    and split_part(name, '/', 4) like 'quick-' || (select auth.uid()) || '-%'
    and private.is_campaign_member(private.try_uuid(split_part(name, '/', 2)))
  );
