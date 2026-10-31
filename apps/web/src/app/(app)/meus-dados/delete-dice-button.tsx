'use client';

import { CAMPAIGN_MEDIA_BUCKET, deleteDice } from '@codexveil/database';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/ui/use-confirm';
import { routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Apaga um dado da coleção (os personagens que o usavam voltam ao dado padrão). */
export function DeleteDiceButton({
  id,
  name,
  image,
}: {
  id: string;
  name: string;
  image: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
      {confirmDialog}
      <button
        type="button"
        disabled={busy}
        aria-label={`Apagar o dado ${name}`}
        title="Apagar"
        onClick={async () => {
          const ok = await confirm({
            title: 'Apagar o dado?',
            description: `"${name}" sai da coleção. Os personagens que o usam voltam ao dado padrão.`,
            confirmLabel: 'Apagar',
          });
          if (!ok) return;
          setBusy(true);
          const client = getSupabaseBrowserClient();
          try {
            await deleteDice(client, id);
            if (image) await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([image]);
            router.replace(routes.myDice);
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
        className="rounded p-1 text-fg-muted hover:bg-hover hover:text-ember-300"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </>
  );
}
