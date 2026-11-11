'use client';

import {
  CAMPAIGN_MEDIA_BUCKET,
  createCampaignHandout,
  deleteCampaignHandout,
  handoutImagePath,
  setCampaignHandoutImage,
  setCampaignHandoutRevealed,
  updateCampaignHandout,
  type CampaignHandout,
  type HandoutAudience,
} from '@codexveil/database';
import { IMAGE_EXTENSIONS } from '@codexveil/validation';
import { Eye, EyeOff, Pencil, Plus, ScrollText, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CheckboxField, TextareaField, TextField } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { LiveBadge } from '@/components/ui/save-status';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { formatRelative } from '@/lib/format';
import { prepareImage } from '@/lib/images';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

interface PartyMember {
  id: string;
  name: string;
  ownerName: string;
}

interface HandoutsBoardProps {
  campaignId: string;
  handouts: CampaignHandout[];
  images: Record<string, string>;
  isGm: boolean;
  canWrite: boolean;
  party: PartyMember[];
}

/**
 * Revelações: o mestre entrega cartas, pistas, mapas achados e retratos de NPCs sem precisar
 * colocar no roteiro. Pode preparar antes (só ele vê) e revelar na hora, para todos ou para
 * alguns personagens. A lista atualiza sozinha para os jogadores.
 */
