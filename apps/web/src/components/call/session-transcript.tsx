'use client';

import type { TranscriptSegment } from '@codexveil/database';
import { ScrollText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/card';
import { TranscriptExport, TranscriptList } from './transcript-panel';

/** Transcrição da sessão (todas as calls dela): o mestre corrige trechos e exporta. */
export function SessionTranscript({
  segments,
  header,
}: {
  segments: TranscriptSegment[];
  header: { campaign: string; session: string; title: string };
}) {
  const router = useRouter();
  return (
    <Card ornate>
      <CardHeader
        icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
        title="Transcrição da sessão"
        description="Falas das calls vinculadas a esta sessão. Corrija erros de reconhecimento no lápis (opcional) e exporte."
        action={<TranscriptExport segments={segments} header={header} />}
      />
      {segments.length ? null : (
        <p className="mb-2 text-sm text-fg-muted">
          Crie a call pela aba Call, vinculada a esta sessão, e ligue “Gravar transcrição”.
        </p>
      )}
      <TranscriptList segments={segments} canEdit onEdited={() => router.refresh()} />
    </Card>
  );
}
