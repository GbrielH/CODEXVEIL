'use client';

import { CreationAnswersFields, answersComplete, answersFor } from '@/components/characters/creation-answers';
import {
  CAMPAIGN_MEDIA_BUCKET,
  deleteCharacter,
  setCharacterCampaign,
  setCharacterCampaignWithAnswers,
} from '@codexveil/database';
import { characterImagePrompt, characterTokenPrompt } from '@codexveil/domain';
import { dnd5eCampaignIssues, parseDnd5eCampaignRules } from '@codexveil/rpg-systems/dnd5e';
import { Link2, Trash2, Unlink } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { ImagePromptCard } from '@/components/characters/image-prompt-card';
import { PortraitCard } from '@/components/characters/portrait-card';
import { TokenImageCard } from '@/components/characters/token-image-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SelectField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useSheet } from './context';

export function SettingsTab({
  campaigns,
}: {
  campaigns: { id: string; name: string; characterRules?: unknown }[];
}) {
  const { permissions, character } = useSheet();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {permissions.canEditSheet ? (
        <div className="flex flex-col gap-3">
          <DndPortraitCard />
          <DndImagePrompt variant="portrait" />
        </div>
      ) : null}
      {permissions.canEditSheet ? (
        <div className="flex flex-col gap-3">
          <TokenImageCard characterId={character.id} portraitUrl={character.portraitUrl} />
          <DndImagePrompt variant="token" />
        </div>
      ) : null}
      {permissions.isOwner ? <CampaignCard campaigns={campaigns} /> : null}
      {permissions.isOwner ? <DangerCard /> : null}
    </div>
  );
}

function DndPortraitCard() {
  const { character, name, adoptVersion } = useSheet();
  return (
    <PortraitCard
      characterId={character.id}
      name={name}
      portraitPath={character.portraitPath}
      portraitUrl={character.portraitUrl}
      onVersion={adoptVersion}
    />
  );
}

/** Prompts para IA de imagens: o do retrato (abaixo do retrato) e o do token (abaixo do grid). */
function DndImagePrompt({ variant }: { variant: 'portrait' | 'token' }) {
  const { name, sheet } = useSheet();
  const main = sheet.identity.classes[0];
  const input = {
    system: 'D&D 5e',
    name,
    species: sheet.identity.species,
    className: main?.name ? `${main.name}${main.subclass ? ` (${main.subclass})` : ''}` : '',
    level: sheet.identity.classes.reduce((total, entry) => total + entry.level, 0),
    background: sheet.identity.background,
    alignment: sheet.identity.alignment,
  };
  return (
    <ImagePromptCard
      variant={variant}
      prompt={variant === 'token' ? characterTokenPrompt(input) : characterImagePrompt(input)}
    />
  );
}

function CampaignCard({
  campaigns,
}: {
  campaigns: { id: string; name: string; characterRules?: unknown; creationQuestions?: string[] }[];
}) {
  const { character, name, sheet } = useSheet();
  const router = useRouter();
  const { toast } = useToast();
  const id = useId();
  const [selected, setSelected] = useState('');
  const chosen = campaigns.find((campaign) => campaign.id === selected);
  const questions = chosen?.creationQuestions ?? [];
  const [answerValues, setAnswerValues] = useState<Record<number, string>>({});
  const answersOk = answersComplete(questions, answerValues);
  // O que impede a entrada na campanha escolhida, com o que mudar na ficha.
  const issues = chosen
    ? dnd5eCampaignIssues({ name, sheet }, parseDnd5eCampaignRules(chosen.characterRules))
    : [];

  const link = async (campaignId: string | null) => {
    try {
      if (campaignId && questions.length > 0) {
        await setCharacterCampaignWithAnswers(getSupabaseBrowserClient(), character.id, campaignId, answersFor(questions, answerValues));
      } else {
        await setCharacterCampaign(getSupabaseBrowserClient(), character.id, campaignId);
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

  const options = campaigns.filter((campaign) => campaign.id !== character.campaign?.id);

  return (
    <Card>
      <CardHeader
        title="Campanha"
        description={
          character.campaign
            ? `Vinculado a “${character.campaign.name}”.`
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
        {chosen ? <CreationAnswersFields questions={questions} values={answerValues} onChange={setAnswerValues} /> : null}
        {issues.length > 0 ? (
          <Alert tone="warning" title={`Antes de entrar em “${chosen?.name ?? ''}”, ajuste:`}>
            <ul className="list-disc pl-5">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {character.campaign ? (
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

function DangerCard() {
  const { character, name } = useSheet();
  const router = useRouter();
  const remove = async () => {
    const client = getSupabaseBrowserClient();
    try {
      await deleteCharacter(client, character.id);
    } catch (cause) {
      throw new Error(failureMessage(cause, 'Não foi possível excluir o personagem.'));
    }
    if (character.portraitPath)
      await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([character.portraitPath]);
    router.replace(`${routes.characters}?aviso=personagem-excluido` as Route);
    router.refresh();
  };
  return (
    <Card className="border-ember-400/40 lg:col-span-2">
      <CardHeader
        title="Excluir personagem"
        description="Apaga a ficha, o inventário, as habilidades e o histórico. Não pode ser desfeito."
      />
      <ConfirmDialog
        trigger={(open) => (
          <Button
            variant="danger"
            onClick={open}
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          >
            Excluir definitivamente
          </Button>
        )}
        title={`Excluir “${name}”?`}
        description="Todos os dados do personagem serão apagados para sempre."
        confirmLabel="Excluir personagem"
        requireText={name}
        onConfirm={remove}
      />
    </Card>
  );
}
