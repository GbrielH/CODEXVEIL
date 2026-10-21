'use client';

import {
  CAMPAIGN_MEDIA_BUCKET,
  sessionImagePath,
  signedMediaUrls,
  updateSessionBlock,
  type StoredSessionBlock,
} from '@codexveil/database';
import {
  CALLOUT_TONES,
  blockTypeLabels,
  isAlwaysPrivate,
  type CalloutTone,
  type SessionBlockContent,
  type SharedVisibility,
} from '@codexveil/domain';
import { IMAGE_EXTENSIONS, sessionBlockSchema } from '@codexveil/validation';
import { ArrowDown, ArrowUp, GripVertical, ImageUp, Plus, Trash2, X } from 'lucide-react';
import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SaveStatus } from '@/components/ui/save-status';
import { Select } from '@/components/ui/select';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { prepareImage } from '@/lib/images';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useAutosave } from '@/lib/use-autosave';
import { calloutToneLabels } from './block-renderer';

export interface EditorOptions {
  creatures: { id: string; name: string; subtitle: string; kind: 'npc' | 'monster' }[];
  characters: { id: string; name: string }[];
  sessions: { id: string; number: number; title: string }[];
  notes: { id: string; title: string }[];
}

interface BlockDraft {
  visibility: SharedVisibility;
  content: SessionBlockContent;
  /** Marcado para liberar na mesa (aparece em "Lore da sessão"); senão é roteiro só do mestre. */
  revealable: boolean;
}

const inputClass =
  'w-full rounded-md border border-line-strong bg-sunken px-3 text-fg placeholder:text-fg-subtle focus-visible:border-parchment-300 focus-visible:outline-none';

function validateBlock(draft: BlockDraft): string | null {
  const parsed = sessionBlockSchema.safeParse(draft);
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Bloco inválido.');
}

