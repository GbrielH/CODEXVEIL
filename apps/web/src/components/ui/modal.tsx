'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Largura máxima do painel. */
  size?: 'md' | 'lg';
  /** Impede fechar (Esc/botão) enquanto uma operação está em andamento. */
  busy?: boolean;
}

/**
 * Janela modal com o elemento nativo <dialog>: foco preso, Esc fecha e o restante da
 * página fica inerte. Mesmo padrão do ConfirmDialog.
 */
export function Modal({ open, onClose, title, description, children, size = 'md', busy = false }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      className={cx(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg border border-line-strong bg-raised p-0 text-fg shadow-overlay backdrop:bg-overlay',
        size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
      )}
    >
      {open ? (
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl leading-tight">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-fg-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-50"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
