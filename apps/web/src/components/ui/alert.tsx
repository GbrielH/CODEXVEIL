import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'border-arcane-400/40 bg-info-bg text-arcane-300',
    icon: <Info className="h-5 w-5" aria-hidden="true" />,
  },
  success: {
    box: 'border-verdigris-400/40 bg-success-bg text-verdigris-300',
    icon: <CircleCheck className="h-5 w-5" aria-hidden="true" />,
  },
  warning: {
    box: 'border-amber-400/40 bg-warning-bg text-amber-300',
    icon: <TriangleAlert className="h-5 w-5" aria-hidden="true" />,
  },
  danger: {
    box: 'border-ember-400/45 bg-danger-bg text-ember-300',
    icon: <CircleAlert className="h-5 w-5" aria-hidden="true" />,
  },
};

interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const style = tones[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('flex gap-3 rounded-md border px-4 py-3 text-sm', style.box, className)}
    >
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div className={cx('text-fg-secondary', title ? 'mt-1' : undefined)}>{children}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
