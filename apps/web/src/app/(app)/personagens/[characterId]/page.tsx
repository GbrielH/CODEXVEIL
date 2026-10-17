import {
  characterAccessInput,
  listCharacterAbilities,
  listCharacterConditions,
  listCharacterItems,
  listCharacterResources,
  listMyCampaigns,
  signedMediaUrls,
} from '@codexveil/database';
import { canEditCharacterPlayState, canEditCharacterSheet } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import { parseDnd5eSheet } from '@codexveil/rpg-systems/dnd5e';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { Dnd5eSheetScreen } from '@/components/sheets/dnd5e/sheet-screen';
import { Notice } from '@/components/ui/notice';
import { ErrorState } from '@/components/ui/states';
import { loadCharacterOrNotFound } from '@/lib/characters';
import { campaignPath, routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: PageProps<'/personagens/[characterId]'>): Promise<Metadata> {
  const { characterId } = await params;
  const { character } = await loadCharacterOrNotFound(characterId);
  return { title: character.name };
}

export default async function CharacterSheetPage({ params, searchParams }: PageProps<'/personagens/[characterId]'>) {
  const [{ characterId }, query] = await Promise.all([params, searchParams]);
  const { user, character } = await loadCharacterOrNotFound(characterId);
  const supabase = await createSupabaseServerClient();

  const [resources, conditions, items, abilities, campaigns, portraits] = await Promise.all([
    listCharacterResources(supabase, character.id),
    listCharacterConditions(supabase, character.id),
    listCharacterItems(supabase, character.id),
    listCharacterAbilities(supabase, character.id),
    character.viewer.isOwner ? listMyCampaigns(supabase, user.id) : Promise.resolve([]),
    signedMediaUrls(supabase, [character.portraitPath]),
  ]);

  const access = characterAccessInput(character);
  const permissions = {
    canEditSheet: canEditCharacterSheet(access),
    canEditPlay: canEditCharacterPlayState(access),
    isOwner: character.viewer.isOwner,
    isGm: character.viewer.membership?.role === 'gm',
  };

  const backLink = character.campaign
    ? { href: campaignPath(character.campaign.id), label: character.campaign.name }
    : { href: routes.characters, label: 'Personagens' };

  const system = findSystem(character.systemId);
  let content;
  if (system?.id === 'dnd5e') {
    let sheet;
    try {
      sheet = parseDnd5eSheet(character.sheet);
    } catch (error) {
      console.error('[codexveil] ficha D&D 5e inválida', character.id, error);
    }
    content = sheet ? (
      <Dnd5eSheetScreen
        character={{
          id: character.id,
          name: character.name,
          ownerName: character.ownerName,
          version: character.version,
          portraitPath: character.portraitPath,
          portraitUrl: character.portraitPath ? (portraits[character.portraitPath] ?? null) : null,
          campaign: character.campaign
            ? { id: character.campaign.id, name: character.campaign.name, status: character.campaign.status }
            : null,
        }}
        sheet={sheet}
        resources={resources}
        conditions={conditions}
        items={items}
        abilities={abilities}
        permissions={permissions}
        campaigns={campaigns
          // Só campanhas em que o dono é jogador: mestres não vinculam personagens às próprias mesas.
          .filter((campaign) => campaign.status === 'active' && campaign.role === 'player' && campaign.systemId === character.systemId)
          .map((campaign) => ({ id: campaign.id, name: campaign.name }))}
      />
    ) : (
      <ErrorState
        title="Não foi possível abrir a ficha"
        description="Os dados desta ficha não seguem o formato esperado. Nada foi alterado; contate o suporte informando o personagem."
      />
    );
  } else {
    content = (
      <ErrorState
        title="Sistema não suportado"
        description={`Esta versão do Codexveil ainda não tem fichas para o sistema “${character.systemId}”.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href={backLink.href as Route} className="text-sm text-fg-muted hover:text-fg">
        ← {backLink.label}
      </Link>
      <Notice value={query.aviso} />
      {content}
    </div>
  );
}
