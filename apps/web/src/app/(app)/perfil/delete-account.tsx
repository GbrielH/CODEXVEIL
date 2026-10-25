'use client';

import { deleteMyAccount } from '@codexveil/database';
import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const CONFIRM_WORD = 'EXCLUIR';

/**
 * Exclusão da própria conta (LGPD). Pede a palavra de confirmação; se a pessoa for mestre
 * responsável de campanhas com outros participantes, mostra quais transferir antes.
 */
export function DeleteAccount() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ error: string; campaigns: string[] } | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setTyped('');
    setProblem(null);
  };

  const confirm = async () => {
    setBusy(true);
    const client = getSupabaseBrowserClient();
    const result = await deleteMyAccount(client);
    if (result.deleted) {
      await client.auth.signOut().catch(() => undefined);
      window.location.assign('/');
      return;
    }
    setProblem({ error: result.error, campaigns: result.campaigns });
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">
        Apaga a sua conta, os seus personagens, anotações e rolagens, e as campanhas em que você é o
        único participante. Não dá para desfazer.
      </p>
      <div>
        <Button
          variant="danger"
          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          onClick={() => setOpen(true)}
        >
          Excluir minha conta
        </Button>
      </div>
      <Modal open={open} onClose={close} title="Excluir a conta?" busy={busy}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed.trim().toUpperCase() === CONFIRM_WORD) void confirm();
          }}
        >
          <Alert tone="danger" title="Esta ação é definitiva">
            Seus personagens, anotações, rolagens e as campanhas em que só você participa serão
            apagados. Se você for o mestre responsável por uma campanha com outros jogadores,
            transfira-a antes (Configurações da campanha).
          </Alert>
          {problem ? (
            <Alert tone="warning" title="A conta não foi excluída">
              {problem.error}
              {problem.campaigns.length ? (
                <ul className="mt-2 list-disc pl-5">
                  {problem.campaigns.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : null}
            </Alert>
          ) : null}
          <TextField
            id={`${id}-confirmar`}
            label={`Digite ${CONFIRM_WORD} para confirmar`}
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={busy}
              disabled={typed.trim().toUpperCase() !== CONFIRM_WORD}
            >
              Excluir para sempre
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
