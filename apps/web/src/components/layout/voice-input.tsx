'use client';

import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** Tipos mínimos da Web Speech API (não fazem parte do TypeScript padrão). */
interface SpeechResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}
type RecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const subscribeNothing = () => () => undefined;

/**
 * Ditado por voz (pt-BR) com o reconhecimento do próprio navegador (Chrome, Edge, Safari): o que a
 * pessoa fala vai para a caixa de pergunta, que ela pode corrigir antes de enviar. Em navegadores
 * sem suporte (Firefox), o botão não aparece.
 */
export function VoiceInputButton({ value, onChange, disabled }: { value: string; onChange: (text: string) => void; disabled?: boolean }) {
  const supported = useSyncExternalStore(subscribeNothing, () => recognitionConstructor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const base = useRef('');

  useEffect(() => () => recognition.current?.stop(), []);

  if (!supported) return null;

  const start = () => {
    const Recognition = recognitionConstructor();
    if (!Recognition) return;
    setError(null);
    const instance = new Recognition();
    instance.lang = 'pt-BR';
    instance.continuous = true;
    instance.interimResults = true;
    base.current = value.trim() ? `${value.trim()} ` : '';
    instance.onresult = (event) => {
      let finalText = '';
      let interim = '';
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]!;
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      onChange(`${base.current}${finalText}${interim}`.slice(0, 2000));
    };
    instance.onerror = (event) => {
      setError(event.error === 'not-allowed' ? 'Permita o microfone no navegador para falar com o Tomo.' : 'Não consegui ouvir. Tente de novo.');
    };
    instance.onend = () => setListening(false);
    recognition.current = instance;
    instance.start();
    setListening(true);
  };

  const stop = () => {
    recognition.current?.stop();
    setListening(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={listening ? 'Parar de ouvir' : 'Falar a pergunta'}
        title={listening ? 'Parar de ouvir' : 'Falar a pergunta (o texto aparece na caixa)'}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-50 ${
          listening ? 'animate-pulse border-red-400/70 bg-red-500/20 text-red-200' : 'border-line text-fg-muted hover:bg-hover hover:text-fg'
        }`}
      >
        {listening ? <Square className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
      </button>
      {error ? (
        <p role="alert" className="absolute right-3 bottom-full mb-1 rounded-md bg-raised px-2 py-1 text-xs text-danger shadow">
          {error}
        </p>
      ) : null}
    </>
  );
}