export function HandoutsBoard({ campaignId, handouts, images, isGm, canWrite, party }: HandoutsBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CampaignHandout | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const live = useRealtimeRefresh(`revelacoes:${campaignId}`, [{ table: 'campaign_handouts', filter: `campaign_id=eq.${campaignId}` }], () =>
    router.refresh(),
  );
  const names = new Map(party.map((member) => [member.id, member.name]));

  const toggleReveal = async (handout: CampaignHandout) => {
    setBusyId(handout.id);
    try {
      await setCampaignHandoutRevealed(getSupabaseBrowserClient(), handout.id, !handout.isRevealed);
      toast({ tone: 'success', title: handout.isRevealed ? 'Revelação escondida de novo.' : `“${handout.title}” revelada aos jogadores.` });
      router.refresh();
    } catch (error) {
      toast({ tone: 'danger', title: 'Não foi possível alterar', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (handout: CampaignHandout) => {
    const client = getSupabaseBrowserClient();
    await deleteCampaignHandout(client, handout.id);
    if (handout.imagePath) await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([handout.imagePath]);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-fg-muted">
          {isGm
            ? 'Entregue informações e imagens aos jogadores fora do roteiro: cartas, pistas, mapas achados, retratos de NPCs. Prepare antes e revele na hora certa, para todos ou só para alguns.'
            : 'O que o mestre revelou para você: cartas, pistas, imagens e informações da campanha.'}
        </p>
        <div className="flex items-center gap-2">
          <LiveBadge status={live} />
          {isGm && canWrite ? (
            <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setEditing('new')}>
              Nova revelação
            </Button>
          ) : null}
        </div>
      </div>

      {handouts.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6" aria-hidden="true" />}
          title={isGm ? 'Nenhuma revelação ainda' : 'Nada revelado ainda'}
          description={isGm ? 'Crie a primeira e revele quando os jogadores descobrirem.' : 'Quando o mestre revelar algo, aparece aqui na hora.'}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {handouts.map((handout) => {
            const imageUrl = handout.imagePath ? images[handout.imagePath] : undefined;
            return (
              <li key={handout.id}>
                <Card ornate className={handout.isRevealed ? 'animate-fade-up' : 'border-dashed opacity-80'}>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-xl">{handout.title}</h2>
                        <p className="text-xs text-fg-muted">
                          {handout.isRevealed && handout.revealedAt ? `Revelada ${formatRelative(handout.revealedAt)}` : 'Preparada: só o mestre vê'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {isGm ? (
                          handout.audience === 'all' ? (
                            <Badge tone="neutral">Todos</Badge>
                          ) : (
                            <Badge tone="brand" icon={<Users className="h-3 w-3" aria-hidden="true" />}>
                              {handout.characterIds.map((id) => names.get(id) ?? 'Personagem').join(', ')}
                            </Badge>
                          )
                        ) : handout.audience === 'characters' ? (
                          <Badge tone="brand">Só para você</Badge>
                        ) : null}
                      </div>
                    </div>
                    {imageUrl ? (
                      <a href={imageUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Storage. */}
                        <img src={imageUrl} alt={handout.title} className="max-h-[28rem] w-full object-contain bg-sunken" />
                      </a>
                    ) : null}
                    {handout.body ? <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-fg">{handout.body}</p> : null}
                    {isGm && canWrite ? (
                      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                        <Button
                          size="sm"
                          variant={handout.isRevealed ? 'secondary' : 'primary'}
                          loading={busyId === handout.id}
                          icon={handout.isRevealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                          onClick={() => void toggleReveal(handout)}
                        >
                          {handout.isRevealed ? 'Esconder' : 'Revelar agora'}
                        </Button>
                        <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" aria-hidden="true" />} onClick={() => setEditing(handout)}>
                          Editar
                        </Button>
                        <ConfirmDialog
                          trigger={(open) => (
                            <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} onClick={open}>
                              Excluir
                            </Button>
                          )}
                          title={`Excluir “${handout.title}”?`}
                          description="A revelação some para todos, junto com a imagem."
                          confirmLabel="Excluir"
                          onConfirm={() => remove(handout)}
                        />
                      </div>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <HandoutForm campaignId={campaignId} handout={editing === 'new' ? null : editing} party={party} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function HandoutForm({
  campaignId,
  handout,
  party,
  onClose,
}: {
  campaignId: string;
  handout: CampaignHandout | null;
  party: PartyMember[];
  onClose: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(handout?.title ?? '');
  const [body, setBody] = useState(handout?.body ?? '');
  const [audience, setAudience] = useState<HandoutAudience>(handout?.audience ?? 'all');
  const [characterIds, setCharacterIds] = useState<string[]>(handout?.characterIds ?? []);
  const [revealNow, setRevealNow] = useState(handout?.isRevealed ?? false);
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return setError('Dê um título à revelação.');
    if (audience === 'characters' && characterIds.length === 0) return setError('Escolha pelo menos um personagem.');
    setBusy(true);
    setError(null);
    const client = getSupabaseBrowserClient();
    try {
      const fields = { title, body, audience, characterIds, isRevealed: revealNow };
      const saved = handout ? await updateCampaignHandout(client, handout.id, fields) : await createCampaignHandout(client, campaignId, fields);
      const previous = handout?.imagePath ?? null;
      if (image) {
        const prepared = await prepareImage(image, 'creature');
        if (!prepared.ok) throw new Error(prepared.message);
        const path = handoutImagePath(campaignId, saved.id, `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`);
        const { error: uploadError } = await client.storage
          .from(CAMPAIGN_MEDIA_BUCKET)
          .upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
        if (uploadError) throw uploadError;
        await setCampaignHandoutImage(client, saved.id, path);
        if (previous) await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([previous]);
      } else if (removeImage && previous) {
        await setCampaignHandoutImage(client, saved.id, null);
        await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([previous]);
      }
      toast({ tone: 'success', title: revealNow ? 'Revelação publicada para os jogadores.' : 'Revelação preparada (só você vê).' });
      onClose();
      router.refresh();
    } catch (cause) {
      setError(failureMessage(cause, 'A revelação não foi salva.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} busy={busy} size="lg" title={handout ? 'Editar revelação' : 'Nova revelação'}>
      <div className="flex flex-col gap-4">
        <TextField id={`${id}-title`} label="Título" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Carta lacrada do barão" />
        <TextareaField
          id={`${id}-body`}
          label="Texto (opcional)"
          rows={6}
          maxLength={20000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          hint="O que os jogadores leem: a carta, a pista, a descrição do que encontraram."
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-image`} className="text-sm font-medium">
            Imagem (opcional)
          </label>
          <input
            id={`${id}-image`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              setImage(event.target.files?.[0] ?? null);
              setRemoveImage(false);
            }}
            className="text-sm text-fg-secondary file:mr-3 file:rounded-md file:border file:border-line file:bg-raised file:px-3 file:py-1.5 file:text-fg"
          />
          {handout?.imagePath && !image ? (
            <CheckboxField id={`${id}-remove`} label="Tirar a imagem atual" checked={removeImage} onChange={(event) => setRemoveImage(event.target.checked)} />
          ) : null}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Para quem</legend>
          <div className="flex flex-wrap gap-2">
            {(['all', 'characters'] as const).map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm has-[:checked]:border-parchment-300/70">
                <input type="radio" name={`${id}-audience`} checked={audience === option} onChange={() => setAudience(option)} className="accent-wine-500" />
                {option === 'all' ? 'Todos os jogadores' : 'Só alguns personagens'}
              </label>
            ))}
          </div>
          {audience === 'characters' ? (
            party.length === 0 ? (
              <p className="text-xs text-fg-muted">Nenhum personagem na campanha ainda.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {party.map((member) => (
                  <CheckboxField
                    key={member.id}
                    id={`${id}-char-${member.id}`}
                    label={member.name}
                    description={member.ownerName}
                    checked={characterIds.includes(member.id)}
                    onChange={(event) =>
                      setCharacterIds((current) => (event.target.checked ? [...current, member.id] : current.filter((entry) => entry !== member.id)))
                    }
                  />
                ))}
              </div>
            )
          ) : null}
        </fieldset>
        <CheckboxField
          id={`${id}-reveal`}
          label="Revelar agora"
          description="Desmarcado, fica preparada: só você vê até apertar “Revelar agora”."
          checked={revealNow}
          onChange={(event) => setRevealNow(event.target.checked)}
        />
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            {revealNow ? 'Salvar e revelar' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
