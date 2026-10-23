'use client';

import { CAMPAIGN_MEDIA_BUCKET, characterPortraitPath, setCharacterToken, signedMediaUrls } from '@codexveil/database';
import { IMAGE_EXTENSIONS } from '@codexveil/validation';
import { ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { prepareImage } from '@/lib/images';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Imagem do token do personagem no mapa da sessão. Sem ela, o mapa usa o retrato. Fica na mesma
 * pasta do retrato (characters/{id}/...).
 */
export function TokenImageCard({ characterId, portraitUrl }: { characterId: string; portraitUrl: string | null }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    void client
      .from('characters')
      .select('token_path')
      .eq('id', characterId)
      .maybeSingle()
      .then(async ({ data }) => {
        const current = data?.token_path ?? null;
        if (!active) return;
        setPath(current);
        if (current) {
          const urls = await signedMediaUrls(client, [current]);
          if (active) setUrl(urls[current] ?? null);
        }
      });
    return () => {
      active = false;
    };
  }, [characterId]);

  const upload = async (original: File) => {
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const prepared = await prepareImage(original, 'portrait');
      if (!prepared.ok) {
        toast({ tone: 'danger', title: 'Imagem recusada', description: prepared.message });
        return;
      }
      const next = characterPortraitPath(characterId, `token-${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`);
      const bucket = client.storage.from(CAMPAIGN_MEDIA_BUCKET);
      const { error } = await bucket.upload(next, prepared.file, { contentType: prepared.mimeType, upsert: false });
      if (error) throw error;
      await setCharacterToken(client, characterId, next);
      if (path) await bucket.remove([path]);
      setPath(next);
      setUrl((await signedMediaUrls(client, [next]))[next] ?? null);
      toast({ tone: 'success', title: 'Imagem do token atualizada.' });
    } catch (cause) {
      toast({ tone: 'danger', title: 'A imagem não foi enviada', description: failureMessage(cause, 'Tente novamente.') });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!path) return;
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      await setCharacterToken(client, characterId, null);
      await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([path]);
      setPath(null);
      setUrl(null);
      toast({ tone: 'success', title: 'O token volta a usar o retrato.' });
    } catch (cause) {
      toast({ tone: 'danger', title: 'A imagem não foi removida', description: failureMessage(cause, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  const shown = url ?? portraitUrl;
  return (
    <Card>
      <CardHeader title="Token no mapa" description="Imagem do personagem na grade da sessão. Sem ela, o mapa usa o retrato." />
      <div className="flex items-center gap-4">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-parchment-300/50 bg-wine-950">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária. */}
          {shown ? <img src={shown} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-fg-muted">Sem imagem</span>}
        </span>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0])}
          />
          <Button size="sm" variant="secondary" loading={busy} icon={<ImageUp className="h-4 w-4" aria-hidden="true" />} onClick={() => inputRef.current?.click()}>
            {path ? 'Trocar imagem do token' : 'Enviar imagem do token'}
          </Button>
          {path ? (
            <Button size="sm" variant="ghost" disabled={busy} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} onClick={() => void remove()}>
              Usar o retrato
            </Button>
          ) : null}
          <p className="text-xs text-fg-muted">{path ? 'Imagem própria do token.' : portraitUrl ? 'Usando o retrato.' : 'Sem retrato: o mapa mostra as iniciais.'}</p>
        </div>
      </div>
    </Card>
  );
}
