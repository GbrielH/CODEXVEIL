'use client';

import {
  callAccessModeLabels,
  createCallRoom,
  findCallRoom,
  listSessions,
  type CallAccessMode,
} from '@codexveil/database';
import { DoorOpen, Plus } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { callPath } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Criar sala (com campanha e sessão opcionais) e entrar por código ou link. */
export function CallStart({ campaigns }: { campaigns: { id: string; name: string }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<CallAccessMode>('open');
  const [campaignId, setCampaignId] = useState('');
  const [sessions, setSessions] = useState<{ id: string; label: string }[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  // Sessões da campanha escolhida (a transcrição saberá quem joga com quem).
  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    listSessions(getSupabaseBrowserClient(), campaignId)
      .then((list) => {
        if (!active) return;
        setSessions(
          list.map((session) => ({
            id: session.id,
            label: `Sessão ${session.number}: ${session.title}`,
          })),
        );
        const live = list.find((session) => session.status === 'in_progress') ?? list.at(-1);
        setSessionId(live?.id ?? '');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);

  const create = async () => {
    setBusy('create');
    try {
      const room = await createCallRoom(getSupabaseBrowserClient(), {
        title: title.trim(),
        accessMode: mode,
        campaignId: campaignId || null,
        sessionId: campaignId && sessionId ? sessionId : null,
      });
      router.push(callPath(room.slug) as Route);
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error, 'A sala não foi criada.') });
      setBusy(null);
    }
  };

  const join = async () => {
    // Aceita o código (RUNA-4821) ou o link inteiro (terminando no slug da sala).
    const ref = code.trim().split('/').filter(Boolean).at(-1) ?? '';
    if (!ref) return;
    setBusy('join');
    try {
      const room = await findCallRoom(getSupabaseBrowserClient(), ref);
      if (!room) {
        toast({ tone: 'warning', title: 'Nenhuma sala com esse código.' });
        setBusy(null);
        return;
      }
      router.push(callPath(room.slug) as Route);
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error, 'Não foi possível achar a sala.') });
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card ornate>
        <CardHeader
          icon={<Plus className="h-5 w-5" aria-hidden="true" />}
          title="Criar sala"
          description="Gera um link e um código para chamar o grupo."
        />
        <div className="flex flex-col gap-3">
          <TextField
            id="call-title"
            label="Nome da sala (opcional)"
            value={title}
            maxLength={80}
            placeholder="Ex.: Sessão 12, A Cripta"
            onChange={(event) => setTitle(event.target.value)}
          />
          <SelectField
            id="call-campaign"
            label="Campanha (opcional)"
            value={campaignId}
            onChange={(event) => {
              setCampaignId(event.target.value);
              if (!event.target.value) {
                setSessions([]);
                setSessionId('');
              }
            }}
          >
            <option value="">Sem campanha</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </SelectField>
          {campaignId && sessions.length ? (
            <SelectField
              id="call-session"
              label="Sessão"
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
            >
              <option value="">Nenhuma</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.label}
                </option>
              ))}
            </SelectField>
          ) : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-fg">Quem entra</legend>
            {(Object.keys(callAccessModeLabels) as CallAccessMode[]).map((key) => (
              <label key={key} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="call-mode"
                  checked={mode === key}
                  onChange={() => setMode(key)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-fg">{callAccessModeLabels[key].name}</span>
                  <span className="block text-xs text-fg-muted">
                    {callAccessModeLabels[key].hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <Button loading={busy === 'create'} onClick={() => void create()}>
            Criar e entrar
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader
          icon={<DoorOpen className="h-5 w-5" aria-hidden="true" />}
          title="Entrar numa sala"
          description="Cole o código (ex.: RUNA-4821) ou o link que receberam."
        />
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void join();
          }}
        >
          <TextField
            id="call-code"
            label="Código ou link"
            value={code}
            maxLength={200}
            placeholder="RUNA-4821"
            onChange={(event) => setCode(event.target.value)}
          />
          <Button
            type="submit"
            variant="secondary"
            loading={busy === 'join'}
            disabled={!code.trim()}
          >
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
