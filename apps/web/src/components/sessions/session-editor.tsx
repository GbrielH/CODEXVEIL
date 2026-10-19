'use client';

import {
  createSessionBlock,
  deleteSessionBlock,
  notifySessionScheduled,
  reorderSessionBlocks,
  updateSession,
  updateSessionBlock,
  type BlockReferences,
  type SessionDetail,
  type StoredSessionBlock,
} from '@codexveil/database';
import {
  blockTypeLabels,
  createBlockContent,
  defaultVisibilityFor,
  moveItem,
  needsRenumbering,
  positionBetween,
  type SessionBlockContent,
  type SessionBlockType,
  type SharedVisibility,
} from '@codexveil/domain';
import { sessionUpdateSchema } from '@codexveil/validation';
import {
  BookMarked,
  Eye,
  Heading1,
  Heading2,
  Image as ImageIcon,
  List,
  ListChecks,
  Lock,
  MessageSquareQuote,
  Minus,
  PencilLine,
  Pilcrow,
  Skull,
  Swords,
  UserRound,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckboxField, TextareaField, TextField } from '@/components/ui/field';
import { SaveStatus } from '@/components/ui/save-status';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { fromBrasiliaInput, toBrasiliaInput } from '@/lib/format';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useAutosave } from '@/lib/use-autosave';
import { BlockEditor, type EditorOptions } from './block-editor';
import { BlockRenderer } from './block-renderer';

const blockMenu: { type: SessionBlockType; icon: ReactNode }[] = [
  { type: 'paragraph', icon: <Pilcrow className="h-4 w-4" aria-hidden="true" /> },
  { type: 'heading', icon: <Heading1 className="h-4 w-4" aria-hidden="true" /> },
  { type: 'subheading', icon: <Heading2 className="h-4 w-4" aria-hidden="true" /> },
  { type: 'callout', icon: <MessageSquareQuote className="h-4 w-4" aria-hidden="true" /> },
  { type: 'gm_note', icon: <Lock className="h-4 w-4" aria-hidden="true" /> },
  { type: 'list', icon: <List className="h-4 w-4" aria-hidden="true" /> },
  { type: 'checklist', icon: <ListChecks className="h-4 w-4" aria-hidden="true" /> },
  { type: 'image', icon: <ImageIcon className="h-4 w-4" aria-hidden="true" /> },
  { type: 'divider', icon: <Minus className="h-4 w-4" aria-hidden="true" /> },
  { type: 'npc_ref', icon: <UserRound className="h-4 w-4" aria-hidden="true" /> },
  { type: 'monster_ref', icon: <Skull className="h-4 w-4" aria-hidden="true" /> },
  { type: 'character_ref', icon: <Swords className="h-4 w-4" aria-hidden="true" /> },
  { type: 'content_ref', icon: <BookMarked className="h-4 w-4" aria-hidden="true" /> },
];

type EditableBlock = StoredSessionBlock & { content: SessionBlockContent };

interface SessionMeta {
  title: string;
  scheduledAt: string;
  isPublished: boolean;
  physicalDice: boolean;
  recap: string;
}

function toUpdate(meta: SessionMeta) {
  const scheduledAt = fromBrasiliaInput(meta.scheduledAt);
  return {
    title: meta.title,
    scheduledAt: scheduledAt === undefined ? 'data-invalida' : scheduledAt,
    isPublished: meta.isPublished,
    physicalDice: meta.physicalDice,
    recap: meta.recap,
  };
}

function validateMeta(meta: SessionMeta): string | null {
  const parsed = sessionUpdateSchema.safeParse(toUpdate(meta));
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Revise os dados da sessão.');
}

interface SessionEditorProps {
  campaignId: string;
  session: SessionDetail;
  initialBlocks: StoredSessionBlock[];
  initialImageUrls: Record<string, string>;
  options: EditorOptions;
}

