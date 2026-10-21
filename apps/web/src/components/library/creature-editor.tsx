'use client';

import {
  CAMPAIGN_MEDIA_BUCKET,
  creatureImagePath,
  setCreatureImage,
  updateCreature,
  updateCreatureGmData,
} from '@codexveil/database';
import {
  ABILITIES,
  CHALLENGE_RATINGS,
  CREATURE_SIZES,
  abilityLabels,
  creatureSizeLabels,
  dnd5eStatBlockSchema,
  type CreatureSize,
  type Dnd5eStatBlock,
  type StatBlockEntry,
  ALIGNMENTS,
  withCurrentOption,
} from '@codexveil/rpg-systems/dnd5e';
import {
  creatureGmDataSchema,
  creatureSchema,
  fieldErrorsFrom,
  IMAGE_EXTENSIONS,
  type FieldErrors,
} from '@codexveil/validation';
import { TOKEN_SIZES, tokenSizeLabels, type TokenSize } from '@codexveil/domain';
import { ImageUp, Lock, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { deleteCreatureAction } from '@/app/(app)/campanhas/[campaignId]/biblioteca/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckboxField, SelectField, TextareaField, TextField } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { NumberInput } from '@/components/ui/number-input';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { prepareImage } from '@/lib/images';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { StatBlockView } from './stat-block-view';

interface CreatureEditorProps {
  campaignId: string;
  creature: {
    id: string;
    kind: 'npc' | 'monster';
    name: string;
    subtitle: string;
    description: string;
    visibility: 'members' | 'gm';
    imagePath: string | null;
    imageUrl: string | null;
    /** Porte (tamanho do token na grade). */
    size: TokenSize;
  };
  systemId: string;
  gm: { notes: string; secrets: string };
  /** `null` quando o sistema da campanha não tem bloco de estatísticas na interface. */
  statBlock: Dnd5eStatBlock | null;
}

export function CreatureEditor({
  campaignId,
  creature,
  gm,
  statBlock,
  systemId,
}: CreatureEditorProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <ProfileCard
          campaignId={campaignId}
          creature={creature}
          systemId={systemId}
          sizeInStats={statBlock !== null}
        />
        <DangerCard campaignId={campaignId} creatureId={creature.id} name={creature.name} />
      </div>
      <GmDataCard creatureId={creature.id} name={creature.name} gm={gm} statBlock={statBlock} />
    </div>
  );
}

