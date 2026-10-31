import { listMyBookPacks } from '@codexveil/database';
import { BookOpen, Puzzle } from 'lucide-react-native';
import { useState } from 'react';
import { HeroCard, IconBubble } from '@/components/ui/layout';
import { ListRow } from '@/components/ui/list-row';
import { AppText, Badge } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type View = 'mine' | 'community';

const systemNames: Record<string, string> = {
  dnd5e: 'D&D 5e',
  tormenta20: 'Tormenta20',
  assimilacao: 'Assimilação',
};

/** Sistemas: os livros que você importou e (em breve) os sistemas criados pela comunidade. */
export default function SystemsScreen() {
  const userId = useUserId();
  const [view, setView] = useState<View>('mine');
  const { data, error, loading, reload } = useAsyncData(
    () => listMyBookPacks(getSupabase(), userId),
    `livros:${userId}`,
  );

  return (
    <Screen
      eyebrow="Sistemas"
      title="Sistemas e livros"
      subtitle="Os livros que você importou e os sistemas da comunidade."
    >
      <Segmented<View>
        value={view}
        onChange={setView}
        accessibilityLabel="O que mostrar"
        options={[
          { value: 'mine', label: 'Meus livros' },
          { value: 'community', label: 'Comunidade' },
        ]}
      />
      {view === 'community' ? (
        <HeroCard>
          <IconBubble tone="brand" size={52}>
            <Puzzle size={26} color={colors.fgAccent} />
          </IconBubble>
          <AppText variant="title">Em breve</AppText>
          <AppText variant="muted">
            Aqui vão aparecer sistemas e livros criados pela comunidade, para ligar e desligar nas
            suas campanhas.
          </AppText>
        </HeroCard>
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState
          icon={<BookOpen size={28} color={colors.fgMuted} />}
          title="Nenhum livro importado"
          description="Importe livros pelo site, em Meus livros. Eles aparecem aqui e nas campanhas que você mestra."
        />
      ) : (
        data.map((pack) => (
          <ListRow
            key={pack.id}
            title={pack.name}
            subtitle={`${systemNames[pack.systemId] ?? pack.systemId}${pack.edition ? ` · ${pack.edition}` : ''}`}
            leading={
              <IconBubble tone="brand" size={40}>
                <BookOpen size={20} color={colors.fgAccent} />
              </IconBubble>
            }
            trailing={<Badge label={pack.isReady ? 'Pronto' : 'Importando'} tone={pack.isReady ? 'success' : 'warning'} />}
          />
        ))
      )}
    </Screen>
  );
}
