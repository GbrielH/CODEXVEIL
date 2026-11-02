import type { TranscribedSpeech, TranscriptionProvider } from '@codexveil/domain';

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
  network: 'O reconhecimento de fala precisa de internet.',
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

  return {
    supported: Boolean(Constructor),
    start(onFinal: (speech: TranscribedSpeech) => void, onError: (message: string) => void) {
      if (!Constructor || running) return;
      running = true;
      const listen = () => {
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
              onFinal({ text, startedAt: speechStart, endedAt: new Date() });
              speechStart = new Date();
            }
          }
        };
        current.onerror = (event) => {
          if (event.error === 'no-speech' || event.error === 'aborted') return;
          running = false;
          onError(
            ERRORS[event.error] ?? 'O reconhecimento de fala parou. A call continua normalmente.',
          );
        };
        // O navegador para de ouvir depois de um tempo: volta a ouvir enquanto estiver ligada.
        current.onend = () => {
          if (running) window.setTimeout(listen, 300);
        };
        recognition = current;
        try {
          current.start();
        } catch {
          running = false;
          onError('Não foi possível iniciar o reconhecimento de fala neste navegador.');
        }
      };
      listen();
    },
    stop() {
      running = false;
      recognition?.stop();
      recognition = null;
    },
  };
}
