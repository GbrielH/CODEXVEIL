'use client';

import { acceptFriend, removeFriend, requestFriend, type Friend, type KnownPerson } from '@codexveil/database';
import { Check, UserMinus, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CopyButton } from '@/components/ui/copy-button';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

function PersonRow({ name, icon, children }: { name: string; icon: KnownPerson['avatarIcon']; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar name={name} icon={icon} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm text-fg">{name}</span>
      <span className="flex shrink-0 gap-2">{children}</span>
    </li>
  );
}

/** Código de amigo, pedidos, amigos e sugestões (quem já joga com você). */
export function FriendsPanel({ code, friends, known }: { code: string; friends: Friend[]; known: KnownPerson[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const run = async (key: string, task: () => Promise<string | void>) => {
    setBusy(key);
    try {
      const message = await task();
      if (message) toast({ tone: 'success', title: message });
      router.refresh();
    } catch (cause) {
      toast({ tone: 'danger', title: failureMessage(cause, 'Não foi possível concluir.') });
    } finally {
      setBusy(null);
    }
  };

  const added = (status: 'pending' | 'accepted') => (status === 'accepted' ? 'Agora vocês são amigos!' : 'Pedido enviado.');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    void run('code', async () => {
      const status = await requestFriend(getSupabaseBrowserClient(), { code: value });
      setDraft('');
      return added(status);
    });
  };

  const incoming = friends.filter((friend) => friend.status === 'incoming');
  const accepted = friends.filter((friend) => friend.status === 'accepted');
  const outgoing = friends.filter((friend) => friend.status === 'outgoing');
  const linked = new Set(friends.map((friend) => friend.userId));
  const suggestions = known.filter((person) => !linked.has(person.userId));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
      <div className="flex flex-col gap-6">
        <Card ornate>
          <CardHeader title="Seu código de amigo" description="Passe para quem você quer adicionar." />
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl tracking-[0.2em] text-fg-accent tabular">{code}</span>
            <CopyButton value={code} label="Copiar" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Adicionar amigo" description="Digite o código de amigo da pessoa." />
          <form onSubmit={submit} className="flex gap-2">
            <input
              aria-label="Código de amigo"
              value={draft}
              onChange={(event) => setDraft(event.target.value.toUpperCase())}
              maxLength={12}
              placeholder="Ex.: K7M2QXPA"
              className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 font-display tracking-[0.15em] text-fg uppercase"
            />
            <Button type="submit" loading={busy === 'code'} icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}>
              Enviar
            </Button>
          </form>
        </Card>
        {suggestions.length ? (
          <Card>
            <CardHeader title="Quem joga com você" description="Pessoas das suas campanhas. Adicione com um clique." />
            <ul className="divide-y divide-line">
              {suggestions.map((person) => (
                <PersonRow key={person.userId} name={person.displayName} icon={person.avatarIcon}>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === person.userId}
                    onClick={() => void run(person.userId, async () => added(await requestFriend(getSupabaseBrowserClient(), { userId: person.userId })))}
                  >
                    Adicionar
                  </Button>
                </PersonRow>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        {incoming.length ? (
          <Card ornate>
            <CardHeader title="Pedidos recebidos" />
            <ul className="divide-y divide-line">
              {incoming.map((friend) => (
                <PersonRow key={friend.friendshipId} name={friend.displayName} icon={friend.avatarIcon}>
                  <Button
                    size="sm"
                    loading={busy === friend.friendshipId}
                    icon={<Check className="h-4 w-4" aria-hidden="true" />}
                    onClick={() =>
                      void run(friend.friendshipId, async () => {
                        await acceptFriend(getSupabaseBrowserClient(), friend.friendshipId);
                        return 'Agora vocês são amigos!';
                      })
                    }
                  >
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    icon={<X className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => void run(`x-${friend.friendshipId}`, () => removeFriend(getSupabaseBrowserClient(), friend.friendshipId))}
                  >
                    Recusar
                  </Button>
                </PersonRow>
              ))}
            </ul>
          </Card>
        ) : null}
        <Card>
          <CardHeader
            title={`Amigos (${accepted.length})`}
            description="Amigos podem ser convidados direto para suas campanhas e ver as fichas que você compartilhar."
          />
          {accepted.length ? (
            <ul className="divide-y divide-line">
              {accepted.map((friend) => (
                <PersonRow key={friend.friendshipId} name={friend.displayName} icon={friend.avatarIcon}>
                  <ConfirmDialog
                    trigger={(open) => (
                      <Button size="sm" variant="ghost" onClick={open} icon={<UserMinus className="h-4 w-4" aria-hidden="true" />}>
                        Desfazer
                      </Button>
                    )}
                    title={`Desfazer a amizade com ${friend.displayName}?`}
                    description="As fichas compartilhadas entre vocês deixam de aparecer. Convites já enviados continuam valendo."
                    confirmLabel="Desfazer"
                    onConfirm={() => run(friend.friendshipId, () => removeFriend(getSupabaseBrowserClient(), friend.friendshipId))}
                  />
                </PersonRow>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Nenhum amigo ainda. Envie seu código ou adicione quem joga com você.</p>
          )}
        </Card>
        {outgoing.length ? (
          <Card>
            <CardHeader title="Pedidos enviados" description="Aguardando a outra pessoa aceitar." />
            <ul className="divide-y divide-line">
              {outgoing.map((friend) => (
                <PersonRow key={friend.friendshipId} name={friend.displayName} icon={friend.avatarIcon}>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === friend.friendshipId}
                    onClick={() => void run(friend.friendshipId, () => removeFriend(getSupabaseBrowserClient(), friend.friendshipId))}
                  >
                    Cancelar
                  </Button>
                </PersonRow>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
