'use client';

import { importBookPack } from '@codexveil/database';
import {
  bookEntryKindLabels,
  parseBookPack,
  type BookPackIssue,
} from '@codexveil/rpg-systems/dnd5e';
import {
  T20_BOOK_PACK_FORMAT,
  parseT20BookPack,
  t20BookEntryKindLabels,
} from '@codexveil/rpg-systems/tormenta20';
import { FileUp, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Pacote lido, de qualquer sistema: o que a tela e a importação precisam. */
interface AnyPack {
  systemId: string;
  book: { id: string; name: string; category: string; edition: string; origin: string };
  entries: readonly { kind: string; key: string; name: string; data: unknown }[];
}

type State =
  | { step: 'idle' }
  | { step: 'ready'; fileName: string; pack: AnyPack; issues: BookPackIssue[]; replaces: boolean }
  | { step: 'importing'; fileName: string; done: number; total: number }
  | { step: 'error'; message: string };

function counts(pack: AnyPack): [string, number][] {
  const map = new Map<string, number>();
  for (const entry of pack.entries) map.set(entry.kind, (map.get(entry.kind) ?? 0) + 1);
  return [...map];
}

function kindLabel(systemId: string, kind: string): string {
  const labels: Record<string, { many: string }> =
    systemId === 'tormenta20' ? t20BookEntryKindLabels : bookEntryKindLabels;
  return labels[kind]?.many ?? kind;
}

/** Lê o pacote conforme o formato: D&D 5e (`codexveil.dnd5e.book`) ou Tormenta20. */
function readPack(input: unknown): { pack: AnyPack; issues: BookPackIssue[] } {
  if (
    input &&
    typeof input === 'object' &&
    (input as { format?: unknown }).format === T20_BOOK_PACK_FORMAT
  ) {
    const parsed = parseT20BookPack(input);
    return {
      pack: { systemId: 'tormenta20', book: parsed.pack.book, entries: parsed.pack.entries },
      issues: parsed.issues,
    };
  }
  const parsed = parseBookPack(input);
  return {
    pack: { systemId: 'dnd5e', book: parsed.pack.book, entries: parsed.pack.entries },
    issues: parsed.issues,
  };
}

/**
 * Importa um pacote de livro (JSON gerado do exemplar do próprio usuário). O arquivo é lido e
 * validado no navegador e enviado em lotes direto ao banco, com a sessão do usuário (RLS).
 */
export function BookImporter({ userId, existingKeys }: { userId: string; existingKeys: string[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ step: 'idle' });

  const [dragging, setDragging] = useState(false);
  const read = async (file: File) => {
    try {
      const parsed = readPack(JSON.parse(await file.text()) as unknown);
      setState({
        step: 'ready',
        fileName: file.name,
        pack: parsed.pack,
        issues: parsed.issues,
        replaces: existingKeys.includes(parsed.pack.book.id),
      });
    } catch (error) {
      setState({
        step: 'error',
        message:
          error instanceof SyntaxError
            ? 'O arquivo não é um JSON válido.'
            : failureMessage(error, 'Este arquivo não é um pacote de livro do Codexveil.'),
      });
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const start = async () => {
    if (state.step !== 'ready') return;
    const { pack, fileName } = state;
    setState({ step: 'importing', fileName, done: 0, total: pack.entries.length });
    try {
      await importBookPack(
        getSupabaseBrowserClient(),
        userId,
        { systemId: pack.systemId, book: pack.book, entries: pack.entries },
        (done, total) => setState({ step: 'importing', fileName, done, total }),
      );
      setState({ step: 'idle' });
      router.refresh();
    } catch (error) {
      setState({
        step: 'error',
        message: failureMessage(
          error,
          'A importação não terminou. Importe o arquivo de novo: o livro incompleto é substituído.',
        ),
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Escolher pacote de livro"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void read(file);
        }}
      />
      {state.step === 'idle' || state.step === 'error' ? (
        // Arraste o arquivo para a área ou clique no botão.
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void read(file);
          }}
          className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging ? 'border-wine-400 bg-wine-900/30' : 'border-line'}`}
        >
          <p className="text-sm text-fg-muted">Arraste o arquivo do livro (.json) para cá ou</p>
          <Button
            icon={<FileUp className="h-4 w-4" aria-hidden="true" />}
            onClick={() => input.current?.click()}
          >
            Escolher arquivo do livro (.json)
          </Button>
        </div>
      ) : null}
      {state.step === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

      {state.step === 'ready' ? (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-sunken p-4">
          <p className="font-display text-lg text-fg">{state.pack.book.name}</p>
          <p className="text-xs text-fg-muted">{state.fileName}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-secondary">
            {counts(state.pack).map(([kind, total]) => (
              <li key={kind}>
                {kindLabel(state.pack.systemId, kind)}: <strong className="text-fg">{total}</strong>
              </li>
            ))}
          </ul>
          {state.issues.length > 0 ? (
            <Alert
              tone="warning"
              title={`${state.issues.length} entrada(s) com problema ficam de fora`}
            >
              <ul className="list-disc pl-4 text-xs">
                {state.issues.slice(0, 8).map((issue) => (
                  <li key={issue.index}>
                    {issue.key ? `${issue.kind} ${issue.key}: ` : `Entrada ${issue.index + 1}: `}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}
          {state.replaces ? (
            <Alert tone="info">Você já importou este livro: a versão atual será substituída.</Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<Upload className="h-4 w-4" aria-hidden="true" />}
              onClick={() => void start()}
            >
              Importar {state.pack.entries.length} entradas
            </Button>
            <Button variant="ghost" onClick={() => setState({ step: 'idle' })}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {state.step === 'importing' ? (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <p className="text-sm text-fg-secondary">
            Importando {state.fileName}… {state.done} de {state.total}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full bg-wine-500 transition-[width]"
              style={{
                width: `${state.total ? Math.round((state.done / state.total) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-fg-muted">Não feche a página até terminar.</p>
        </div>
      ) : null}
    </div>
  );
}
