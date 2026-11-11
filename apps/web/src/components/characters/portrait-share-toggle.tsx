'use client';

import { setCharacterPortraitShared } from '@codexveil/database';
import { ImageIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Portrait } from '@/components/characters/portrait';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

function useSharedPortrait(characterId: string, initial: boolean) {
  const { toast } = useToast();
  const [shared, setShared] = useState(initial);
  const [busy, setBusy] = useState(false);
  const change = async (next: boolean) => {
    setShared(next);
    setBusy(true);
    try {
      await setCharacterPortraitShared(getSupabaseBrowserClient(), characterId, next);
      toast({ tone: 'success', title: next ? 'O grupo vê o seu retrato.' : 'Retrato escondido do grupo.' });
    } catch (error) {
      setShared(!next);
      toast({ tone: 'danger', title: 'Não foi possível alterar', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };
  return { shared, busy, change };
}

/**
 * O dono escolhe se o retrato aparece para o grupo da campanha, mesmo quando o mestre deixa as
 * fichas dos outros jogadores ocultas (a imagem não revela nada da ficha).
 */
export function PortraitShareToggle({ characterId, initial }: { characterId: string; initial: boolean }) {
  const id = useId();
  const { shared, busy, change } = useSharedPortrait(characterId, initial);
  return (
    <Card>
      <CardHeader icon={<ImageIcon className="h-5 w-5" aria-hidden="true" />} title="Retrato no grupo" />
      <CheckboxField
        id={`${id}-share`}
        label="Mostrar meu retrato para o grupo"
        description="Vale mesmo quando o mestre deixa as fichas ocultas: os outros jogadores veem só o nome e o retrato. Sem retrato, aparece o token do mapa."
        checked={shared}
        disabled={busy}
        onChange={(event) => void change(event.target.checked)}
      />
    </Card>
  );
}

/** Versão do card "Grupo" da campanha: o seu personagem com o botão de mostrar o retrato. */
export function OwnPortraitShareRow({
  characterId,
  name,
  portraitUrl,
  initial,
}: {
  characterId: string;
  name: string;
  portraitUrl: string | null;
  initial: boolean;
}) {
  const id = useId();
  const { shared, busy, change } = useSharedPortrait(characterId, initial);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-line-strong bg-sunken/60 p-3">
      <Portrait name={name} url={portraitUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{name} (você)</p>
        <p className="text-xs text-fg-muted">
          {shared ? 'O grupo vê o seu retrato.' : 'O grupo vê só o seu token do mapa (ou as iniciais).'}
        </p>
      </div>
      <CheckboxField id={`${id}-share`} label="Mostrar meu retrato" checked={shared} disabled={busy} onChange={(event) => void change(event.target.checked)} />
    </div>
  );
}
