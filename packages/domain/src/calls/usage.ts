export interface CallUsageInterval {
  startedAt: string | Date;
  endedAt?: string | Date | null;
  lastSeenAt: string | Date;
}

const timestamp = (value: string | Date): number =>
  value instanceof Date ? value.getTime() : Date.parse(value);

/**
 * Soma tempo de participante, não a união do relógio: duas pessoas conectadas por dez minutos
 * consomem vinte minutos. Intervalos abertos terminam no último sinal de vida.
 */
export function sumParticipantSeconds(
  intervals: readonly CallUsageInterval[],
  window: { startedAt: string | Date; endedAt: string | Date },
): number {
  const windowStart = timestamp(window.startedAt);
  const windowEnd = timestamp(window.endedAt);
  return intervals.reduce((total, interval) => {
    const startedAt = Math.max(timestamp(interval.startedAt), windowStart);
    const endedAt = Math.min(timestamp(interval.endedAt ?? interval.lastSeenAt), windowEnd);
    return total + Math.max(0, Math.floor((endedAt - startedAt) / 1000));
  }, 0);
}

export function callUsagePercent(usedMinutes: number, limitMinutes: number): number {
  if (limitMinutes <= 0) return 100;
  return Math.max(0, Math.round((usedMinutes / limitMinutes) * 100));
}

export function formatCallDuration(startedAt: Date, now = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}min` : `${rest}min`;
}
