import {
  CAMPAIGN_MEDIA_BUCKET,
  campaignCoverPath,
  createCampaign,
  setCampaignCover,
} from '@codexveil/database';
import { DEFAULT_SYSTEM_ID, getSystem } from '@codexveil/rpg-systems';
import { defaultDnd5eCampaignRules, dnd5eCampaignRulesSchema } from '@codexveil/rpg-systems/dnd5e';
import { campaignCreateSchema, fieldErrorsFrom, type FieldErrors } from '@codexveil/validation';
import { useRouter } from 'expo-router';
import { ImageUp, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { Dnd5eRulesEditor } from '@/components/campaign-rules-editor';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { pickImage, type PickedImage } from '@/lib/images';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';

export default function NewCampaignScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState(defaultDnd5eCampaignRules);
  const [cover, setCover] = useState<Extract<PickedImage, { ok: true }> | null>(null);
  const toast = useToast();
  const system = getSystem(DEFAULT_SYSTEM_ID);

  const chooseCover = async () => {
    const picked = await pickImage('scene');
    if (!picked) return;
    if (!picked.ok) {
      setMessage(picked.message);
      return;
    }
    setCover(picked);
  };

  /** Envia a capa depois de criar a campanha; se falhar, a campanha continua criada. */
  const uploadCover = async (campaignId: string, image: Extract<PickedImage, { ok: true }>) => {
    const bucket = getSupabase().storage.from(CAMPAIGN_MEDIA_BUCKET);
    const path = campaignCoverPath(
      campaignId,
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${image.extension}`,
    );
    try {
      const { error } = await bucket.upload(path, image.bytes, {
        contentType: image.mimeType,
        upsert: false,
      });
      if (error) throw error;
      try {
        await setCampaignCover(getSupabase(), campaignId, path);
      } catch (cause) {
        await bucket.remove([path]);
        throw cause;
      }
    } catch (cause) {
      toast({
        tone: 'warning',
        title: 'Campanha criada, mas a capa não foi enviada',
        description: failureMessage(cause),
      });
    }
  };

  const submit = async () => {
    setMessage(null);
    const parsedRules = dnd5eCampaignRulesSchema.safeParse(rules);
    const parsed = campaignCreateSchema.safeParse({
      name,
      description,
      systemId: system.id,
      characterRules: parsedRules.success ? parsedRules.data : {},
    });
    if (!parsed.success || !parsedRules.success) {
      setErrors({
        ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)),
        ...(parsedRules.success
          ? {}
          : { rules: parsedRules.error.issues[0]?.message ?? 'Revise as regras.' }),
      });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const id = await createCampaign(getSupabase(), parsed.data);
      if (cover) await uploadCover(id, cover);
      router.replace({ pathname: '/campanha/[id]', params: { id } });
    } catch (error) {
      setMessage(failureMessage(error));
      setBusy(false);
    }
  };

  return (
    <Screen subtitle="Você será o mestre responsável. Depois, convide os jogadores.">
      {message ? <Notice tone="danger" message={message} /> : null}
      <Card ornate>
        <Field
          label="Nome da campanha"
          value={name}
          onChangeText={setName}
          maxLength={80}
          error={errors.name}
        />
        <Field
          label="Descrição (opcional)"
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
          multiline
          error={errors.description}
        />
        <AppText variant="muted">
          Capa (opcional): aparece no painel e na lista de campanhas de todos os participantes.
        </AppText>
        {cover ? (
          <Image
            source={{ uri: cover.uri }}
            accessibilityLabel="Capa escolhida"
            style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radii.md }}
            resizeMode="cover"
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          <Button
            label={cover ? 'Trocar capa' : 'Escolher capa'}
            compact
            variant="secondary"
            icon={<ImageUp size={14} color={colors.fg} />}
            onPress={() => void chooseCover()}
            style={{ flex: 1 }}
          />
          {cover ? (
            <Button
              label="Remover"
              compact
              variant="ghost"
              icon={<Trash2 size={14} color={colors.fgSecondary} />}
              onPress={() => setCover(null)}
            />
          ) : null}
        </View>
        <AppText variant="muted">
          Sistema: {system.name} ({system.rulesReference}). O sistema não pode ser trocado depois.
        </AppText>
        <Dnd5eRulesEditor value={rules} onChange={setRules} error={errors.rules} />
        <Button label="Criar campanha" onPress={() => void submit()} loading={busy} />
      </Card>
    </Screen>
  );
}
