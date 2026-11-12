'use client';

import { Swords } from 'lucide-react';
import { useState, useTransition } from 'react';
import { startOrdem2MissionAction } from '@/app/(app)/campanhas/[campaignId]/livros/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/** Monta a missão pronta na campanha: sessão com o roteiro, criaturas e mapas (só mestres). */
export function Ordem2MissionStart({
  campaignId,
  packId,
  missionKey,
}: {
  campaignId: string;
  packId: string;
  missionKey: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <p className="text-sm text-fg-muted">
        Cria uma sessão em rascunho com o roteiro completo (narração, regras das cenas e os pontos
        de interesse com perícias e DTs), copia as criaturas para a biblioteca e cria os mapas da
        sessão. Tudo fica oculto dos jogadores até você revelar.
      </p>
      <div>
        <Button
          loading={pending}
          icon={<Swords className="h-4 w-4" aria-hidden="true" />}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await startOrdem2MissionAction(campaignId, packId, missionKey);
              if (result && !result.ok) setError(result.message);
            })
          }
        >
          Usar esta missão na campanha
        </Button>
      </div>
    </div>
  );
}
