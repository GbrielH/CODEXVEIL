'use client';

import { adjustCharacterResource, type CharacterResource } from '@codexveil/database';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Vida, mana e outras trilhas com máximo, com − e + de 1 em 1 (clique 7 vezes para tirar 7).
 * A vida desce como dano (gasta primeiro os pontos temporários); as demais, como gasto.
 * Cada clique vai direto ao banco, de forma atômica; em caso de erro, volta ao valor salvo.
 */
export function ResourceStepper({ resource }: { resource: CharacterResource }) {
  const { toast } = useToast();
  const [value, setValue] = useState(resource);
  const [pending, setPending] = useState(0);
  const isHealth = value.display === 'health';

  const step = (delta: 1 | -1) => {
    const operation = delta > 0 ? 'heal' : isHealth ? 'damage' : 'spend';
    setValue((current) => {
      if (delta > 0) return { ...current, current: Math.min(current.max ?? Infinity, current.current + 1) };
      if (isHealth && current.temp > 0) return { ...current, temp: current.temp - 1 };
      return { ...current, current: Math.max(0, current.current - 1) };
    });
    setPending((count) => count + 1);
    adjustCharacterResource(getSupabaseBrowserClient(), resource.id, operation, 1)
      .then((saved) => setValue(saved))
      .catch((error: unknown) => {
        toast({ tone: 'danger', title: `${resource.label}: não foi salvo`, description: failureMessage(error, 'Tente novamente.') });
      })
      .finally(() => setPending((count) => count - 1));
  };

  const button = 'flex h-6 w-6 items-center justify-center rounded border border-line text-fg-secondary hover:border-parchment-300/60 hover:bg-hover hover:text-fg disabled:opacity-40';
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate">{value.label}</span>
      <span className="flex shrink-0 items-center gap-1.5" aria-busy={pending > 0}>
        <button type="button" className={button} aria-label={`Diminuir ${value.label}`} disabled={value.current <= 0 && value.temp <= 0} onClick={() => step(-1)}>
          <Minus className="h-3 w-3" aria-hidden="true" />
        </button>
        <strong className="tabular min-w-12 text-center">
          {value.current}
          {value.temp ? ` + ${value.temp}` : ''}
          {value.max === null ? '' : ` / ${value.max}`}
        </strong>
        <button type="button" className={button} aria-label={`Aumentar ${value.label}`} disabled={value.max !== null && value.current >= value.max} onClick={() => step(1)}>
          <Plus className="h-3 w-3" aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
