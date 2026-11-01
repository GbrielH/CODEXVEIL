import type { TranscribedSpeech, TranscriptionProvider } from '@codexveil/domain';
import { Platform } from 'react-native';

interface RecognitionModule {
  ExpoWebSpeechRecognition: new () => {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult:
      | ((event: {
          resultIndex: number;
          results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
        }) => void)
      | null;
    onspeechstart: (() => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  };
  ExpoSpeechRecognitionModule: { requestPermissionsAsync(): Promise<{ granted: boolean }> };
}

/** O módulo nativo só existe no APK com a transcrição; em APK antigo, a transcrição fica indisponível. */
function loadModule(): RecognitionModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech-recognition') as RecognitionModule;
  } catch {
    return null;
  }
}

/**
 * Transcrição grátis no próprio celular (reconhecimento de fala do aparelho, pt-BR). Atenção: o
 * microfone também está na call (WebRTC); em alguns aparelhos os dois disputam o microfone, e aí
 * a transcrição avisa e para (veja docs/call-transcricao-momentos.md).
 */
export function createDeviceTranscription(): TranscriptionProvider {
  const module = loadModule();
  let recognition: InstanceType<RecognitionModule['ExpoWebSpeechRecognition']> | null = null;
  let running = false;
  let speechStart = new Date();
  return {
    supported: Boolean(module),
    start(onFinal: (speech: TranscribedSpeech) => void, onError: (message: string) => void) {
      if (!module || running) return;
      running = true;
      void module.ExpoSpeechRecognitionModule.requestPermissionsAsync().then(({ granted }) => {
        if (!granted) {
          running = false;
          onError('Sem permissão de reconhecimento de fala.');
          return;
        }
        const listen = () => {
          const current = new module.ExpoWebSpeechRecognition();
          current.lang = 'pt-BR';
          current.continuous = true;
          current.interimResults = false;
          current.onspeechstart = () => {
            speechStart = new Date();
          };
          current.onresult = (event) => {
            for (let index = event.resultIndex; index < event.results.length; index++) {
              const result = event.results[index]!;
              const text = result[0].transcript.trim();
              if (result.isFinal && text) {
                onFinal({ text, startedAt: speechStart, endedAt: new Date() });
                speechStart = new Date();
              }
            }
          };
          current.onerror = (event) => {
            if (event.error === 'no-speech' || event.error === 'aborted') return;
            if (event.error === 'audio-capture' || event.error === 'not-allowed') {
              running = false;
              onError('O microfone está ocupado pela call neste aparelho; a transcrição parou.');
            }
          };
          current.onend = () => {
            if (running) setTimeout(listen, 300);
          };
          recognition = current;
          try {
            current.start();
          } catch {
            // Já estava ouvindo.
          }
        };
        listen();
      });
    },
    stop() {
      running = false;
      recognition?.stop();
      recognition = null;
    },
  };
}
