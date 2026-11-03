'use client';

import {
  TRIANGLE_ANOMALIES,
  TRIANGLE_COMPETENCIES,
  TRIANGLE_QUALITIES,
  TRIANGLE_REALITIES,
  creationIssues,
  createDefaultTriangleAgencySheet,
  triangleQualityLabels,
  type TriangleAgencySheet,
} from '@codexveil/rpg-systems/triangle-agency';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { createTriangleAgencyCharacterAction } from '@/app/(app)/personagens/actions-triangle-agency';
import {
  CreationAnswersFields,
  answersComplete,
  answersFor,
} from '@/components/characters/creation-answers';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextareaField, TextField } from '@/components/ui/field';
import { characterPath } from '@/lib/routes';

interface CampaignInfo {
  id: string;
  name: string;
  questions: readonly string[];
}

export function TriangleAgencyCreationWizard({ campaign }: { campaign: CampaignInfo | null }) {
  const router = useRouter();
  const npcCampaignId = useSearchParams().get('npc');
  const [name, setName] = useState('');
  const [sheet, setSheet] = useState<TriangleAgencySheet>(() => {
    const base = createDefaultTriangleAgencySheet();
    return {
      ...base,
      anomalousAbilities: TRIANGLE_QUALITIES.slice(0, 3).map((quality) => ({
        name: '',
        quality,
        notes: '',
      })),
      relationships: [1, 2, 3].map(() => ({ name: '', description: '', connection: 0, bonus: '' })),
    };
  });
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questions = campaign?.questions ?? [];
  const issues = creationIssues(sheet);
  const gqTotal = Object.values(sheet.qualityAssurances.maximum).reduce(
    (sum, value) => sum + value,
    0,
  );

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await createTriangleAgencyCharacterAction({
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
        <p className="eyebrow">Integração da Agência</p>
        <h2 className="mt-1 text-2xl">Construa o ARC do Agente</h2>
        <p className="mt-2 text-sm text-fg-muted">
          Anomalia, Realidade e Competência são escolhas próprias de Triangle Agency. O texto
          integral das opções fica no livro importado.
        </p>
      </header>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <section className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="triangle-name"
          label="Nome do Agente"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          required
        />
        <TextField
          id="triangle-pronouns"
          label="Pronomes"
          value={sheet.identity.pronouns}
          onChange={(event) =>
            setSheet({ ...sheet, identity: { ...sheet.identity, pronouns: event.target.value } })
          }
          maxLength={80}
        />
        <SelectField
          id="triangle-anomaly"
          label="Anomalia"
          value={sheet.arc.anomaly}
          onChange={(event) =>
            setSheet({ ...sheet, arc: { ...sheet.arc, anomaly: event.target.value } })
          }
        >
          <option value="">Selecione</option>
          {TRIANGLE_ANOMALIES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </SelectField>
        <SelectField
          id="triangle-reality"
          label="Realidade"
          value={sheet.arc.reality}
          onChange={(event) =>
            setSheet({ ...sheet, arc: { ...sheet.arc, reality: event.target.value } })
          }
        >
          <option value="">Selecione</option>
          {TRIANGLE_REALITIES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </SelectField>
        <SelectField
          id="triangle-competency"
          label="Competência"
          value={sheet.arc.competency}
          onChange={(event) =>
            setSheet({
              ...sheet,
              arc: {
                ...sheet.arc,
                competency: event.target.value,
                competencyTitle: event.target.value,
              },
            })
          }
        >
          <option value="">Selecione</option>
          {TRIANGLE_COMPETENCIES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </SelectField>
        <TextField
          id="triangle-salary"
          label="Salário anual"
          value={sheet.identity.annualSalary}
          onChange={(event) =>
            setSheet({
              ...sheet,
              identity: { ...sheet.identity, annualSalary: event.target.value },
            })
          }
          maxLength={120}
        />
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-5">
        <h3 className="font-display text-xl">3 Habilidades Anômalas</h3>
        {sheet.anomalousAbilities.map((ability, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-md border border-line p-4 sm:grid-cols-[1fr_14rem]"
          >
            <TextField
              id={`triangle-ability-${index}`}
              label={`Habilidade ${index + 1}`}
              value={ability.name}
              onChange={(event) =>
                setSheet({
                  ...sheet,
                  anomalousAbilities: sheet.anomalousAbilities.map((item, position) =>
                    position === index ? { ...item, name: event.target.value } : item,
                  ),
                })
              }
            />
            <SelectField
              id={`triangle-ability-quality-${index}`}
              label="Qualidade"
              value={ability.quality}
              onChange={(event) =>
                setSheet({
                  ...sheet,
                  anomalousAbilities: sheet.anomalousAbilities.map((item, position) =>
                    position === index
                      ? { ...item, quality: event.target.value as typeof item.quality }
                      : item,
                  ),
                })
              }
            >
              {TRIANGLE_QUALITIES.map((quality) => (
                <option key={quality} value={quality}>
                  {triangleQualityLabels[quality]}
                </option>
              ))}
            </SelectField>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-5">
        <div>
          <h3 className="font-display text-xl">Garantias de Qualidade</h3>
          <p className="text-sm text-fg-muted">
            Distribua 9 GQs entre exatamente 3 Qualidades. Total: {gqTotal}/9.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {TRIANGLE_QUALITIES.map((quality) => (
            <SelectField
              id={`triangle-gq-${quality}`}
              key={quality}
              label={triangleQualityLabels[quality]}
              value={String(sheet.qualityAssurances.maximum[quality])}
              onChange={(event) => {
                const value = Number(event.target.value);
                setSheet({
                  ...sheet,
                  qualityAssurances: {
                    maximum: { ...sheet.qualityAssurances.maximum, [quality]: value },
                    current: { ...sheet.qualityAssurances.current, [quality]: value },
                  },
                });
              }}
            >
              {Array.from({ length: 10 }, (_, value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectField>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-5">
        <h3 className="font-display text-xl">3 Relacionamentos</h3>
        {sheet.relationships.map((relationship, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-2">
            <TextField
              id={`triangle-relationship-${index}`}
              label={`Relacionamento ${index + 1}`}
              value={relationship.name}
              onChange={(event) =>
                setSheet({
                  ...sheet,
                  relationships: sheet.relationships.map((item, position) =>
                    position === index ? { ...item, name: event.target.value } : item,
                  ),
                })
              }
            />
            <TextField
              id={`triangle-relationship-description-${index}`}
              label="Quem é / vínculo"
              value={relationship.description}
              onChange={(event) =>
                setSheet({
                  ...sheet,
                  relationships: sheet.relationships.map((item, position) =>
                    position === index ? { ...item, description: event.target.value } : item,
                  ),
                })
              }
            />
          </div>
        ))}
      </section>

      <section className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <TextareaField
          id="triangle-anomaly-contact"
          label="Como entrou em contato com a Anomalia?"
          value={sheet.identity.anomalyContact}
          onChange={(event) =>
            setSheet({
              ...sheet,
              identity: { ...sheet.identity, anomalyContact: event.target.value },
            })
          }
        />
        <TextareaField
          id="triangle-agency-contact"
          label="Como a Agência encontrou o Agente?"
          value={sheet.identity.agencyContact}
          onChange={(event) =>
            setSheet({
              ...sheet,
              identity: { ...sheet.identity, agencyContact: event.target.value },
            })
          }
        />
        <TextareaField
          id="triangle-appearance"
          label="Aparência"
          value={sheet.identity.appearance}
          onChange={(event) =>
            setSheet({ ...sheet, identity: { ...sheet.identity, appearance: event.target.value } })
          }
        />
      </section>
      {questions.length ? (
        <CreationAnswersFields questions={questions} values={answers} onChange={setAnswers} />
      ) : null}
      {issues.length || !name.trim() ? (
        <Alert tone="warning" title="Integração pendente">
          <ul className="list-disc pl-4">
            {!name.trim() ? <li>Dê um nome ao Agente.</li> : null}
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <div className="flex justify-end">
        <Button
          onClick={() => void submit()}
          loading={busy}
          disabled={
            busy || !name.trim() || issues.length > 0 || !answersComplete(questions, answers)
          }
        >
          Concluir integração
        </Button>
      </div>
    </div>
  );
}
