'use client';

import { deleteBookPack } from '@codexveil/database';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Remove um livro importado (e todo o conteúdo dele) da conta. */
export function BookDeleteButton({ packId, name }: { packId: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={(open) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          onClick={open}
        >
          Remover
        </Button>
      )}
      title={`Remover “${name}”?`}
      description="O conteúdo do livro sai da sua conta e das campanhas em que ele estava liberado. Personagens e registros já criados com ele continuam como estão. Dá para importar de novo depois."
      confirmLabel="Remover livro"
      onConfirm={async () => {
        try {
          await deleteBookPack(getSupabaseBrowserClient(), packId);
        } catch (error) {
          throw new Error(failureMessage(error, 'Não foi possível remover o livro.'));
        }
        router.refresh();
      }}
    />
  );
}
