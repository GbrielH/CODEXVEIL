'use client';

import { listMyDice, setCharacterDice, signedMediaUrls, type SavedDice } from '@codexveil/database';
import { Dices } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { SkinPrompt } from './skin-prompt';

/** Miniatura de um dado salvo: a face desenhada sobre a cor do dado. */
export function DiceSwatch({
  color,
  imageUrl,
  className,
}: {
  color: string | null;
  imageUrl: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx('block h-10 w-10 rounded-lg bg-cover bg-center ring-1 ring-line', className)}
      style={{
        backgroundColor: color ?? '#6b1d2a',
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
      }}
    />
  );
}

/**
 * Dado do personagem: o dono escolhe um dos dados salvos em "Meus dados" (a mesa desenha as
 * rolagens desse personagem com ele) e tem um prompt para gerar uma skin que combine com o
 * personagem.
 */
export function CharacterDiceCard({
  characterId,
  characterSummary,
}: {
  characterId: string;
  /** Quem é o personagem, em texto (entra no prompt da skin). */
  characterSummary: string;
}) {
  const { toast } = useToast();
  const [dice, setDice] = useState<SavedDice[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    void (async () => {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return;
      const [list, character] = await Promise.all([
        listMyDice(client, auth.user.id),
        client.from('characters').select('dice_id').eq('id', characterId).maybeSingle(),
      ]);
      const signed = await signedMediaUrls(
        client,
        list.map((entry) => entry.look.image),
      );
      if (!active) return;
      setDice(list);
      setUrls(signed);
      setCurrent(character.data?.dice_id ?? null);
    })().catch(() => {
      if (active) setDice([]);
    });
    return () => {
      active = false;
    };
  }, [characterId]);

  const choose = async (id: string | null) => {
    const previous = current;
    setCurrent(id);
    setBusy(true);
    try {
      await setCharacterDice(getSupabaseBrowserClient(), characterId, id);
      toast({
        tone: 'success',
        title: id ? 'Dado vinculado ao personagem.' : 'Personagem usa o seu dado padrão.',
      });
    } catch (error) {
      setCurrent(previous);
      toast({
        tone: 'danger',
        title: 'O dado não foi vinculado',
        description: failureMessage(error, 'Tente de novo.'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<Dices className="h-5 w-5" aria-hidden="true" />}
        title="Dado do personagem"
        description="Escolha um dos seus dados salvos: as rolagens deste personagem aparecem com ele para toda a mesa."
      />
      {dice === null ? (
        <p className="text-sm text-fg-muted">Carregando seus dados…</p>
      ) : (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dado do personagem">
          <button
            type="button"
            role="radio"
            aria-checked={current === null}
            disabled={busy}
            onClick={() => void choose(null)}
            className={cx(
              'flex items-center gap-2 rounded-lg border p-2 pr-3 text-sm transition-colors',
              current === null
                ? 'border-fg-brand bg-hover text-fg'
                : 'border-line text-fg-secondary hover:bg-hover',
            )}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sunken text-fg-muted ring-1 ring-line">
              <Dices className="h-5 w-5" aria-hidden="true" />
            </span>
            Meu dado padrão
          </button>
          {dice.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={current === entry.id}
              disabled={busy}
              onClick={() => void choose(entry.id)}
              className={cx(
                'flex items-center gap-2 rounded-lg border p-2 pr-3 text-sm transition-colors',
                current === entry.id
                  ? 'border-fg-brand bg-hover text-fg'
                  : 'border-line text-fg-secondary hover:bg-hover',
              )}
            >
              <DiceSwatch
                color={entry.look.color}
                imageUrl={entry.look.image ? (urls[entry.look.image] ?? null) : null}
              />
              {entry.name}
            </button>
          ))}
        </div>
      )}
      {dice?.length === 0 ? (
        <p className="mt-2 text-xs text-fg-muted">
          Você ainda não salvou dados na coleção.{' '}
          <Link
            href={routes.myDice}
            className="text-fg-accent underline-offset-4 hover:underline"
          >
            Criar em Meus dados
          </Link>
          .
        </p>
      ) : null}
      <details className="mt-4 rounded-lg border border-line p-3">
        <summary className="cursor-pointer text-sm font-medium text-fg">
          Prompt para criar a textura do dado deste personagem
        </summary>
        <div className="mt-3">
          <SkinPrompt context={characterSummary} />
        </div>
      </details>
    </Card>
  );
}
