import { deleteCreature, getCampaign, getCreature, signedMediaUrls, updateCreature, updateCreatureGmData } from '@codexveil/database';
import { dnd5eStatBlockSchema, parseDnd5eStatBlock, type Dnd5eStatBlock } from '@codexveil/rpg-systems/dnd5e';
import { creatureGmDataSchema, creatureKindLabels, creatureSchema, fieldErrorsFrom, type FieldErrors } from '@codexveil/validation';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { StatBlockEditor, StatBlockView } from '@/components/library/stat-block';
import { Button } from '@/components/ui/button';
import { CheckRow } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';

interface ProfileForm {
  name: string;
  subtitle: string;
  description: string;
  revealed: boolean;
}

/** NPC ou monstro da biblioteca: perfil público, estatísticas e segredos (mestre). */
export default function CreatureScreen() {
  const { id, creatureId } = useLocalSearchParams<{ id: string; creatureId: string }>();
  const userId = useUserId();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [profile, setProfile] = useState<ProfileForm | null>(null);
  const [gm, setGm] = useState<{ notes: string; secrets: string; stats: Dnd5eStatBlock | null } | null>(null);
  const [editingStats, setEditingStats] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<'profile' | 'gm' | null>(null);

  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign) return null;
    const creature = await getCreature(supabase, creatureId, campaign.role === 'gm');
    if (!creature || creature.campaignId !== campaign.id) return null;
    const images = await signedMediaUrls(supabase, [creature.imagePath]);
    return { campaign, creature, imageUrl: creature.imagePath ? (images[creature.imagePath] ?? null) : null };
  }, `${id}:${creatureId}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Registro não encontrado" description="Ele não existe ou ainda não foi revelado." />
      </Screen>
    );
  }
  const { campaign, creature, imageUrl } = data;
  const isGm = campaign.role === 'gm';
  const canManage = isGm && campaign.status === 'active';
  const isDnd = campaign.systemId === 'dnd5e';
  let statBlock: Dnd5eStatBlock | null = null;
  if (creature.gm && isDnd) {
    try {
      statBlock = parseDnd5eStatBlock(creature.gm.stats);
    } catch {
      statBlock = null;
    }
  }
  const form: ProfileForm = profile ?? { name: creature.name, subtitle: creature.subtitle, description: creature.description, revealed: creature.visibility === 'members' };
  const gmForm = gm ?? { notes: creature.gm?.notes ?? '', secrets: creature.gm?.secrets ?? '', stats: statBlock };

  const saveProfile = async () => {
    const parsed = creatureSchema.safeParse({ ...form, kind: creature.kind, visibility: form.revealed ? 'members' : 'gm' });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy('profile');
    try {
      await updateCreature(getSupabase(), creature.id, parsed.data);
      toast({ tone: 'success', title: 'Perfil salvo.' });
      setProfile(null);
      reload();
    } catch (cause) {
      toast({ tone: 'danger', title: 'O perfil não foi salvo', description: failureMessage(cause) });
    } finally {
      setBusy(null);
    }
  };

  const saveGm = async () => {
    const texts = creatureGmDataSchema.safeParse({ notes: gmForm.notes, secrets: gmForm.secrets });
    const stats = gmForm.stats ? dnd5eStatBlockSchema.safeParse(gmForm.stats) : null;
    if (!texts.success || (stats && !stats.success)) {
      toast({ tone: 'danger', title: 'Revise os dados', description: (!texts.success ? texts.error.issues[0]?.message : stats && !stats.success ? stats.error.issues[0]?.message : undefined) ?? 'Valores inválidos.' });
      return;
    }
    setBusy('gm');
    try {
      await updateCreatureGmData(getSupabase(), creature.id, {
        notes: texts.data.notes,
        secrets: texts.data.secrets,
        stats: stats?.success ? stats.data : (creature.gm?.stats ?? {}),
      });
      toast({ tone: 'success', title: 'Dados do mestre salvos.' });
      setGm(null);
      setEditingStats(false);
      reload();
    } catch (cause) {
      toast({ tone: 'danger', title: 'Os dados não foram salvos', description: failureMessage(cause) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: `Excluir “${creature.name}”?`, message: 'O registro, as estatísticas e os segredos serão apagados.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteCreature(getSupabase(), creature.id);
      toast({ tone: 'info', title: 'Registro excluído.' });
      router.back();
    } catch (cause) {
      toast({ tone: 'danger', title: 'O registro não foi excluído', description: failureMessage(cause) });
    }
  };

  return (
    <Screen eyebrow={creatureKindLabels[creature.kind]} title={creature.name} subtitle={creature.subtitle || undefined} refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: creature.name }} />
      {imageUrl ? <Image source={{ uri: imageUrl }} accessibilityLabel={`Imagem de ${creature.name}`} style={{ width: '100%', aspectRatio: 1, borderRadius: radii.lg }} resizeMode="cover" /> : null}
      {isGm ? <Badge label={creature.visibility === 'gm' ? 'Oculto dos jogadores' : 'Revelado aos jogadores'} tone={creature.visibility === 'gm' ? 'warning' : 'success'} /> : null}
      {creature.description ? <AppText variant="serif">{creature.description}</AppText> : null}

      {canManage ? (
        <Card>
          <AppText variant="heading">Perfil público</AppText>
          <Field label="Nome" value={form.name} maxLength={80} onChangeText={(name) => setProfile({ ...form, name })} error={errors.name} />
          <Field label="Descrição curta" value={form.subtitle} maxLength={80} onChangeText={(subtitle) => setProfile({ ...form, subtitle })} error={errors.subtitle} />
          <Field label="Descrição" value={form.description} multiline maxLength={4000} onChangeText={(description) => setProfile({ ...form, description })} error={errors.description} />
          <CheckRow label="Revelar aos jogadores" description="Jogadores veem só nome, descrição e imagem." checked={form.revealed} onChange={(revealed) => setProfile({ ...form, revealed })} />
          <Button label="Salvar perfil" loading={busy === 'profile'} onPress={() => void saveProfile()} />
        </Card>
      ) : null}

      {isGm && creature.gm ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <AppText variant="heading" style={{ flex: 1 }}>
              Estatísticas
            </AppText>
            {canManage && gmForm.stats && !editingStats ? (
              <Button label="Editar" compact variant="ghost" icon={<Pencil size={14} color={colors.fgSecondary} />} onPress={() => setEditingStats(true)} />
            ) : null}
          </View>
          {gmForm.stats ? (
            editingStats ? (
              <StatBlockEditor value={gmForm.stats} onChange={(stats) => setGm({ ...gmForm, stats })} />
            ) : (
              <StatBlockView name={creature.name} statBlock={gmForm.stats} />
            )
          ) : (
            <AppText variant="muted">{isDnd ? 'As estatísticas não seguem o formato esperado.' : 'Sistema sem bloco de estatísticas.'}</AppText>
          )}
          {canManage ? (
            <>
              <Field label="Observações do mestre" value={gmForm.notes} multiline maxLength={8000} onChangeText={(notes) => setGm({ ...gmForm, notes })} />
              <Field label="Segredos" value={gmForm.secrets} multiline maxLength={8000} onChangeText={(secrets) => setGm({ ...gmForm, secrets })} />
              <Button label="Salvar dados do mestre" loading={busy === 'gm'} onPress={() => void saveGm()} />
            </>
          ) : null}
        </Card>
      ) : null}

      {canManage ? <Button label="Excluir da biblioteca" variant="danger" icon={<Trash2 size={16} color="#EC9384" />} onPress={() => void remove()} /> : null}
    </Screen>
  );
}
