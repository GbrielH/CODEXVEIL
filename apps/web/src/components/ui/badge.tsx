import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

export type BadgeTone =
  'neutral' | 'brand' | 'parchment' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<BadgeTone, string> = {
  neutral: 'border-line-strong bg-raised text-fg-secondary',
  brand: 'border-wine-400/50 bg-wine-900 text-wine-200',
  parchment: 'border-parchment-400/40 bg-parchment-200/10 text-fg-accent',
  success: 'border-verdigris-400/40 bg-success-bg text-verdigris-300',
  warning: 'border-amber-400/40 bg-warning-bg text-amber-300',
  danger: 'border-ember-400/40 bg-danger-bg text-ember-300',
  info: 'border-arcane-400/40 bg-info-bg text-arcane-300',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
