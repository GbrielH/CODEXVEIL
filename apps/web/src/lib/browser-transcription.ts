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

/** Volta a ouvir logo depois que o navegador encerra a escuta (silêncio ou fim de sessão). */
const QUICK_RESTART_MS = 150;

/**
 * Transcrição grátis no navegador (Web Speech API, em português do Brasil). Funciona no Chrome e
 * no Edge; Firefox e Safari não suportam.
 *
 *   * O navegador encerra a escuta depois de silêncios: ela volta em 150 ms (antes a espera
 *     crescia até 15 s e as falas desse intervalo se perdiam).
 *   * O início de cada fala é o primeiro resultado parcial dela (antes ficava o fim da fala
 *     anterior). O banco ajusta os horários pelo relógio do servidor.
 *   * Só falhas de rede usam espera crescente. Se o navegador bloquear a escuta com a aba em
 *     segundo plano, ela volta quando a aba fica visível de novo.
 */
export function createBrowserTranscription(): TranscriptionProvider {
  const Constructor = recognitionConstructor();
  let recognition: Recognition | null = null;
  let running = false;
  let utteranceStart: Date | null = null;
  let networkAttempt = 0;
  let restartTimer: number | null = null;
  let waitVisible: (() => void) | null = null;

  const clearVisibleWait = () => {
    if (waitVisible) document.removeEventListener('visibilitychange', waitVisible);
    waitVisible = null;
  };

  return {
    supported: Boolean(Constructor),
    start(onFinal: (speech: TranscribedSpeech) => void, onError: (message: string) => void) {
      if (!Constructor || running) return;
      running = true;
      networkAttempt = 0;
      const restart = (delay: number) => {
        if (!running || restartTimer !== null) return;
        restartTimer = window.setTimeout(() => {
          restartTimer = null;
          listen();
        }, delay);
      };
      const whenVisible = () => {
        clearVisibleWait();
        waitVisible = () => {
          if (document.visibilityState !== 'visible') return;
          clearVisibleWait();
          restart(QUICK_RESTART_MS);
        };
        document.addEventListener('visibilitychange', waitVisible);
      };
      const listen = () => {
        if (!running) return;
        const current = new Constructor();
        current.lang = 'pt-BR';
        current.continuous = true;
        // Resultados parciais marcam quando a fala começou de verdade.
        current.interimResults = true;
        current.onspeechstart = () => {
          utteranceStart ??= new Date();
        };
        current.onresult = (event) => {
          for (let index = event.resultIndex; index < event.results.length; index++) {
            const result = event.results[index]!;
            const text = result[0].transcript.trim();
            if (!text) continue;
            utteranceStart ??= new Date(Date.now() - 400);
            if (!result.isFinal) continue;
            networkAttempt = 0;
            onFinal({ text, startedAt: utteranceStart, endedAt: new Date() });
            utteranceStart = null;
          }
        };
        current.onerror = (event) => {
          if (event.error === 'network') {
            onError(ERRORS.network!);
            restart(recognitionRestartDelay(networkAttempt++));
            return;
          }
          if (isRetryableRecognitionError(event.error)) {
            restart(QUICK_RESTART_MS);
            return;
          }
          // Com a aba em segundo plano o navegador pode recusar a escuta: volta ao reaparecer.
          if (document.visibilityState !== 'visible') {
            whenVisible();
            return;
          }
          running = false;
          onError(
            ERRORS[event.error] ?? 'O reconhecimento de fala parou. A call continua normalmente.',
          );
        };
        current.onend = () => {
          current.onresult = null;
          current.onspeechstart = null;
          current.onerror = null;
          current.onend = null;
          if (recognition === current) recognition = null;
          utteranceStart = null;
          if (waitVisible) return;
          restart(QUICK_RESTART_MS);
        };
        recognition = current;
        try {
          current.start();
        } catch {
          if (document.visibilityState !== 'visible') whenVisible();
          else restart(recognitionRestartDelay(networkAttempt++));
        }
      };
      listen();
    },
    stop() {
      running = false;
      clearVisibleWait();
      if (restartTimer !== null) window.clearTimeout(restartTimer);
      restartTimer = null;
      utteranceStart = null;
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