function newItemId(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface BlockEditorProps {
  block: StoredSessionBlock & { content: SessionBlockContent };
  index: number;
  total: number;
  campaignId: string;
  sessionId: string;
  options: EditorOptions;
  imageUrls: Record<string, string>;
  autoFocus: boolean;
  isDragTarget: boolean;
  onLocalChange: (blockId: string, draft: BlockDraft) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (blockId: string) => Promise<void>;
  onInsertBelow: () => void;
  onImageUrl: (path: string, url: string) => void;
  dragHandlers: {
    onDragStart: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
    onDragEnd: () => void;
  };
}

/** Um bloco do roteiro em edição, com salvamento automático próprio. */
export function BlockEditor(props: BlockEditorProps) {
  const { block, index, total, onLocalChange, onMove, onRemove, onInsertBelow, dragHandlers } =
    props;
  const autosave = useAutosave<BlockDraft>({
    initial: { visibility: block.visibility, content: block.content, revealable: block.revealable },
    version: 0,
    delayMs: 700,
    save: async (draft) => {
      await updateSessionBlock(getSupabaseBrowserClient(), block.id, draft);
      return 0;
    },
    validate: validateBlock,
  });
  const draft = autosave.value;
  const forcedPrivate = isAlwaysPrivate(draft.content.type);

  const change = (next: Partial<BlockDraft>) => {
    autosave.update((current) => {
      const merged = { ...current, ...next };
      onLocalChange(block.id, merged);
      return merged;
    });
  };
  const setContent = (content: SessionBlockContent) => change({ content });

  return (
    <li
      className={cx(
        'group relative rounded-lg border bg-card p-3 shadow-card transition-colors sm:p-4',
        draft.visibility === 'gm' ? 'border-wine-400/50' : 'border-line',
        props.isDragTarget && 'ring-2 ring-parchment-300/60',
      )}
      onDragOver={dragHandlers.onDragOver}
      onDrop={dragHandlers.onDrop}
      aria-label={`Bloco ${index + 1} de ${total}: ${blockTypeLabels[draft.content.type]}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          draggable
          onDragStart={dragHandlers.onDragStart}
          onDragEnd={dragHandlers.onDragEnd}
          className="hidden cursor-grab text-fg-subtle hover:text-fg-secondary active:cursor-grabbing sm:inline-flex"
          title="Arraste para reordenar (ou use as setas)"
          aria-hidden="true"
        >
          <GripVertical className="h-5 w-5" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
          {blockTypeLabels[draft.content.type]}
        </span>
        <VisibilityToggle
          value={draft.visibility}
          locked={forcedPrivate}
          onChange={(visibility) => change({ visibility })}
        />
        {forcedPrivate || draft.content.type === 'divider' ? null : (
          <label
            className={cx(
              'flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
              draft.revealable ? 'border-parchment-300/60 bg-parchment-200/10 text-fg' : 'border-line-strong text-fg-muted hover:text-fg',
            )}
            title="Marcado: aparece na lista para liberar aos jogadores durante a sessão. Desmarcado: roteiro só seu."
          >
            <input type="checkbox" checked={draft.revealable} onChange={(event) => change({ revealable: event.target.checked })} className="h-3.5 w-3.5 accent-wine-500" />
            Para liberar na mesa
          </label>
        )}
        <SaveStatus status={autosave.state.status} className="ml-auto" />
        <div className="flex items-center">
          <Button
            size="icon"
            variant="ghost"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label="Mover bloco para cima"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label="Mover bloco para baixo"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          <ConfirmDialog
            trigger={(open) => (
              <Button size="icon" variant="ghost" onClick={open} aria-label="Excluir bloco">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            title="Excluir este bloco?"
            description="O conteúdo do bloco será apagado do roteiro."
            confirmLabel="Excluir bloco"
            onConfirm={() => onRemove(block.id)}
          />
        </div>
      </div>

      {autosave.state.status === 'invalid' || autosave.state.status === 'error' ? (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-danger" role="alert">
          {autosave.state.message}
          {autosave.state.status === 'error' ? (
            <Button size="sm" variant="ghost" onClick={() => void autosave.retry()}>
              Tentar de novo
            </Button>
          ) : null}
        </p>
      ) : null}

      <ContentFields {...props} content={draft.content} onChange={setContent} />

      <div className="mt-3 flex justify-center opacity-70 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Button
          size="sm"
          variant="ghost"
          onClick={onInsertBelow}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          Inserir bloco abaixo
        </Button>
      </div>
    </li>
  );
}

function VisibilityToggle({
  value,
  locked,
  onChange,
}: {
  value: SharedVisibility;
  locked: boolean;
  onChange: (value: SharedVisibility) => void;
}) {
  const name = useId();
  if (locked) {
    return (
      <span className="rounded-full border border-wine-400/50 bg-wine-950 px-2 py-0.5 text-[11px] text-wine-200">
        Sempre privado
      </span>
    );
  }
  return (
    <fieldset className="flex overflow-hidden rounded-full border border-line-strong text-[11px]">
      <legend className="sr-only">Quem vê este bloco</legend>
      {(
        [
          { value: 'members', label: 'Público' },
          { value: 'gm', label: 'Somente mestres' },
        ] as const
      ).map((option) => (
        <label
          key={option.value}
          className={cx(
            'cursor-pointer px-2.5 py-1 transition-colors focus-within:ring-2 focus-within:ring-parchment-300',
            value === option.value
              ? option.value === 'gm'
                ? 'bg-wine-800 text-wine-100'
                : 'bg-hover text-fg'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

interface ContentFieldsProps extends BlockEditorProps {
  content: SessionBlockContent;
  onChange: (content: SessionBlockContent) => void;
}

function Labeled({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-fg-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

function ContentFields(props: ContentFieldsProps) {
  const { content, onChange, autoFocus, options } = props;
  const id = useId();

  switch (content.type) {
    case 'heading':
    case 'subheading':
      return (
        <input
          aria-label={blockTypeLabels[content.type]}
          autoFocus={autoFocus}
          value={content.data.text}
          maxLength={200}
          placeholder={content.type === 'heading' ? 'Título da seção' : 'Subtítulo'}
          onChange={(event) => onChange({ type: content.type, data: { text: event.target.value } })}
          className={cx(
            inputClass,
            'h-12 font-display',
            content.type === 'heading' ? 'text-2xl' : 'text-lg',
          )}
        />
      );
    case 'paragraph':
    case 'gm_note':
      return (
        <textarea
          aria-label={blockTypeLabels[content.type]}
          autoFocus={autoFocus}
          value={content.data.text}
          maxLength={20000}
          rows={Math.min(16, Math.max(3, content.data.text.split('\n').length + 1))}
          placeholder={
            content.type === 'gm_note'
              ? 'Segredos, revelações futuras, motivações ocultas…'
              : 'Escreva a narração ou os acontecimentos…'
          }
          onChange={(event) => onChange({ type: content.type, data: { text: event.target.value } })}
          className={cx(
            inputClass,
            'py-2 font-serif text-lg leading-relaxed',
            content.type === 'gm_note' && 'border-dashed border-wine-400/60',
          )}
        />
      );
    case 'callout':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <Labeled label="Estilo" htmlFor={`${id}-tone`}>
              <Select
                id={`${id}-tone`}
                value={content.data.tone}
                onChange={(event) =>
                  onChange({
                    type: 'callout',
                    data: { ...content.data, tone: event.target.value as CalloutTone },
                  })
                }
              >
                {CALLOUT_TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {calloutToneLabels[tone]}
                  </option>
                ))}
              </Select>
            </Labeled>
            <Labeled label="Título (opcional)" htmlFor={`${id}-title`}>
              <input
                id={`${id}-title`}
                value={content.data.title ?? ''}
                maxLength={200}
                onChange={(event) =>
                  onChange({
                    type: 'callout',
                    data: { ...content.data, title: event.target.value || null },
                  })
                }
                className={cx(inputClass, 'h-11')}
              />
            </Labeled>
          </div>
          <Labeled label="Texto" htmlFor={`${id}-text`}>
            <textarea
              id={`${id}-text`}
              autoFocus={autoFocus}
              value={content.data.text}
              maxLength={20000}
              rows={4}
              onChange={(event) =>
                onChange({ type: 'callout', data: { ...content.data, text: event.target.value } })
              }
              className={cx(inputClass, 'py-2 font-serif leading-relaxed')}
            />
          </Labeled>
        </div>
      );
    case 'image':
      return <ImageFields {...props} content={content} />;
    case 'divider':
      return <p className="text-sm text-fg-muted">Separador ornamental entre partes do roteiro.</p>;
    case 'list':
      return (
        <div className="flex flex-col gap-3">
          <Labeled label="Estilo" htmlFor={`${id}-style`} className="sm:max-w-48">
            <Select
              id={`${id}-style`}
              value={content.data.style}
              onChange={(event) =>
                onChange({
                  type: 'list',
                  data: {
                    ...content.data,
                    style: event.target.value === 'numbered' ? 'numbered' : 'bulleted',
                  },
                })
              }
            >
              <option value="bulleted">Marcadores</option>
              <option value="numbered">Numerada</option>
            </Select>
          </Labeled>
          <Labeled label="Itens (um por linha)" htmlFor={`${id}-items`}>
            <textarea
              id={`${id}-items`}
              autoFocus={autoFocus}
              value={content.data.items.join('\n')}
              rows={Math.min(14, Math.max(3, content.data.items.length + 1))}
              onChange={(event) =>
                onChange({
                  type: 'list',
                  data: { ...content.data, items: event.target.value.split('\n').slice(0, 200) },
                })
              }
              className={cx(inputClass, 'py-2 leading-relaxed')}
            />
          </Labeled>
        </div>
      );
    case 'checklist':
      return (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            {content.data.items.map((item, itemIndex) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.checked}
                  aria-label={`Concluído: ${item.text || `item ${itemIndex + 1}`}`}
                  onChange={(event) =>
                    onChange({
                      type: 'checklist',
                      data: {
                        items: content.data.items.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, checked: event.target.checked }
                            : entry,
                        ),
                      },
                    })
                  }
                  className="h-5 w-5 shrink-0 accent-wine-500"
                />
                <input
                  value={item.text}
                  maxLength={2000}
                  aria-label={`Texto do item ${itemIndex + 1}`}
                  autoFocus={autoFocus && itemIndex === content.data.items.length - 1}
                  onChange={(event) =>
                    onChange({
                      type: 'checklist',
                      data: {
                        items: content.data.items.map((entry) =>
                          entry.id === item.id ? { ...entry, text: event.target.value } : entry,
                        ),
                      },
                    })
                  }
                  className={cx(inputClass, 'h-10 text-sm')}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover item ${itemIndex + 1}`}
                  onClick={() =>
                    onChange({
                      type: 'checklist',
                      data: { items: content.data.items.filter((entry) => entry.id !== item.id) },
                    })
                  }
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            disabled={content.data.items.length >= 200}
            onClick={() =>
              onChange({
                type: 'checklist',
                data: {
                  items: [...content.data.items, { id: newItemId(), text: '', checked: false }],
                },
              })
            }
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Adicionar item
          </Button>
        </div>
      );
    case 'npc_ref':
    case 'monster_ref': {
      const kind = content.type === 'npc_ref' ? 'npc' : 'monster';
      const choices = options.creatures.filter((creature) => creature.kind === kind);
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled
            label={kind === 'npc' ? 'NPC da biblioteca' : 'Monstro da biblioteca'}
            htmlFor={`${id}-target`}
          >
            <Select
              id={`${id}-target`}
              value={content.data.creatureId}
              onChange={(event) =>
                onChange({
                  type: content.type,
                  data: { ...content.data, creatureId: event.target.value },
                })
              }
            >
              <option value="">Escolha…</option>
              {choices.map((creature) => (
                <option key={creature.id} value={creature.id}>
                  {creature.name}
                  {creature.subtitle ? ` — ${creature.subtitle}` : ''}
                </option>
              ))}
            </Select>
            {choices.length === 0 ? (
              <span className="text-xs text-fg-muted">
                Cadastre registros na Biblioteca da campanha.
              </span>
            ) : null}
          </Labeled>
          <Labeled label="Observação (opcional)" htmlFor={`${id}-note`}>
            <input
              id={`${id}-note`}
              value={content.data.note ?? ''}
              maxLength={500}
              onChange={(event) =>
                onChange({
                  type: content.type,
                  data: { ...content.data, note: event.target.value || null },
                })
              }
            />
          </Labeled>
        </div>
      );
    }
    case 'character_ref':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Personagem" htmlFor={`${id}-target`}>
            <Select
              id={`${id}-target`}
              value={content.data.characterId}
              onChange={(event) =>
                onChange({
                  type: 'character_ref',
                  data: { ...content.data, characterId: event.target.value },
                })
              }
            >
              <option value="">Escolha…</option>
              {options.characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Observação (opcional)" htmlFor={`${id}-note`}>
            <input
              id={`${id}-note`}
              value={content.data.note ?? ''}
              maxLength={500}
              onChange={(event) =>
                onChange({
                  type: 'character_ref',
                  data: { ...content.data, note: event.target.value || null },
                })
              }
            />
          </Labeled>
        </div>
      );
    case 'content_ref': {
      const targets =
        content.data.kind === 'session'
          ? options.sessions.map((session) => ({
              id: session.id,
              label: `Sessão ${session.number}: ${session.title}`,
            }))
          : options.notes.map((note) => ({ id: note.id, label: note.title }));
      return (
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr_1fr]">
          <Labeled label="Tipo" htmlFor={`${id}-kind`}>
            <Select
              id={`${id}-kind`}
              value={content.data.kind}
              onChange={(event) =>
                onChange({
                  type: 'content_ref',
                  data: {
                    ...content.data,
                    kind: event.target.value === 'note' ? 'note' : 'session',
                    targetId: '',
                  },
                })
              }
            >
              <option value="session">Sessão</option>
              <option value="note">Anotação</option>
            </Select>
          </Labeled>
          <Labeled label="Conteúdo" htmlFor={`${id}-target`}>
            <Select
              id={`${id}-target`}
              value={content.data.targetId}
              onChange={(event) =>
                onChange({
                  type: 'content_ref',
                  data: { ...content.data, targetId: event.target.value },
                })
              }
            >
              <option value="">Escolha…</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Observação (opcional)" htmlFor={`${id}-note`}>
            <input
              id={`${id}-note`}
              value={content.data.note ?? ''}
              maxLength={500}
              onChange={(event) =>
                onChange({
                  type: 'content_ref',
                  data: { ...content.data, note: event.target.value || null },
                })
              }
            />
          </Labeled>
        </div>
      );
    }
  }
}

