import type { AvatarPreset } from '@codexveil/validation';
import type { ImageSourcePropType } from 'react-native';

/** Retratos de perfil empacotados no app (as mesmas imagens de `apps/web/public/retratos`). */
export const AVATAR_IMAGES: Record<AvatarPreset, ImageSourcePropType> = {
  guerreiro: require('../../../assets/retratos/guerreiro.webp') as ImageSourcePropType,
  patrulheiro: require('../../../assets/retratos/patrulheiro.webp') as ImageSourcePropType,
  grimorio: require('../../../assets/retratos/grimorio.webp') as ImageSourcePropType,
  clerigo: require('../../../assets/retratos/clerigo.webp') as ImageSourcePropType,
  ladino: require('../../../assets/retratos/ladino.webp') as ImageSourcePropType,
  barbaro: require('../../../assets/retratos/barbaro.webp') as ImageSourcePropType,
  bardo: require('../../../assets/retratos/bardo.webp') as ImageSourcePropType,
  druida: require('../../../assets/retratos/druida.webp') as ImageSourcePropType,
  guardiao: require('../../../assets/retratos/guardiao.webp') as ImageSourcePropType,
  monge: require('../../../assets/retratos/monge.webp') as ImageSourcePropType,
  paladino: require('../../../assets/retratos/paladino.webp') as ImageSourcePropType,
  fera: require('../../../assets/retratos/fera.webp') as ImageSourcePropType,
  feiticeiro: require('../../../assets/retratos/feiticeiro.webp') as ImageSourcePropType,
  bruxo: require('../../../assets/retratos/bruxo.webp') as ImageSourcePropType,
  mago: require('../../../assets/retratos/mago.webp') as ImageSourcePropType,
};
