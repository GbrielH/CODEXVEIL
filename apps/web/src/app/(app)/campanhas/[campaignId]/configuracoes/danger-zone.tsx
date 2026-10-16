'use client';

import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { archiveCampaignAction, deleteCampaignAction, unarchiveCampaignAction } from '../../actions';

interface DangerZoneProps {
  campaignId: string;
  campaignName: string;
  archived: boolean;
}

/** Ações irreversíveis ou de grande impacto, restritas ao mestre responsável. */
export function DangerZone({ campaignId, campaignName, archived }: DangerZoneProps) {
  const router = useRouter();
  const { toast } = useToast();

  return (
    <div className="flex flex-col divide-y divide-line">
      <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-fg">{archived ? 'Reabrir campanha' : 'Arquivar campanha'}</p>
          <p className="text-sm text-fg-muted">
            {archived
              ? 'A campanha volta a aceitar alterações e novos convites.'
              : 'Preserva todos os dados em modo somente leitura e cancela convites pendentes.'}
          </p>
        </div>
        {archived ? (
          <ConfirmDialog
            trigger={(open) => (
              <Button variant="secondary" onClick={open} icon={<ArchiveRestore className="h-4 w-4" aria-hidden="true" />}>
                Reabrir
              </Button>
            )}
            title="Reabrir a campanha?"
            description="Mestres e jogadores voltarão a poder alterar fichas, sessões e anotações."
            confirmLabel="Reabrir campanha"
            tone="primary"
            onConfirm={async () => {
              const result = await unarchiveCampaignAction(campaignId);
              if (!result.ok) throw new Error(result.message);
              toast({ tone: 'success', title: result.message ?? 'Campanha reaberta.' });
              router.refresh();
            }}
          />
        ) : (
          <ConfirmDialog
            trigger={(open) => (
              <Button variant="secondary" onClick={open} icon={<Archive className="h-4 w-4" aria-hidden="true" />}>
                Arquivar
              </Button>
            )}
            title="Arquivar a campanha?"
            description="Nada será apagado. A campanha fica somente para consulta e os convites pendentes deixam de valer."
            confirmLabel="Arquivar campanha"
            tone="primary"
            onConfirm={async () => {
              const result = await archiveCampaignAction(campaignId);
              if (!result.ok) throw new Error(result.message);
              toast({ tone: 'success', title: result.message ?? 'Campanha arquivada.' });
              router.refresh();
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-danger">Excluir definitivamente</p>
          <p className="text-sm text-fg-muted">
            Apaga sessões, roteiros, biblioteca e anotações. Personagens dos jogadores continuam nas contas deles.
          </p>
        </div>
        <ConfirmDialog
          trigger={(open) => (
            <Button variant="danger" onClick={open} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
              Excluir
            </Button>
          )}
          title="Excluir a campanha para sempre?"
          description="Esta ação não pode ser desfeita. Prefira arquivar se quiser guardar o histórico."
          confirmLabel="Excluir definitivamente"
          requireText={campaignName}
          onConfirm={async () => {
            const result = await deleteCampaignAction(campaignId);
            // Em caso de sucesso a ação redireciona; só chega aqui com erro.
            if (result && !result.ok) throw new Error(result.message);
          }}
        />
      </div>
    </div>
  );
}
