'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { cx } from '@/lib/cx';

export interface CallUsageState {
  nearLimit: boolean;
  exhausted: boolean;
  usedMinutes?: number;
  limitMinutes?: number;
  percentage?: number;
}

export function useCallUsage(roomId?: string, enabled = true): CallUsageState | null {
  const [usage, setUsage] = useState<CallUsageState | null>(null);
  const load = useCallback(() => {
    if (!enabled) return;
    const query = roomId ? `?roomId=${encodeURIComponent(roomId)}` : '';
    void fetch(`/api/call/usage${query}`, { cache: 'no-store' })
      .then(async (response) => (response.ok ? ((await response.json()) as CallUsageState) : null))
      .then((next) => {
        if (next) setUsage(next);
      })
      .catch(() => undefined);
  }, [enabled, roomId]);

  useEffect(() => {
    if (!enabled) return;
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled, load]);
  return usage;
}

export function CallUsageMeter({ usage }: { usage: CallUsageState | null }) {
  if (!usage) return null;
  if (usage.percentage === undefined) {
    return usage.nearLimit ? (
      <Alert tone="warning">Os minutos de call do mês estão quase no fim.</Alert>
    ) : null;
  }

  const percentage = Math.max(0, usage.percentage);
  const color = percentage >= 95 ? 'bg-danger' : percentage >= 80 ? 'bg-amber-400' : 'bg-success';
  return (
    <div className="rounded-lg border border-line bg-sunken px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-fg">Minutos de call do mês: {percentage}%</span>
        <span className="text-xs text-fg-muted">
          {usage.usedMinutes ?? 0} de {usage.limitMinutes ?? 0} min
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
        <div
          className={cx('h-full rounded-full transition-[width]', color)}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
}
