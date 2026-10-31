import { findClassByName, parseDnd5eSheet } from '@codexveil/rpg-systems/dnd5e';
import { Image, View } from 'react-native';
import { CharacterIcon } from '@/components/creation/character-icon';
import { AppText } from '@/components/ui/primitives';
import { colors, fonts, palette } from '@/lib/theme';

/** Id da classe principal do SRD (para o ícone), quando a ficha é de D&D 5e. */
export function characterClassId(systemId: string, sheet: unknown): string | null {
  if (systemId !== 'dnd5e') return null;
  try {
    const name = parseDnd5eSheet(sheet).identity.classes[0]?.name ?? '';
    return findClassByName(name)?.id ?? null;
  } catch {
    return null;
  }
}

/** Avatar do personagem: o retrato, se houver; senão o ícone da classe num selo vinho, ou a inicial. */
export function CharacterAvatar({
  name,
  systemId,
  sheet,
  size = 44,
  portraitUrl = null,
}: {
  name: string;
  systemId: string;
  sheet: unknown;
  size?: number;
  portraitUrl?: string | null;
}) {
  const classId = characterClassId(systemId, sheet);
  if (portraitUrl) {
    return (
      <Image
        source={{ uri: portraitUrl }}
        accessibilityIgnoresInvertColors
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: 'rgba(187, 167, 125, 0.45)',
          backgroundColor: palette.wine[900],
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.wine[900],
        borderWidth: 1,
        borderColor: 'rgba(187, 167, 125, 0.45)',
      }}
    >
      {classId ? (
        <CharacterIcon
          kind="class"
          id={classId}
          color={colors.fgAccent}
          size={Math.round(size * 0.6)}
        />
      ) : (
        <AppText
          style={{ fontFamily: fonts.displayBold, fontSize: size * 0.42, color: colors.fgAccent }}
        >
          {name.trim().charAt(0).toUpperCase() || '?'}
        </AppText>
      )}
    </View>
  );
}
