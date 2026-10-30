import { AVATAR_LABELS, isAvatarPhoto, type AvatarIcon } from '@codexveil/validation';
import { Image, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import { AVATAR_IMAGES } from './avatar-images';
import { AppText } from './primitives';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Retrato escolhido no perfil (silhueta por classe) ou as iniciais, como no site. */
export function Avatar({
  name,
  icon,
  size = 36,
}: {
  name: string;
  icon?: AvatarIcon | null;
  size?: number;
}) {
  if (isAvatarPhoto(icon))
    return (
      <Image
        source={{ uri: icon }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityLabel={name}
      />
    );
  if (icon)
    return (
      <Image
        source={AVATAR_IMAGES[icon]}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityLabel={AVATAR_LABELS[icon]}
      />
    );
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: '#2a1230',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityElementsHidden
    >
      <AppText style={{ fontFamily: fonts.display, color: colors.fgAccent, fontSize: size * 0.38 }}>
        {initialsOf(name)}
      </AppText>
    </View>
  );
}
