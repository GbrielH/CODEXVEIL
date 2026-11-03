'use client';

import { saveCharacterSheet } from '@codexveil/database';
import {
  TRIANGLE_QUALITIES,
  qualityBurnout,
  rechargeQualityAssurances,
  resolveTriangleRoll,
  spendQualityAssurances,
  triangleQualityLabels,
  type TriangleAgencySheet,
  type TriangleQuality,
  type TriangleRoll,
} from '@codexveil/rpg-systems/triangle-agency';
import { useState } from 'react';
import { DiceProvider, useDice } from '@/components/dice/dice-roller';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { SelectField, TextareaField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface Props {
  character: {
    id: string;
    name: string;
    version: number;
    campaign: { id: string; name: string } | null;
  };
  sheet: TriangleAgencySheet;
  permissions: { canEditSheet: boolean; canEditPlay: boolean; isGm: boolean; isOwner: boolean };
  variant?: 'full' | 'campaign';
}

export function TriangleAgencySheetScreen(props: Props) {
  return (
    <DiceProvider
      campaignId={props.variant === 'campaign' ? (props.character.campaign?.id ?? null) : null}
      characterId={props.character.id}
      enabled={props.permissions.canEditPlay}
      sessionGate={props.variant === 'campaign'}
    >
      <TriangleSheetBody {...props} />
    </DiceProvider>
  );
}

function TriangleSheetBody({ character, sheet: initial, permissions }: Props) {
  const { toast } = useToast();
  const dice = useDice();
  const [sheet, setSheet] = useState(initial);
  const [version, setVersion] = useState(character.version);
  const [tab, setTab] = useState('agencia');
  const [quality, setQuality] = useState<TriangleQuality>('atencao');
  const [spend, setSpend] = useState(0);
  const [lastRoll, setLastRoll] = useState<TriangleRoll | null>(null);

  const save = async (next: TriangleAgencySheet) => {
    const previous = sheet;
    setSheet(next);
    try {
      const saved = await saveCharacterSheet(getSupabaseBrowserClient(), character.id, version, {
        sheet: next,
      });
      setVersion(saved.version);
    } catch (error) {
      setSheet(previous);
      toast({
        tone: 'danger',
        title: 'A ficha não foi salva',
        description: failureMessage(error, 'Recarregue a página e tente de novo.'),
      });
    }
  };

  const roll = async () => {
    const shown = await dice?.roll({
      expression: '6d4',
      label: `Triangle Agency · ${triangleQualityLabels[quality]}`,
    });
    const values = shown?.dice.flatMap((group) => group.values) ?? [];
    if (values.length !== 6) return;
    const burnout = qualityBurnout(sheet, quality);
    const spent = spendQualityAssurances(sheet, quality, spend);
    const result = resolveTriangleRoll(values, spent.spent, burnout);
    setLastRoll(result);
    setSpend(0);
    if (spent.spent) await save(spent.sheet);
  };

  const updateNumber = (field: 'merits' | 'looseEnds' | 'deaths', value: number) =>
    void save({ ...sheet, [field]: value });

  return (
    <div className="flex flex-col gap-6">
      <Card ornate>
        <CardHeader
          title={character.name}
          description={[sheet.arc.anomaly, sheet.arc.reality, sheet.arc.competency]
            .filter(Boolean)
            .join(' · ')}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Counter
            label="Méritos"
            value={sheet.merits}
            min={-9999}
            onChange={(value) => updateNumber('merits', value)}
          />
          <Counter
            label="Pontas Soltas"
            value={sheet.looseEnds}
            min={0}
            onChange={(value) => updateNumber('looseEnds', value)}
          />
          <Counter
            label="Ressurreições"
            value={sheet.deaths}
            min={0}
            onChange={(value) => updateNumber('deaths', value)}
          />
        </div>
      </Card>
      <nav className="flex flex-wrap gap-2" aria-label="Seções da ficha">
        {[
          { value: 'agencia', label: 'Agência' },
          { value: 'arc', label: 'ARC' },
          { value: 'vida', label: 'Vida e Tempo' },
          { value: 'missao', label: 'Missão' },
        ].map((item) => (
          <Button
            key={item.value}
            variant={tab === item.value ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {tab === 'agencia' ? (
        <>
          <Card>
            <CardHeader
              title="Solicite à Agência / Habilidade Anômala"
              description="Sempre 6d4. Cada 3 conta; GQs ajustam dados e Burnout elimina 3s e aumenta o Caos."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="triangle-roll-quality"
                label="Qualidade"
                value={quality}
                onChange={(event) => {
                  setQuality(event.target.value as TriangleQuality);
                  setSpend(0);
                }}
              >
                {TRIANGLE_QUALITIES.map((key) => (
                  <option key={key} value={key}>
                    {triangleQualityLabels[key]} · {sheet.qualityAssurances.current[key]}/
                    {sheet.qualityAssurances.maximum[key]} GQs
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="triangle-roll-gq"
                label="GQs para transformar dados em 3"
                value={String(spend)}
                onChange={(event) => setSpend(Number(event.target.value))}
              >
                {Array.from(
                  { length: sheet.qualityAssurances.current[quality] + 1 },
                  (_, value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </SelectField>
            </div>
            {qualityBurnout(sheet, quality) ? (
              <Alert tone="warning">
                Esta jogada terá {qualityBurnout(sheet, quality)} Burnout.
              </Alert>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void roll()} disabled={!permissions.canEditPlay}>
                Jogar 6d4
              </Button>
              <Button
                variant="ghost"
                onClick={() => void save(rechargeQualityAssurances(sheet))}
                disabled={!permissions.canEditPlay}
              >
                Intermissão: recarregar GQs
              </Button>
            </div>
            {lastRoll ? (
              <div className="mt-4 rounded-md border border-line bg-sunken p-4">
                <p className="font-display text-xl">
                  {lastRoll.success ? 'Sucesso' : 'Falha'} · {lastRoll.chaos} Caos
                </p>
                <p className="text-sm text-fg-muted">
                  Dados: {lastRoll.dice.join(', ')} · 3s finais: {lastRoll.finalThrees}
                  {lastRoll.transcendence
                    ? ' · Triscendência'
                    : lastRoll.stability
                      ? ' · Estabilidade'
                      : ''}
                </p>
              </div>
            ) : null}
          </Card>
          <Card>
            <CardHeader title="Garantias de Qualidade" />
            <div className="grid gap-3 sm:grid-cols-3">
              {TRIANGLE_QUALITIES.map((key) => (
                <div key={key} className="rounded-md border border-line p-3">
                  <p className="font-medium">{triangleQualityLabels[key]}</p>
                  <p className="text-2xl">
                    {sheet.qualityAssurances.current[key]} / {sheet.qualityAssurances.maximum[key]}
                  </p>
                  {sheet.qualityAssurances.current[key] === 0 ? (
                    <p className="text-xs text-danger">Burnout ativo</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      {tab === 'arc' ? (
        <>
          <Card>
            <CardHeader title={`Anomalia · ${sheet.arc.anomaly || 'não definida'}`} />
            {sheet.anomalousAbilities.map((ability, index) => (
              <div key={index} className="border-t border-line py-3 first:border-0">
                <p className="font-medium">
                  {ability.name} · {triangleQualityLabels[ability.quality]}
                </p>
                <TextareaField
                  id={`triangle-ability-notes-${index}`}
                  label="Anotações"
                  value={ability.notes}
                  disabled={!permissions.canEditSheet}
                  onChange={(event) =>
                    setSheet({
                      ...sheet,
                      anomalousAbilities: sheet.anomalousAbilities.map((item, position) =>
                        position === index ? { ...item, notes: event.target.value } : item,
                      ),
                    })
                  }
                  onBlur={() => void save(sheet)}
                />
              </div>
            ))}
          </Card>
          <Card>
            <CardHeader title={`Realidade · ${sheet.arc.reality || 'não definida'}`} />
            <TextareaField
              id="triangle-reality-trigger"
              label="Gatilho de Realidade"
              value={sheet.reality.trigger}
              disabled={!permissions.canEditSheet}
              onChange={(event) =>
                setSheet({ ...sheet, reality: { ...sheet.reality, trigger: event.target.value } })
              }
              onBlur={() => void save(sheet)}
            />
            <TextareaField
              id="triangle-burnout-relief"
              label="Alívio de Burnout"
              value={sheet.reality.burnoutRelief}
              disabled={!permissions.canEditSheet}
              onChange={(event) =>
                setSheet({
                  ...sheet,
                  reality: { ...sheet.reality, burnoutRelief: event.target.value },
                })
              }
              onBlur={() => void save(sheet)}
            />
          </Card>
          <Card>
            <CardHeader title={`Competência · ${sheet.arc.competency || 'não definida'}`} />
            <TextareaField
              id="triangle-primary-directive"
              label="Diretriz Primária"
              value={sheet.competency.primaryDirective}
              disabled={!permissions.canEditSheet}
              onChange={(event) =>
                setSheet({
                  ...sheet,
                  competency: { ...sheet.competency, primaryDirective: event.target.value },
                })
              }
              onBlur={() => void save(sheet)}
            />
          </Card>
        </>
      ) : null}

      {tab === 'vida' ? (
        <>
          <Card>
            <CardHeader title="Relacionamentos" />
            {sheet.relationships.map((relationship, index) => (
              <div
                key={index}
                className="grid gap-3 border-t border-line py-3 first:border-0 sm:grid-cols-2"
              >
                <TextField
                  id={`triangle-relationship-name-${index}`}
                  label="Nome"
                  value={relationship.name}
                  disabled={!permissions.canEditSheet}
                  onChange={(event) =>
                    setSheet({
                      ...sheet,
                      relationships: sheet.relationships.map((item, position) =>
                        position === index ? { ...item, name: event.target.value } : item,
                      ),
                    })
                  }
                  onBlur={() => void save(sheet)}
                />
                <Counter
                  label="Conexão"
                  value={relationship.connection}
                  min={0}
                  max={9}
                  onChange={(connection) =>
                    void save({
                      ...sheet,
                      relationships: sheet.relationships.map((item, position) =>
                        position === index ? { ...item, connection } : item,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </Card>
          <Card>
            <CardHeader
              title="Equilíbrio entre Vida Profissional e Pessoal"
              description="Cada Tempo marcado torna uma caixa dos outros dois medidores indisponível."
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <p>
                Anomalia: {sheet.time.anomaly} marcadas · {sheet.time.unavailableAnomaly}{' '}
                indisponíveis
              </p>
              <p>
                Realidade: {sheet.time.reality} marcadas · {sheet.time.unavailableReality}{' '}
                indisponíveis
              </p>
              <p>
                Competência: {sheet.time.competency} marcadas · {sheet.time.unavailableCompetency}{' '}
                indisponíveis
              </p>
            </div>
          </Card>
        </>
      ) : null}

      {tab === 'missao' ? (
        <Card>
          <CardHeader title="Relatório de Missão" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="triangle-mission-codename"
              label="Codinome da Anomalia"
              value={sheet.mission.codename}
              onChange={(event) =>
                setSheet({ ...sheet, mission: { ...sheet.mission, codename: event.target.value } })
              }
              onBlur={() => void save(sheet)}
            />
            <SelectField
              id="triangle-mission-status"
              label="Status"
              value={sheet.mission.anomalyStatus ?? ''}
              onChange={(event) =>
                void save({
                  ...sheet,
                  mission: {
                    ...sheet.mission,
                    anomalyStatus: (event.target.value ||
                      null) as typeof sheet.mission.anomalyStatus,
                  },
                })
              }
            >
              <option value="">Não definido</option>
              <option value="capturada">Capturada</option>
              <option value="neutralizada">Neutralizada</option>
              <option value="perdida">Perdida</option>
              <option value="outro">Outro</option>
            </SelectField>
            <TextareaField
              id="triangle-mission-behavior"
              label="Comportamento"
              value={sheet.mission.anomalyBehavior}
              onChange={(event) =>
                setSheet({
                  ...sheet,
                  mission: { ...sheet.mission, anomalyBehavior: event.target.value },
                })
              }
              onBlur={() => void save(sheet)}
            />
            <TextareaField
              id="triangle-mission-focus"
              label="Foco"
              value={sheet.mission.anomalyFocus}
              onChange={(event) =>
                setSheet({
                  ...sheet,
                  mission: { ...sheet.mission, anomalyFocus: event.target.value },
                })
              }
              onBlur={() => void save(sheet)}
            />
            <TextareaField
              id="triangle-mission-domain"
              label="Domínio"
              value={sheet.mission.anomalyDomain}
              onChange={(event) =>
                setSheet({
                  ...sheet,
                  mission: { ...sheet.mission, anomalyDomain: event.target.value },
                })
              }
              onBlur={() => void save(sheet)}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Counter({
  label,
  value,
  min,
  max = 99999,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-line p-3">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => onChange(Math.max(min, value - 1))}>
          −
        </Button>
        <strong>{value}</strong>
        <Button variant="ghost" size="sm" onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </Button>
      </div>
    </div>
  );
}
