import Link, { type LinkProps } from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap ' +
  'transition-[background-color,border-color,color,box-shadow] duration-150 ease-codex ' +
  'disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55';

const variants: Record<ButtonVariant, string> = {
  primary:
    'border border-wine-500/70 bg-primary text-primary-fg shadow-[inset_0_1px_0_rgb(228_216_189/0.14)] ' +
    'hover:bg-primary-hover active:bg-primary-pressed',
  secondary:
    'border border-line-strong bg-raised text-fg hover:border-silver-400/60 hover:bg-hover active:bg-card',
  ghost: 'text-fg-secondary hover:bg-hover hover:text-fg active:bg-card',
  danger:
    'border border-ember-400/45 bg-danger-bg text-ember-300 hover:border-ember-400/80 hover:bg-ember-400/15',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-11 w-11 p-0',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cx(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mostra indicador de progresso e bloqueia novos cliques. */
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant,
  size,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size="sm" label="" /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps<T extends string> extends LinkProps<T> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function ButtonLink<T extends string>({
  variant,
  size,
  className,
  icon,
  children,
  ...props
}: ButtonLinkProps<T>) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