function ProfileCard({
  campaignId,
  creature,
  systemId,
  sizeInStats,
}: Pick<CreatureEditorProps, 'campaignId' | 'creature' | 'systemId'> & {
  /** D&D: o porte é editado no bloco de estatísticas (que atualiza o token sozinho). */
  sizeInStats: boolean;
}) {
  const sizeLabels = tokenSizeLabels(systemId);
  const router = useRouter();
  const { toast } = useToast();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: creature.name,
    subtitle: creature.subtitle,
    description: creature.description,
    revealed: creature.visibility === 'members',
    size: creature.size,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const save = async () => {
    const parsed = creatureSchema.safeParse({
      ...form,
      kind: creature.kind,
      visibility: form.revealed ? 'members' : 'gm',
    });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await updateCreature(getSupabaseBrowserClient(), creature.id, parsed.data);
      toast({ tone: 'success', title: 'Perfil salvo.' });
      router.refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'O perfil não foi salvo',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (original: File) => {
    setImageError(null);
    setImageBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const prepared = await prepareImage(original, 'creature');
      if (!prepared.ok) {
        setImageError(prepared.message);
        return;
      }
      const path = creatureImagePath(
        campaignId,
        `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`,
      );
      const { error } = await client.storage
        .from(CAMPAIGN_MEDIA_BUCKET)
        .upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
      if (error) throw error;
      try {
        await setCreatureImage(client, creature.id, path);
      } catch (cause) {
        await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([path]);
        throw cause;
      }
      if (creature.imagePath)
        await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([creature.imagePath]);
      toast({ tone: 'success', title: 'Imagem atualizada.' });
      router.refresh();
    } catch (error) {
      setImageError(failureMessage(error, 'Não foi possível enviar a imagem.'));
    } finally {
      setImageBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Card ornate>
      <CardHeader
        title="Perfil público"
        description="O que os jogadores veem quando o registro é revelado."
      />
      <div className="mb-4 flex items-center gap-4">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-sunken">
          {creature.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Storage
            <img
              src={creature.imageUrl}
              alt={`Imagem de ${creature.name}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageUp className="h-8 w-8 text-fg-subtle" aria-hidden="true" />
          )}
        </div>
        <p className="text-sm text-fg-muted">
          {creature.imageUrl ? 'Imagem atual do registro.' : 'Sem imagem ainda.'} Use “
          {creature.imagePath ? 'Trocar imagem' : 'Enviar imagem'}” abaixo (PNG, JPEG ou WebP; a
          imagem é reduzida antes do envio).
        </p>
      </div>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id={`${id}-name`}
            label="Nome"
            required
            maxLength={80}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            error={errors.name}
          />
          <TextField
            id={`${id}-subtitle`}
            label="Descrição curta"
            maxLength={80}
            value={form.subtitle}
            onChange={(event) =>
              setForm((current) => ({ ...current, subtitle: event.target.value }))
            }
            error={errors.subtitle}
          />
        </div>
        {sizeInStats ? (
          <p className="text-xs text-fg-muted">
            Tamanho: <strong className="text-fg">{sizeLabels[creature.size]}</strong> (defina no
            bloco de estatísticas; ele define o tamanho do token na grade).
          </p>
        ) : (
          <SelectField
            id={`${id}-size`}
            label="Tamanho"
            value={form.size}
            onChange={(event) =>
              setForm((current) => ({ ...current, size: event.target.value as TokenSize }))
            }
            hint="Tamanho do token na grade da sessão (cada quadrado = 1,5 m)."
            error={errors.size}
          >
            {TOKEN_SIZES.map((size) => (
              <option key={size} value={size}>
                {sizeLabels[size]}
              </option>
            ))}
          </SelectField>
        )}
        <TextareaField
          id={`${id}-description`}
          label="Descrição"
          rows={5}
          maxLength={4000}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          error={errors.description}
        />
        <CheckboxField
          id={`${id}-revealed`}
          label="Revelado aos jogadores"
          description="Somente nome, descrição e imagem. Estatísticas, notas e segredos continuam exclusivos dos mestres."
          checked={form.revealed}
          onChange={(event) =>
            setForm((current) => ({ ...current, revealed: event.target.checked }))
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={busy}>
            Salvar perfil
          </Button>
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
            variant="secondary"
            loading={imageBusy}
            onClick={() => inputRef.current?.click()}
            icon={<ImageUp className="h-4 w-4" aria-hidden="true" />}
          >
            {creature.imagePath ? 'Trocar imagem' : 'Enviar imagem'}
          </Button>
        </div>
        {imageError ? (
          <p className="text-xs text-danger" role="alert">
            {imageError}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

function DangerCard({
  campaignId,
  creatureId,
  name,
}: {
  campaignId: string;
  creatureId: string;
  name: string;
}) {
  return (
    <Card className="border-ember-400/40">
      <CardHeader
        title="Excluir registro"
        description="Instâncias já colocadas em cenas continuam, mas perdem o vínculo com este registro."
      />
      <ConfirmDialog
        trigger={(open) => (
          <Button
            variant="danger"
            onClick={open}
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          >
            Excluir da biblioteca
          </Button>
        )}
        title={`Excluir “${name}”?`}
        description="O registro, as estatísticas e os segredos serão apagados."
        confirmLabel="Excluir registro"
        onConfirm={async () => {
          const result = await deleteCreatureAction(campaignId, creatureId);
          if (!result.ok) throw new Error(result.message);
        }}
      />
    </Card>
  );
}

function GmDataCard({
  creatureId,
  name,
  gm,
  statBlock,
}: Pick<CreatureEditorProps, 'gm' | 'statBlock'> & { creatureId: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const id = useId();
  const [notes, setNotes] = useState(gm.notes);
  const [secrets, setSecrets] = useState(gm.secrets);
  const [stats, setStats] = useState<Dnd5eStatBlock | null>(statBlock);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Dnd5eStatBlock>) =>
    setStats((current) => (current ? { ...current, ...patch } : current));

  const save = async () => {
    const texts = creatureGmDataSchema.safeParse({ notes, secrets });
    const parsedStats = stats ? dnd5eStatBlockSchema.safeParse(stats) : null;
    if (!texts.success || (parsedStats && !parsedStats.success)) {
      setErrors({
        ...(texts.success ? {} : fieldErrorsFrom(texts.error)),
        ...(parsedStats && !parsedStats.success
          ? { stats: parsedStats.error.issues[0]?.message ?? 'Estatísticas inválidas.' }
          : {}),
      });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await updateCreatureGmData(getSupabaseBrowserClient(), creatureId, {
        notes: texts.data.notes,
        secrets: texts.data.secrets,
        stats: parsedStats?.success ? parsedStats.data : {},
      });
      toast({ tone: 'success', title: 'Dados do mestre salvos.' });
      router.refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Os dados não foram salvos',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-wine-400/40">
      <CardHeader
        icon={<Lock className="h-5 w-5" aria-hidden="true" />}
        title="Dados do mestre"
        description="Nunca enviados aos jogadores, nem quando o registro é revelado."
      />
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextareaField
          id={`${id}-secrets`}
          label="Segredos"
          rows={3}
          maxLength={8000}
          value={secrets}
          onChange={(event) => setSecrets(event.target.value)}
          error={errors.secrets}
          hint="Motivações ocultas, verdadeira identidade, o que só será revelado depois."
        />
        <TextareaField
          id={`${id}-notes`}
          label="Observações"
          rows={3}
          maxLength={8000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          error={errors.notes}
        />

        {stats ? (
          <fieldset className="flex flex-col gap-4 rounded-md border border-line p-3">
            <legend className="px-1 text-sm font-medium">Estatísticas (D&amp;D 5e)</legend>
            {errors.stats ? <Alert tone="danger">{errors.stats}</Alert> : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField
                id={`${id}-size`}
                label="Tamanho"
                value={stats.size}
                onChange={(event) => set({ size: event.target.value as CreatureSize })}
              >
                {CREATURE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {creatureSizeLabels[size]}
                  </option>
                ))}
              </SelectField>
              <TextField
                id={`${id}-type`}
                label="Tipo"
                placeholder="Morto-vivo"
                maxLength={60}
                value={stats.creatureType}
                onChange={(event) => set({ creatureType: event.target.value })}
              />
              <SelectField
                id={`${id}-alignment`}
                label="Alinhamento"
                value={stats.alignment}
                onChange={(event) => set({ alignment: event.target.value })}
              >
                <option value="">Escolha…</option>
                {withCurrentOption(
                  [...ALIGNMENTS.map((alignment) => alignment.name), 'Sem alinhamento', 'Qualquer alinhamento'],
                  stats.alignment,
                ).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-ac`} className="text-sm font-medium">
                  CA
                </label>
                <NumberInput
                  id={`${id}-ac`}
                  value={stats.armorClass}
                  min={0}
                  max={50}
                  onCommit={(value) => set({ armorClass: value ?? 10 })}
                />
              </div>
              <TextField
                id={`${id}-armor-note`}
                label="Armadura"
                maxLength={80}
                value={stats.armorNote}
                onChange={(event) => set({ armorNote: event.target.value })}
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-hp`} className="text-sm font-medium">
                  PV
                </label>
                <NumberInput
                  id={`${id}-hp`}
                  value={stats.hitPoints}
                  min={1}
                  max={9999}
                  onCommit={(value) => set({ hitPoints: value ?? 1 })}
                />
              </div>
              <TextField
                id={`${id}-hp-formula`}
                label="Fórmula"
                placeholder="5d8"
                maxLength={40}
                value={stats.hitPointFormula}
                onChange={(event) => set({ hitPointFormula: event.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
              <TextField
                id={`${id}-speed`}
                label="Deslocamento"
                placeholder="9 m, voo 18 m"
                maxLength={120}
                value={stats.speed}
                onChange={(event) => set({ speed: event.target.value })}
              />
              <SelectField
                id={`${id}-cr`}
                label="Nível de desafio"
                value={stats.challengeRating}
                onChange={(event) => set({ challengeRating: event.target.value })}
              >
                {CHALLENGE_RATINGS.map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {ABILITIES.map((ability) => (
                <div key={ability} className="flex flex-col gap-1.5">
                  <label htmlFor={`${id}-${ability}`} className="text-center text-xs font-semibold">
                    {abilityLabels[ability].abbreviation}
                  </label>
                  <NumberInput
                    id={`${id}-${ability}`}
                    value={stats.abilities[ability]}
                    min={1}
                    max={30}
                    onCommit={(value) =>
                      set({ abilities: { ...stats.abilities, [ability]: value ?? 10 } })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['savingThrows', 'Testes de resistência', 200],
                  ['skills', 'Perícias', 300],
                  ['damageResistances', 'Resistências a dano', 300],
                  ['damageImmunities', 'Imunidades a dano', 300],
                  ['conditionImmunities', 'Imunidades a condições', 300],
                  ['senses', 'Sentidos', 200],
                  ['languages', 'Idiomas', 200],
                ] as const
              ).map(([key, label, max]) => (
                <TextField
                  key={key}
                  id={`${id}-${key}`}
                  label={label}
                  maxLength={max}
                  value={stats[key]}
                  onChange={(event) => set({ [key]: event.target.value })}
                />
              ))}
            </div>
            {(
              [
                ['traits', 'Características'],
                ['actions', 'Ações'],
                ['bonusActions', 'Ações bônus'],
                ['reactions', 'Reações'],
                ['legendaryActions', 'Ações lendárias'],
              ] as const
            ).map(([key, label]) => (
              <EntryList
                key={key}
                id={`${id}-${key}`}
                label={label}
                entries={stats[key]}
                onChange={(entries) => set({ [key]: entries })}
              />
            ))}
          </fieldset>
        ) : null}

        <div>
          <Button type="submit" loading={busy}>
            Salvar dados do mestre
          </Button>
        </div>
      </form>
      {stats ? (
        <div className="mt-6">
          <StatBlockView name={name} statBlock={stats} />
        </div>
      ) : null}
    </Card>
  );
}

function EntryList({
  id,
  label,
  entries,
  onChange,
}: {
  id: string;
  label: string;
  entries: StatBlockEntry[];
  onChange: (entries: StatBlockEntry[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      {entries.map((entry, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-md border border-line p-2">
          <div className="flex gap-2">
            <input
              aria-label={`${label}: nome ${index + 1}`}
              value={entry.name}
              maxLength={80}
              placeholder="Nome"
              onChange={(event) =>
                onChange(
                  entries.map((item, position) =>
                    position === index ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
              className="h-10 min-w-0 flex-1 rounded-md border border-line-strong bg-sunken px-3 text-sm text-fg"
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Remover ${entry.name || `item ${index + 1}`}`}
              onClick={() => onChange(entries.filter((_, position) => position !== index))}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <textarea
            aria-label={`${label}: descrição ${index + 1}`}
            value={entry.description}
            maxLength={4000}
            rows={2}
            onChange={(event) =>
              onChange(
                entries.map((item, position) =>
                  position === index ? { ...item, description: event.target.value } : item,
                ),
              )
            }
            className="rounded-md border border-line-strong bg-sunken px-3 py-2 text-sm text-fg"
          />
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        className="self-start"
        disabled={entries.length >= 40}
        onClick={() => onChange([...entries, { name: '', description: '' }])}
        icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        id={`${id}-add`}
      >
        Adicionar
      </Button>
    </div>
  );
}
