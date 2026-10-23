import { Image, Pressable, StyleSheet, View } from 'react-native';
import { characterClassId } from '@/components/character-avatar';
import { CharacterIcon } from '@/components/creation/character-icon';
import { AppText } from '@/components/ui/primitives';
import { colors, fonts, palette, radii, spacing } from '@/lib/theme';

interface Props {
  name: string;
  systemId: string;
  sheet: unknown;
  subtitle: string;
  meta: string;
  portraitUrl: string | null;
  onPress: () => void;
}

/** Personagem com o retrato em destaque (ou o ícone da classe), no padrão dos cartões de campanha. */
export function CharacterCoverCard({
  name,
  systemId,
  sheet,
  subtitle,
  meta,
  portraitUrl,
  onPress,
}: Props) {
  const classId = characterClassId(systemId, sheet);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${subtitle}, ${meta}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      {portraitUrl ? (
        <Image
          source={{ uri: portraitUrl }}
          accessibilityIgnoresInvertColors
          style={styles.cover}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.cover, styles.placeholder]}>
          {classId ? (
            <CharacterIcon kind="class" id={classId} color="rgba(245, 237, 231, 0.7)" size={72} />
          ) : (
            <AppText style={styles.initial}>{name.trim().charAt(0).toUpperCase() || '?'}</AppText>
          )}
        </View>
      )}
      <View style={styles.body}>
        <AppText style={styles.title} numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="muted" numberOfLines={1}>
          {subtitle}
        </AppText>
        <AppText variant="small" style={{ color: colors.fgMuted }} numberOfLines={1}>
          {meta}
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
  cover: { width: '100%', aspectRatio: 4 / 3 },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.wine[950],
  },
  initial: { fontFamily: fonts.displayBold, fontSize: 48, color: 'rgba(245, 237, 231, 0.7)' },
  body: { padding: spacing[3], gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: colors.fgAccent },
});
