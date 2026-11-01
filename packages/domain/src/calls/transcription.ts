/**
 * Transcrição da call. O motor é plugável: hoje, grátis, o reconhecimento de fala do próprio
 * aparelho (cada participante transcreve a própria voz, então a fala já sai atribuída a ele);
 * um motor no servidor (ex.: um agente do LiveKit por faixa de áudio) pode entrar depois.
 */
export interface TranscribedSpeech {
  text: string;
  startedAt: Date;
  endedAt: Date;
}

export interface TranscriptionProvider {
  /** O aparelho/navegador consegue transcrever? */
  readonly supported: boolean;
  /** Começa a ouvir; chama `onFinal` a cada trecho final (nunca com os parciais). */
  start(onFinal: (speech: TranscribedSpeech) => void, onError: (message: string) => void): void;
  stop(): void;
}

export interface TranscriptLine {
  speakerLabel: string;
  text: string;
  startedAt: string;
}

/** Tempo desde o começo da sessão no formato [hh:mm:ss]. */
export function transcriptTimestamp(startedAt: string, sessionStart: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.parse(startedAt) - Date.parse(sessionStart)) / 1000),
  );
  const pad = (value: number) => String(value).padStart(2, '0');
  return `[${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}]`;
}

/**
 * Texto da transcrição para copiar ou baixar (.md/.txt), com cabeçalho:
 *   [00:12:31] Gambiarra: Eu avanço e golpeio o ogro com o machado!
 */
export function formatTranscript(
  lines: readonly TranscriptLine[],
  header: {
    campaign?: string | null;
    session?: string | null;
    date: string;
    characters: readonly string[];
  },
): string {
  const start = lines[0]?.startedAt ?? header.date;
  const head = [
    header.campaign ? `Campanha: ${header.campaign}` : null,
    header.session ? `Sessão: ${header.session}` : null,
    `Data: ${new Date(header.date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    header.characters.length ? `Personagens: ${header.characters.join(', ')}` : null,
  ].filter(Boolean);
  const body = lines.map(
    (line) => `${transcriptTimestamp(line.startedAt, start)} ${line.speakerLabel}: ${line.text}`,
  );
  return `${head.join('\n')}\n\n${body.join('\n')}\n`;
}
