'use client';

import { CharacterDiceCard } from '@/components/dice/character-dice-card';
import { CAMPAIGN_MEDIA_BUCKET, deleteCharacter } from '@codexveil/database';
import { characterImagePrompt, characterTokenPrompt } from '@codexveil/domain';
import { dnd5eCampaignIssues, parseDnd5eCampaignRules } from '@codexveil/rpg-systems/dnd5e';
import { Trash2 } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { CampaignLinkCard } from '@/components/characters/campaign-link-card';
import { ImagePromptCard } from '@/components/characters/image-prompt-card';
import { PortraitCard } from '@/components/characters/portrait-card';
import { TokenImageCard } from '@/components/characters/token-image-card';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { failureMessage } from '@/lib/client-errors';
import { routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useSheet } from './context';

export function SettingsTab({
  campaigns,
  initialCampaignId = null,
}: {
  campaigns: { id: string; name: string; characterRules?: unknown }[];
  /** Campanha já escolhida ao chegar pelo "Vincular" da campanha. */
  initialCampaignId?: string | null;
}) {
  const { permissions, character, name, sheet } = useSheet();
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
      {permissions.isOwner ? (
        <CharacterDiceCard
          characterId={character.id}
          characterSummary={[name, sheet.identity.species, sheet.identity.classes[0]?.name, sheet.details.appearance]
            .filter(Boolean)
            .join(' · ')}
        />
      ) : null}
      {permissions.isOwner ? <CampaignCard campaigns={campaigns} initialCampaignId={initialCampaignId} /> : null}
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
    age: sheet.details.age,
    appearance: sheet.details.appearance,
    personality: sheet.details.personality,
    backstory: sheet.details.backstory,
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
  initialCampaignId,
}: {
  campaigns: { id: string; name: string; characterRules?: unknown; creationQuestions?: string[] }[];
  initialCampaignId: string | null;
}) {
  const { character, name, sheet } = useSheet();
  return (
    <CampaignLinkCard
      characterId={character.id}
      currentCampaign={character.campaign}
      campaigns={campaigns}
      initialCampaignId={initialCampaignId}
      // O que impede a entrada na campanha escolhida, com o que mudar na ficha.
      issuesFor={(campaign) => dnd5eCampaignIssues({ name, sheet }, parseDnd5eCampaignRules(campaign.characterRules))}
    />
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
