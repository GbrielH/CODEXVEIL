import { listCharactersSharedWithMe, listMyCharacters, signedMediaUrls } from '@codexveil/database';
import { summarizeSheet } from '@codexveil/rpg-systems';
import { useRouter } from 'expo-router';
import { Plus, Share2, Swords } from 'lucide-react-native';
import { SectionHeader } from '@/components/ui/layout';
import { ListRow } from '@/components/ui/list-row';
import { CharacterCoverCard } from '@/components/character-cover-card';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function CharactersScreen() {
  const userId = useUserId();
  const router = useRouter();
  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const [characters, shared] = await Promise.all([
      listMyCharacters(supabase, userId),
      listCharactersSharedWithMe(supabase, userId).catch(() => []),
    ]);
    const portraits = await signedMediaUrls(
      supabase,
      characters.map((character) => character.portraitPath),
    );
    return {
      shared,
      mine: characters.map((character) => ({
        character,
        portraitUrl: character.portraitPath ? (portraits[character.portraitPath] ?? null) : null,
      })),
    };
  }, userId);

  if (loading) return <LoadingState />;

  return (
    <Screen
      title="Personagens"
      subtitle="Suas fichas, com ou sem campanha."
      refreshing={refreshing}
      onRefresh={reload}
    >
      <Button
        label="Novo personagem"
        icon={<Plus size={16} color={colors.primaryFg} />}
        onPress={() => router.push('/personagem/novo')}
      />
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data && data.mine.length === 0 ? (
        <EmptyState
          icon={<Swords size={28} color={colors.fgSecondary} />}
          title="Nenhum personagem ainda"
          description="Crie seu primeiro personagem. Você pode vinculá-lo a uma campanha depois."
        />
      ) : null}
      {data?.mine.map(({ character, portraitUrl }) => (
        <CharacterCoverCard
          key={character.id}
          name={character.name}
          systemId={character.systemId}
          sheet={character.sheet}
          subtitle={summarizeSheet(character.systemId, character.sheet).subtitle}
          meta={character.campaignName ?? 'Sem campanha'}
          portraitUrl={portraitUrl}
          onPress={() =>
            router.push({ pathname: '/personagem/[id]', params: { id: character.id } })
          }
        />
      ))}
      {data?.shared.length ? (
        <>
          <SectionHeader
            icon={<Share2 size={14} color={colors.fgAccent} />}
            title="Compartilhados comigo"
          />
          {data.shared.map((character) => (
            <ListRow
              key={character.id}
              title={character.name}
              subtitle={`De ${character.ownerName} · só leitura`}
              onPress={() =>
                router.push({ pathname: '/personagem/[id]', params: { id: character.id } })
              }
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