function ImageFields({
  content,
  onChange,
  campaignId,
  sessionId,
  imageUrls,
  onImageUrl,
}: ContentFieldsProps & { content: Extract<SessionBlockContent, { type: 'image' }> }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = content.data.path ? imageUrls[content.data.path] : undefined;

  const upload = async (original: File) => {
    setError(null);
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const prepared = await prepareImage(original, 'scene');
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }
      const path = sessionImagePath(
        campaignId,
        sessionId,
        `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`,
      );
      const { error: uploadError } = await client.storage
        .from(CAMPAIGN_MEDIA_BUCKET)
        .upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
      if (uploadError) throw uploadError;
      const signed = await signedMediaUrls(client, [path]);
      if (signed[path]) onImageUrl(path, signed[path]);
      onChange({ type: 'image', data: { ...content.data, path } });
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível enviar a imagem.'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={content.data.alt}
          className="max-h-72 w-full rounded-md border border-line object-contain"
        />
      ) : (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-line-strong text-sm text-fg-muted">
          Nenhuma imagem enviada
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Escolher imagem"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          onClick={() => inputRef.current?.click()}
          icon={<ImageUp className="h-4 w-4" aria-hidden="true" />}
        >
          {content.data.path ? 'Trocar imagem' : 'Enviar imagem'}
        </Button>
        <span className="text-xs text-fg-muted">PNG, JPEG ou WebP, até 5 MB.</span>
      </div>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Texto alternativo (descreva a imagem)" htmlFor={`${id}-alt`}>
          <input
            id={`${id}-alt`}
            value={content.data.alt}
            maxLength={300}
            onChange={(event) =>
              onChange({ type: 'image', data: { ...content.data, alt: event.target.value } })
            }
          />
        </Labeled>
        <Labeled label="Legenda (opcional)" htmlFor={`${id}-caption`}>
          <input
            id={`${id}-caption`}
            value={content.data.caption ?? ''}
            maxLength={500}
            onChange={(event) =>
              onChange({
                type: 'image',
                data: { ...content.data, caption: event.target.value || null },
              })
            }
          />
        </Labeled>
      </div>
    </div>
  );
}
