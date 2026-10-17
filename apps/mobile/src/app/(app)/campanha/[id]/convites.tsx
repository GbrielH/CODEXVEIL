import { createCampaignInvite, getCampaign, listCampaignInvites, revokeCampaignInvite, type CampaignInvite } from '@codexveil/database';
import { formatInviteCode, inviteStatusLabels } from '@codexveil/domain';
import { fieldErrorsFrom, inviteCreateSchema, type FieldErrors } from '@codexveil/validation';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Share2, Ticket, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase, siteUrl } from '@/lib/supabase';
import { colors, fonts, spacing } from '@/lib/theme';

const DAY_OPTIONS = [1, 7, 14, 30] as const;
const USE_OPTIONS: (number | null)[] = [1, 5, 10, null];

/** Convites da campanha (mestre): criar com prazo e usos, compartilhar e revogar. */
export default function InvitesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const toast = useToast();
  const confirm = useConfirm();
  const [days, setDays] = useState<number>(7);
  const [uses, setUses] = useState<number | null>(1);
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign || campaign.role !== 'gm') return null;
    return { campaign, invites: await listCampaignInvites(supabase, campaign.id) };
  }, `${id}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Sem acesso" description="Só os mestres gerenciam convites." />
      </Screen>
    );
  }
  const { campaign, invites } = data;
  const canManage = campaign.status === 'active';

  const share = async (code: string) => {
    const formatted = formatInviteCode(code);
    await Share.share({ message: `Você foi convidado para a campanha “${campaign.name}” no Codexveil. Código: ${formatted}\n${siteUrl}/convite/${formatted}` });
  };

  const create = async () => {
    const parsed = inviteCreateSchema.safeParse({ expiresInDays: days, maxUses: uses, invitedEmail: email.trim() ? email.trim() : null });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const created = await createCampaignInvite(getSupabase(), campaign.id, parsed.data);
      setEmail('');
      reload();
      await share(created.code);
    } catch (cause) {
      toast({ tone: 'danger', title: 'O convite não foi criado', description: failureMessage(cause) });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (invite: CampaignInvite) => {
    const ok = await confirm({ title: 'Revogar o convite?', message: `O código ${formatInviteCode(invite.code)} deixa de funcionar.`, confirmLabel: 'Revogar', tone: 'danger' });
    if (!ok) return;
    try {
      await revokeCampaignInvite(getSupabase(), invite.id);
      reload();
    } catch (cause) {
      toast({ tone: 'danger', title: 'O convite não foi revogado', description: failureMessage(cause) });
    }
  };

  return (
    <Screen eyebrow={campaign.name} title="Convites" refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: 'Convites' }} />
      {canManage ? (
        <Card ornate>
          <AppText variant="heading">Novo convite</AppText>
          <AppText variant="small" style={{ color: colors.fg }}>
            Vale por
          </AppText>
          <ChipRow>
            {DAY_OPTIONS.map((option) => (
              <Chip key={option} label={option === 1 ? '1 dia' : `${option} dias`} selected={days === option} onPress={() => setDays(option)} />
            ))}
          </ChipRow>
          <AppText variant="small" style={{ color: colors.fg }}>
            Usos
          </AppText>
          <ChipRow>
            {USE_OPTIONS.map((option) => (
              <Chip key={String(option)} label={option === null ? 'Ilimitado' : option === 1 ? '1 pessoa' : `${option} pessoas`} selected={uses === option} onPress={() => setUses(option)} />
            ))}
          </ChipRow>
          <Field
            label="E-mail (convite pessoal, opcional)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.invitedEmail}
            hint="Só a conta com este e-mail confirmado poderá aceitar."
          />
          <Button label="Criar e compartilhar" loading={busy} icon={<Share2 size={16} color={colors.primaryFg} />} onPress={() => void create()} />
        </Card>
      ) : null}
      {invites.length === 0 ? <EmptyState title="Nenhum convite" description="Crie um convite e envie o código aos jogadores." /> : null}
      {invites.map((invite) => (
        <Card key={invite.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Ticket size={18} color={colors.fgAccent} />
            <AppText style={{ flex: 1, fontFamily: fonts.display, fontSize: 18, color: colors.fgAccent, letterSpacing: 1 }}>{formatInviteCode(invite.code)}</AppText>
            <Badge label={inviteStatusLabels[invite.status]} tone={invite.status === 'active' ? 'success' : 'neutral'} />
          </View>
          <AppText variant="small">
            {invite.invitedEmail ? `Para ${invite.invitedEmail} · ` : ''}
            {invite.maxUses === null ? `${invite.usesCount} usos` : `${invite.usesCount} de ${invite.maxUses} usos`} · até {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}
          </AppText>
          {invite.status === 'active' && canManage ? (
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <Button label="Compartilhar" compact variant="secondary" icon={<Share2 size={14} color={colors.fg} />} onPress={() => void share(invite.code)} style={{ flex: 1 }} />
              <Button label="Revogar" compact variant="ghost" icon={<XCircle size={14} color={colors.fgSecondary} />} onPress={() => void revoke(invite)} style={{ flex: 1 }} />
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
