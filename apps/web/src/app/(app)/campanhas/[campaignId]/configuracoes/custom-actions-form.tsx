'use client';

import { updateCampaignCustomActions, type CustomAction } from '@codexveil/database';
import { parseDiceExpression, turnActionKindLabels } from '@codexveil/domain';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SelectField, TextareaField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const KINDS: CustomAction['kind'][] = ['action', 'bonus_action', 'reaction', 'movement', 'free'];

/** Ações de combate criadas pelo mestre: aparecem para os jogadores na hora do turno. */
export function CustomActionsForm({ campaignId, initial, disabled }: { campaignId: string; initial: CustomAction[]; disabled: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const id = useId();
  const [actions, setActions] = useState(initial);
  const [draft, setDraft] = useState<Omit<CustomAction, 'id'>>({ name: '', kind: 'action', description: '', roll: '' });
  const [busy, setBusy] = useState(false);
  const rollInvalid = draft.roll.trim() !== '' && parseDiceExpression(draft.roll.trim()) === null;

  const save = async (next: CustomAction[]) => {
    setBusy(true);
    try {
      await updateCampaignCustomActions(getSupabaseBrowserClient(), campaignId, next);
      setActions(next);
      toast({ tone: 'success', title: 'Ações de combate salvas.' });
      router.refresh();
      return true;
    } catch (error) {
      toast({ tone: 'danger', title: 'As ações não foram salvas', description: failureMessage(error, 'Tente novamente.') });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!draft.name.trim() || rollInvalid) return;
    const created: CustomAction = { id: crypto.randomUUID(), name: draft.name.trim(), kind: draft.kind, description: draft.description.trim(), roll: draft.roll.trim() };
    if (await save([...actions, created])) setDraft({ name: '', kind: 'action', description: '', roll: '' });
  };

  return (
    <div className="flex flex-col gap-4">
      {actions.length === 0 ? <p className="text-sm text-fg-muted">Nenhuma ação personalizada ainda.</p> : null}
      <ul className="flex flex-col gap-2">
        {actions.map((action) => (
          <li key={action.id} className="flex items-start gap-3 rounded-md border border-line px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                {action.name} <span className="text-xs text-fg-muted">· {turnActionKindLabels[action.kind]}{action.roll ? ` · 🎲 ${action.roll}` : ''}</span>
              </p>
              {action.description ? <p className="text-xs text-fg-secondary">{action.description}</p> : null}
            </div>
            <Button
              size="icon"
              variant="ghost"
              disabled={disabled || busy}
              aria-label={`Remover ${action.name}`}
              onClick={() => void save(actions.filter((entry) => entry.id !== action.id))}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      {!disabled ? (
        <div className="grid gap-3 rounded-md border border-dashed border-line-strong p-3 sm:grid-cols-2">
          <TextField id={`${id}-name`} label="Nome da ação" maxLength={80} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Empurrar da ponte" />
          <SelectField id={`${id}-kind`} label="Tipo" value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as CustomAction['kind'] }))}>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {turnActionKindLabels[kind]}
              </option>
            ))}
          </SelectField>
          <TextField
            id={`${id}-roll`}
            label="Dado (opcional)"
            maxLength={40}
            value={draft.roll}
            onChange={(event) => setDraft((current) => ({ ...current, roll: event.target.value }))}
            placeholder="Ex.: 1d20+3"
            error={rollInvalid ? 'Expressão de dados inválida.' : undefined}
          />
          <TextareaField
            id={`${id}-description`}
            label="Descrição"
            rows={2}
            maxLength={1000}
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="O que a ação faz e quando usar."
          />
          <div className="sm:col-span-2">
            <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} loading={busy} disabled={!draft.name.trim() || rollInvalid} onClick={() => void add()}>
              Adicionar ação
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
