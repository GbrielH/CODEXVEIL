'use client';

import {
  createDefaultOrdem2Sheet,
  ordem2CreationIssues,
  type Ordem2Setting,
  type Ordem2Sheet,
} from '@codexveil/rpg-systems/ordem2';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { createOrdem2CharacterAction } from '@/app/(app)/personagens/actions-ordem2';
import {
  CreationAnswersFields,
  answersComplete,
  answersFor,
} from '@/components/characters/creation-answers';
import {
  Ordem2GearEditor,
  Ordem2IdentityEditor,
  Ordem2RelationsEditor,
  Ordem2StatsEditor,
} from '@/components/sheets/ordem2/editor';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextareaField, TextField } from '@/components/ui/field';
import { characterPath } from '@/lib/routes';

interface CampaignInfo {
  id: string;
  name: string;
  setting: Ordem2Setting;
  questions: readonly string[];
}

/**
 * Criação de agente do Ordem Paranormal 2. O playtest não traz regras de criação (só personagens
 * prontos): o jogador copia a ficha pronta que escolheu ou monta uma com o mestre.
 */
export function Ordem2CreationWizard({ campaign }: { campaign: CampaignInfo | null }) {
  const router = useRouter();
  const npcCampaignId = useSearchParams().get('npc');
  const [name, setName] = useState('');
  const [sheet, setSheet] = useState<Ordem2Sheet>(() =>
    createDefaultOrdem2Sheet(campaign?.setting ?? 'moderno'),
  );
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questions = campaign?.questions ?? [];
  const issues = ordem2CreationIssues(sheet);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await createOrdem2CharacterAction({
      npcCampaignId,
      campaignId: campaign?.id ?? null,
      name,
      sheet,
      answers: answersFor(questions, answers),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    router.push(
      (npcCampaignId
        ? `/campanhas/${npcCampaignId}/biblioteca`
        : `${characterPath(result.characterId)}?aviso=personagem-criado`) as Route,
    );
  };

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="eyebrow">Ordo Realitas</p>
        <h2 className="mt-1 text-2xl">Ficha do agente</h2>
        <p className="mt-2 text-sm text-fg-muted">
          O playtest traz personagens prontos: copie aqui a ficha escolhida (perfil, vocação, dados
          de atributos e perícias, PV, PD, habilidades e equipamento) ou monte uma com o mestre.
        </p>
      </header>
      <TextField
        id="ordem2-name"
        label="Nome"
        required
        maxLength={80}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Ordem2IdentityEditor sheet={sheet} onChange={setSheet} lockSetting={Boolean(campaign)} />
      <Ordem2StatsEditor sheet={sheet} onChange={setSheet} />
      <Ordem2GearEditor sheet={sheet} onChange={setSheet} />
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg">Relações</h3>
        <Ordem2RelationsEditor sheet={sheet} onChange={setSheet} />
      </section>
      <TextareaField
        id="ordem2-history"
        label="Histórico"
        rows={5}
        maxLength={12000}
        value={sheet.identity.history}
        onChange={(event) =>
          setSheet({ ...sheet, identity: { ...sheet.identity, history: event.target.value } })
        }
      />
      {questions.length ? (
        <CreationAnswersFields questions={questions} values={answers} onChange={setAnswers} />
      ) : null}
      {issues.length || !name.trim() ? (
        <Alert tone="warning" title="Falta pouco">
          <ul className="list-disc pl-4">
            {!name.trim() ? <li>Dê um nome ao agente.</li> : null}
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end">
        <Button
          onClick={() => void submit()}
          loading={busy}
          disabled={
            busy || !name.trim() || issues.length > 0 || !answersComplete(questions, answers)
          }
        >
          Criar agente
        </Button>
      </div>
    </div>
  );
}