export function SessionEditor({ campaignId, session, initialBlocks, initialImageUrls, options }: SessionEditorProps) {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<StoredSessionBlock[]>(initialBlocks);
  const [imageUrls, setImageUrls] = useState(initialImageUrls);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [structureBusy, setStructureBusy] = useState(false);

  const meta = useAutosave<SessionMeta>({
    initial: {
      title: session.title,
      scheduledAt: toBrasiliaInput(session.scheduledAt),
      isPublished: session.isPublished,
      physicalDice: session.physicalDice,
      recap: session.recap,
    },
    version: session.version,
    save: (value, version) => {
      const parsed = sessionUpdateSchema.parse(toUpdate(value));
      return updateSession(getSupabaseBrowserClient(), session.id, version, parsed);
    },
    validate: validateMeta,
  });

  const fail = (title: string, error: unknown) =>
    toast({ tone: 'danger', title, description: failureMessage(error, 'Tente novamente.') });

  // Aviso no app dos jogadores: quando a sessão publicada ganha (ou muda de) data e fica salva,
  // o aviso sai depois de alguns segundos sem novas mudanças. O servidor não repete a mesma data.
  const notifyKey = meta.state.status === 'saved' && meta.value.isPublished && meta.value.scheduledAt ? meta.value.scheduledAt : null;
  const initialNotifyKey = useRef(notifyKey);
  const pendingNotify = useRef(false);
  useEffect(() => {
    if (!notifyKey || notifyKey === initialNotifyKey.current) return;
    pendingNotify.current = true;
    const timer = window.setTimeout(() => {
      pendingNotify.current = false;
      void notifySessionScheduled(getSupabaseBrowserClient(), session.id).then((result) => {
        if (result && result.sent > 0) {
          toast({ tone: 'success', title: `Aviso da sessão enviado a ${result.sent} ${result.sent === 1 ? 'aparelho' : 'aparelhos'} da mesa.` });
        }
      });
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [notifyKey, session.id, toast]);
  useEffect(
    () => () => {
      if (pendingNotify.current) void notifySessionScheduled(getSupabaseBrowserClient(), session.id);
    },
    [session.id],
  );

  const insertBlock = async (type: SessionBlockType, index: number) => {
    setInsertAt(null);
    setStructureBusy(true);
    const before = blocks[index - 1]?.position ?? null;
    const after = blocks[index]?.position ?? null;
    try {
      const created = await createSessionBlock(getSupabaseBrowserClient(), {
        sessionId: session.id,
        campaignId,
        position: positionBetween(before, after),
        visibility: defaultVisibilityFor(type),
        content: createBlockContent(type),
      });
      setBlocks((current) => [...current.slice(0, index), created, ...current.slice(index)]);
      setFocusId(created.id);
    } catch (error) {
      fail('O bloco não foi criado', error);
    } finally {
      setStructureBusy(false);
    }
  };

  const moveBlock = async (from: number, to: number) => {
    if (from === to || to < 0 || to >= blocks.length) return;
    const previous = blocks;
    const next = moveItem(blocks, from, to);
    const moved = next[to];
    if (!moved) return;
    const position = positionBetween(next[to - 1]?.position ?? null, next[to + 1]?.position ?? null);
    next[to] = { ...moved, position };
    setBlocks(next);
    const client = getSupabaseBrowserClient();
    try {
      if (needsRenumbering(next.map((block) => block.position))) {
        await reorderSessionBlocks(client, session.id, next.map((block) => block.id));
        setBlocks(next.map((block, order) => ({ ...block, position: (order + 1) * 1024 })));
      } else {
        await updateSessionBlock(client, moved.id, { position });
      }
    } catch (error) {
      setBlocks(previous);
      fail('A nova ordem não foi salva', error);
    }
  };

  const removeBlock = async (blockId: string) => {
    try {
      await deleteSessionBlock(getSupabaseBrowserClient(), blockId);
    } catch (error) {
      throw new Error(failureMessage(error, 'O bloco não foi excluído.'));
    }
    setBlocks((current) => current.filter((block) => block.id !== blockId));
  };

  const onLocalChange = (blockId: string, draft: { visibility: SharedVisibility; content: SessionBlockContent }) =>
    setBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, ...draft } : block)));

  // Referências para a pré-visualização, montadas a partir das opções já carregadas.
  const previewReferences: BlockReferences = {
    creatures: Object.fromEntries(options.creatures.map((creature) => [creature.id, { name: creature.name, subtitle: creature.subtitle, kind: creature.kind }])),
    characters: Object.fromEntries(options.characters.map((character) => [character.id, { name: character.name }])),
    sessions: Object.fromEntries(options.sessions.map((entry) => [entry.id, { title: entry.title, number: entry.number }])),
    notes: Object.fromEntries(options.notes.map((note) => [note.id, { title: note.title }])),
  };

  const insertMenu = (index: number) => (
    <div className="rounded-lg border border-line-strong bg-raised p-3" role="group" aria-label="Escolha o tipo de bloco">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Inserir bloco</p>
        <Button size="sm" variant="ghost" onClick={() => setInsertAt(null)}>
          Cancelar
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {blockMenu.map((entry) => (
          <Button key={entry.type} size="sm" variant="secondary" className="justify-start" icon={entry.icon} disabled={structureBusy} onClick={() => void insertBlock(entry.type, index)}>
            {blockTypeLabels[entry.type]}
          </Button>
        ))}
      </div>
    </div>
  );

  const publicCount = blocks.filter((block) => block.visibility === 'members').length;

  return (
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg">Sessão {session.number}</h2>
            <SaveStatus status={meta.state.status} />
          </div>
          {meta.state.status === 'conflict' ? (
            <Alert tone="warning" className="mb-3">
              Outro mestre alterou estes dados. Recarregue a página para ver a versão atual.
            </Alert>
          ) : null}
          {meta.state.status === 'invalid' || meta.state.status === 'error' ? (
            <Alert tone="danger" className="mb-3">
              {meta.state.message}
            </Alert>
          ) : null}
          <div className="flex flex-col gap-4">
            <TextField id="session-title" label="Título" maxLength={120} value={meta.value.title} onChange={(event) => meta.update((current) => ({ ...current, title: event.target.value }))} />
            <DateTimeField
              id="session-date"
              label="Data e hora"
              hint="Horário de Brasília."
              value={meta.value.scheduledAt}
              onChange={(scheduledAt) => meta.update((current) => ({ ...current, scheduledAt }))}
            />
            <CheckboxField
              id="session-published"
              label="Publicada para os jogadores"
              description="Jogadores veem o resumo e os blocos públicos. Blocos privados nunca são enviados a eles. Com data marcada, quem usa o app recebe um aviso."
              checked={meta.value.isPublished}
              onChange={(event) => meta.update((current) => ({ ...current, isPublished: event.target.checked }))}
            />
            <CheckboxField
              id="session-physical-dice"
              label="Dados presenciais"
              description="A mesa rola dados físicos nesta sessão: as ações do turno não rolam no app, e o jogador pode anotar o resultado do dado. Vale só para esta sessão."
              checked={meta.value.physicalDice}
              onChange={(event) => meta.update((current) => ({ ...current, physicalDice: event.target.checked }))}
            />
            <TextareaField
              id="session-recap"
              label="Resumo para os jogadores"
              rows={5}
              maxLength={20000}
              hint="Visível aos jogadores quando a sessão estiver publicada."
              value={meta.value.recap}
              onChange={(event) => meta.update((current) => ({ ...current, recap: event.target.value }))}
            />
          </div>
        </Card>
        <p className="text-xs text-fg-muted">
          {blocks.length} blocos · {publicCount} públicos · {blocks.length - publicCount} privados. Tudo é salvo automaticamente.
        </p>
      </aside>

      <section aria-label="Roteiro" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-line-strong p-0.5" role="group" aria-label="Modo do editor">
            <Button size="sm" variant={mode === 'edit' ? 'secondary' : 'ghost'} aria-pressed={mode === 'edit'} onClick={() => setMode('edit')} icon={<PencilLine className="h-4 w-4" aria-hidden="true" />}>
              Editar
            </Button>
            <Button size="sm" variant={mode === 'preview' ? 'secondary' : 'ghost'} aria-pressed={mode === 'preview'} onClick={() => setMode('preview')} icon={<Eye className="h-4 w-4" aria-hidden="true" />}>
              Ver como jogador
            </Button>
          </div>
        </div>

        {mode === 'preview' ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            <Alert tone="info">
              Pré-visualização do que os jogadores recebem{meta.value.isPublished ? '' : ' quando a sessão for publicada'}: somente blocos públicos.
            </Alert>
            {blocks
              .filter((block) => block.visibility === 'members')
              .map((block) => (
                <BlockRenderer key={block.id} block={block} campaignId={campaignId} references={previewReferences} imageUrls={imageUrls} showVisibility={false} />
              ))}
          </div>
        ) : (
          <>
            {blocks.length === 0 ? (
              <EmptyState title="Roteiro vazio" description="Comece por um título, uma narração ou uma nota privada." />
            ) : (
              <ol className="flex flex-col gap-3">
                {blocks.map((block, index) =>
                  block.content ? (
                    <Fragment key={block.id}>
                      <BlockEditor
                        block={block as EditableBlock}
                        index={index}
                        total={blocks.length}
                        campaignId={campaignId}
                        sessionId={session.id}
                        options={options}
                        imageUrls={imageUrls}
                        autoFocus={focusId === block.id}
                        isDragTarget={dragOver === index && dragFrom !== index}
                        onLocalChange={onLocalChange}
                        onMove={(from, to) => void moveBlock(from, to)}
                        onRemove={removeBlock}
                        onInsertBelow={() => setInsertAt(index + 1)}
                        onImageUrl={(path, url) => setImageUrls((current) => ({ ...current, [path]: url }))}
                        dragHandlers={{
                          onDragStart: (event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', block.id);
                            setDragFrom(index);
                          },
                          onDragOver: (event) => {
                            if (dragFrom === null) return;
                            event.preventDefault();
                            setDragOver(index);
                          },
                          onDrop: (event) => {
                            event.preventDefault();
                            if (dragFrom !== null) void moveBlock(dragFrom, index);
                            setDragFrom(null);
                            setDragOver(null);
                          },
                          onDragEnd: () => {
                            setDragFrom(null);
                            setDragOver(null);
                          },
                        }}
                      />
                      {insertAt === index + 1 && insertAt < blocks.length ? <li>{insertMenu(index + 1)}</li> : null}
                    </Fragment>
                  ) : (
                    <li key={block.id} className="rounded-lg border border-ember-400/40 bg-card p-4 text-sm text-fg-muted">
                      Bloco “{block.type}” em formato desconhecido — não é editável nesta versão.
                    </li>
                  ),
                )}
              </ol>
            )}
            {insertAt === blocks.length ? (
              insertMenu(blocks.length)
            ) : (
              <Button variant="secondary" className="self-center" onClick={() => setInsertAt(blocks.length)} disabled={structureBusy}>
                Adicionar bloco ao final
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
