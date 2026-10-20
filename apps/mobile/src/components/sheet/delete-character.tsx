import { CAMPAIGN_MEDIA_BUCKET, deleteCharacter } from '@codexveil/database';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { AppText, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

/** Exclusão definitiva do personagem (qualquer sistema), com confirmação. */
export function DeleteCharacterCard({ characterId, name, portraitPath }: { characterId: string; name: string; portraitPath: string | null }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <AppText variant="heading">Excluir personagem</AppText>
      <AppText variant="small">Apaga a ficha, o inventário, as habilidades e o histórico. Não pode ser desfeito.</AppText>
      <Button
        label="Excluir definitivamente"
        variant="danger"
        loading={busy}
        onPress={async () => {
          const ok = await confirm({ title: `Excluir “${name}”?`, message: 'Todos os dados do personagem serão apagados para sempre.', confirmLabel: 'Excluir personagem', tone: 'danger' });
          if (!ok) return;
          setBusy(true);
          try {
            const client = getSupabase();
            await deleteCharacter(client, characterId);
            if (portraitPath) await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([portraitPath]);
            toast({ tone: 'success', title: `${name} foi excluído.` });
            router.replace('/personagens');
          } catch (error) {
            toast({ tone: 'danger', title: 'Não foi possível excluir o personagem', description: failureMessage(error) });
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}
