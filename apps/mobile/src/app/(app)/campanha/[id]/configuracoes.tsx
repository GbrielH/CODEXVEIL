import { archiveCampaign, getCampaign, unarchiveCampaign, updateCampaign, updateCampaignTurnSettings, type CampaignTurnSettings } from '@codexveil/database';
import { TURN_MODES, TURN_ORDER_MODES, turnModeLabels, turnOrderModeLabels } from '@codexveil/domain';
import { dnd5eCampaignRulesSchema, parseDnd5eCampaignRules, type Dnd5eCampaignRules } from '@codexveil/rpg-systems/dnd5e';
import { campaignUpdateSchema, fieldErrorsFrom, type FieldErrors } from '@codexveil/validation';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Archive, ArchiveRestore } from 'lucide-react-native';
import { useState } from 'react';
import { Dnd5eRulesEditor } from '@/components/campaign-rules-editor';
import { Button } from '@/components/ui/button';
import { CheckRow, Chip, ChipRow } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

interface SettingsForm {
  name: string;
  description: string;
  partySheetsVisible: boolean;
  playersCanEditSheets: boolean;
  rules: Dnd5eCampaignRules;
}

/** Configurações da campanha (mestre): dados, regras da mesa, turnos e arquivamento. */
export default function CampaignSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [turns, setTurns] = useState<CampaignTurnSettings | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<'settings' | 'turns' | 'archive' | null>(null);

  const { data: campaign, error, loading, refreshing, reload } = useAsyncData(() => getCampaign(getSupabase(), id, userId), `${id}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !campaign) return <ErrorState message={error} onRetry={reload} />;
  if (!campaign || campaign.role !== 'gm') {
    return (
      <Screen>
        <EmptyState title="Sem acesso" description="Só os mestres alteram as configurações." />
      </Screen>
    );
  }
  const archived = campaign.status === 'archived';
  const isDnd = campaign.systemId === 'dnd5e';
  const current: SettingsForm = form ?? {
    name: campaign.name,
    description: campaign.description,
    partySheetsVisible: campaign.settings.partySheetsVisible,
    playersCanEditSheets: campaign.settings.playersCanEditSheets,
    rules: isDnd ? parseDnd5eCampaignRules(campaign.characterRules) : parseDnd5eCampaignRules({}),
  };
  const turnForm = turns ?? campaign.turnSettings;

  const save = async () => {
    const rules = dnd5eCampaignRulesSchema.safeParse(current.rules);
    const parsed = campaignUpdateSchema.safeParse({
      name: current.name,
      description: current.description,
      partySheetsVisible: current.partySheetsVisible,
      playersCanEditSheets: current.playersCanEditSheets,
      ...(isDnd && rules.success ? { characterRules: rules.data } : {}),
    });
    if (!parsed.success || (isDnd && !rules.success)) {
      setErrors({
        ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)),
        ...(rules.success ? {} : { rules: rules.error.issues[0]?.message ?? 'Revise as regras.' }),
      });
      return;
    }
    setErrors({});
    setBusy('settings');
    try {
      await updateCampaign(getSupabase(), campaign.id, parsed.data);
      toast({ tone: 'success', title: 'Configurações salvas.' });
      setForm(null);
      reload();
    } catch (cause) {
      toast({ tone: 'danger', title: 'As configurações não foram salvas', description: failureMessage(cause) });
    } finally {
      setBusy(null);
    }
  };

  const saveTurns = async () => {
    setBusy('turns');
    try {
      await updateCampaignTurnSettings(getSupabase(), campaign.id, turnForm);
      toast({ tone: 'success', title: 'Turnos salvos.' });
      setTurns(null);
      reload();
    } catch (cause) {
      toast({ tone: 'danger', title: 'Os turnos não foram salvos', description: failureMessage(cause) });
    } finally {
      setBusy(null);
    }
  };

  const toggleArchive = async () => {
    const ok = await confirm(
      archived
        ? { title: 'Reabrir a campanha?', message: 'Mestres e jogadores voltam a poder alterar o conteúdo.', confirmLabel: 'Reabrir' }
        : { title: 'Arquivar a campanha?', message: 'Tudo fica preservado, mas ninguém pode alterar nada até reabrir.', confirmLabel: 'Arquivar', tone: 'danger' },
    );
    if (!ok) return;
    setBusy('archive');
    try {
      if (archived) await unarchiveCampaign(getSupabase(), campaign.id);
      else await archiveCampaign(getSupabase(), campaign.id);
      reload();
    } catch (cause) {
      toast({ tone: 'danger', title: 'A campanha não mudou', description: failureMessage(cause) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen eyebrow={campaign.name} title="Configurações" refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: 'Configurações' }} />
      <Card ornate>
        <AppText variant="heading">Dados e regras da mesa</AppText>
        <Field label="Nome" value={current.name} maxLength={80} editable={!archived} onChangeText={(name) => setForm({ ...current, name })} error={errors.name} />
        <Field label="Descrição" value={current.description} multiline maxLength={2000} editable={!archived} onChangeText={(description) => setForm({ ...current, description })} error={errors.description} />
        <CheckRow
          label="Fichas do grupo visíveis"
          description="Jogadores podem consultar as fichas dos outros personagens."
          checked={current.partySheetsVisible}
          disabled={archived}
          onChange={(partySheetsVisible) => setForm({ ...current, partySheetsVisible })}
        />
        <CheckRow
          label="Jogadores editam a construção da ficha"
          description="Desmarcado, só vida, recursos, condições e inventário seguem editáveis."
          checked={current.playersCanEditSheets}
          disabled={archived}
          onChange={(playersCanEditSheets) => setForm({ ...current, playersCanEditSheets })}
        />
        {isDnd ? <Dnd5eRulesEditor value={current.rules} onChange={(rules) => setForm({ ...current, rules })} error={errors.rules} /> : null}
        <Button label="Salvar" loading={busy === 'settings'} disabled={archived || form === null} onPress={() => void save()} />
      </Card>

      <Card>
        <AppText variant="heading">Turnos</AppText>
        <AppText variant="muted">Como a mesa do mestre começa os turnos. O modo pode mudar a qualquer momento.</AppText>
        <AppText variant="small" style={{ color: colors.fg }}>
          Modo padrão
        </AppText>
        <ChipRow>
          {TURN_MODES.map((mode) => (
            <Chip key={mode} label={turnModeLabels[mode]} selected={turnForm.defaultMode === mode} disabled={archived} onPress={() => setTurns({ ...turnForm, defaultMode: mode })} />
          ))}
        </ChipRow>
        <AppText variant="small" style={{ color: colors.fg }}>
          Ordem dos turnos
        </AppText>
        <ChipRow>
          {TURN_ORDER_MODES.map((mode) => (
            <Chip key={mode} label={turnOrderModeLabels[mode]} selected={turnForm.defaultOrder === mode} disabled={archived} onPress={() => setTurns({ ...turnForm, defaultOrder: mode })} />
          ))}
        </ChipRow>
        <CheckRow
          label="Jogadores veem a ordem completa"
          description="Desmarcado, eles só sabem de quem é a vez. Participantes ocultos nunca aparecem."
          checked={turnForm.playersSeeOrder}
          disabled={archived}
          onChange={(playersSeeOrder) => setTurns({ ...turnForm, playersSeeOrder })}
        />
        <Button label="Salvar turnos" loading={busy === 'turns'} disabled={archived || turns === null} onPress={() => void saveTurns()} />
      </Card>

      {campaign.isOwner ? (
        <Card style={{ borderColor: 'rgba(226, 109, 90, 0.4)' }}>
          <AppText variant="heading">{archived ? 'Campanha arquivada' : 'Arquivar campanha'}</AppText>
          <AppText variant="muted">Transferir a campanha ou excluí-la de vez: pelo site, em Configurações.</AppText>
          <Button
            label={archived ? 'Reabrir campanha' : 'Arquivar campanha'}
            variant={archived ? 'secondary' : 'danger'}
            loading={busy === 'archive'}
            icon={archived ? <ArchiveRestore size={16} color={colors.fg} /> : <Archive size={16} color="#EC9384" />}
            onPress={() => void toggleArchive()}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
