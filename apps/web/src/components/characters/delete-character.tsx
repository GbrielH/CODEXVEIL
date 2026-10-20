'use client';

import { CAMPAIGN_MEDIA_BUCKET, deleteCharacter } from '@codexveil/database';
import { Trash2 } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { failureMessage } from '@/lib/client-errors';
import { routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Exclusão definitiva do personagem (qualquer sistema); pede para digitar o nome. */
export function DeleteCharacterCard({
  characterId,
  name,
  portraitPath,
  className,
}: {
  characterId: string;
  name: string;
  portraitPath: string | null;
  className?: string;
}) {
  const router = useRouter();
  const remove = async () => {
    const client = getSupabaseBrowserClient();
    try {
      await deleteCharacter(client, characterId);
    } catch (cause) {
      throw new Error(failureMessage(cause, 'Não foi possível excluir o personagem.'));
    }
    if (portraitPath) await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([portraitPath]);
    router.replace(`${routes.characters}?aviso=personagem-excluido` as Route);
    router.refresh();
  };
  return (
    <Card className={className ?? 'border-ember-400/40'}>
      <CardHeader
        title="Excluir personagem"
        description="Apaga a ficha, o inventário, as habilidades e o histórico. Não pode ser desfeito."
      />
      <ConfirmDialog
        trigger={(open) => (
          <Button
            variant="danger"
            onClick={open}
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          >
            Excluir definitivamente
          </Button>
        )}
        title={`Excluir “${name}”?`}
        description="Todos os dados do personagem serão apagados para sempre."
        confirmLabel="Excluir personagem"
        requireText={name}
        onConfirm={remove}
      />
    </Card>
  );
}
