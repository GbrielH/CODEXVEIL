import { Platform } from 'react-native';

/**
 * WebRTC da call (LiveKit) registrado uma vez na abertura do app. Só no aparelho: no navegador
 * (desenvolvimento) o módulo nativo não existe.
 */
export function setupCallMedia() {
  if (Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerGlobals } = require('@livekit/react-native') as { registerGlobals: () => void };
    registerGlobals();
  } catch {
    // APK antigo, sem o módulo: a call avisa ao abrir.
  }
}
