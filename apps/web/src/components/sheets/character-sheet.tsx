import {
  getCampaign,
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
import { Dnd5eSheetScreen } from '@/components/sheets/dnd5e/sheet-screen';
import { ErrorState } from '@/components/ui/states';
import { campaignBookPacks, loadBookSources, ownReadyBookPacks } from '@/lib/books';
import { loadCharacterOrNotFound } from '@/lib/characters';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Ficha completa (aba "Personagens") ou de mesa (aba "Meu personagem" da campanha), carregada
 * no servidor com as mesmas regras de acesso.
 */
export async function CharacterSheet({ characterId, variant = 'full' }: { characterId: string; variant?: 'full' | 'campaign' }) {
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

  // Livros para a subida de nível: os liberados na campanha do personagem ou, em fichas pessoais, os do dono.
  let books: Awaited<ReturnType<typeof loadBookSources>> = [];
  if (permissions.canEditSheet && character.systemId === 'dnd5e') {
    const campaign = character.campaign ? await getCampaign(supabase, character.campaign.id, user.id) : null;
    const packs = campaign ? await campaignBookPacks(supabase, campaign) : character.viewer.isOwner ? await ownReadyBookPacks(supabase, user.id) : [];
    books = await loadBookSources(supabase, packs);
  }

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
        variant={variant}
        books={books}
        campaigns={campaigns
          // Só campanhas em que o dono é jogador: mestres não vinculam personagens às próprias mesas.
          .filter((campaign) => campaign.status === 'active' && campaign.role === 'player' && campaign.systemId === character.systemId)
          .map((campaign) => ({ id: campaign.id, name: campaign.name, characterRules: campaign.characterRules }))}
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

  return content;
}
