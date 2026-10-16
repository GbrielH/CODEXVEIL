'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from './button';

interface SubmitButtonProps extends Omit<ComponentProps<typeof Button>, 'type' | 'loading'> {
  /** Texto exibido enquanto o formulário é enviado. */
  pendingLabel?: string;
}

/** Botão de envio que reflete o estado pendente do formulário (Server Actions). */
export function SubmitButton({ children, pendingLabel, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
