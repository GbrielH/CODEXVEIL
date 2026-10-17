import { listMyCampaigns } from '@codexveil/database';
import { campaignRoleLabels, campaignStatusLabels } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import { useRouter } from 'expo-router';
import { KeyRound, Plus, ScrollText } from 'lucide-react-native';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { AppText, Badge } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function CampaignsScreen() {
  const userId = useUserId();
  const router = useRouter();
  const { data, error, loading, refreshing, reload } = useAsyncData(() => listMyCampaigns(getSupabase(), userId), userId);

  if (loading) return <LoadingState />;

  return (
    <Screen title="Campanhas" subtitle="Mesas em que você é mestre ou jogador." refreshing={refreshing} onRefresh={reload}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Nova campanha" compact icon={<Plus size={16} color={colors.primaryFg} />} onPress={() => router.push('/campanha/nova')} style={{ flex: 1 }} />
        <Button label="Entrar com código" compact variant="secondary" icon={<KeyRound size={16} color={colors.fg} />} onPress={() => router.push('/convite')} style={{ flex: 1 }} />
      </View>
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data && data.length === 0 ? (
        <EmptyState icon={<ScrollText size={28} color={colors.fgSecondary} />} title="Nenhuma campanha" description="Crie a sua para mestrar ou peça ao seu mestre um código de convite." />
      ) : null}
      {data?.map((campaign) => (
        <ListRow
          key={campaign.id}
          title={campaign.name}
          subtitle={[findSystem(campaign.systemId)?.shortName, `${campaign.memberCount} participante${campaign.memberCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge label={campaign.isOwner ? 'Responsável' : campaignRoleLabels[campaign.role]} tone={campaign.role === 'gm' ? 'brand' : 'neutral'} />
              {campaign.status === 'archived' ? <Badge label={campaignStatusLabels.archived} tone="warning" /> : null}
            </View>
          }
          onPress={() => router.push({ pathname: '/campanha/[id]', params: { id: campaign.id } })}
        />
      ))}
      {data && data.length > 0 ? (
        <AppText variant="small" style={{ color: colors.fgMuted, textAlign: 'center' }}>
          Mestres também conduzem a mesa pelo app: sessões, biblioteca, turnos e rolagens ficam na página da campanha.
        </AppText>
      ) : null}
    </Screen>
  );
}
