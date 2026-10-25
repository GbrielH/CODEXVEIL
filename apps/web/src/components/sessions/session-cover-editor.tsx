'use client';

import { CAMPAIGN_MEDIA_BUCKET, sessionImagePath, setSessionCover } from '@codexveil/database';
import { IMAGE_EXTENSIONS } from '@codexveil/validation';
import { ImageIcon, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { prepareImage } from '@/lib/images';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Capa da sessão (como a da campanha): o mestre envia, troca ou tira. */
export function SessionCoverEditor({
  campaignId,
  sessionId,
  coverPath,
  coverUrl,
}: {
  campaignId: string;
  sessionId: string;
  coverPath: string | null;
  coverUrl: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (original: File) => {
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const prepared = await prepareImage(original, 'scene');
      if (!prepared.ok) throw new Error(prepared.message);
      const path = sessionImagePath(
        campaignId,
        sessionId,
        `capa-${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`,
      );
      const { error } = await client.storage
        .from(CAMPAIGN_MEDIA_BUCKET)
        .upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
      if (error) throw error;
      await setSessionCover(client, sessionId, path);
      if (coverPath) await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([coverPath]);
      toast({ tone: 'success', title: 'Capa da sessão atualizada.' });
      router.refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'A capa não foi salva',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    if (!coverPath) return;
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      await setSessionCover(client, sessionId, null);
      await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([coverPath]);
      router.refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'A capa não foi removida',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<ImageIcon className="h-5 w-5" aria-hidden="true" />}
        title="Capa da sessão"
        description="Aparece no topo da sessão e no roteiro dos jogadores quando a sessão for publicada."
      />
      {coverUrl ? (
        // URL assinada e temporária do Storage privado.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          className="mb-3 aspect-[3/1] w-full rounded-lg border border-line object-cover"
        />
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Escolher a capa da sessão"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => input.current?.click()}
          icon={<ImageIcon className="h-4 w-4" aria-hidden="true" />}
        >
          {coverUrl ? 'Trocar capa' : 'Escolher capa'}
        </Button>
        {coverUrl ? (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void remove()}
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          >
            Tirar capa
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
