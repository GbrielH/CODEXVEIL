import { healthStatus, healthStatusLabels, type HealthStatus } from '@codexveil/domain';
import { cx } from '@/lib/cx';

const barColors: Record<HealthStatus, string> = {
  healthy: 'bg-hp-healthy',
  bloodied: 'bg-hp-bloodied',
  critical: 'bg-hp-critical',
  down: 'bg-hp-critical',
  unknown: 'bg-silver-500',
};

const textColors: Record<HealthStatus, string> = {
  healthy: 'text-verdigris-300',
  bloodied: 'text-amber-300',
  critical: 'text-ember-300',
  down: 'text-ember-300',
  unknown: 'text-fg-muted',
};

interface HealthBarProps {
  current: number | null;
  max: number | null;
  temp?: number;
  /** Mostra os números ao lado da barra. */
  showValues?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Barra de vida com cor por estado (saudável, ferido, em perigo, caído). O estado também
 * é escrito em texto, para não depender só da cor.
 */
export function HealthBar({ current, max, temp = 0, showValues = true, size = 'sm', className }: HealthBarProps) {
  const value = current ?? 0;
  const status = healthStatus(value, max);
  const percent = max && max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tempPercent = max && max > 0 ? Math.min(100 - percent, Math.round((temp / max) * 100)) : 0;

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <div
        className={cx('flex overflow-hidden rounded-full bg-sunken ring-1 ring-line', size === 'md' ? 'h-3' : 'h-2')}
        role="meter"
        aria-label="Pontos de vida"
        aria-valuemin={0}
        aria-valuemax={max ?? undefined}
        aria-valuenow={value}
        aria-valuetext={`${value} de ${max ?? '?'} pontos de vida${temp > 0 ? `, mais ${temp} temporários` : ''} — ${healthStatusLabels[status]}`}
      >
        <div className={cx('transition-[width] duration-300 ease-codex', barColors[status])} style={{ width: `${percent}%` }} />
        {tempPercent > 0 ? <div className="bg-hp-temp" style={{ width: `${tempPercent}%` }} /> : null}
      </div>
      {showValues ? (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="tabular text-fg-secondary">
            <strong className="text-fg">{current ?? '—'}</strong> / {max ?? '—'}
            {temp > 0 ? <span className="ml-1 text-arcane-300">+{temp} temp.</span> : null}
          </span>
          <span className={textColors[status]}>{healthStatusLabels[status]}</span>
        </div>
      ) : null}
    </div>
  );
}
