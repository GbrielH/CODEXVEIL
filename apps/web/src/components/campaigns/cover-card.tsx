'use client';

import { CAMPAIGN_MEDIA_BUCKET, campaignCoverPath, setCampaignCover } from '@codexveil/database';
import { IMAGE_EXTENSIONS } from '@codexveil/validation';
import { ImageUp, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { prepareImage } from '@/lib/images';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { CampaignCover } from './campaign-cover';

interface CoverCardProps {
  campaignId: string;
  name: string;
  coverPath: string | null;
  coverUrl: string | null;
  disabled: boolean;
}

/** Envio, troca e remoção da capa (só mestres de campanhas ativas enviam, pelo Storage). */
export function CampaignCoverCard({ campaignId, name, coverPath, coverUrl, disabled }: CoverCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (original: File) => {
    setError(null);
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const prepared = await prepareImage(original, 'scene');
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }
      const path = campaignCoverPath(campaignId, `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`);
      const bucket = client.storage.from(CAMPAIGN_MEDIA_BUCKET);
      const { error: uploadError } = await bucket.upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
      if (uploadError) throw uploadError;
      try {
        await setCampaignCover(client, campaignId, path);
      } catch (cause) {
        await bucket.remove([path]);
        throw cause;
      }
      if (coverPath) await bucket.remove([coverPath]);
      toast({ tone: 'success', title: 'Capa atualizada.' });
      router.refresh();
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível enviar a imagem.'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!coverPath) return;
    setError(null);
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      await setCampaignCover(client, campaignId, null);
      await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([coverPath]);
      toast({ tone: 'success', title: 'Capa removida.' });
      router.refresh();
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível remover a capa.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Capa da campanha" description="Aparece no painel e na lista de campanhas de todos os participantes. PNG, JPEG ou WebP." />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <CampaignCover url={coverUrl} name={name} className="aspect-[16/9] w-full rounded-md border border-line" />
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Escolher imagem da capa"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button size="sm" variant="secondary" loading={busy} disabled={disabled} onClick={() => inputRef.current?.click()} icon={<ImageUp className="h-4 w-4" aria-hidden="true" />}>
            {coverPath ? 'Trocar capa' : 'Enviar capa'}
          </Button>
          {coverPath ? (
            <Button size="sm" variant="ghost" disabled={busy || disabled} onClick={() => void remove()} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
              Remover
            </Button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
