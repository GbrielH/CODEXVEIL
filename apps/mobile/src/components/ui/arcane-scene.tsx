import { arcaneSceneSvg, type ArcaneSceneOptions } from '@codexveil/ui/scene';
import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

/**
 * Paisagem arcana gerada pela semente (a mesma do site): cada campanha tem a sua. Preenche o
 * contêiner (como "cover").
 */
export function ArcaneScene({ seed, style, options }: { seed: string; style?: StyleProp<ViewStyle>; options?: ArcaneSceneOptions }) {
  const xml = useMemo(() => arcaneSceneSvg(seed, options), [seed, options]);
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <SvgXml xml={xml} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
    </View>
  );
}
