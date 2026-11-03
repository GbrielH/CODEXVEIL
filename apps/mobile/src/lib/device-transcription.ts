import {
  isRetryableRecognitionError,
  recognitionRestartDelay,
  type TranscribedSpeech,
  type TranscriptionProvider,
} from '@codexveil/domain';
import { Platform } from 'react-native';

interface RecognitionModule {
  ExpoWebSpeechRecognition: new () => {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    requiresOnDeviceRecognition: boolean;
    onresult:
      | ((event: {
          resultIndex: number;
          results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
        }) => void)
      | null;
    onspeechstart: (() => void) | null;
    onerror: ((event: { error: string; message?: string }) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  };
  ExpoSpeechRecognitionModule: { requestPermissionsAsync(): Promise<{ granted: boolean }> };
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'O aparelho não permitiu usar o microfone para a transcrição.',
  'service-not-allowed': 'O reconhecimento de fala está desativado neste aparelho.',
  network: 'O serviço de reconhecimento de fala falhou. Tentando reconectar…',
  'audio-capture': 'O microfone está ocupado pela call neste aparelho; a transcrição parou.',
};

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
  let restartAttempt = 0;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  return {
    supported: Boolean(module),
    start(onFinal: (speech: TranscribedSpeech) => void, onError: (message: string) => void) {
      if (!module || running) return;
      running = true;
      restartAttempt = 0;
      void module.ExpoSpeechRecognitionModule.requestPermissionsAsync()
        .then(({ granted }) => {
          if (!running) return;
          if (!granted) {
            running = false;
            onError('Sem permissão de reconhecimento de fala.');
            return;
          }
          const scheduleRestart = (listen: () => void) => {
            if (!running || restartTimer !== null) return;
            const delay = recognitionRestartDelay(restartAttempt++);
            restartTimer = setTimeout(() => {
              restartTimer = null;
              listen();
            }, delay);
          };
          const listen = () => {
            if (!running) return;
            const current = new module.ExpoWebSpeechRecognition();
            current.lang = 'pt-BR';
            current.continuous = true;
            current.interimResults = false;
            // Usa o serviço padrão do Android; não exige pacote de idioma offline instalado.
            current.requiresOnDeviceRecognition = false;
            current.onspeechstart = () => {
              speechStart = new Date();
            };
            current.onresult = (event) => {
              for (let index = event.resultIndex; index < event.results.length; index++) {
                const result = event.results[index]!;
                const text = result[0].transcript.trim();
                if (result.isFinal && text) {
                  restartAttempt = 0;
                  onFinal({ text, startedAt: speechStart, endedAt: new Date() });
                  speechStart = new Date();
                }
              }
            };
            current.onerror = (event) => {
              if (isRetryableRecognitionError(event.error)) {
                if (event.error === 'network') onError(ERRORS.network!);
                scheduleRestart(listen);
                return;
              }
              running = false;
              onError(
                ERRORS[event.error] ??
                  event.message ??
                  'O reconhecimento de fala parou neste aparelho. A call continua normalmente.',
              );
            };
            current.onend = () => {
              current.onresult = null;
              current.onspeechstart = null;
              current.onerror = null;
              current.onend = null;
              if (recognition === current) recognition = null;
              scheduleRestart(listen);
            };
            recognition = current;
            try {
              current.start();
            } catch {
              onError('O reconhecimento de fala não iniciou. Tentando de novo…');
              scheduleRestart(listen);
            }
          };
          listen();
        })
        .catch(() => {
          running = false;
          onError('Não foi possível pedir acesso ao reconhecimento de fala.');
        });
    },
    stop() {
      running = false;
      if (restartTimer !== null) clearTimeout(restartTimer);
      restartTimer = null;
      if (recognition) {
        recognition.onresult = null;
        recognition.onspeechstart = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      }
      recognition = null;
    },
  };
}
