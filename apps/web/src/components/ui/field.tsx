import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';

const controlBase =
  'w-full rounded-md border bg-sunken px-3 text-fg placeholder:text-fg-subtle ' +
  'transition-[border-color,box-shadow] duration-150 ease-codex ' +
  'hover:border-silver-400/50 focus-visible:border-parchment-300 focus-visible:outline-none ' +
  'focus-visible:shadow-[0_0_0_3px_rgb(228_216_189/0.18)] disabled:cursor-not-allowed disabled:opacity-60';

function controlClasses(invalid: boolean, extra?: string) {
  return cx(
    controlBase,
    invalid ? 'border-ember-400/80' : 'border-line-strong',
    extra,
  );
}

interface FieldShellProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/** Rótulo, dica e mensagem de erro ligados ao controle por `aria-describedby`. */
export function FieldShell({ id, label, hint, error, required, children, className }: FieldShellProps) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {required ? (
          <span className="ml-1 text-fg-brand" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  fieldClassName?: string;
}

export function TextField({ id, label, hint, error, required, fieldClassName, className, ...props }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={controlClasses(Boolean(error), cx('h-11', className))}
        {...props}
      />
    </FieldShell>
  );
}

interface TextareaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  fieldClassName?: string;
}

export function TextareaField({
  id,
  label,
  hint,
  error,
  required,
  fieldClassName,
  className,
  rows = 4,
  ...props
}: TextareaFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={controlClasses(Boolean(error), cx('py-2.5 leading-relaxed', className))}
        {...props}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  fieldClassName?: string;
  children: ReactNode;
}

export function SelectField({
  id,
  label,
  hint,
  error,
  required,
  fieldClassName,
  className,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={controlClasses(Boolean(error), cx('h-11 pr-8', className))}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  id: string;
  label: string;
  description?: ReactNode;
}

export function CheckboxField({ id, label, description, className, ...props }: CheckboxFieldProps) {
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        aria-describedby={description ? `${id}-description` : undefined}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-sm border border-line-strong bg-sunken accent-wine-500"
        {...props}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-fg">
          {label}
        </label>
        {description ? (
          <p id={`${id}-description`} className="text-xs text-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
