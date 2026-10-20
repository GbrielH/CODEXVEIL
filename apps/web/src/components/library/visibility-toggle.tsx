'use client';

import { setCreatureVisibility } from '@codexveil/database';
import type { SharedVisibility } from '@codexveil/domain';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface VisibilityToggleProps {
  creatureId: string;
  name: string;
  visibility: SharedVisibility;
  /** `compact` mostra só o ícone; o nome acessível sempre traz a ação e o registro. */
  compact?: boolean;
}

/** Oculta ou libera um NPC/monstro para os jogadores, sem abrir o editor. */
export function VisibilityToggle({
  creatureId,
  name,
  visibility,
  compact = false,
}: VisibilityToggleProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [current, setCurrent] = useState(visibility);
  const [busy, setBusy] = useState(false);
  const hidden = current === 'gm';
  const label = hidden ? 'Liberar aos jogadores' : 'Ocultar dos jogadores';

  const toggle = async () => {
    const next: SharedVisibility = hidden ? 'members' : 'gm';
    setBusy(true);
    try {
      await setCreatureVisibility(getSupabaseBrowserClient(), creatureId, next);
      setCurrent(next);
      toast({
        tone: 'success',
        title:
          next === 'members'
            ? `${name} foi liberado aos jogadores.`
            : `${name} foi ocultado dos jogadores.`,
      });
      router.refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'A visibilidade não mudou',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={hidden ? 'secondary' : 'ghost'}
      size={compact ? 'icon' : 'sm'}
      loading={busy}
      icon={
        busy ? undefined : hidden ? (
          <Eye className="h-4 w-4" aria-hidden="true" />
        ) : (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        )
      }
      aria-label={`${label}: ${name}`}
      title={label}
      onClick={() => void toggle()}
    >
      {compact ? null : hidden ? 'Liberar' : 'Ocultar'}
    </Button>
  );
}
