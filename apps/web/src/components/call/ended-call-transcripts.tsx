'use client';

import type { EndedCallTranscript, TranscriptSegment } from '@codexveil/database';
import { formatCallDuration, formatTranscript } from '@codexveil/domain';
import { Download, History } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { callPath } from '@/lib/routes';

export interface EndedCallTranscriptItem {
  call: EndedCallTranscript;
  segments: TranscriptSegment[];
}

const date = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });

const fileDate = (value: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'campanha';

function downloadTranscript(item: EndedCallTranscriptItem) {
  const { call, segments } = item;
  const content = formatTranscript(segments, {
    campaign: call.campaignName,
    session: call.sessionName,
    date: call.startedAt,
    characters: [
      ...new Set(
        segments.filter((line) => line.speakerType === 'player').map((line) => line.speakerLabel),
      ),
    ],
  });
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `transcricao-${slug(call.campaignName)}-${fileDate(call.endedAt)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function expiresIn(expiresAt: string, now: number): string {
  const remaining = Math.max(0, Date.parse(expiresAt) - now);
  if (remaining < 60 * 60 * 1000) return 'menos de 1h';
  return `${Math.ceil(remaining / (60 * 60 * 1000))}h`;
}

export function EndedCallTranscripts({
  items,
  single = false,
}: {
  items: EndedCallTranscriptItem[];
  single?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!items.length) {
    return single ? (
      <Card>
        <CardHeader title="Call encerrada" />
        <Alert tone="warning">
          A transcrição não está mais disponível. As falas são apagadas 24 horas depois do fim da
          call.
        </Alert>
      </Card>
    ) : null;
  }

  return (
    <Card ornate>
      <CardHeader
        icon={<History className="h-5 w-5" aria-hidden="true" />}
        title={single ? 'Call encerrada' : 'Calls encerradas'}
        description={
          single ? 'Baixe a transcrição antes do prazo.' : 'Encerradas nas últimas 24 horas.'
        }
      />
      <Alert tone="warning">
        As transcrições ficam disponíveis por 24 horas depois do fim da call e então são apagadas
        automaticamente. Gere os Melhores Momentos antes disso.
      </Alert>
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {items.map((item) => {
          const { call, segments } = item;
          const label = [call.campaignName, call.sessionName].filter(Boolean).join(' · ');
          return (
            <li key={call.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link
                  href={callPath(call.slug) as Route}
                  className="font-medium text-fg hover:text-fg-accent"
                >
                  {label || call.title || 'Call'}
                </Link>
                <p className="text-xs text-fg-muted">
                  {date(call.endedAt)} ·{' '}
                  {formatCallDuration(new Date(call.startedAt), new Date(call.endedAt))}
                  {' · '}Apaga em {expiresIn(call.expiresAt, now)}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={<Download className="h-4 w-4" />}
                disabled={!segments.length || Date.parse(call.expiresAt) <= now}
                onClick={() => downloadTranscript(item)}
              >
                Baixar transcrição (.txt)
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
