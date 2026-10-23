import type { CampaignSummary } from '@codexveil/database';
import { campaignRoleLabels, campaignStatusLabels } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ArcaneScene } from '@/components/ui/arcane-scene';
import { AppText, Badge } from '@/components/ui/primitives';
import { colors, fonts, palette, radii, spacing } from '@/lib/theme';

/** Campanha no estilo "Grimório Arcano": a capa (ou a paisagem da campanha) com o título por cima. */
export function CampaignCoverCard({
  campaign,
  coverUrl,
  onPress,
}: {
  campaign: CampaignSummary;
  coverUrl: string | null;
  onPress: () => void;
}) {
  const role = campaign.isOwner ? 'Mestre responsável' : campaignRoleLabels[campaign.role];
  const details = [
    findSystem(campaign.systemId)?.shortName,
    `${campaign.memberCount} participante${campaign.memberCount === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${campaign.name}, ${role}, ${details}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cover}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <ArcaneScene seed={campaign.name} />
        )}
        {/* Escurece de baixo para cima para o título ficar legível sobre a arte. */}
        <View style={styles.shade} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: spacing[3] }}>
          <Badge label={role} tone={campaign.role === 'gm' ? 'brand' : 'neutral'} />
          {campaign.status === 'archived' ? <Badge label={campaignStatusLabels.archived} tone="warning" /> : null}
        </View>
        <View style={styles.body}>
          <AppText style={styles.title} numberOfLines={2}>
            {campaign.name}
          </AppText>
          <AppText variant="small" style={{ color: colors.fgSecondary }}>
            {details}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  cover: { width: '100%', aspectRatio: 16 / 10, justifyContent: 'space-between', backgroundColor: palette.wine[950] },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(7, 7, 10, 0.35)' },
  body: { padding: spacing[3], gap: 4, backgroundColor: 'rgba(7, 7, 10, 0.55)' },
  title: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: colors.fgAccent },
});
