import { cx } from '@/lib/cx';

/** Separador ornamental: filete com losango central. */
export function Divider({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cx('flex items-center gap-3 text-parchment-400/70', className)} role="separator">
      <span className="h-px flex-1 bg-linear-to-r from-transparent to-parchment-400/40" />
      {label ? (
        <span className="eyebrow">{label}</span>
      ) : (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
          <path d="M6 0L12 6L6 12L0 6Z" fill="currentColor" />
        </svg>
      )}
      <span className="h-px flex-1 bg-linear-to-l from-transparent to-parchment-400/40" />
    </div>
  );
}
