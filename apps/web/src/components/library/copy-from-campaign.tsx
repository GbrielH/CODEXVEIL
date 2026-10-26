'use client';

import { Copy } from 'lucide-react';
import { useState, useTransition } from 'react';
import { copyCreatureFromCampaignAction } from '@/app/(app)/campanhas/[campaignId]/biblioteca/actions';
import { Button } from '@/components/ui/button';

export interface OtherCampaignLibrary {
  id: string;
  name: string;
  creatures: { id: string; name: string; subtitle: string; kind: 'npc' | 'monster' }[];
}

/**
 * Biblioteca reaproveitável: copia NPCs e monstros das outras campanhas em que você é mestre
 * (mesmo sistema). A cópia é independente: mudar uma não muda a outra.
 */
export function CopyFromCampaign({ campaignId, campaigns }: { campaignId: string; campaigns: OtherCampaignLibrary[] }) {
  const [sourceId, setSourceId] = useState(campaigns[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const source = campaigns.find((campaign) => campaign.id === sourceId);
  const words = query.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const shown = (source?.creatures ?? []).filter((creature) =>
    `${creature.name} ${creature.subtitle}`.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(words),
  );

  if (campaigns.length === 0) {
    return <p className="text-sm text-fg-muted">Você não mestra outra campanha deste sistema com registros na biblioteca.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        value={sourceId}
        onChange={(event) => setSourceId(event.target.value)}
        aria-label="Campanha de origem"
        className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-fg"
      >
        {campaigns.map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.name} ({campaign.creatures.length})
          </option>
        ))}
      </select>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar registro…"
        aria-label="Buscar registro na outra campanha"
        className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-fg"
      />
      <ul className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-md border border-line">
        {shown.length === 0 ? (
          <li className="px-3 py-2 text-sm text-fg-muted">Nenhum registro.</li>
        ) : (
          shown.map((creature) => (
            <li key={creature.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">{creature.name}</span>
                <span className="block truncate text-xs text-fg-muted">{creature.kind === 'npc' ? 'NPC' : 'Monstro'}{creature.subtitle ? ` · ${creature.subtitle}` : ''}</span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                icon={<Copy className="h-4 w-4" aria-hidden="true" />}
                onClick={() =>
                  startTransition(async () => {
                    setMessage(null);
                    const result = await copyCreatureFromCampaignAction(campaignId, creature.id);
                    if (result && !result.ok) setMessage(result.message);
                  })
                }
              >
                Copiar
              </Button>
            </li>
          ))
        )}
      </ul>
      {message ? <p className="text-sm text-danger">{message}</p> : null}
      <p className="text-xs text-fg-muted">A cópia chega oculta dos jogadores, com estatísticas, segredos e imagem.</p>
    </div>
  );
}
