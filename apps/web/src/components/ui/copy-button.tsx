'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from './button';

/** Copia um texto para a área de transferência, com confirmação visual e anunciada. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={copy}
        icon={
          copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )
        }
      >
        {copied ? 'Copiado' : label}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copiado para a área de transferência.' : ''}
      </span>
      {failed ? <span className="text-xs text-danger">Copie manualmente.</span> : null}
    </span>
  );
}
