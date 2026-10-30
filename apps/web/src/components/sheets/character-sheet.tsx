import {
  getCharacterAnswers,
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
import { parseT20Sheet } from '@codexveil/rpg-systems/tormenta20';
import { parseAssimilacaoSheet } from '@codexveil/rpg-systems/assimilacao';
import { Dnd5eSheetScreen } from '@/components/sheets/dnd5e/sheet-screen';
import { T20SheetScreen } from '@/components/sheets/t20/sheet-screen';
import { AssimilacaoSheetScreen } from '@/components/sheets/assimilacao/sheet-screen';
import { ErrorState } from '@/components/ui/states';
import { Card } from '@/components/ui/card';
import { CreationAnswersView } from '@/components/characters/creation-answers';
import { ShareCharacterCard } from '@/components/friends/share-character-card';
import { ItemCatalogProvider } from '@/components/sheets/item-catalog';
import {
  campaignBookPacks,
  loadAssimilacaoSources,
  loadBookSources,
  loadT20Sources,
  ownReadyBookPacks,
  packsOfSystem,
} from '@/lib/books';
import { loadCharacterOrNotFound } from '@/lib/characters';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Ficha completa (aba "Personagens") ou de mesa (aba "Meu personagem" da campanha), carregada
 * no servidor com as mesmas regras de acesso.
 */
export async function CharacterSheet({
  characterId,
  variant = 'full',
}: {
  characterId: string;
  variant?: 'full' | 'campaign';
}) {
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

  // Livros para a subida de nível: os liberados na campanha do personagem ou, em fichas pessoais, só os
  // livros escolhidos na criação (gravados na ficha) entre os importados pelo dono.
  const identity = (character.sheet as { identity?: { sourcebooks?: unknown } } | null)?.identity;
  const sheetBooks = Array.isArray(identity?.sourcebooks)
    ? identity.sourcebooks.filter((id): id is string => typeof id === 'string')
    : [];
  // Mesmos livros alimentam o catálogo "Escolher do livro" do inventário.
  const campaign =
    (permissions.canEditSheet || permissions.canEditPlay) && character.campaign
      ? await getCampaign(supabase, character.campaign.id, user.id)
      : null;
  const activePacks = !(permissions.canEditSheet || permissions.canEditPlay)
    ? []
    : campaign
      ? await campaignBookPacks(supabase, campaign)
      : character.viewer.isOwner
        ? (await ownReadyBookPacks(supabase, user.id)).filter((pack) =>
            sheetBooks.includes(pack.bookKey),
          )
        : [];
  const catalogBooks = {
    systemId: character.systemId,
    packs: packsOfSystem(activePacks, character.systemId).map((pack) => ({
      id: pack.id,
      name: pack.name,
    })),
  };
  let books: Awaited<ReturnType<typeof loadBookSources>> = [];
  if (permissions.canEditSheet && character.systemId === 'dnd5e') {
    books = await loadBookSources(supabase, activePacks);
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
            ? {
                id: character.campaign.id,
                name: character.campaign.name,
                status: character.campaign.status,
              }
            : null,
          grantedLevel: character.grantedLevel,
        }}
        sheet={sheet}
        resources={resources}
        conditions={conditions}
        items={items}
        abilities={abilities}
        permissions={permissions}
        variant={variant}
        books={books}
        shareCard={
          character.viewer.isOwner ? (
            <ShareCharacterCard characterId={character.id} ownerId={character.ownerId} />
          ) : null
        }
        campaigns={campaigns
          // Só campanhas em que o dono é jogador: mestres não vinculam personagens às próprias mesas.
          .filter(
            (campaign) =>
              campaign.status === 'active' &&
              campaign.role === 'player' &&
              campaign.systemId === character.systemId,
          )
          .map((campaign) => ({
            id: campaign.id,
            name: campaign.name,
            characterRules: campaign.characterRules,
            creationQuestions: campaign.creationQuestions,
          }))}
      />
    ) : (
      <ErrorState
        title="Não foi possível abrir a ficha"
        description="Os dados desta ficha não seguem o formato esperado. Nada foi alterado; contate o suporte informando o personagem."
      />
    );
  } else if (system?.id === 'tormenta20') {
    // Livros para a subida de nível: os da campanha do personagem ou, em fichas pessoais, os do dono.
    // Também para quem só joga: os ataques usam as armas do livro (dano e crítico).
    let t20Sources: Awaited<ReturnType<typeof loadT20Sources>> = [];
    if (permissions.canEditSheet || permissions.canEditPlay) {
      t20Sources = await loadT20Sources(supabase, activePacks);
    }
    let sheet;
    try {
      sheet = parseT20Sheet(character.sheet);
    } catch (error) {
      console.error('[codexveil] ficha Tormenta20 inválida', character.id, error);
    }
    content = sheet ? (
      <T20SheetScreen
        shareCard={
          character.viewer.isOwner ? (
            <ShareCharacterCard characterId={character.id} ownerId={character.ownerId} />
          ) : null
        }
        campaigns={campaigns
          .filter(
            (campaign) =>
              campaign.status === 'active' &&
              campaign.role === 'player' &&
              campaign.systemId === character.systemId,
          )
          .map((campaign) => ({
            id: campaign.id,
            name: campaign.name,
            characterRules: campaign.characterRules,
            creationQuestions: campaign.creationQuestions,
          }))}
        character={{
          id: character.id,
          name: character.name,
          ownerName: character.ownerName,
          version: character.version,
          portraitUrl: character.portraitPath ? (portraits[character.portraitPath] ?? null) : null,
          campaign: character.campaign
            ? { id: character.campaign.id, name: character.campaign.name }
            : null,
          grantedLevel: character.grantedLevel,
          portraitPath: character.portraitPath,
        }}
        sheet={sheet}
        resources={resources}
        conditions={conditions}
        items={items}
        abilities={abilities}
        permissions={{
          canEditSheet: permissions.canEditSheet,
          canEditPlay: permissions.canEditPlay,
          isGm: permissions.isGm,
          isOwner: permissions.isOwner,
        }}
        sources={t20Sources}
        variant={variant}
      />
    ) : (
      <ErrorState
        title="Não foi possível abrir a ficha"
        description="Os dados desta ficha não seguem o formato do Tormenta20. Nada foi alterado."
      />
    );
  } else if (system?.id === 'assimilacao') {
    // Ficha pessoal: todos os livros prontos do dono (a criação não grava a lista na ficha).
    const assimPacks = campaign
      ? activePacks
      : character.viewer.isOwner
        ? await ownReadyBookPacks(supabase, user.id)
        : [];
    const assimSources =
      permissions.canEditSheet || permissions.canEditPlay
        ? await loadAssimilacaoSources(supabase, assimPacks)
        : [];
    let sheet;
    try {
      sheet = parseAssimilacaoSheet(character.sheet);
    } catch (error) {
      console.error('[codexveil] ficha Assimilação inválida', character.id, error);
    }
    content = sheet ? (
      <AssimilacaoSheetScreen
        shareCard={
          character.viewer.isOwner ? (
            <ShareCharacterCard characterId={character.id} ownerId={character.ownerId} />
          ) : null
        }
        campaigns={campaigns
          .filter(
            (campaign) =>
              campaign.status === 'active' &&
              campaign.role === 'player' &&
              campaign.systemId === character.systemId,
          )
          .map((campaign) => ({
            id: campaign.id,
            name: campaign.name,
            characterRules: campaign.characterRules,
            creationQuestions: campaign.creationQuestions,
          }))}
        character={{
          id: character.id,
          name: character.name,
          ownerName: character.ownerName,
          version: character.version,
          portraitUrl: character.portraitPath ? (portraits[character.portraitPath] ?? null) : null,
          portraitPath: character.portraitPath,
          campaign: character.campaign
            ? { id: character.campaign.id, name: character.campaign.name }
            : null,
        }}
        sheet={sheet}
        resources={resources}
        permissions={{
          canEditSheet: permissions.canEditSheet,
          canEditPlay: permissions.canEditPlay,
          isGm: permissions.isGm,
          isOwner: permissions.isOwner,
        }}
        sources={assimSources}
        variant={variant}
      />
    ) : (
      <ErrorState
        title="Não foi possível abrir a ficha"
        description="Os dados desta ficha não seguem o formato do Assimilação RPG. Nada foi alterado."
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

  // Respostas às perguntas do mestre: o banco só entrega ao dono e ao mestre.
  const answers = character.campaign
    ? await getCharacterAnswers(supabase, character.id).catch(() => null)
    : null;
  return (
    <ItemCatalogProvider value={catalogBooks}>
      {content}
      {answers?.length ? (
        <Card className="mt-6">
          <CreationAnswersView answers={answers} />
        </Card>
      ) : null}
    </ItemCatalogProvider>
  );
}
