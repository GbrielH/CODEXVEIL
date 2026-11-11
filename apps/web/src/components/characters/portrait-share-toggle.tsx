'use client';

import { setCharacterPortraitShared } from '@codexveil/database';
import { ImageIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * O dono escolhe se o retrato aparece para o grupo da campanha, mesmo quando o mestre deixa as
 * fichas dos outros jogadores ocultas (a imagem não revela nada da ficha).
 */
export function PortraitShareToggle({ characterId, initial }: { characterId: string; initial: boolean }) {
  const id = useId();
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
