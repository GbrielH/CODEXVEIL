'use client';

import { CAMPAIGN_MEDIA_BUCKET, characterPortraitPath, setCharacterPortrait } from '@codexveil/database';
import { IMAGE_EXTENSIONS } from '@codexveil/validation';
import { ImageUp, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { Portrait } from '@/components/characters/portrait';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { prepareImage } from '@/lib/images';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Retrato do personagem (a imagem da ficha, não a do grid). Comum às fichas de todos os sistemas;
 * `onVersion` recebe a nova versão da ficha depois de gravar.
 */
export function PortraitCard({
  characterId,
  name,
  portraitPath,
  portraitUrl,
  onVersion,
}: {
  characterId: string;
  name: string;
  portraitPath: string | null;
  portraitUrl: string | null;
  onVersion: (version: number) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (original: File) => {
    setError(null);
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const prepared = await prepareImage(original, 'portrait');
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }
      const path = characterPortraitPath(characterId, `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`);
      const { error: uploadError } = await client.storage
        .from(CAMPAIGN_MEDIA_BUCKET)
        .upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
      if (uploadError) throw uploadError;
      try {
        onVersion(await setCharacterPortrait(client, characterId, path));
      } catch (cause) {
        await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([path]);
        throw cause;
      }
      if (portraitPath) await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([portraitPath]);
      toast({ tone: 'success', title: 'Retrato atualizado.' });
      router.refresh();
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível enviar a imagem.'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!portraitPath) return;
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      onVersion(await setCharacterPortrait(client, characterId, null));
      await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([portraitPath]);
      toast({ tone: 'success', title: 'Retrato removido.' });
      router.refresh();
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível remover o retrato.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Retrato" description="A imagem da ficha. Visível para quem pode ver a ficha. PNG, JPEG ou WebP, até 5 MB." />
      <div className="flex items-center gap-4">
        <Portrait name={name} url={portraitUrl} size="lg" />
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => inputRef.current?.click()}
            icon={<ImageUp className="h-4 w-4" aria-hidden="true" />}
          >
            {portraitPath ? 'Trocar retrato' : 'Enviar retrato'}
          </Button>
          {portraitPath ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove()} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
              Remover
            </Button>
          ) : null}
          {error ? (
            <p className="text-xs font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
