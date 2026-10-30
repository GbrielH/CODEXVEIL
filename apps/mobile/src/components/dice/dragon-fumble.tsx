import { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { AppText } from '@/components/ui/primitives';
import { fonts } from '@/lib/theme';

/** Quadros do GIF da falha crítica (70 ms cada): o dragão sopra fogo e as chamas cobrem a tela. */
 
const FRAMES: ImageSourcePropType[] = [
  require('../../../assets/dragon/f00.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f01.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f02.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f03.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f04.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f05.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f06.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f07.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f08.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f09.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f10.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f11.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f12.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f13.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f14.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f15.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f16.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f17.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f18.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f19.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f20.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f21.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f22.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f23.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f24.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f25.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f26.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f27.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f28.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f29.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f30.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f31.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f32.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f33.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f34.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f35.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f36.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f37.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f38.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f39.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f40.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f41.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f42.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f43.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f44.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f45.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f46.jpg') as ImageSourcePropType,
  require('../../../assets/dragon/f47.jpg') as ImageSourcePropType,
];
 
const FRAME_MS = 70;
/** Quando o fogo cobre a tela (quadro 33), "CRÍTICO" surge no meio das chamas. */
const WORD_AT = 33;
const TOTAL_MS = 4600;

/**
 * Falha crítica (1 natural) no app: os quadros tocam uma vez e param no fogo; "CRÍTICO" aparece
 * no meio das chamas. Fecha sozinho; toque para fechar antes.
 */
export function DragonFumble({ onDone }: { onDone: () => void }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame((current) => (current < FRAMES.length - 1 ? current + 1 : current)), FRAME_MS);
    const close = setTimeout(onDone, TOTAL_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(close);
    };
  }, [onDone]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop} onTouchEnd={onDone}>
        <View style={styles.frame}>
          <Image source={FRAMES[frame]} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
          {frame >= WORD_AT ? (
            <Animated.View entering={ZoomIn.springify().damping(10)} style={styles.wordWrap}>
              <AppText style={styles.word}>CRÍTICO</AppText>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  frame: { width: '86%', aspectRatio: 245 / 320, borderRadius: 16, overflow: 'hidden' },
  wordWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  word: {
    fontFamily: fonts.displayBold,
    fontSize: 46,
    letterSpacing: 6,
    color: '#2a0a02',
    textShadowColor: 'rgba(255,190,90,0.95)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
});
