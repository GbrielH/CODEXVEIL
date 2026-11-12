'use client';

import { exportBookPack, type BookPackSummary } from '@codexveil/database';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Baixa o livro como pacote `.book.json` (o mesmo formato aceito pelo importador). */
export function BookDownloadButton({ pack }: { pack: BookPackSummary }) {
  const { toast } = useToast();
  const [step, setStep] = useState<string | null>(null);
  const download = async () => {
    setStep('Preparando…');
    try {
      const data = await exportBookPack(getSupabaseBrowserClient(), pack, setStep);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pack.bookKey}.book.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível baixar o livro',
        description: failureMessage(error, 'Tente de novo.'),
      });
    } finally {
      setStep(null);
    }
  };
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={step !== null}
      disabled={!pack.isReady}
      icon={<Download className="h-4 w-4" aria-hidden="true" />}
      onClick={() => void download()}
    >
      {step ?? 'Baixar JSON'}
    </Button>
  );
}
