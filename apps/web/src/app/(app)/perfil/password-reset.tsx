'use client';

import { KeyRound } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { sendPasswordResetAction } from './actions';

export function PasswordReset() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {result ? <Alert tone={result.ok ? 'success' : 'danger'}>{result.message}</Alert> : null}
      <div>
        <Button
          variant="secondary"
          loading={pending}
          icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
          onClick={() =>
            startTransition(async () => {
              const response = await sendPasswordResetAction();
              setResult({ ok: response.ok, message: response.message ?? '' });
            })
          }
        >
          Enviar link para trocar a senha
        </Button>
      </div>
    </div>
  );
}
