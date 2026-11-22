'use client';

import { CAMPAIGN_MEDIA_BUCKET } from '@codexveil/database';
import { diceAuraLabels, type DiceAura } from '@codexveil/validation';
import { ImagePlus, Music, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { AuraIcon } from '@/components/dice/aura-icons';
import { forgetAuraArt } from '@/components/dice/aura-media';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { setAuraArtAction, setAuraSoundAction } from './actions';

/** Até 2 MB (o limite do armazenamento). */
const MAX_BYTES = 2 * 1024 * 1024;
const SOUND_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
};
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * Conta de criador: imagem própria para o crítico de uma aura (o Vírus Retrô, por exemplo, usa a
 * imagem como o assistente que pula pela tela). Fica no armazenamento da conta, fora do código;
 * quem divide campanha com você vê no crítico.
 */
export function AuraArtCard({
  userId,
  auras,
  art,
  sounds,
}: {
  userId: string;
  auras: readonly DiceAura[];
  /** Imagens já enviadas: aura → caminho e link assinado. */
  art: Partial<Record<DiceAura, { path: string; url: string | null }>>;
  /** Sons já enviados: aura → caminho e link assinado. */
  sounds: Partial<Record<DiceAura, { path: string; url: string | null }>>;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const soundRef = useRef<HTMLInputElement>(null);
  const [aura, setAura] = useState<DiceAura>(auras.includes('retro') ? 'retro' : auras[0]!);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const current = art[aura];
  const currentSound = sounds[aura];

  const upload = (file: File) =>
    startTransition(async () => {
      setMessage(null);
      const extension = TYPES[file.type];
      if (!extension) return setMessage({ ok: false, text: 'Use PNG, JPG ou WebP.' });
      if (file.size > MAX_BYTES)
        return setMessage({ ok: false, text: 'A imagem pode ter até 2 MB.' });
      const bucket = getSupabaseBrowserClient().storage.from(CAMPAIGN_MEDIA_BUCKET);
      const path = `users/${userId}/dice/aura-${aura}-${Date.now()}.${extension}`;
      const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
      if (error) return setMessage({ ok: false, text: 'Não foi possível enviar a imagem.' });
      const result = await setAuraArtAction(aura, path);
      if (!result.ok) {
        await bucket.remove([path]);
        return setMessage({ ok: false, text: result.message });
      }
      if (current) await bucket.remove([current.path]);
      forgetAuraArt();
      setMessage({ ok: true, text: `Imagem do crítico de ${diceAuraLabels[aura].name} salva.` });
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      if (!current) return;
      const result = await setAuraArtAction(aura, null);
      if (!result.ok) return setMessage({ ok: false, text: result.message });
      await getSupabaseBrowserClient().storage.from(CAMPAIGN_MEDIA_BUCKET).remove([current.path]);
      forgetAuraArt();
      setMessage({ ok: true, text: 'Imagem removida.' });
      router.refresh();
    });

  const uploadSound = (file: File) =>
    startTransition(async () => {
      setMessage(null);
      const extension = SOUND_TYPES[file.type];
      if (!extension) return setMessage({ ok: false, text: 'Use MP3, OGG, WAV ou M4A.' });
      if (file.size > MAX_BYTES) return setMessage({ ok: false, text: 'O som pode ter até 2 MB.' });
      const bucket = getSupabaseBrowserClient().storage.from(CAMPAIGN_MEDIA_BUCKET);
      const path = `users/${userId}/sounds/aura-${aura}-${Date.now()}.${extension}`;
      const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
      if (error) return setMessage({ ok: false, text: 'Não foi possível enviar o som.' });
      const result = await setAuraSoundAction(aura, path);
      if (!result.ok) {
        await bucket.remove([path]);
        return setMessage({ ok: false, text: result.message });
      }
      if (currentSound) await bucket.remove([currentSound.path]);
      forgetAuraArt();
      setMessage({ ok: true, text: `Som do crítico de ${diceAuraLabels[aura].name} salvo.` });
      router.refresh();
    });

  const removeSound = () =>
    startTransition(async () => {
      if (!currentSound) return;
      const result = await setAuraSoundAction(aura, null);
      if (!result.ok) return setMessage({ ok: false, text: result.message });
      await getSupabaseBrowserClient()
        .storage.from(CAMPAIGN_MEDIA_BUCKET)
        .remove([currentSound.path]);
      forgetAuraArt();
      setMessage({ ok: true, text: 'Som removido.' });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert tone={message.ok ? 'success' : 'danger'}>{message.text}</Alert> : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-fg">
          Aura
          <select
            value={aura}
            onChange={(event) => {
              setAura(event.target.value as DiceAura);
              setMessage(null);
            }}
            className="h-9 rounded-md border border-line bg-sunken px-2 text-sm text-fg"
          >
            {auras.map((key) => (
              <option key={key} value={key}>
                {diceAuraLabels[key].name}
                {art[key] ? ' (com imagem)' : ''}
              </option>
            ))}
          </select>
        </label>
        <AuraIcon aura={aura} />
        <Button
          size="sm"
          variant="secondary"
          loading={pending}
          icon={<ImagePlus className="h-4 w-4" aria-hidden="true" />}
          onClick={() => fileRef.current?.click()}
        >
          {current ? 'Trocar imagem' : 'Enviar imagem'}
        </Button>
        {current ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            onClick={remove}
          >
            Remover
          </Button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
            event.target.value = '';
          }}
        />
      </div>
      {current?.url ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-line bg-[repeating-conic-gradient(rgb(255_255_255/0.06)_0_25%,transparent_0_50%)] bg-[length:20px_20px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia de imagem enviada (link assinado) */}
          <img
            src={current.url}
            alt={`Imagem do crítico de ${diceAuraLabels[aura].name}`}
            className="max-h-44 object-contain"
          />
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          Nenhuma imagem para esta aura. PNG sem fundo fica melhor. Hoje o Vírus Retrô usa a imagem
          como o assistente que pula pela tela no crítico e é sugado pelo antivírus na falha.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button
          size="sm"
          variant="secondary"
          loading={pending}
          icon={<Music className="h-4 w-4" aria-hidden="true" />}
          onClick={() => soundRef.current?.click()}
        >
          {currentSound ? 'Trocar som' : 'Enviar som'}
        </Button>
        {currentSound ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            onClick={removeSound}
          >
            Remover som
          </Button>
        ) : null}
        <input
          ref={soundRef}
          type="file"
          accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.ogg,.wav,.m4a"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadSound(file);
            event.target.value = '';
          }}
        />
        {currentSound?.url ? (
          <audio controls src={currentSound.url} className="h-9 max-w-full" />
        ) : (
          <span className="text-sm text-fg-muted">
            Sem som próprio: o crítico usa o som do tema. Toca no lugar dele (até 8 s).
          </span>
        )}
      </div>
    </div>
  );
}
