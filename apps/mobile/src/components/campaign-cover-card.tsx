import type { CampaignSummary } from '@codexveil/database';
import { campaignRoleLabels, campaignStatusLabels } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import { ScrollText } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Badge } from '@/components/ui/primitives';
import { colors, fonts, palette, radii, spacing } from '@/lib/theme';

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words.length > 1
      ? `${words[0]![0]}${words[words.length - 1]![0]}`
      : (words[0]?.slice(0, 2) ?? '?')
  ).toUpperCase();
}

/** Campanha com a capa no topo (ou um fundo com as iniciais, sem imagem). */
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
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          accessibilityIgnoresInvertColors
          style={styles.cover}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.cover, styles.placeholder]}>
          <AppText style={styles.initials}>{initials(campaign.name)}</AppText>
          <View style={styles.placeholderIcon}>
            <ScrollText size={18} color="rgba(228, 216, 189, 0.3)" />
          </View>
        </View>
      )}
      <View style={styles.body}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Badge label={role} tone={campaign.role === 'gm' ? 'brand' : 'neutral'} />
          {campaign.status === 'archived' ? (
            <Badge label={campaignStatusLabels.archived} tone="warning" />
          ) : null}
        </View>
        <AppText style={styles.title} numberOfLines={2}>
          {campaign.name}
        </AppText>
        <AppText variant="small" style={{ color: colors.fgMuted }}>
          {details}
        </AppText>
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
  cover: { width: '100%', aspectRatio: 16 / 9 },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.wine[950],
  },
  placeholderIcon: { position: 'absolute', right: spacing[3], bottom: spacing[3] },
  initials: { fontFamily: fonts.displayBold, fontSize: 34, color: 'rgba(228, 216, 189, 0.7)' },
  body: { padding: spacing[3], gap: 6 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 22, color: colors.fg },
});
