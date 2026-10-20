import { cx } from '@/lib/cx';

const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' } as const;

interface SpinnerProps {
  size?: keyof typeof sizes;
  /** Texto para leitores de tela; vazio quando o contexto já anuncia o carregamento. */
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label = 'Carregando…', className }: SpinnerProps) {
  return (
    <span role={label ? 'status' : undefined} className={cx('inline-flex', className)}>
      <svg
        className={cx('animate-spin text-current', sizes[size])}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
