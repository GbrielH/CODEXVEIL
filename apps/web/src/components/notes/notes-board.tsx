'use client';

import {
  CAMPAIGN_MEDIA_BUCKET,
  createCampaignNote,
  noteImagePath,
  setCampaignNoteImage,
  deleteCampaignNote,
  setCampaignNotePinned,
  updateCampaignNote,
  type CampaignNote,
} from '@codexveil/database';
import {
  CONTENT_VISIBILITIES,
  visibilityDescriptions,
  visibilityLabels,
  type ContentVisibility,
} from '@codexveil/domain';
import {
  IMAGE_EXTENSIONS,
  fieldErrorsFrom,
  noteSchema,
  type FieldErrors,
} from '@codexveil/validation';
import {
  Globe,
  Lock,
  NotebookPen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { MenuButton } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { SelectField, TextareaField, TextField } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { cx } from '@/lib/cx';
import { formatRelative } from '@/lib/format';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { prepareImage } from '@/lib/images';

interface NotesBoardProps {
  campaignId: string;
  notes: CampaignNote[];
  /** URLs assinadas das imagens das anotações (caminho → URL). */
  images?: Record<string, string>;
  currentUserId: string;
  isGm: boolean;
  canWrite: boolean;
}

const visibilityIcons: Record<ContentVisibility, ReactNode> = {
  members: <Globe className="h-3 w-3" aria-hidden="true" />,
  gm: <Lock className="h-3 w-3" aria-hidden="true" />,
  author: <UserRound className="h-3 w-3" aria-hidden="true" />,
};

/** Mural de anotações. O banco só entrega as notas que o usuário pode ver. */
export function NotesBoard({
  campaignId,
  notes,
  images = {},
  currentUserId,
  isGm,
  canWrite,
}: NotesBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CampaignNote | 'new' | null>(null);

  const [deleting, setDeleting] = useState<CampaignNote | null>(null);

  const togglePin = async (note: CampaignNote) => {
    try {
      await setCampaignNotePinned(getSupabaseBrowserClient(), note, currentUserId, !note.isPinned);
      toast({
        tone: 'success',
        title: note.isPinned ? 'Anotação desafixada.' : 'Anotação fixada no topo.',
      });
      router.refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível fixar',
        description: failureMessage(error, 'Tente novamente.'),
      });
    }
  };

  const remove = async (note: CampaignNote) => {
    try {
      await deleteCampaignNote(getSupabaseBrowserClient(), note.id);
    } catch (error) {
      throw new Error(failureMessage(error, 'A anotação não foi excluída.'));
    }
    toast({ tone: 'success', title: 'Anotação excluída.' });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">Anotações</h2>
          <p className="text-sm text-fg-muted">
            Registros da campanha. Escolha quem pode ler cada anotação.
          </p>
        </div>
        {canWrite ? (
          <Button
            onClick={() => setEditing('new')}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Nova anotação
          </Button>
        ) : null}
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={<NotebookPen className="h-8 w-8" aria-hidden="true" />}
          title="Nenhuma anotação"
          description="Mapas, pistas, nomes e acontecimentos importantes cabem aqui."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {notes.map((note) => {
            const mine = note.authorId === currentUserId;
            const canDelete = canWrite && (mine || (isGm && note.visibility === 'members'));
            return (
              <li
                key={note.id}
                id={`nota-${note.id}`}
                className={cx(
                  'parchment flex flex-col rounded-lg px-5 py-4',
                  note.isPinned && 'ring-2 ring-wine-500/60',
                )}
              >
                <div className="flex items-start gap-2">
                  <h3 className="min-w-0 flex-1 font-display text-lg text-ink">
                    {note.isPinned ? (
                      <Pin className="mr-1 inline h-4 w-4 text-wine-700" aria-label="Fixada" />
                    ) : null}
                    {note.title}
                  </h3>
                  {canWrite && (mine || canDelete) ? (
                    <MenuButton
                      label={`Opções de ${note.title}`}
                      className="text-ink"
                      items={[
                        ...(mine
                          ? [
                              {
                                label: note.isPinned ? 'Desafixar' : 'Fixar no topo',
                                icon: note.isPinned ? (
                                  <PinOff className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <Pin className="h-4 w-4" aria-hidden="true" />
                                ),
                                onSelect: () => void togglePin(note),
                              },
                              {
                                label: 'Editar',
                                icon: <Pencil className="h-4 w-4" aria-hidden="true" />,
                                onSelect: () => setEditing(note),
                              },
                            ]
                          : []),
                        ...(canDelete
                          ? [
                              {
                                label: 'Excluir',
                                tone: 'danger' as const,
                                icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
                                onSelect: () => setDeleting(note),
                              },
                            ]
                          : []),
                      ]}
                    />
                  ) : null}
                </div>
                {note.imagePath && images[note.imagePath] ? (
                  // URL assinada e temporária do Storage privado.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={images[note.imagePath]}
                    alt=""
                    className="mt-2 max-h-64 w-full rounded-md border border-line object-contain"
                  />
                ) : null}
                {note.body ? (
                  <p className="mt-2 line-clamp-[12] whitespace-pre-line font-serif leading-relaxed text-ink">
                    {note.body}
                  </p>
                ) : null}
                <p className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-xs text-ink-muted">
                  <span>
                    {note.authorName} · {formatRelative(note.updatedAt)}
                  </span>
                  <Badge
                    tone={note.visibility === 'members' ? 'neutral' : 'brand'}
                    icon={visibilityIcons[note.visibility]}
                  >
                    {note.visibility === 'members'
                      ? 'Geral'
                      : note.visibility === 'author'
                        ? 'Pessoal'
                        : visibilityLabels[note.visibility]}
                  </Badge>
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <NoteFormModal campaignId={campaignId} note={editing} onClose={() => setEditing(null)} />
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting ? `Excluir “${deleting.title}”?` : 'Excluir'}
        size="md"
      >
        <p className="text-sm text-fg-secondary">A anotação será apagada para todos.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const target = deleting;
              setDeleting(null);
              if (target)
                void remove(target).catch((error: unknown) =>
                  toast({
                    tone: 'danger',
                    title: error instanceof Error ? error.message : 'A anotação não foi excluída.',
                  }),
                );
            }}
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function NoteFormModal({
  campaignId,
  note,
  onClose,
}: {
  campaignId: string;
  note: CampaignNote | 'new' | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const id = useId();
  const isNew = note === 'new';
  const [form, setForm] = useState({
    title: '',
    body: '',
    visibility: 'members' as ContentVisibility,
    isPinned: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<CampaignNote | 'new' | null>(null);
  /** Imagem escolhida (enviada ao salvar) ou pedido de tirar a atual. */
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  if (note !== openedFor) {
    setOpenedFor(note);
    setErrors({});
    setImage(null);
    setRemoveImage(false);
    setForm(
      note && note !== 'new'
        ? {
            title: note.title,
            body: note.body,
            visibility: note.visibility,
            isPinned: note.isPinned,
          }
        : { title: '', body: '', visibility: 'members', isPinned: false },
    );
  }

  const submit = async () => {
    const parsed = noteSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const noteId =
        isNew || !note
          ? await createCampaignNote(client, campaignId, parsed.data)
          : (await updateCampaignNote(client, note.id, note.version, parsed.data), note.id);
      const previous = note && note !== 'new' ? note.imagePath : null;
      if (image) {
        const prepared = await prepareImage(image, 'creature');
        if (!prepared.ok) throw new Error(prepared.message);
        const path = noteImagePath(
          campaignId,
          noteId,
          `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`,
        );
        const { error } = await client.storage
          .from(CAMPAIGN_MEDIA_BUCKET)
          .upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
        if (error) throw error;
        await setCampaignNoteImage(client, noteId, path);
        if (previous) await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([previous]);
      } else if (removeImage && previous) {
        await setCampaignNoteImage(client, noteId, null);
        await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([previous]);
      }
      toast({ tone: 'success', title: isNew ? 'Anotação criada.' : 'Anotação salva.' });
      onClose();
      router.refresh();
    } catch (error) {
      setErrors({ _form: failureMessage(error, 'A anotação não foi salva.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={note !== null}
      onClose={onClose}
      title={isNew ? 'Nova anotação' : 'Editar anotação'}
      busy={busy}
      size="lg"
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {errors._form ? (
          <p className="text-sm text-danger" role="alert">
            {errors._form}
          </p>
        ) : null}
        <TextField
          id={`${id}-title`}
          label="Título"
          required
          maxLength={120}
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          error={errors.title}
        />
        <TextareaField
          id={`${id}-body`}
          label="Texto"
          rows={8}
          maxLength={20000}
          value={form.body}
          onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
          error={errors.body}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Imagem (opcional)</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              setImage(event.target.files?.[0] ?? null);
              setRemoveImage(false);
            }}
            className="text-sm text-fg-secondary file:mr-3 file:rounded-md file:border file:border-line file:bg-raised file:px-3 file:py-1.5 file:text-fg"
          />
          {note && note !== 'new' && note.imagePath && !image ? (
            <label className="flex items-center gap-2 text-xs text-fg-muted">
              <input
                type="checkbox"
                checked={removeImage}
                onChange={(event) => setRemoveImage(event.target.checked)}
              />
              Tirar a imagem atual
            </label>
          ) : null}
          <span className="text-xs text-fg-muted">
            PNG, JPG ou WebP; a imagem é reduzida antes do envio.
          </span>
        </div>
        <SelectField
          id={`${id}-visibility`}
          label="Quem pode ler"
          hint={visibilityDescriptions[form.visibility]}
          value={form.visibility}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              visibility: event.target.value as ContentVisibility,
            }))
          }
        >
          {CONTENT_VISIBILITIES.map((visibility) => (
            <option key={visibility} value={visibility}>
              {visibilityLabels[visibility]}
            </option>
          ))}
        </SelectField>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" loading={busy}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
