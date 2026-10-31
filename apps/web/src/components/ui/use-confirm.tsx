'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Button } from './button';
import { Modal } from './modal';

interface ConfirmRequest {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
}

/**
 * Confirmação com o visual do Codexveil, no lugar do `window.confirm` do navegador:
 * `const [confirm, dialog] = useConfirm()`; renderize `dialog` e use `await confirm({...})`.
 */
export function useConfirm(): [(request: ConfirmRequest) => Promise<boolean>, ReactNode] {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setRequest(next);
      }),
    [],
  );
  const finish = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  };

  const dialog = (
    <Modal
      open={request !== null}
      onClose={() => finish(false)}
      title={request?.title ?? ''}
      description={typeof request?.description === 'string' ? request.description : undefined}
    >
      {request?.description && typeof request.description !== 'string' ? (
        <div className="text-sm text-fg-secondary">{request.description}</div>
      ) : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => finish(false)}>
          Cancelar
        </Button>
        <Button variant={request?.tone ?? 'danger'} onClick={() => finish(true)}>
          {request?.confirmLabel ?? 'Confirmar'}
        </Button>
      </div>
    </Modal>
  );
  return [confirm, dialog];
}
