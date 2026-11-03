import { describe, expect, it } from 'vitest';
import { callUsagePercent, formatCallDuration, sumParticipantSeconds } from './usage';

describe('consumo da call', () => {
  it('soma sobreposições por participante e fecha intervalo aberto no último sinal', () => {
    const seconds = sumParticipantSeconds(
      [
        {
          startedAt: '2026-11-03T12:00:00Z',
          endedAt: '2026-11-03T12:10:00Z',
          lastSeenAt: '2026-11-03T12:10:00Z',
        },
        {
          startedAt: '2026-11-03T12:05:00Z',
          endedAt: '2026-11-03T12:15:00Z',
          lastSeenAt: '2026-11-03T12:15:00Z',
        },
        {
          startedAt: '2026-11-03T12:20:00Z',
          endedAt: null,
          lastSeenAt: '2026-11-03T12:24:00Z',
        },
      ],
      { startedAt: '2026-11-03T12:00:00Z', endedAt: '2026-11-03T13:00:00Z' },
    );
    expect(seconds).toBe(24 * 60);
  });

  it('recorta na janela e formata percentual e duração', () => {
    expect(
      sumParticipantSeconds(
        [
          {
            startedAt: '2026-10-31T23:55:00Z',
            endedAt: '2026-11-01T00:05:00Z',
            lastSeenAt: '2026-11-01T00:05:00Z',
          },
        ],
        { startedAt: '2026-11-01T00:00:00Z', endedAt: '2026-12-01T00:00:00Z' },
      ),
    ).toBe(5 * 60);
    expect(callUsagePercent(4000, 5000)).toBe(80);
    expect(
      formatCallDuration(new Date('2026-11-03T12:00:00Z'), new Date('2026-11-03T13:23:00Z')),
    ).toBe('1h 23min');
  });
});
