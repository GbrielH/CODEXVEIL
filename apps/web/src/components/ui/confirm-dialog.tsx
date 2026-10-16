'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Alert } from './alert';
import { Button, type ButtonVariant } from './button';

interface ConfirmDialogProps {
  /** Elemento que abre o diálogo (recebe a função `open`). */
  trigger: (open: () => void) => ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: Extract<ButtonVariant, 'primary' | 'danger'>;
  /** Exige digitar este texto para confirmar (operações irreversíveis). */
  requireText?: string;
  /** Executa a ação; lance um erro para mantê-lo aberto exibindo a mensagem. */
  onConfirm: () => Promise<void>;
}

/**
 * Confirmação de operações destrutivas usando o elemento nativo <dialog>: foco preso no
 * diálogo, Esc fecha e o restante da página fica inerte enquanto ele está aberto.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  requireText,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza o estado com o <dialog> nativo (showModal dá foco preso e fundo inerte).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const open = () => {
    setTyped('');
    setError(null);
    setIsOpen(true);
  };

  const close = () => {
    if (!pending) setIsOpen(false);
  };

  const canConfirm = !requireText || typed.trim() === requireText.trim();

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setIsOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {trigger(open)}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setIsOpen(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line-strong bg-raised p-0 text-fg shadow-overlay backdrop:bg-overlay"
      >
        {isOpen ? (
          <div className="ornate flex flex-col gap-4 p-6">
            <h2 id={titleId} className="text-xl">
              {title}
            </h2>
            <div id={descriptionId} className="text-sm leading-relaxed text-fg-secondary">
              {description}
            </div>
            {requireText ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={inputId} className="text-sm text-fg">
                  Digite <strong className="text-fg-accent">{requireText}</strong> para confirmar
                </label>
                <input
                  id={inputId}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  className="h-11 rounded-md border border-line-strong bg-sunken px-3 text-fg focus-visible:border-parchment-300"
                />
              </div>
            ) : null}
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={close} disabled={pending}>
                Cancelar
              </Button>
              <Button variant={tone} onClick={confirm} loading={pending} disabled={!canConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
