import { describe, expect, it } from 'vitest';
import {
  formatTranscript,
  isRetryableRecognitionError,
  recognitionRestartDelay,
  transcriptTimestamp,
} from './transcription';

describe('transcrição', () => {
  it('marca o tempo desde o começo da sessão', () => {
    expect(transcriptTimestamp('2026-11-01T20:12:31Z', '2026-11-01T20:00:00Z')).toBe('[00:12:31]');
  });

  it('exporta com cabeçalho e uma fala por linha', () => {
    const text = formatTranscript(
      [
        {
          speakerLabel: 'Gambiarra',
          text: 'Eu avanço e golpeio o ogro com o machado!',
          startedAt: '2026-11-01T20:00:00Z',
        },
        { speakerLabel: 'Mestre', text: 'O ogro ri.', startedAt: '2026-11-01T20:00:09Z' },
      ],
      {
        campaign: 'Dilúvio Sangrento',
        session: 'Sessão 3',
        date: '2026-11-01T20:00:00Z',
        characters: ['Gambiarra'],
      },
    );
    expect(text).toContain('Campanha: Dilúvio Sangrento');
    expect(text).toContain('Personagens: Gambiarra');
    expect(text).toContain('[00:00:00] Gambiarra: Eu avanço e golpeio o ogro com o machado!');
    expect(text).toContain('[00:00:09] Mestre: O ogro ri.');
  });

  it('reinicia erros temporários com espera exponencial limitada', () => {
    expect(isRetryableRecognitionError('no-speech')).toBe(true);
    expect(isRetryableRecognitionError('network')).toBe(true);
    expect(isRetryableRecognitionError('aborted')).toBe(true);
    expect(isRetryableRecognitionError('not-allowed')).toBe(false);
    expect([0, 1, 2, 3, 8].map(recognitionRestartDelay)).toEqual([300, 600, 1200, 2400, 15_000]);
  });
});
