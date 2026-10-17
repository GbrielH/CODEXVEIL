'use client';

import { updateCampaignTurnSettings, type CampaignTurnSettings } from '@codexveil/database';
import { TURN_MODES, TURN_ORDER_MODES, turnModeLabels, turnOrderModeLabels, type TurnMode, type TurnOrderMode } from '@codexveil/domain';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckboxField, SelectField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Como os turnos começam nesta campanha e o que os jogadores veem. */
export function TurnSettingsForm({ campaignId, initial, disabled }: { campaignId: string; initial: CampaignTurnSettings; disabled: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const id = useId();
  const [settings, setSettings] = useState(initial);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateCampaignTurnSettings(getSupabaseBrowserClient(), campaignId, settings);
      toast({ tone: 'success', title: 'Configurações de turno salvas.' });
      router.refresh();
    } catch (error) {
      toast({ tone: 'danger', title: 'As configurações não foram salvas', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id={`${id}-mode`}
          label="Modo padrão"
          hint="O modo pode ser trocado a qualquer momento na mesa do mestre."
          value={settings.defaultMode}
          disabled={disabled}
          onChange={(event) => setSettings((current) => ({ ...current, defaultMode: event.target.value as TurnMode }))}
        >
          {TURN_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {turnModeLabels[mode]}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`${id}-order`}
          label="Ordem dos turnos"
          hint="Pela iniciativa rolada ou na ordem que você definir."
          value={settings.defaultOrder}
          disabled={disabled}
          onChange={(event) => setSettings((current) => ({ ...current, defaultOrder: event.target.value as TurnOrderMode }))}
        >
          {TURN_ORDER_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {turnOrderModeLabels[mode]}
            </option>
          ))}
        </SelectField>
      </div>
      <CheckboxField
        id={`${id}-order-visible`}
        label="Jogadores veem a ordem completa"
        description="Desmarcado, eles só sabem de quem é a vez. Participantes ocultos nunca aparecem."
        checked={settings.playersSeeOrder}
        disabled={disabled}
        onChange={(event) => setSettings((current) => ({ ...current, playersSeeOrder: event.target.checked }))}
      />
      <div>
        <Button type="submit" loading={busy} disabled={disabled}>
          Salvar turnos
        </Button>
      </div>
    </form>
  );
}
