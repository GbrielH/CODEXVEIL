import { GAME_ICONS_VIEWBOX, findCharacterIcon } from '@codexveil/ui/character-icons';
import Svg, { Path } from 'react-native-svg';

/** Ícone da classe ou espécie (game-icons.net, CC BY 3.0). */
export function CharacterIcon({ kind, id, color, size = 32 }: { kind: 'class' | 'species'; id: string; color: string; size?: number }) {
  const icon = findCharacterIcon(kind, id);
  if (!icon) return null;
  return (
    <Svg width={size} height={size} viewBox={GAME_ICONS_VIEWBOX} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={icon.d} fill={color} />
    </Svg>
  );
}
