'use client';

import { setCharacterCampaign, setCharacterCampaignWithAnswers } from '@codexveil/database';
import { Link2, Unlink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import {
  CreationAnswersFields,
  answersComplete,
  answersFor,
} from '@/components/characters/creation-answers';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SelectField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export interface LinkCampaignOption {
  id: string;
  name: string;
  characterRules?: unknown;
  creationQuestions?: string[];
}

/**
 * Vincular a ficha a uma campanha (ou desvincular), para qualquer sistema: as perguntas do mestre
 * e as pendências de regras (`issuesFor`, do sistema da ficha) bloqueiam o vínculo até serem
 * resolvidas. `initialCampaignId` vem do "Vincular" da página da campanha.
 */
export function CampaignLinkCard({
  characterId,
  currentCampaign,
  campaigns,
  initialCampaignId = null,
  issuesFor,
}: {
  characterId: string;
  currentCampaign: { id: string; name: string } | null;
  campaigns: LinkCampaignOption[];
  initialCampaignId?: string | null;
  issuesFor: (campaign: LinkCampaignOption) => string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const id = useId();
  const [selected, setSelected] = useState(
    initialCampaignId && campaigns.some((campaign) => campaign.id === initialCampaignId)
      ? initialCampaignId
      : '',
  );
  const chosen = campaigns.find((campaign) => campaign.id === selected);
  const questions = chosen?.creationQuestions ?? [];
  const [answerValues, setAnswerValues] = useState<Record<number, string>>({});
  const answersOk = answersComplete(questions, answerValues);
  const issues = chosen ? issuesFor(chosen) : [];

  const link = async (campaignId: string | null) => {
    try {
      if (campaignId && questions.length > 0) {
        await setCharacterCampaignWithAnswers(
          getSupabaseBrowserClient(),
          characterId,
          campaignId,
          answersFor(questions, answerValues),
        );
      } else {
        await setCharacterCampaign(getSupabaseBrowserClient(), characterId, campaignId);
      }
    } catch (cause) {
      throw new Error(failureMessage(cause, 'Não foi possível alterar a campanha.'));
    }
    toast({
      tone: 'success',
      title: campaignId ? 'Personagem vinculado à campanha.' : 'Personagem desvinculado.',
    });
    router.refresh();
  };

  const options = campaigns.filter((campaign) => campaign.id !== currentCampaign?.id);

  return (
    <Card>
      <CardHeader
        title="Campanha"
        description={
          currentCampaign
            ? `Vinculado a “${currentCampaign.name}”.`
            : 'Ficha pessoal, sem campanha.'
        }
      />
      <div className="flex flex-col gap-3">
        {options.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <SelectField
              id={`${id}-campaign`}
              label="Vincular a"
              hint="Só aparecem campanhas do mesmo sistema da ficha. A ficha precisa seguir as regras e os livros escolhidos pelo mestre."
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              fieldClassName="flex-1"
            >
              <option value="">Escolha uma campanha…</option>
              {options.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </SelectField>
            <ConfirmDialog
              trigger={(open) => (
                <Button
                  variant="secondary"
                  disabled={!selected || issues.length > 0 || !answersOk}
                  onClick={open}
                  icon={<Link2 className="h-4 w-4" aria-hidden="true" />}
                >
                  Vincular
                </Button>
              )}
              title="Vincular o personagem?"
              description="Os mestres da campanha passam a ver e poder editar a ficha. Se o personagem estiver em outra campanha, sairá dela (e de combates em andamento)."
              confirmLabel="Vincular"
              tone="primary"
              onConfirm={() => link(selected)}
            />
          </div>
        ) : (
          <p className="text-sm text-fg-muted">Nenhuma outra campanha ativa com o mesmo sistema.</p>
        )}
        {chosen ? (
          <CreationAnswersFields
            questions={questions}
            values={answerValues}
            onChange={setAnswerValues}
          />
        ) : null}
        {issues.length > 0 ? (
          <Alert tone="warning" title={`Antes de entrar em “${chosen?.name ?? ''}”, ajuste:`}>
            <ul className="list-disc pl-5">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {currentCampaign ? (
          <ConfirmDialog
            trigger={(open) => (
              <Button
                variant="ghost"
                onClick={open}
                icon={<Unlink className="h-4 w-4" aria-hidden="true" />}
                className="self-start"
              >
                Desvincular da campanha
              </Button>
            )}
            title="Desvincular da campanha?"
            description="O personagem continua seu, mas deixa de aparecer para o grupo e para os mestres."
            confirmLabel="Desvincular"
            onConfirm={() => link(null)}
          />
        ) : null}
      </div>
    </Card>
  );
}
