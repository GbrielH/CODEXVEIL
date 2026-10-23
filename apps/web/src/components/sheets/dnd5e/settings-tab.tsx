'use client';

import {
  CAMPAIGN_MEDIA_BUCKET,
  characterPortraitPath,
  deleteCharacter,
  setCharacterCampaign,
  setCharacterPortrait,
} from '@codexveil/database';
import { dnd5eCampaignIssues, parseDnd5eCampaignRules } from '@codexveil/rpg-systems/dnd5e';
import { IMAGE_EXTENSIONS } from '@codexveil/validation';
import { ImageUp, Link2, Trash2, Unlink } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { Portrait } from '@/components/characters/portrait';
import { TokenImageCard } from '@/components/characters/token-image-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SelectField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { prepareImage } from '@/lib/images';
import { routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useSheet } from './context';

export function SettingsTab({
  campaigns,
}: {
  campaigns: { id: string; name: string; characterRules?: unknown }[];
}) {
  const { permissions, character } = useSheet();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {permissions.canEditSheet ? <PortraitCard /> : null}
      {permissions.canEditSheet ? <TokenImageCard characterId={character.id} portraitUrl={character.portraitUrl} /> : null}
      {permissions.isOwner ? <CampaignCard campaigns={campaigns} /> : null}
      {permissions.isOwner ? <DangerCard /> : null}
    </div>
  );
}

function PortraitCard() {
  const { character, name, adoptVersion } = useSheet();
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (original: File) => {
    setError(null);
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const prepared = await prepareImage(original, 'portrait');
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }
      const path = characterPortraitPath(
        character.id,
        `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`,
      );
      const { error: uploadError } = await client.storage
        .from(CAMPAIGN_MEDIA_BUCKET)
        .upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
      if (uploadError) throw uploadError;
      try {
        adoptVersion(await setCharacterPortrait(client, character.id, path));
      } catch (cause) {
        await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([path]);
        throw cause;
      }
      if (character.portraitPath)
        await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([character.portraitPath]);
      toast({ tone: 'success', title: 'Retrato atualizado.' });
      router.refresh();
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível enviar a imagem.'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!character.portraitPath) return;
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      adoptVersion(await setCharacterPortrait(client, character.id, null));
      await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([character.portraitPath]);
      toast({ tone: 'success', title: 'Retrato removido.' });
      router.refresh();
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível remover o retrato.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Retrato"
        description="Visível para quem pode ver a ficha. PNG, JPEG ou WebP, até 5 MB."
      />
      <div className="flex items-center gap-4">
        <Portrait name={name} url={character.portraitUrl} size="lg" />
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
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
            {character.portraitPath ? 'Trocar retrato' : 'Enviar retrato'}
          </Button>
          {character.portraitPath ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void remove()}
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            >
              Remover
            </Button>
          ) : null}
          {error ? (
            <p className="text-xs font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function CampaignCard({
  campaigns,
}: {
  campaigns: { id: string; name: string; characterRules?: unknown }[];
}) {
  const { character, name, sheet } = useSheet();
  const router = useRouter();
  const { toast } = useToast();
  const id = useId();
  const [selected, setSelected] = useState('');
  const chosen = campaigns.find((campaign) => campaign.id === selected);
  // O que impede a entrada na campanha escolhida, com o que mudar na ficha.
  const issues = chosen
    ? dnd5eCampaignIssues({ name, sheet }, parseDnd5eCampaignRules(chosen.characterRules))
    : [];

  const link = async (campaignId: string | null) => {
    try {
      await setCharacterCampaign(getSupabaseBrowserClient(), character.id, campaignId);
    } catch (cause) {
      throw new Error(failureMessage(cause, 'Não foi possível alterar a campanha.'));
    }
    toast({
      tone: 'success',
      title: campaignId ? 'Personagem vinculado à campanha.' : 'Personagem desvinculado.',
    });
    router.refresh();
  };

  const options = campaigns.filter((campaign) => campaign.id !== character.campaign?.id);

  return (
    <Card>
      <CardHeader
        title="Campanha"
        description={
          character.campaign
            ? `Vinculado a “${character.campaign.name}”.`
            : 'Ficha pessoal, sem campanha.'
        }
      />
      <div className="flex flex-col gap-3">
        {options.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <SelectField
              id={`${id}-campaign`}
              label="Vincular a"
              hint="Só aparecem campanhas do mesmo sistema da ficha. A ficha precisa seguir as regras e os livros escolhidos pelo mestre."
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              fieldClassName="flex-1"
            >
              <option value="">Escolha uma campanha…</option>
              {options.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </SelectField>
            <ConfirmDialog
              trigger={(open) => (
                <Button
                  variant="secondary"
                  disabled={!selected || issues.length > 0}
                  onClick={open}
                  icon={<Link2 className="h-4 w-4" aria-hidden="true" />}
                >
                  Vincular
                </Button>
              )}
              title="Vincular o personagem?"
              description="Os mestres da campanha passam a ver e poder editar a ficha. Se o personagem estiver em outra campanha, sairá dela (e de combates em andamento)."
              confirmLabel="Vincular"
              tone="primary"
              onConfirm={() => link(selected)}
            />
          </div>
        ) : (
          <p className="text-sm text-fg-muted">Nenhuma outra campanha ativa com o mesmo sistema.</p>
        )}
        {issues.length > 0 ? (
          <Alert tone="warning" title={`Antes de entrar em “${chosen?.name ?? ''}”, ajuste:`}>
            <ul className="list-disc pl-5">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {character.campaign ? (
          <ConfirmDialog
            trigger={(open) => (
              <Button
                variant="ghost"
                onClick={open}
                icon={<Unlink className="h-4 w-4" aria-hidden="true" />}
                className="self-start"
              >
                Desvincular da campanha
              </Button>
            )}
            title="Desvincular da campanha?"
            description="O personagem continua seu, mas deixa de aparecer para o grupo e para os mestres."
            confirmLabel="Desvincular"
            onConfirm={() => link(null)}
          />
        ) : null}
      </div>
    </Card>
  );
}

function DangerCard() {
  const { character, name } = useSheet();
  const router = useRouter();
  const remove = async () => {
    const client = getSupabaseBrowserClient();
    try {
      await deleteCharacter(client, character.id);
    } catch (cause) {
      throw new Error(failureMessage(cause, 'Não foi possível excluir o personagem.'));
    }
    if (character.portraitPath)
      await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([character.portraitPath]);
    router.replace(`${routes.characters}?aviso=personagem-excluido` as Route);
    router.refresh();
  };
  return (
    <Card className="border-ember-400/40 lg:col-span-2">
      <CardHeader
        title="Excluir personagem"
        description="Apaga a ficha, o inventário, as habilidades e o histórico. Não pode ser desfeito."
      />
      <ConfirmDialog
        trigger={(open) => (
          <Button
            variant="danger"
            onClick={open}
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          >
            Excluir definitivamente
          </Button>
        )}
        title={`Excluir “${name}”?`}
        description="Todos os dados do personagem serão apagados para sempre."
        confirmLabel="Excluir personagem"
        requireText={name}
        onConfirm={remove}
      />
    </Card>
  );
}
