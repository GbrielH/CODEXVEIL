import { listMyCharacterDrafts, listMyCharacters, signedMediaUrls } from '@codexveil/database';
import { findSystem, summarizeSheet } from '@codexveil/rpg-systems';
import { findClassByName, parseDnd5eSheet } from '@codexveil/rpg-systems/dnd5e';
import { Plus, Swords } from 'lucide-react';
import type { Metadata, Route } from 'next';
import { CharacterCoverCard } from '@/components/characters/character-cover-card';
import { DraftList } from '@/components/characters/draft-list';
import { ButtonLink } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { requireSessionUser } from '@/lib/auth';
import { characterPath, routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Personagens' };

/** Classe principal do SRD (para o ícone do cartão sem retrato), em fichas de D&D 5e. */
function mainClassId(systemId: string, sheet: unknown): string | null {
  if (systemId !== 'dnd5e') return null;
  try {
    return findClassByName(parseDnd5eSheet(sheet).identity.classes[0]?.name ?? '')?.id ?? null;
  } catch {
    return null;
  }
}

export default async function CharactersPage({ searchParams }: PageProps<'/personagens'>) {
  const user = await requireSessionUser(routes.characters);
  const supabase = await createSupabaseServerClient();
  const [characters, drafts, params] = await Promise.all([
    listMyCharacters(supabase, user.id),
    listMyCharacterDrafts(supabase, user.id),
    searchParams,
  ]);
  const portraits = await signedMediaUrls(
    supabase,
    characters.map((character) => character.portraitPath),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Meus personagens"
        title="Personagens"
        description="Suas fichas, com ou sem campanha. Vincule um personagem a uma campanha para jogar com o grupo."
        actions={
          <ButtonLink
            href={routes.newCharacter}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Novo personagem
          </ButtonLink>
        }
      />
      <Notice value={params.aviso} />
      <DraftList drafts={drafts} />

      {characters.length === 0 ? (
        <EmptyState
          icon={<Swords className="h-8 w-8" aria-hidden="true" />}
          title="Nenhum personagem ainda"
          description="Crie seu primeiro personagem. Você pode vinculá-lo a uma campanha agora ou depois."
          action={<ButtonLink href={routes.newCharacter}>Criar personagem</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {characters.map((character) => {
            const summary = summarizeSheet(character.systemId, character.sheet);
            const system = findSystem(character.systemId);
            return (
              <li key={character.id}>
                <CharacterCoverCard
                  href={characterPath(character.id) as Route}
                  name={character.name}
                  subtitle={summary.subtitle}
                  portraitUrl={
                    character.portraitPath ? (portraits[character.portraitPath] ?? null) : null
                  }
                  classId={mainClassId(character.systemId, character.sheet)}
                  meta={
                    character.campaignName ??
                    `Sem campanha · ${system?.shortName ?? character.systemId}`
                  }
                  updatedAt={character.updatedAt}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
