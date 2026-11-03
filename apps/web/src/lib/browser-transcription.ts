import {
  isRetryableRecognitionError,
  recognitionRestartDelay,
  type TranscribedSpeech,
  type TranscriptionProvider,
} from '@codexveil/domain';

/** Partes da Web Speech API usadas aqui (não estão nos tipos padrão do TypeScript). */
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onspeechstart: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'O navegador bloqueou o microfone para a transcrição.',
  'service-not-allowed': 'Este navegador não libera o reconhecimento de fala.',
  network: 'O serviço de reconhecimento de fala falhou. Tentando reconectar…',
  'audio-capture': 'Nenhum microfone encontrado para a transcrição.',
};

/**
 * Transcrição grátis no navegador (Web Speech API, em português do Brasil). Funciona no Chrome e
 * no Edge; Firefox e Safari não suportam. Reinicia sozinha quando o navegador encerra a escuta.
 */
export function createBrowserTranscription(): TranscriptionProvider {
  const Constructor = recognitionConstructor();
  let recognition: Recognition | null = null;
  let running = false;
  let speechStart = new Date();
  let restartAttempt = 0;
  let restartTimer: number | null = null;

  return {
    supported: Boolean(Constructor),
    start(onFinal: (speech: TranscribedSpeech) => void, onError: (message: string) => void) {
      if (!Constructor || running) return;
      running = true;
      restartAttempt = 0;
      const scheduleRestart = (listen: () => void) => {
        if (!running || restartTimer !== null) return;
        const delay = recognitionRestartDelay(restartAttempt++);
        restartTimer = window.setTimeout(() => {
          restartTimer = null;
          listen();
        }, delay);
      };
      const listen = () => {
        if (!running) return;
        const current = new Constructor();
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
            ERRORS[event.error] ?? 'O reconhecimento de fala parou. A call continua normalmente.',
          );
        };
        // O navegador para de ouvir depois de um tempo: volta a ouvir enquanto estiver ligada.
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
    },
    stop() {
      running = false;
      if (restartTimer !== null) window.clearTimeout(restartTimer);
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
