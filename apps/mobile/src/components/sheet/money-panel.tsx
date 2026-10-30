import { listMoneyLog, recordMoney, type CharacterResource, type MoneyLogEntry } from '@codexveil/database';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { AppText, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';

export interface MoneyCurrency {
  key: string;
  label: string;
  amount: number;
}

/**
 * Moedas no app (D&D e Tormenta20), como no site: saldo, gastar e receber sempre com valor e
 * descrição, e o histórico. `ensure` cria a trilha da moeda em fichas antigas.
 */
export function MoneyPanel({
  characterId,
  currencies,
  canEdit,
  onChanged,
  ensure,
  title = 'Moedas',
}: {
  characterId: string;
  currencies: MoneyCurrency[];
  canEdit: boolean;
  onChanged: (resource: CharacterResource) => void;
  ensure?: (key: string) => Promise<void>;
  title?: string;
}) {
  const toast = useToast();
  const [key, setKey] = useState(currencies[0]?.key ?? '');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<MoneyLogEntry[] | null>(null);
  const [showLog, setShowLog] = useState(false);
  const labelOf = (resourceKey: string) => currencies.find((currency) => currency.key === resourceKey)?.label ?? resourceKey;

  useEffect(() => {
    listMoneyLog(getSupabase(), characterId)
      .then(setLog)
      .catch(() => setLog([]));
  }, [characterId]);

  const amount = Math.floor(Number(value) || 0);
  const ready = amount > 0 && description.trim().length > 0;
  const submit = async (sign: 1 | -1) => {
    if (!ready) return;
    setBusy(true);
    try {
      if (ensure) await ensure(key);
      const saved = await recordMoney(getSupabase(), characterId, key, sign * amount, description.trim());
      onChanged(saved);
      setLog(await listMoneyLog(getSupabase(), characterId));
      setValue('');
      setDescription('');
      toast({ tone: 'success', title: sign > 0 ? `Recebeu ${amount} ${labelOf(key)}.` : `Gastou ${amount} ${labelOf(key)}.` });
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <AppText variant="heading">{title}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {currencies.map((currency) => (
          <AppText key={currency.key}>
            <AppText variant="small">{currency.label} </AppText>
            {currency.amount.toLocaleString('pt-BR')}
          </AppText>
        ))}
      </View>
      {canEdit ? (
        <View style={{ gap: spacing[2] }}>
          {currencies.length > 1 ? (
            <ChipRow>
              {currencies.map((currency) => (
                <Chip key={currency.key} label={currency.label} selected={key === currency.key} role="radio" onPress={() => setKey(currency.key)} />
              ))}
            </ChipRow>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <TextInput
              value={value}
              onChangeText={(text) => setValue(text.replace(/[^0-9]/g, '').slice(0, 9))}
              keyboardType="number-pad"
              placeholder="Valor"
              placeholderTextColor={colors.fgMuted}
              accessibilityLabel="Valor"
              style={[styles.input, { width: 90 }]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={200}
              placeholder="Descrição"
              placeholderTextColor={colors.fgMuted}
              accessibilityLabel="Descrição"
              style={[styles.input, { flex: 1 }]}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <Button compact variant="secondary" label="Gastar" disabled={!ready} loading={busy} onPress={() => void submit(-1)} />
            <Button compact variant="secondary" label="Receber" disabled={!ready} loading={busy} onPress={() => void submit(1)} />
          </View>
        </View>
      ) : null}
      <Button compact variant="ghost" label={showLog ? 'Esconder histórico' : `Histórico${log?.length ? ` (${log.length})` : ''}`} onPress={() => setShowLog(!showLog)} />
      {showLog
        ? (log ?? []).map((entry) => (
            <View key={entry.id} style={{ flexDirection: 'row', gap: spacing[2] }}>
              <AppText variant="small" style={{ color: entry.amount > 0 ? colors.fgAccent : colors.fgSecondary, minWidth: 70 }}>
                {entry.amount > 0 ? '+' : '−'}
                {Math.abs(entry.amount)} {labelOf(entry.resourceKey)}
              </AppText>
              <AppText variant="small" style={{ flex: 1, color: colors.fg }}>
                {entry.description}
              </AppText>
            </View>
          ))
        : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing[2],
    paddingVertical: 8,
    color: colors.fg,
  },
});
