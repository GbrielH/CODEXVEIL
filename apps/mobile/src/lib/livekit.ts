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

/** Call, transcrição e Momentos ainda em teste: escondidos até `EXPO_PUBLIC_CALLS_ENABLED=1`. */
export const callsEnabled = process.env.EXPO_PUBLIC_CALLS_ENABLED === '1';
