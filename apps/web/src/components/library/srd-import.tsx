'use client';

import { Copy } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { importSrdItemAction, importSrdMonsterAction } from '@/app/(app)/campanhas/[campaignId]/biblioteca/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';

/** Copia um monstro do SRD para a biblioteca, como NPC ou monstro. */
export function SrdImportMonster({ campaignId, slug, defaultKind }: { campaignId: string; slug: string; defaultKind: 'npc' | 'monster' }) {
  const id = useId();
  const [kind, setKind] = useState(defaultKind);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <SelectField id={`${id}-kind`} label="Copiar como" value={kind} onChange={(event) => setKind(event.target.value === 'npc' ? 'npc' : 'monster')}>
        <option value="monster">Monstro</option>
        <option value="npc">NPC</option>
      </SelectField>
      <div>
        <Button
          loading={pending}
          icon={<Copy className="h-4 w-4" aria-hidden="true" />}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await importSrdMonsterAction(campaignId, slug, kind);
              if (!result.ok) setError(result.message);
            })
          }
        >
          Copiar para a biblioteca
        </Button>
      </div>
    </div>
  );
}

/** Copia um item mágico do SRD para os itens da campanha. */
export function SrdImportItem({ campaignId, slug }: { campaignId: string; slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div>
        <Button
          loading={pending}
          icon={<Copy className="h-4 w-4" aria-hidden="true" />}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await importSrdItemAction(campaignId, slug);
              if (!result.ok) setError(result.message);
            })
          }
        >
          Copiar para os itens da campanha
        </Button>
      </div>
    </div>
  );
}
