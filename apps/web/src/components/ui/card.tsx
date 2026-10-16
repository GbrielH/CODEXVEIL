import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Cantos ornamentais da identidade visual (use com moderação). */
  ornate?: boolean;
  padded?: boolean;
}

export function Card({ ornate = false, padded = true, className, ...props }: CardProps) {
  return (
    <div
      className={cx(
        'rounded-lg border border-line bg-card shadow-card',
        padded && 'p-5 sm:p-6',
        ornate && 'ornate',
        className,
      )}
      {...props}
    />
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, description, action, icon }: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span className="mt-0.5 text-fg-brand">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-lg leading-tight">{title}</h2>
          {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
