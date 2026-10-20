import { listMyCampaigns, signedMediaUrls } from '@codexveil/database';
import { useRouter } from 'expo-router';
import { KeyRound, Plus, ScrollText } from 'lucide-react-native';
import { View } from 'react-native';
import { CampaignCoverCard } from '@/components/campaign-cover-card';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function CampaignsScreen() {
  const userId = useUserId();
  const router = useRouter();
  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaigns = await listMyCampaigns(supabase, userId);
    const covers = await signedMediaUrls(
      supabase,
      campaigns.map((campaign) => campaign.coverPath),
    );
    return campaigns.map((campaign) => ({
      campaign,
      coverUrl: campaign.coverPath ? (covers[campaign.coverPath] ?? null) : null,
    }));
  }, userId);

  if (loading) return <LoadingState />;

  return (
    <Screen
      title="Campanhas"
      subtitle="Mesas em que você é mestre ou jogador."
      refreshing={refreshing}
      onRefresh={reload}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          label="Nova campanha"
          compact
          icon={<Plus size={16} color={colors.primaryFg} />}
          onPress={() => router.push('/campanha/nova')}
          style={{ flex: 1 }}
        />
        <Button
          label="Entrar com código"
          compact
          variant="secondary"
          icon={<KeyRound size={16} color={colors.fg} />}
          onPress={() => router.push('/convite')}
          style={{ flex: 1 }}
        />
      </View>
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data && data.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={28} color={colors.fgSecondary} />}
          title="Nenhuma campanha"
          description="Crie a sua para mestrar ou peça ao seu mestre um código de convite."
        />
      ) : null}
      {data?.map(({ campaign, coverUrl }) => (
        <CampaignCoverCard
          key={campaign.id}
          campaign={campaign}
          coverUrl={coverUrl}
          onPress={() => router.push({ pathname: '/campanha/[id]', params: { id: campaign.id } })}
        />
      ))}
      {data && data.length > 0 ? (
        <AppText variant="small" style={{ color: colors.fgMuted, textAlign: 'center' }}>
          O app é para jogar: ficha, turno, dados e anotações. As ferramentas do mestre ficam no
          site.
        </AppText>
      ) : null}
    </Screen>
  );
}
